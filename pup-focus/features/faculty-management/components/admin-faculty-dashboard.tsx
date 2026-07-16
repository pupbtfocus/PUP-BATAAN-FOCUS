"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { AdminAcademicTerms } from "@/features/admin-management/components/admin-academic-terms";
import {
  REQUIREMENT_LABEL,
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
} from "@/config/compliance";
import { buildFacultyInitials } from "@/lib/faculty-profile";
import {
  facultyAccountSchema,
  type FacultyAccountFormInput,
} from "@/features/faculty-management/schemas/faculty-account.schema";

type RequirementStatus = "not_submitted" | "uploaded" | "validated";
type SemesterOption = "1st Semester" | "2nd Semester";

type AdminSection =
  | "dashboard"
  | "facultyManagement"
  | "requirements"
  | "submissionWindow"
  | "academicTerms"
  | "details";

type FacultyAccount = {
  id: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  is_active: boolean;
  created_at: string;
  requirementStatus: Record<RequirementCode, RequirementStatus>;
};

type PendingFacultyAction = {
  kind: "delete" | "deactivate";
  facultyId: string;
};

type CreateFacultyResult = {
  success?: boolean;
  error?: string;
  invited?: boolean;
  sent?: boolean;
  sendError?: string | null;
  link?: string | null;
  user?: {
    email: string;
    fullName: string;
  };
};

const SEMESTER_OPTIONS: SemesterOption[] = ["1st Semester", "2nd Semester"];
const LOGIN_PAGE_IMAGES = [
  "/images/attachments/IMG_9399.jpeg",
  "/images/attachments/IMG_9402.jpeg",
];

function toTimeInputValue(timeLabel: string): string | null {
  const match = timeLabel
    .trim()
    .match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i);

  if (!match) {
    return null;
  }

  const hour12 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();

  const hour24 =
    period === "AM"
      ? hour12 === 12
        ? 0
        : hour12
      : hour12 === 12
        ? 12
        : hour12 + 12;

  return `${hour24.toString().padStart(2, "0")}:${minute}`;
}

function toTimeLabel(timeInput: string): string | null {
  const match = timeInput.trim().match(/^([01][0-9]|2[0-3]):([0-5][0-9])$/);

  if (!match) {
    return null;
  }

  const hour24 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${minute} ${period}`;
}

function toAcademicYearAndSemester(dateInput: string | null | undefined): {
  academicYear: string;
  semester: SemesterOption;
} {
  const parsed = dateInput ? new Date(dateInput) : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return {
      academicYear: "",
      semester: "1st Semester",
    };
  }

  const month = parsed.getMonth() + 1;
  const year = parsed.getFullYear();
  const startsSchoolYear = month >= 6;

  return {
    academicYear: startsSchoolYear
      ? `${year}-${year + 1}`
      : `${year - 1}-${year}`,
    semester: startsSchoolYear ? "1st Semester" : "2nd Semester",
  };
}

function formatSubmittedDateTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCurrentYearInManila(): number {
  const yearText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
  }).format(new Date());

  return Number(yearText);
}

function buildAcademicYearOptions(): string[] {
  const currentYear = getCurrentYearInManila();
  const firstYear = 2026;
  const lastYear = Math.max(currentYear, firstYear);

  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const startYear = firstYear + index;
    return `${startYear}-${startYear + 1}`;
  });
}

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

function statusTone(status: RequirementStatus): string {
  if (status === "validated") {
    return "text-green-400";
  }

  if (status === "uploaded") {
    return "text-yellow-400";
  }

  return "text-red-400";
}

export function AdminFacultyDashboard({
  adminName,
}: {
  adminName?: string | null;
}) {
  const [facultyAccounts, setFacultyAccounts] = useState<FacultyAccount[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(
    null,
  );
  const [activeSection, setActiveSection] =
    useState<AdminSection>("facultyManagement");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [addFacultyModalOpen, setAddFacultyModalOpen] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageInputKey, setProfileImageInputKey] = useState(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalMessage, setInviteModalMessage] = useState("");
  const [inviteWasSent, setInviteWasSent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingFacultyIds, setLoadingFacultyIds] = useState<Set<string>>(
    new Set(),
  );
  const [deletingFacultyIds, setDeletingFacultyIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingFacultyAction, setPendingFacultyAction] =
    useState<PendingFacultyAction | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsFacultyId, setDetailsFacultyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [facultyActionError, setFacultyActionError] = useState<string | null>(
    null,
  );
  const [verificationResetTrigger, setVerificationResetTrigger] = useState(0);

  useEffect(() => {
    void loadFacultyFromDatabase();
  }, []);

  async function loadFacultyFromDatabase() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/faculty/list");
      if (response.ok) {
        const data = await response.json();
        setFacultyAccounts(data.faculty || []);
      }
    } catch {
      // Error handled by UI state
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshCurrentPanel() {
    await loadFacultyFromDatabase();
  }

  const form = useForm<FacultyAccountFormInput>({
    resolver: zodResolver(facultyAccountSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
    },
  });

  const selectedFaculty = useMemo(
    () =>
      facultyAccounts.find((faculty) => faculty.id === selectedFacultyId) ??
      null,
    [facultyAccounts, selectedFacultyId],
  );

  const pendingFaculty = useMemo(
    () =>
      pendingFacultyAction
        ? (facultyAccounts.find(
            (faculty) => faculty.id === pendingFacultyAction.facultyId,
          ) ?? null)
        : null,
    [facultyAccounts, pendingFacultyAction],
  );

  async function confirmPendingFacultyAction() {
    if (!pendingFacultyAction) {
      return;
    }

    const { kind, facultyId } = pendingFacultyAction;
    setPendingFacultyAction(null);

    if (kind === "delete") {
      await performDeleteFaculty(facultyId);
      return;
    }

    await performDeactivateFaculty(facultyId);
  }

  async function onAddFaculty(input: FacultyAccountFormInput) {
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const payload = new FormData();
      payload.append("firstName", input.firstName);
      payload.append("middleName", input.middleName);
      payload.append("lastName", input.lastName);
      payload.append("email", input.email);

      if (profileImageFile) {
        payload.append("profileImage", profileImageFile);
      }

      const response = await fetch("/api/admin/faculty/create", {
        method: "POST",
        body: payload,
      });

      const data = (await response.json()) as CreateFacultyResult;

      if (!response.ok) {
        setCreateError(data.error ?? "Failed to send faculty invite");
        setIsCreating(false);
        return;
      }

      const invitedEmail = data.user?.email ?? input.email;
      setInviteWasSent(Boolean(data.sent));
      const inviteMessage = data.sent
        ? `Invitation email sent to ${invitedEmail}. Please ask them to verify their email and check their inbox.`
        : data.link
          ? `Invite link generated for ${invitedEmail}. Email delivery failed: ${data.sendError ?? "SMTP is not available"}\n\n${data.link}`
          : `Invite could not be sent for ${invitedEmail}.`;

      setCreateSuccess(inviteMessage);
      setInviteModalMessage(inviteMessage);
      setInviteModalOpen(true);
      setAddFacultyModalOpen(false);
      form.reset({ firstName: "", middleName: "", lastName: "", email: "" });
      setProfileImageFile(null);
      setProfileImageInputKey((value) => value + 1);

      // Refresh faculty list from database
      await loadFacultyFromDatabase();
    } catch (error) {
      setCreateError("An error occurred while creating the faculty account");
    } finally {
      setIsCreating(false);
    }
  }

  function onDeleteFaculty(facultyId: string) {
    setPendingFacultyAction({ kind: "delete", facultyId });
  }

  async function performDeleteFaculty(facultyId: string) {
    setDeletingFacultyIds((prev) => new Set(prev).add(facultyId));
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      const response = await fetch("/api/admin/faculty/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        if (response.ok) {
          // Success response that's not JSON - treat as success
          setFacultyAccounts((prev) =>
            prev.filter((faculty) => faculty.id !== facultyId),
          );
          if (selectedFacultyId === facultyId) {
            setSelectedFacultyId(null);
          }
          setDeleteSuccess("Faculty account deleted successfully");
          await loadFacultyFromDatabase();
        } else {
          setDeleteError(
            `Failed to delete faculty account (HTTP ${response.status})`,
          );
        }
        return;
      }

      if (response.ok) {
        setFacultyAccounts((prev) =>
          prev.filter((faculty) => faculty.id !== facultyId),
        );
        if (selectedFacultyId === facultyId) {
          setSelectedFacultyId(null);
        }
        setDeleteSuccess("Faculty account deleted successfully");
        // Refresh from database
        await loadFacultyFromDatabase();
      } else {
        setDeleteError(data.error || "Failed to delete faculty account");
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "An error occurred while deleting the faculty account",
      );
    } finally {
      setDeletingFacultyIds((prev) => {
        const next = new Set(prev);
        next.delete(facultyId);
        return next;
      });
    }
  }

  function onDeactivateFaculty(facultyId: string) {
    setPendingFacultyAction({ kind: "deactivate", facultyId });
  }

  async function performDeactivateFaculty(facultyId: string) {
    setLoadingFacultyIds((prev) => new Set(prev).add(facultyId));
    setFacultyActionError(null);

    try {
      const response = await fetch("/api/admin/faculty/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      if (!response.ok) {
        let message = `Failed to deactivate faculty account (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          // Keep default message.
        }
        setFacultyActionError(message);
        return;
      }

      setFacultyAccounts((prev) =>
        prev.map((faculty) =>
          faculty.id === facultyId ? { ...faculty, is_active: false } : faculty,
        ),
      );
      await loadFacultyFromDatabase();
    } catch (error) {
      setFacultyActionError(
        error instanceof Error
          ? error.message
          : "An error occurred while deactivating the faculty account",
      );
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
    setFacultyActionError(null);

    try {
      const response = await fetch("/api/admin/faculty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      if (!response.ok) {
        let message = `Failed to activate faculty account (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          // Keep default message.
        }
        setFacultyActionError(message);
        return;
      }

      setFacultyAccounts((prev) =>
        prev.map((faculty) =>
          faculty.id === facultyId ? { ...faculty, is_active: true } : faculty,
        ),
      );
      await loadFacultyFromDatabase();
    } catch (error) {
      setFacultyActionError(
        error instanceof Error
          ? error.message
          : "An error occurred while activating the faculty account",
      );
    } finally {
      setLoadingFacultyIds((prev) => {
        const next = new Set(prev);
        next.delete(facultyId);
        return next;
      });
    }
  }

  return (
    <div className="relative flex min-h-full w-full items-stretch gap-0">
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 overflow-y-auto rounded-r-2xl border border-l-0 border-slate-700 bg-slate-900 p-5 shadow-lg">
        <div className="my-6 rounded-xl bg-[var(--card)] p-4 text-[var(--accent)] flex flex-col items-center">
          <p className="mt-2 font-semibold text-white text-center">
            {adminName ?? "Admin"}
          </p>

          <div className="my-2 h-px w-full bg-slate-700" />

          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--accent)] text-center">
            Admin
          </p>
        </div>

        <nav className="mt-6 space-y-2">
          <SidebarButton
            active={activeSection === "dashboard"}
            title="Dashboard"
            onClick={() => setActiveSection("dashboard")}
          />
          <SidebarButton
            active={activeSection === "facultyManagement"}
            title="Faculty Management"
            onClick={() => setActiveSection("facultyManagement")}
          />
          <SidebarButton
            active={activeSection === "requirements"}
            title="Requirements Verification"
            onClick={() => setActiveSection("requirements")}
          />
          <SidebarButton
            active={activeSection === "submissionWindow"}
            title="Submission Window"
            onClick={() => setActiveSection("submissionWindow")}
          />
          <SidebarButton
            active={activeSection === "academicTerms"}
            title="Academic Term Management"
            onClick={() => setActiveSection("academicTerms")}
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
                    src={LOGIN_PAGE_IMAGES[0]}
                    alt="PUP Bataan login background"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    style={{ animation: "backgroundFadeA 16s infinite linear" }}
                  />
                  <Image
                    src={LOGIN_PAGE_IMAGES[1]}
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

            {activeSection === "facultyManagement" ? (
              <article className="space-y-6 p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-block w-max rounded-xl border border-slate-700 bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-amber-300">
                      Faculty Management
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshCurrentPanel()}
                    disabled={isLoading}
                  >
                    {isLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <section className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg shadow-black/20">
                  <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-[#fff8e7]">
                        Faculty List
                      </h4>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        setCreateError(null);
                        setCreateSuccess(null);
                        setAddFacultyModalOpen(true);
                      }}
                    >
                      Add Faculty
                    </Button>
                  </div>

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
                    deletingFacultyIds={deletingFacultyIds}
                    deleteError={deleteError}
                    deleteSuccess={deleteSuccess}
                    facultyActionError={facultyActionError}
                    onClearDeleteMessages={() => {
                      setDeleteError(null);
                      setDeleteSuccess(null);
                      setFacultyActionError(null);
                    }}
                  />
                </section>
              </article>
            ) : null}

            {activeSection === "requirements" ? (
              <article className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-block w-max rounded-xl border border-slate-700 bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-amber-300">
                      Requirements Verification
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshCurrentPanel()}
                    disabled={isLoading}
                  >
                    {isLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <RequirementsPanel
                  facultyAccounts={facultyAccounts}
                  selectedFaculty={selectedFaculty}
                  onSelectFaculty={setSelectedFacultyId}
                  resetTrigger={verificationResetTrigger}
                />
              </article>
            ) : null}

            {activeSection === "submissionWindow" ? (
              <article className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-block w-max rounded-xl border border-slate-700 bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-amber-300">
                      Submission Window
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshCurrentPanel()}
                    disabled={isLoading}
                  >
                    {isLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <SubmissionWindowPanel
                  onWindowChange={() =>
                    setVerificationResetTrigger((prev) => prev + 1)
                  }
                />
              </article>
            ) : null}

            {activeSection === "academicTerms" ? (
              <article className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-block w-max rounded-xl border border-slate-700 bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-amber-300">
                      Academic Term Management
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshCurrentPanel()}
                    disabled={isLoading}
                  >
                    {isLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <section className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg shadow-black/20">
                  <AdminAcademicTerms adminName={adminName ?? "Admin"} />
                </section>
              </article>
            ) : null}
          </div>
        </div>
      </div>

      {detailsModalOpen && detailsFacultyId && (
        <FacultyDetailsModal
          facultyId={detailsFacultyId}
          facultyAccounts={facultyAccounts}
          onClose={() => setDetailsModalOpen(false)}
          onSave={refreshCurrentPanel}
        />
      )}

      {pendingFacultyAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-red-500/20 bg-[#230606]/95 p-6 shadow-2xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.28em] text-red-300/80">
              {pendingFacultyAction.kind === "delete"
                ? "Confirm Delete"
                : "Confirm Deactivate"}
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-[#fff8e7]">
              {pendingFacultyAction.kind === "delete"
                ? "Delete this faculty account?"
                : "Deactivate this faculty account?"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {pendingFaculty ? (
                <>
                  <span className="font-medium text-[#fff8e7]">
                    {pendingFaculty.fullName}
                  </span>{" "}
                  ({pendingFaculty.email}) will be affected.
                </>
              ) : null}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {pendingFacultyAction.kind === "delete"
                ? "This permanently removes the account and its access. The action cannot be undone."
                : "This temporarily removes access to the system until the account is reactivated."}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingFacultyAction(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmPendingFacultyAction}
                className={
                  pendingFacultyAction.kind === "delete"
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-amber-500 text-slate-950 hover:bg-amber-400"
                }
              >
                {pendingFacultyAction.kind === "delete"
                  ? "Delete Account"
                  : "Deactivate Account"}
              </Button>
            </div>
          </div>
        </div>
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

      {addFacultyModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
                  Faculty Management
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[#fff8e7]">
                  Add Faculty Account
                </h3>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAddFacultyModalOpen(false);
                  setCreateError(null);
                  setCreateSuccess(null);
                  setProfileImageFile(null);
                  setProfileImageInputKey((value) => value + 1);
                }}
              >
                Close
              </Button>
            </div>

            <AddFacultyPanel
              form={form}
              onAddFaculty={onAddFaculty}
              isCreating={isCreating}
              createError={createError}
              createSuccess={createSuccess}
              profileImageFile={profileImageFile}
              onProfileImageChange={setProfileImageFile}
              profileImageInputKey={profileImageInputKey}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type UsedTerm = {
  academicYear: string;
  semester: SemesterOption;
};

type SubmissionWindowResponse = {
  isConfigured: boolean;
  isOpen: boolean;
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear?: string | null;
  semester?: SemesterOption | null;
  usedTerms?: UsedTerm[];
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  currentTimeLabel: string;
};

type ApiBody = {
  error?: string;
  details?: string;
};

async function readApiBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function SubmissionWindowPanel({
  onWindowChange,
}: {
  onWindowChange?: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [windowStatus, setWindowStatus] =
    useState<SubmissionWindowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadWindow() {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/submission-window", {
        credentials: "include",
      });
      const body = await readApiBody(response);

      if (!response.ok) {
        const details =
          typeof body === "object" && body !== null
            ? (((body as ApiBody).error || (body as ApiBody).details) ??
              `HTTP ${response.status}`)
            : `HTTP ${response.status}`;

        setError(`Failed to load submission window: ${details}`);
        return;
      }

      if (typeof body !== "object" || body === null) {
        setError(
          `Failed to load submission window: Invalid response (HTTP ${response.status})`,
        );
        return;
      }

      const data = body as SubmissionWindowResponse;
      const dataObj = data as SubmissionWindowResponse;
      setWindowStatus(dataObj);
      setStartDate(dataObj.startDate ?? "");
      setEndDate(dataObj.endDate ?? "");
      setStartTime(
        dataObj.startTimeLabel
          ? (toTimeInputValue(dataObj.startTimeLabel) ?? "")
          : "",
      );
      setEndTime(
        dataObj.endTimeLabel
          ? (toTimeInputValue(dataObj.endTimeLabel) ?? "")
          : "",
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load submission window",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWindow();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!startDate || !endDate || !startTime || !endTime) {
      setError("Start/end date and time are required.");
      return;
    }

    if (!windowStatus?.academicYear || !windowStatus?.semester) {
      setError(
        "No active academic term is configured. Please set a current academic term first.",
      );
      return;
    }

    const startTimeLabel = toTimeLabel(startTime);
    const endTimeLabel = toTimeLabel(endTime);

    if (!startTimeLabel || !endTimeLabel) {
      setError("Please select valid start and end times.");
      return;
    }

    if (startDate > endDate) {
      setError("Start date cannot be later than end date.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/submission-window", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          startDate,
          endDate,
          startTime: startTimeLabel,
          endTime: endTimeLabel,
        }),
      });
      const body = await readApiBody(response);

      if (!response.ok) {
        if (typeof body !== "object" || body === null) {
          setError(
            `Failed to save submission window (HTTP ${response.status}).`,
          );
          return;
        }

        const apiBody = body as ApiBody;
        setError(
          apiBody.details
            ? `${apiBody.error || "Failed to save submission window"}: ${apiBody.details}`
            : (apiBody.error ?? "Failed to save submission window"),
        );
        return;
      }

      if (typeof body !== "object" || body === null) {
        setError(
          `Failed to save submission window: Invalid response (HTTP ${response.status}).`,
        );
        return;
      }

      setWindowStatus(body as SubmissionWindowResponse);
      setSuccess("Submission window updated successfully.");
      onWindowChange?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save submission window",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCloseSubmission() {
    const shouldClose = window.confirm(
      "Close submissions now and clear the current date/time schedule?",
    );

    if (!shouldClose) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/submission-window", {
        method: "DELETE",
        credentials: "include",
      });
      const body = await readApiBody(response);

      if (!response.ok) {
        if (typeof body === "object" && body !== null) {
          setError((body as ApiBody).error || "Failed to close submissions");
        } else {
          setError(`Failed to close submissions (HTTP ${response.status}).`);
        }
        return;
      }

      if (typeof body !== "object" || body === null) {
        setError(
          `Failed to close submissions: Invalid response (HTTP ${response.status}).`,
        );
        return;
      }

      setWindowStatus(body as SubmissionWindowResponse);
      setStartDate("");
      setEndDate("");
      setStartTime("");
      setEndTime("");
      setSuccess("Submissions closed and schedule cleared.");
      onWindowChange?.();
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "Failed to close submissions",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="mt-6 rounded-xl border border-slate-700 bg-slate-950/50 p-6"
      onSubmit={handleSave}
    >
      {windowStatus ? (
        <div className="mb-4 rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
          <p>
            <span className="text-xs uppercase tracking-[0.18em] text-amber-300">
              Today:
            </span>{" "}
            {windowStatus.today}
          </p>
          <p className="mt-1">
            <span className="text-xs uppercase tracking-[0.18em] text-amber-300">
              Current time:
            </span>{" "}
            {windowStatus.currentTimeLabel}
          </p>
          {windowStatus.isConfigured ? (
            <>
              <p className="mt-1">
                <span className="text-xs uppercase tracking-[0.18em] text-amber-300">
                  Term:
                </span>{" "}
                {windowStatus.academicYear ?? "N/A"} •{" "}
                {windowStatus.semester ?? "N/A"}
              </p>
              <p className="mt-1">
                <span className="text-xs uppercase tracking-[0.18em] text-amber-300">
                  Schedule:
                </span>{" "}
                {windowStatus.startDate} {windowStatus.startTimeLabel} to{" "}
                {windowStatus.endDate} {windowStatus.endTimeLabel}
              </p>
            </>
          ) : null}
          <p className="mt-1">
            <span className="text-xs uppercase tracking-[0.18em] text-amber-300">
              Current status:
            </span>{" "}
            <span
              className={
                windowStatus.isConfigured
                  ? windowStatus.isOpen
                    ? "text-emerald-300"
                    : "text-amber-300"
                  : "text-slate-300"
              }
            >
              {!windowStatus.isConfigured
                ? "Not configured (submissions are closed)"
                : windowStatus.isOpen
                  ? "Open"
                  : "Closed"}
            </span>
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            className="text-xs uppercase tracking-[0.18em] text-amber-300"
            htmlFor="windowStartDate"
          >
            Start Date
          </label>
          <input
            id="windowStartDate"
            type="date"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={isLoading || isSaving}
          />
        </div>

        <div>
          <label
            className="text-xs uppercase tracking-[0.18em] text-amber-300"
            htmlFor="windowEndDate"
          >
            End Date
          </label>
          <input
            id="windowEndDate"
            type="date"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            disabled={isLoading || isSaving}
          />
        </div>

        <div>
          <label
            className="text-xs uppercase tracking-[0.18em] text-amber-300"
            htmlFor="windowStartTime"
          >
            Start Time
          </label>
          <input
            id="windowStartTime"
            type="time"
            step={60}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            disabled={isLoading || isSaving}
          />
        </div>

        <div>
          <label
            className="text-xs uppercase tracking-[0.18em] text-amber-300"
            htmlFor="windowEndTime"
          >
            End Time
          </label>
          <input
            id="windowEndTime"
            type="time"
            step={60}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            disabled={isLoading || isSaving}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
              Current Academic Term
            </p>
            {windowStatus?.academicYear && windowStatus?.semester ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Academic Year
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {windowStatus.academicYear}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Semester
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {windowStatus.semester}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Status
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    Current
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                No current academic term is configured. Please set the current
                academic term in the Academic Terms page.
              </p>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 rounded-md border border-emerald-700 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          className="bg-red-700 text-white hover:bg-red-600"
          onClick={handleCloseSubmission}
          disabled={isLoading || isSaving}
        >
          Close Submission
        </Button>
        <Button type="button" variant="secondary" onClick={loadWindow}>
          Refresh
        </Button>
        <Button type="submit" disabled={isLoading || isSaving}>
          {isSaving ? "Saving..." : "Save Submission Window"}
        </Button>
      </div>
    </form>
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
          : "border-slate-700 bg-slate-950/60 hover:border-slate-500"
      }`}
    >
      <p
        className={`font-semibold ${active ? "text-amber-300" : "text-slate-100"}`}
      >
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      ) : null}
    </button>
  );
}

function AddFacultyPanel({
  form,
  onAddFaculty,
  isCreating,
  createError,
  createSuccess,
  profileImageFile,
  onProfileImageChange,
  profileImageInputKey,
  wrapperClassName,
  formClassName,
}: {
  form: ReturnType<typeof useForm<FacultyAccountFormInput>>;
  onAddFaculty: (input: FacultyAccountFormInput) => void;
  isCreating: boolean;
  createError: string | null;
  createSuccess: string | null;
  profileImageFile: File | null;
  onProfileImageChange: (file: File | null) => void;
  profileImageInputKey: number;
  wrapperClassName?: string;
  formClassName?: string;
}) {
  return (
    <div className={wrapperClassName ?? "flex flex-col max-w-sm mx-auto"}>
      <form
        className={`mt-6 flex flex-1 w-full flex-col gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-6 shadow-lg ${formClassName ?? ""}`}
        onSubmit={form.handleSubmit(onAddFaculty)}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-slate-300" htmlFor="firstName">
              First Name
            </label>
            <input
              id="firstName"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
              {...form.register("firstName")}
            />
            <FieldError message={form.formState.errors.firstName?.message} />
          </div>

          <div>
            <label className="text-sm text-slate-300" htmlFor="middleName">
              Middle Name
            </label>
            <input
              id="middleName"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
              {...form.register("middleName")}
            />
            <FieldError message={form.formState.errors.middleName?.message} />
          </div>

          <div>
            <label className="text-sm text-slate-300" htmlFor="lastName">
              Last Name
            </label>
            <input
              id="lastName"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
              {...form.register("lastName")}
            />
            <FieldError message={form.formState.errors.lastName?.message} />
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-300" htmlFor="profileImage">
            Profile Image
          </label>
          <input
            key={profileImageInputKey}
            id="profileImage"
            type="file"
            accept="image/*"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-950 focus:ring focus:ring-amber-300/30"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              onProfileImageChange(file);
            }}
          />
          <p className="mt-1 text-xs text-slate-400">
            Upload a square image for the faculty directory.
          </p>
          {profileImageFile ? (
            <div className="mt-2 flex items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
              <span className="truncate">{profileImageFile.name}</span>
              <button
                type="button"
                className="ml-3 text-amber-300 hover:text-amber-200"
                onClick={() => onProfileImageChange(null)}
              >
                Remove
              </button>
            </div>
          ) : null}
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
          {isCreating ? "Sending invite..." : "Create Faculty Account"}
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
  deletingFacultyIds,
  deleteError,
  deleteSuccess,
  facultyActionError,
  onClearDeleteMessages,
}: {
  facultyAccounts: FacultyAccount[];
  isLoading: boolean;
  onSelectFaculty: (facultyId: string) => void;
  onDeleteFaculty: (facultyId: string) => void;
  onViewDetails: (facultyId: string) => void;
  onActivate: (facultyId: string) => void;
  onDeactivate: (facultyId: string) => void;
  loadingFacultyIds: Set<string>;
  deletingFacultyIds: Set<string>;
  deleteError: string | null;
  deleteSuccess: string | null;
  facultyActionError: string | null;
  onClearDeleteMessages: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFacultyAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return facultyAccounts;
    }

    return facultyAccounts.filter((faculty) => {
      const haystack = `${faculty.fullName} ${faculty.email}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [facultyAccounts, searchTerm]);

  return (
    <div>
      <div className="mt-4 space-y-3">
        {deleteError ? (
          <div className="rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300 flex justify-between items-center">
            <span>{deleteError}</span>
            <button
              onClick={onClearDeleteMessages}
              className="text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        ) : null}

        {deleteSuccess ? (
          <div className="rounded-md border border-emerald-700 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300 flex justify-between items-center">
            <span>{deleteSuccess}</span>
            <button
              onClick={onClearDeleteMessages}
              className="text-emerald-400 hover:text-emerald-200"
            >
              ✕
            </button>
          </div>
        ) : null}

        {facultyActionError ? (
          <div className="rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300 flex justify-between items-center">
            <span>{facultyActionError}</span>
            <button
              onClick={onClearDeleteMessages}
              className="text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search faculty by name or email"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-400"
          />
        </div>

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

        {!isLoading &&
        facultyAccounts.length > 0 &&
        filteredFacultyAccounts.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
            No faculty accounts match your search.
          </p>
        ) : null}

        {!isLoading &&
        facultyAccounts.length > 0 &&
        filteredFacultyAccounts.length > 0
          ? filteredFacultyAccounts.map((faculty) => (
              <div
                key={faculty.id}
                className="rounded-xl border border-slate-700 bg-slate-950 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => onSelectFaculty(faculty.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-400/30 bg-amber-400/10 text-sm font-semibold text-amber-200">
                      {faculty.profileImageUrl ? (
                        <img
                          src={faculty.profileImageUrl}
                          alt={faculty.fullName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{buildFacultyInitials(faculty.fullName)}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{faculty.fullName}</p>
                      <p className="truncate text-sm text-slate-400">
                        {faculty.email}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onViewDetails(faculty.id)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      View Details
                    </Button>
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
                      onClick={() => onDeleteFaculty(faculty.id)}
                      disabled={deletingFacultyIds.has(faculty.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      {deletingFacultyIds.has(faculty.id)
                        ? "Deleting..."
                        : "Delete"}
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
  resetTrigger,
}: {
  facultyAccounts: FacultyAccount[];
  selectedFaculty: FacultyAccount | null;
  onSelectFaculty: (facultyId: string) => void;
  resetTrigger?: number;
}) {
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState<SemesterOption>("1st Semester");
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string | null>(
    null,
  );
  const [currentSemester, setCurrentSemester] = useState<SemesterOption | null>(
    null,
  );
  const [currentTermConfigured, setCurrentTermConfigured] = useState(false);
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [availableAcademicYears, setAvailableAcademicYears] = useState<
    string[]
  >([]);
  const [availableSemesters, setAvailableSemesters] = useState<
    SemesterOption[]
  >([]);
  const [verificationStatus, setVerificationStatus] = useState<Record<
    RequirementCode,
    RequirementStatus
  > | null>(null);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (resetTrigger === undefined) {
      return;
    }

    setVerificationStatus(null);
    setVerificationError(null);
  }, [resetTrigger]);
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

      console.log("Fetching verification status with params:", {
        facultyId: selectedFacultyId,
        academicYear: selectedAcademicYear,
        semester: selectedSemester,
      });

      const response = await fetch(
        `/api/admin/faculty/requirements/verification?${params.toString()}`,
        { credentials: "include" },
      );

      if (!response.ok) {
        let details = "";
        try {
          const err = await response.json();
          details = JSON.stringify(err);
        } catch (e) {
          try {
            details = await response.text();
          } catch (e2) {
            details = "(no body)";
          }
        }

        throw new Error(
          `Failed to load verification requirements (HTTP ${response.status}): ${details}`,
        );
      }

      const data = await response.json();
      console.log("Verification response:", data);

      const years: string[] = data.availableAcademicYears ?? [];
      const selectedYear = data.selectedAcademicYear ?? "";
      const selectedSem =
        (data.selectedSemester as SemesterOption | undefined) ?? "1st Semester";

      console.log("Setting verification status:", {
        requirementStatus: data.requirementStatus,
        years,
        selectedYear,
        selectedSem,
      });

      const availableSemestersFromResponse =
        (data.availableSemesters as SemesterOption[] | undefined) ??
        SEMESTER_OPTIONS;

      setAvailableAcademicYears(years);
      setAvailableSemesters(availableSemestersFromResponse);
      setAcademicYear(selectedYear);
      setSemester(selectedSem);
      setVerificationStatus(data.requirementStatus ?? null);
    } catch (error) {
      console.error("Verification fetch error:", error);
      setVerificationError(
        error instanceof Error
          ? error.message
          : "Unable to load requirements for the selected filter.",
      );
      setVerificationStatus(null);
    } finally {
      setIsLoadingVerification(false);
    }
  }

  useEffect(() => {
    if (!selectedFaculty) {
      const timeoutId = window.setTimeout(() => {
        setAvailableAcademicYears([]);
        setAvailableSemesters([]);
        setCurrentAcademicYear(null);
        setCurrentSemester(null);
        setCurrentTermConfigured(false);
        setVerificationError(null);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    // Load available academic years and current term metadata without setting requirement status yet
    // Requirement status will be set when modal is opened.
    (async () => {
      try {
        const response = await fetch(
          `/api/admin/faculty/requirements/verification?facultyId=${selectedFaculty.id}`,
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await response.json();
          const years: string[] = data.availableAcademicYears ?? [];
          const selectedYear = data.selectedAcademicYear ?? "";
          const selectedSem =
            (data.selectedSemester as SemesterOption | undefined) ??
            "1st Semester";
          const currentYear = data.currentAcademicYear ?? null;
          const currentSem =
            (data.currentSemester as SemesterOption | undefined) ?? null;
          const termConfigured = Boolean(data.currentTermConfigured);

          const computedYear =
            termConfigured && currentYear
              ? currentYear
              : selectedYear || years[0] || "";
          const computedSem =
            termConfigured && currentSem ? currentSem : selectedSem;

          setAvailableAcademicYears(years);
          setAvailableSemesters(data.availableSemesters ?? []);
          setCurrentAcademicYear(currentYear);
          setCurrentSemester(currentSem);
          setCurrentTermConfigured(termConfigured);
          setAcademicYear(computedYear || "");
          setSemester(computedSem);
          setIsHistoryMode(!termConfigured);
          setVerificationStatus(null);
        } else {
          let details = "";
          try {
            const err = await response.json();
            details = JSON.stringify(err);
          } catch (e) {
            try {
              details = await response.text();
            } catch (e2) {
              details = "(no body)";
            }
          }

          setVerificationError(
            `API returned HTTP ${response.status} - ${details}`,
          );
        }
      } catch (error) {
        console.error("Failed to load academic years", error);
        setVerificationError(`Failed to load academic years: ${String(error)}`);
      }
    })();
  }, [selectedFaculty]);

  function handleToggleHistoryMode(enabled: boolean) {
    setIsHistoryMode(enabled);

    if (!enabled && currentAcademicYear && currentSemester) {
      setAcademicYear(currentAcademicYear);
      setSemester(currentSemester);
    }

    if (enabled) {
      setAcademicYear(
        (previous) => previous || availableAcademicYears[0] || "",
      );
      setSemester((previous) =>
        previous && availableSemesters.includes(previous)
          ? previous
          : (availableSemesters[0] ?? "1st Semester"),
      );
    }
  }

  useEffect(() => {
    if (!selectedFaculty || !academicYear) {
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const response = await fetch(
          `/api/admin/faculty/requirements/verification?facultyId=${selectedFaculty.id}&academicYear=${encodeURIComponent(
            academicYear,
          )}`,
          { credentials: "include" },
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!isMounted) {
          return;
        }

        const availableSemestersFromResponse =
          (data.availableSemesters as SemesterOption[] | undefined) ??
          SEMESTER_OPTIONS;

        setAvailableSemesters(availableSemestersFromResponse);

        const selectedSem =
          (data.selectedSemester as SemesterOption | undefined) ??
          "1st Semester";

        if (!availableSemestersFromResponse.includes(semester)) {
          setSemester(selectedSem);
        }
      } catch (error) {
        console.error("Failed to refresh available semesters", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedFaculty?.id, academicYear, semester]);

  async function onOpenModal() {
    if (!selectedFaculty) return;

    const useYear =
      isHistoryMode && academicYear
        ? academicYear
        : (currentAcademicYear ?? academicYear);
    const useSem =
      isHistoryMode && semester ? semester : (currentSemester ?? semester);

    if (!useYear || !useSem) {
      setVerificationError(
        "A school year and semester are required. Configure the current academic term or select a previous term.",
      );
      return;
    }

    await fetchVerificationStatus(selectedFaculty.id, useYear, useSem);
    setIsModalOpen(true);
  }

  return (
    <div>
      {facultyAccounts.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
          Add faculty accounts first, then verify their required uploads.
        </p>
      ) : null}

      {facultyAccounts.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg shadow-black/20">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
                  Current Academic Term
                </p>
                <h4 className="mt-2 text-lg font-semibold text-white">
                  {currentTermConfigured
                    ? "Current Academic Term"
                    : "Academic Term"}
                </h4>
              </div>
              {currentTermConfigured ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="uppercase tracking-[0.18em]"
                  onClick={() => handleToggleHistoryMode(!isHistoryMode)}
                >
                  {isHistoryMode
                    ? "Return to current term"
                    : "View previous terms"}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Academic Year
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {currentTermConfigured
                    ? (currentAcademicYear ?? academicYear)
                    : "Not configured"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Semester
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {currentTermConfigured
                    ? (currentSemester ?? semester)
                    : "Not configured"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Status
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {currentTermConfigured ? "Current 🟢" : "No active term"}
                </p>
              </div>
            </div>

            {!currentTermConfigured ? (
              <p className="mt-4 text-sm text-slate-400">
                The current academic term is not configured. Select a previous
                term to review history.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label
                  className="text-xs uppercase tracking-[0.18em] text-amber-300"
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
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      className="text-xs uppercase tracking-[0.18em] text-amber-300"
                      htmlFor="academicYearFilter"
                    >
                      Academic Year
                    </label>
                  </div>

                  {currentTermConfigured && !isHistoryMode ? (
                    <div className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                      S.Y. {currentAcademicYear}
                    </div>
                  ) : (
                    <select
                      id="academicYearFilter"
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                      value={academicYear}
                      onChange={(event) => setAcademicYear(event.target.value)}
                      disabled={currentTermConfigured && !isHistoryMode}
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
                  )}
                </div>
                {!currentTermConfigured || isHistoryMode ? null : null}
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-[0.18em] text-amber-300"
                  htmlFor="semesterFilter"
                >
                  Semester
                </label>
                {currentTermConfigured && !isHistoryMode ? (
                  <div className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                    {currentSemester}
                  </div>
                ) : (
                  <select
                    id="semesterFilter"
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                    value={semester}
                    onChange={(event) =>
                      setSemester(event.target.value as SemesterOption)
                    }
                    disabled={
                      currentTermConfigured && !isHistoryMode
                        ? true
                        : !selectedFaculty ||
                          !academicYear ||
                          availableSemesters.length === 0
                    }
                  >
                    {SEMESTER_OPTIONS.map((term) => {
                      const disabled =
                        availableSemesters.length > 0
                          ? !availableSemesters.includes(term)
                          : true;

                      return (
                        <option key={term} value={term} disabled={disabled}>
                          {term}
                          {disabled ? " (no content yet)" : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  {availableSemesters.length === 0
                    ? `No semester content is available for ${
                        currentTermConfigured && !isHistoryMode
                          ? currentAcademicYear
                          : academicYear || "the selected school year"
                      }.`
                    : availableSemesters.length === 1
                      ? `${availableSemesters[0]} is available for ${academicYear}.`
                      : `Both semesters are available for ${academicYear}.`}
                </p>
                {currentTermConfigured ? (
                  <p className="mt-2 text-xs text-slate-400">
                    {isHistoryMode
                      ? "Viewing previous term history."
                      : "Using the active term for verification."}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    No active academic term is configured. Select a previous
                    term to review history.
                  </p>
                )}
              </div>
            </div>

            {verificationError ? (
              <p className="mt-3 rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                {verificationError}
              </p>
            ) : null}

            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={
                  !selectedFaculty ||
                  !academicYear ||
                  availableSemesters.length === 0 ||
                  isLoadingVerification
                }
                onClick={onOpenModal}
              >
                {isLoadingVerification
                  ? "Loading requirements..."
                  : "Verify Requirements"}
              </Button>
            </div>
            {verificationError ? (
              <p className="mt-2 text-sm text-red-300">{verificationError}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isModalOpen && selectedFaculty ? (
        <RequirementsVerificationModal
          facultyName={selectedFaculty.fullName}
          facultyId={selectedFaculty.id}
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
  facultyId,
  onClose,
}: {
  facultyName: string;
  academicYear: string;
  semester: SemesterOption;
  requirementStatus: Record<RequirementCode, RequirementStatus> | null;
  facultyId: string;
  onClose: () => void;
}) {
  const [viewingRequirement, setViewingRequirement] =
    useState<RequirementCode | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<
    string | null
  >(null);
  const [reviewRemarks, setReviewRemarks] = useState("");

  type AdminSubmissionReviewDecision = {
    decision: "validated" | "rejected";
    remarks?: string | null;
    created_at?: string | null;
  };

  type AdminSubmissionDocumentVersion = {
    id: string;
    storage_path: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    created_at?: string | null;
  };

  type AdminSubmission = {
    id: string;
    requirement_code: string;
    status: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    remarks?: string | null;
    document_versions?: AdminSubmissionDocumentVersion[] | null;
    review_decisions?: AdminSubmissionReviewDecision[] | null;
  };

  const selectedSubmission = submissions[0] ?? null;
  const submissionDocuments = selectedSubmission?.document_versions ?? [];
  const selectedDocument = selectedSubmission?.document_versions?.[0] ?? null;
  const latestReview = selectedSubmission?.review_decisions?.length
    ? [...selectedSubmission.review_decisions].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })[0]
    : null;
  const previewPath = selectedDocument?.storage_path ?? null;
  const previewUrl = previewPath
    ? `/api/storage/download?path=${encodeURIComponent(previewPath)}`
    : null;
  const getDocumentDownloadUrl = (storagePath: string) =>
    `/api/storage/download?path=${encodeURIComponent(storagePath)}`;
  const previewFileName = previewPath?.split("/").pop() ?? "Submitted file";
  const previewMimeType = selectedDocument?.mime_type ?? null;
  const isImagePreview =
    previewMimeType?.startsWith("image/") ||
    /\.(jpe?g|png|gif|bmp|webp)$/i.test(previewFileName);
  const isPdfPreview =
    previewMimeType === "application/pdf" || /\.pdf$/i.test(previewFileName);
  const reviewedOn = latestReview?.created_at
    ? new Date(latestReview.created_at).toISOString().split("T")[0]
    : null;
  const submittedOn = formatSubmittedDateTime(
    selectedSubmission?.submitted_at || selectedSubmission?.created_at,
  );
  const previewLabel = "Submitted File";
  const validatedFileCount = requirementStatus
    ? DEFAULT_REQUIREMENTS.filter(
        (code) => requirementStatus[code] === "validated",
      ).length
    : 0;
  const downloadValidatedZipHref = `/api/admin/faculty/submissions/download-validated?facultyId=${encodeURIComponent(
    facultyId,
  )}&academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(
    semester,
  )}`;
  const reviewStatus =
    selectedSubmission?.status === "validated" ||
    latestReview?.decision === "validated"
      ? "validated"
      : selectedSubmission?.status === "rejected" ||
          latestReview?.decision === "rejected"
        ? "rejected"
        : null;
  const reviewStatusLabel =
    reviewStatus === "validated"
      ? "Validated"
      : reviewStatus === "rejected"
        ? "Rejected"
        : null;
  const reviewStatusTone =
    reviewStatus === "validated"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : reviewStatus === "rejected"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
        : "border-slate-700 bg-slate-950 text-slate-400";

  async function handleViewRequirement(code: RequirementCode) {
    setIsLoadingSubmissions(true);
    try {
      const response = await fetch(
        `/api/admin/faculty/submissions?facultyId=${facultyId}`,
        { credentials: "include" },
      );
      if (response.ok) {
        const data = await response.json();
        const filtered = (data.submissions || []).filter((sub: any) => {
          if (sub.requirement_code !== code) {
            return false;
          }

          const term = toAcademicYearAndSemester(
            sub.submitted_at || sub.created_at,
          );

          if (academicYear && term.academicYear !== academicYear) {
            return false;
          }

          if (semester && term.semester !== semester) {
            return false;
          }

          return true;
        });

        setSubmissions(filtered.length > 0 ? [filtered[0]] : []);
        setViewingRequirement(code);
      }
    } catch (error) {
      console.error("Failed to load submissions:", error);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }

  async function handleReviewSubmission(
    submissionId: string,
    decision: "validated" | "rejected",
  ) {
    setReviewingSubmissionId(submissionId);
    try {
      const response = await fetch("/api/admin/faculty/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submissionId,
          decision,
          remarks: reviewRemarks,
        }),
      });

      if (response.ok) {
        // Update submissions list to reflect the change
        setSubmissions(
          submissions.map((sub) =>
            sub.id === submissionId ? { ...sub, status: decision } : sub,
          ),
        );
        setReviewRemarks("");
        alert(`Submission ${decision} successfully!`);
      } else {
        try {
          const error = await response.json();
          alert(`Error: ${error.error}`);
        } catch (parseError) {
          alert(`Error: Failed to process review (HTTP ${response.status})`);
        }
      }
    } catch (error) {
      console.error("Failed to review submission:", error);
      alert("Failed to process review. Please try again.");
    } finally {
      setReviewingSubmissionId(null);
    }
  }

  if (viewingRequirement) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-3 backdrop-blur-sm"
        onClick={() => setViewingRequirement(null)}
      >
        <div
          className="flex h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-amber-300">
                File Preview
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-100">
                {previewLabel}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.location.assign(downloadValidatedZipHref)}
                disabled={validatedFileCount === 0}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-950 disabled:text-slate-500"
              >
                Download ZIP
                {validatedFileCount > 0 ? ` (${validatedFileCount})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setViewingRequirement(null)}
                className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid flex-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:px-6 lg:py-5">
            {isLoadingSubmissions ? (
              <div className="lg:col-span-2 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
                Loading submissions...
              </div>
            ) : submissions.length === 0 ? (
              <div className="lg:col-span-2 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
                No submissions found for this requirement.
              </div>
            ) : (
              <>
                <div className="relative min-h-[60vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                  {previewUrl ? (
                    <div className="absolute right-3 top-3 z-10">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800/95 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-blue-300 shadow-sm transition hover:bg-slate-700"
                      >
                        Open full view
                      </a>
                    </div>
                  ) : null}

                  {previewUrl ? (
                    isImagePreview ? (
                      <Image
                        src={previewUrl}
                        alt={previewFileName}
                        width={1200}
                        height={900}
                        unoptimized
                        className="h-full min-h-[60vh] w-full object-contain"
                      />
                    ) : isPdfPreview ? (
                      <iframe
                        title={`${REQUIREMENT_LABEL[viewingRequirement]} preview`}
                        src={previewUrl}
                        className="h-full min-h-[60vh] w-full border-0"
                      />
                    ) : (
                      <div className="flex min-h-[60vh] items-center justify-center p-4 text-sm text-slate-300">
                        Preview not available for this file type.
                      </div>
                    )
                  ) : (
                    <div className="flex min-h-[60vh] items-center justify-center p-4 text-sm text-slate-300">
                      Preview not available for this file.
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 lg:pr-1">
                  {reviewStatusLabel ? (
                    <div
                      className={`rounded-2xl border p-2.5 text-sm font-semibold uppercase tracking-[0.18em] ${reviewStatusTone}`}
                    >
                      {reviewStatus === "validated" ? "✓ " : "✗ "}
                      {reviewStatusLabel}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-2.5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Faculty Note
                    </p>
                    <p className="mt-2 text-sm leading-6 italic text-slate-200">
                      {selectedSubmission?.remarks || "No note was added."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-2.5">
                    <div className="mt-3 space-y-2">
                      {submissionDocuments.length > 0 ? (
                        submissionDocuments.map((doc, index) => {
                          const fileName =
                            doc.storage_path.split("/").pop() ??
                            `File ${index + 1}`;
                          const downloadUrl = getDocumentDownloadUrl(
                            doc.storage_path,
                          );

                          return (
                            <div
                              key={doc.id}
                              className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"
                            >
                              <div className="flex flex-col items-center gap-3 text-center">
                                <a
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-blue-700"
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm leading-6 italic text-slate-200">
                          No file pieces available.
                        </p>
                      )}
                    </div>
                  </div>

                  {latestReview?.created_at || latestReview?.remarks ? (
                    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-2.5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        My Remarks
                      </p>
                      <p className="mt-2 text-sm leading-6 italic text-slate-200">
                        {latestReview?.remarks || "No remarks were added."}
                      </p>
                      {reviewedOn ? (
                        <>
                          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                            Reviewed On
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">
                            {reviewedOn}
                          </p>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-2.5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        My Remarks
                      </p>
                      <p className="mt-2 text-sm leading-6 italic text-slate-200">
                        No remarks were added.
                      </p>
                    </div>
                  )}

                  {submittedOn ? (
                    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Submitted On
                      </p>
                      <p className="mt-2 leading-6">{submittedOn}</p>
                    </div>
                  ) : null}

                  {selectedSubmission?.status === "uploaded" ? (
                    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-2.5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Admin Action
                      </p>
                      <textarea
                        placeholder="Add remarks (optional)"
                        value={reviewRemarks}
                        onChange={(e) => setReviewRemarks(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 placeholder-slate-500 outline-none focus:ring focus:ring-amber-300/30"
                        rows={2}
                      />
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleReviewSubmission(
                              selectedSubmission.id,
                              "validated",
                            )
                          }
                          disabled={
                            reviewingSubmissionId === selectedSubmission.id
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:from-emerald-400 hover:to-green-500 hover:shadow-emerald-950/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="text-base leading-none">✓</span>
                          {reviewingSubmissionId === selectedSubmission.id
                            ? "Approving..."
                            : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleReviewSubmission(
                              selectedSubmission.id,
                              "rejected",
                            )
                          }
                          disabled={
                            reviewingSubmissionId === selectedSubmission.id
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/30 transition hover:from-rose-400 hover:to-red-500 hover:shadow-rose-950/40 focus:outline-none focus:ring-2 focus:ring-rose-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="text-base leading-none">✗</span>
                          {reviewingSubmissionId === selectedSubmission.id
                            ? "Rejecting..."
                            : "Reject"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber-300">
              Requirements Verification
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-100">
              Faculty Requirement Status
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.assign(downloadValidatedZipHref)}
              disabled={validatedFileCount === 0}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-950 disabled:text-slate-500"
            >
              Download ZIP
              {validatedFileCount > 0 ? ` (${validatedFileCount})` : ""}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Faculty
              </p>
              <p className="mt-2 text-slate-100">{facultyName}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-400">
                Filter
              </p>
              <p className="mt-2 text-slate-100">
                S.Y. {academicYear} - {semester}
              </p>
            </div>

            <div className="space-y-3">
              {requirementStatus ? (
                DEFAULT_REQUIREMENTS.map((code) => {
                  const status = requirementStatus[code] ?? "not_submitted";
                  return (
                    <article
                      key={code}
                      className="rounded-2xl border border-slate-700 bg-slate-950 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {REQUIREMENT_LABEL[code]}
                          </p>
                          <p
                            className={`mt-1 text-sm font-medium ${statusTone(status)}`}
                          >
                            {statusLabel(status)}
                          </p>
                        </div>

                        {(status === "uploaded" || status === "validated") && (
                          <button
                            type="button"
                            onClick={() => handleViewRequirement(code)}
                            className="inline-flex items-center rounded-xl border border-blue-500/30 bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
                  No requirements data loaded. Please refresh the modal.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 px-6 py-4 flex justify-end">
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
  onSave,
}: {
  facultyId: string;
  facultyAccounts: FacultyAccount[];
  onClose: () => void;
  onSave: () => Promise<void> | void;
}) {
  const selectedFaculty = facultyAccounts.find((f) => f.id === facultyId);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!selectedFaculty) {
    return null;
  }

  useEffect(() => {
    const fullNameParts = selectedFaculty.fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    setFirstName(fullNameParts[0] ?? "");
    setLastName(fullNameParts.length > 1 ? fullNameParts.slice(-1)[0] : "");
    setMiddleName(
      fullNameParts.length > 2 ? fullNameParts.slice(1, -1).join(" ") : "",
    );
    setProfileImageFile(null);
    setProfileImagePreviewUrl(selectedFaculty.profileImageUrl);
    setSaveMessage(null);
    setSaveError(null);
  }, [selectedFaculty]);

  useEffect(() => {
    if (!profileImageFile) {
      setProfileImagePreviewUrl(selectedFaculty.profileImageUrl);
      return;
    }

    const previewUrl = URL.createObjectURL(profileImageFile);
    setProfileImagePreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [profileImageFile, selectedFaculty.profileImageUrl]);

  const createdDate = new Date(selectedFaculty.created_at);
  const formattedDate = createdDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleSaveChanges() {
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const formData = new FormData();
      formData.append("facultyProfileId", selectedFaculty.id);
      formData.append("firstName", firstName);
      formData.append("middleName", middleName);
      formData.append("lastName", lastName);

      if (profileImageFile) {
        formData.append("profileImage", profileImageFile);
      }

      const response = await fetch("/api/admin/faculty/update", {
        method: "PATCH",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof payload === "object" && payload && "error" in payload
            ? String((payload as { error?: unknown }).error)
            : "Failed to save faculty details",
        );
      }

      setSaveMessage("Faculty details updated successfully.");
      await onSave();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save faculty details",
      );
    } finally {
      setIsSaving(false);
    }
  }

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
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-400/30 bg-amber-400/10 text-lg font-semibold text-amber-200">
                    {profileImagePreviewUrl ? (
                      <img
                        src={profileImagePreviewUrl}
                        alt={selectedFaculty.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {buildFacultyInitials(selectedFaculty.fullName)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Profile Picture
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("facultyProfileImageInput")
                          ?.click()
                      }
                      className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
                    >
                      Change Photo
                    </button>
                    {profileImageFile ? (
                      <p className="text-xs text-slate-400 truncate">
                        {profileImageFile.name}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      First Name
                    </p>
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-amber-300/30"
                    />
                  </label>
                  <label className="block">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Middle Name
                    </p>
                    <input
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-amber-300/30"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Last Name
                    </p>
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-amber-300/30"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Email
                  </p>
                  <p className="text-sm text-slate-200">
                    {selectedFaculty.email}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
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
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Created Date
                    </p>
                    <p className="text-sm text-slate-200">{formattedDate}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-100">
                    Edit faculty details
                  </p>
                  <p className="text-sm leading-6 text-slate-400">
                    Change the name and profile picture for this faculty
                    account.
                  </p>
                </div>

                <div className="space-y-3">
                  {saveMessage ? (
                    <p className="text-sm text-green-300">{saveMessage}</p>
                  ) : null}
                  {saveError ? (
                    <p className="text-sm text-red-400">{saveError}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>

            <input
              id="facultyProfileImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                setProfileImageFile(event.target.files?.[0] ?? null);
              }}
            />
          </article>
        </div>
      </div>
    </div>
  );
}
