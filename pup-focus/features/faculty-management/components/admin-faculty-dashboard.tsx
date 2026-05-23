"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/shared/brand-mark";
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

type AdminSection =
  | "dashboard"
  | "add"
  | "faculty"
  | "requirements"
  | "submissionWindow"
  | "details";

type FacultyAccount = {
  id: string;
  fullName: string;
  email: string;
  is_active: boolean;
  created_at: string;
  requirementStatus: Record<RequirementCode, RequirementStatus>;
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
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalMessage, setInviteModalMessage] = useState("");
  const [inviteWasSent, setInviteWasSent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingFacultyIds, setLoadingFacultyIds] = useState<Set<string>>(
    new Set(),
  );
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsFacultyId, setDetailsFacultyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [facultyActionError, setFacultyActionError] = useState<string | null>(
    null,
  );

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
        }),
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
      form.reset({ fullName: "", email: "" });

      // Refresh faculty list from database
      await loadFacultyFromDatabase();
    } catch (error) {
      setCreateError("An error occurred while creating the faculty account");
    } finally {
      setIsCreating(false);
    }
  }

  async function onDeleteFaculty(facultyId: string) {
    setLoadingFacultyIds((prev) => new Set(prev).add(facultyId));
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
      setLoadingFacultyIds((prev) => {
        const next = new Set(prev);
        next.delete(facultyId);
        return next;
      });
    }
  }

  async function onDeactivateFaculty(facultyId: string) {
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

        <div className="my-6 rounded-xl bg-slate-950 p-3">
          <p className="text-sm text-slate-400">Admin Control</p>
          <p className="mt-1 font-semibold text-slate-100">
            Faculty Management
          </p>
        </div>

        <nav className="mt-6 space-y-2">
          <SidebarButton
            active={activeSection === "dashboard"}
            title="Dashboard"
            description="Logo, highlights, and login page images"
            onClick={() => setActiveSection("dashboard")}
          />
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
          <SidebarButton
            active={activeSection === "submissionWindow"}
            title="Submission Window"
            description="Set opening and closing dates for uploads"
            onClick={() => setActiveSection("submissionWindow")}
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

            {activeSection === "add" ? (
              <article className="p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Admin Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  Add Faculty Account
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Provision a new faculty account via invite link.
                </p>
                <AddFacultyPanel
                  form={form}
                  onAddFaculty={onAddFaculty}
                  isCreating={isCreating}
                  createError={createError}
                  createSuccess={createSuccess}
                />
              </article>
            ) : null}

            {activeSection === "faculty" ? (
              <article className="p-6">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Admin Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  Faculty List
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  View all faculty accounts and manage them.
                </p>
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
                  deleteError={deleteError}
                  deleteSuccess={deleteSuccess}
                  facultyActionError={facultyActionError}
                  onClearDeleteMessages={() => {
                    setDeleteError(null);
                    setDeleteSuccess(null);
                    setFacultyActionError(null);
                  }}
                />
              </article>
            ) : null}

            {activeSection === "requirements" ? (
              <article className="p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Admin Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  Requirements Verification
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Validate curriculum-based uploads from faculty.
                </p>
                <RequirementsPanel
                  facultyAccounts={facultyAccounts}
                  selectedFaculty={selectedFaculty}
                  onSelectFaculty={setSelectedFacultyId}
                />
              </article>
            ) : null}

            {activeSection === "submissionWindow" ? (
              <article className="p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Admin Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  Submission Window
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Control when faculty can submit requirement documents.
                </p>
                <SubmissionWindowPanel />
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
        />
      )}

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

type SubmissionWindowResponse = {
  isConfigured: boolean;
  isOpen: boolean;
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
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

function SubmissionWindowPanel() {
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
      setWindowStatus(data);
      setStartDate(data.startDate ?? "");
      setEndDate(data.endDate ?? "");
      setStartTime(
        data.startTimeLabel
          ? (toTimeInputValue(data.startTimeLabel) ?? "")
          : "",
      );
      setEndTime(
        data.endTimeLabel ? (toTimeInputValue(data.endTimeLabel) ?? "") : "",
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
            <span className="text-slate-400">Today:</span> {windowStatus.today}
          </p>
          <p className="mt-1">
            <span className="text-slate-400">Current time:</span>{" "}
            {windowStatus.currentTimeLabel}
          </p>
          {windowStatus.isConfigured ? (
            <p className="mt-1">
              <span className="text-slate-400">Schedule:</span>{" "}
              {windowStatus.startDate} {windowStatus.startTimeLabel} to{" "}
              {windowStatus.endDate} {windowStatus.endTimeLabel}
            </p>
          ) : null}
          <p className="mt-1">
            <span className="text-slate-400">Current status:</span>{" "}
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
          <label className="text-sm text-slate-300" htmlFor="windowStartDate">
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
          <label className="text-sm text-slate-300" htmlFor="windowEndDate">
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
          <label className="text-sm text-slate-300" htmlFor="windowStartTime">
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
          <label className="text-sm text-slate-300" htmlFor="windowEndTime">
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
    <div className="flex flex-col max-w-sm mx-auto">
      <form
        className="mt-6 flex flex-1 flex-col gap-3 w-full rounded-xl border border-slate-700 bg-slate-950/50 p-6 shadow-lg"
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
  deleteError: string | null;
  deleteSuccess: string | null;
  facultyActionError: string | null;
  onClearDeleteMessages: () => void;
}) {
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
  const [initialLoadInfo, setInitialLoadInfo] = useState<string | null>(null);
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

      setAvailableAcademicYears(years);
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
        setAcademicYear("");
        setSemester("1st Semester");
        setVerificationStatus(null);
        setVerificationError(null);
      }, 0);

      return () => window.clearTimeout(timeoutId);
      return;
    }

    // Load available academic years without setting requirement status yet
    // Requirement status will be set when modal is opened
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
          // Compute a sensible default semester based on latest submission date
          let computedYear = selectedYear || years[0] || "";
          let computedSem: SemesterOption = "1st Semester";

          try {
            const subsResp = await fetch(
              `/api/admin/faculty/submissions?facultyId=${selectedFaculty.id}`,
              { credentials: "include" },
            );

            if (subsResp.ok) {
              const subsData = await subsResp.json();
              const subs = subsData.submissions || [];
              if (subs.length > 0) {
                const latest = subs.reduce((a: any, b: any) => {
                  const aTime = new Date(
                    a.submitted_at || a.created_at,
                  ).getTime();
                  const bTime = new Date(
                    b.submitted_at || b.created_at,
                  ).getTime();
                  return aTime > bTime ? a : b;
                });

                const dateStr = latest.submitted_at || latest.created_at;
                if (dateStr) {
                  const d = new Date(dateStr);
                  const month = d.getMonth() + 1;
                  const year = d.getFullYear();
                  const startsSchoolYear = month >= 6;
                  computedSem = startsSchoolYear
                    ? "1st Semester"
                    : "2nd Semester";
                  computedYear = startsSchoolYear
                    ? `${year}-${year + 1}`
                    : `${year - 1}-${year}`;
                }
              }
            }
          } catch (e) {
            // ignore and fall back to defaults
          }

          setAvailableAcademicYears(years);
          setAcademicYear(computedYear || "");
          setSemester(computedSem);
          // Don't set verification status here - wait for modal to open
          setVerificationStatus(null);
          setInitialLoadInfo(
            `API returned ${years.length} academic year(s). selected: ${
              computedYear || "(none)"
            }`,
          );
        } else {
          // Try to parse body for error details
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

          setInitialLoadInfo(
            `API returned HTTP ${response.status} - ${details}`,
          );
        }
      } catch (error) {
        console.error("Failed to load academic years", error);
        setInitialLoadInfo(`Failed to load academic years: ${String(error)}`);
      }
    })();
  }, [selectedFaculty]);

  async function onOpenModal() {
    if (!selectedFaculty) return;

    // Recompute semester/year from latest submission to guarantee correct filter
    let useYear = academicYear;
    let useSem = semester;

    try {
      const subsResp = await fetch(
        `/api/admin/faculty/submissions?facultyId=${selectedFaculty.id}`,
        { credentials: "include" },
      );

      if (subsResp.ok) {
        const subsData = await subsResp.json();
        const subs = subsData.submissions || [];
        if (subs.length > 0) {
          const latest = subs.reduce((a: any, b: any) => {
            const aTime = new Date(a.submitted_at || a.created_at).getTime();
            const bTime = new Date(b.submitted_at || b.created_at).getTime();
            return aTime > bTime ? a : b;
          });

          const dateStr = latest.submitted_at || latest.created_at;
          if (dateStr) {
            const d = new Date(dateStr);
            const month = d.getMonth() + 1;
            const year = d.getFullYear();
            const startsSchoolYear = month >= 6;
            useSem = startsSchoolYear ? "1st Semester" : "2nd Semester";
            useYear = startsSchoolYear
              ? `${year}-${year + 1}`
              : `${year - 1}-${year}`;
          }
        }
      }
    } catch (e) {
      // ignore and use current selection
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
              only that term&apos;s requirements.
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
                {initialLoadInfo ? (
                  <p className="mt-2 text-xs text-slate-400">
                    {initialLoadInfo}
                  </p>
                ) : null}
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
            {verificationError ? (
              <p className="mt-2 text-sm text-red-300">{verificationError}</p>
            ) : null}

            {verificationStatus ? (
              <div className="mt-2 rounded-md border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
                <div className="font-semibold text-slate-100">
                  Verification status (debug):
                </div>
                <pre className="whitespace-pre-wrap mt-1">
                  {JSON.stringify(verificationStatus, null, 2)}
                </pre>
              </div>
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
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<
    string | null
  >(null);
  const [reviewRemarks, setReviewRemarks] = useState("");

  async function handleViewRequirement(code: RequirementCode) {
    setIsLoadingSubmissions(true);
    try {
      const response = await fetch(
        `/api/admin/faculty/submissions?facultyId=${facultyId}`,
        { credentials: "include" },
      );
      if (response.ok) {
        const data = await response.json();
        const filtered = (data.submissions || []).filter(
          (sub: any) => sub.requirement_code === code,
        );
        setSubmissions(filtered);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {REQUIREMENT_LABEL[viewingRequirement]}
            </h2>
            <button
              type="button"
              onClick={() => setViewingRequirement(null)}
              className="text-slate-400 hover:text-slate-200"
              aria-label="Back"
            >
              ←
            </button>
          </div>

          <p className="text-sm text-slate-300 mb-4">
            <span className="text-slate-400">Faculty:</span> {facultyName}
          </p>

          {isLoadingSubmissions ? (
            <p className="text-sm text-slate-400">Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-slate-400">
              No submissions found for this requirement.
            </p>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission: any) => (
                <div
                  key={submission.id}
                  className="rounded-lg border border-slate-700 bg-slate-900 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        submission.status === "validated"
                          ? "bg-green-900/30 text-green-400"
                          : submission.status === "rejected"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-yellow-900/30 text-yellow-400"
                      }`}
                    >
                      {submission.status.charAt(0).toUpperCase() +
                        submission.status.slice(1)}
                    </span>
                    <p className="text-xs text-slate-500">
                      {new Date(submission.submitted_at).toLocaleDateString()}
                    </p>
                  </div>

                  {submission.document_versions &&
                    submission.document_versions.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {submission.document_versions.map((doc: any) => {
                          const fileName = doc.storage_path.split("/").pop();
                          const url = `/api/storage/download?path=${encodeURIComponent(
                            doc.storage_path,
                          )}`;
                          const isImage = /\.(jpe?g|png|gif|bmp)$/i.test(
                            fileName,
                          );
                          const isPdf = /\.pdf$/i.test(fileName);

                          return (
                            <div
                              key={doc.id}
                              className="rounded-md border border-slate-800 p-3 bg-slate-900"
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-400">
                                  📄 {fileName} ·{" "}
                                  {(doc.size_bytes / 1024).toFixed(1)} KB
                                </div>
                                <div className="flex gap-2">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1 text-xs text-blue-400 hover:bg-slate-700"
                                  >
                                    Open full view
                                  </a>
                                </div>
                              </div>

                              <div className="mt-3">
                                {isImage ? (
                                  <Image
                                    src={url}
                                    alt={fileName}
                                    width={640}
                                    height={360}
                                    unoptimized
                                    className="max-h-64 w-auto rounded-md border border-slate-700"
                                  />
                                ) : isPdf ? (
                                  <iframe
                                    src={url}
                                    className="w-full h-64 rounded-md border border-slate-700"
                                    title={fileName}
                                  />
                                ) : (
                                  <div className="text-sm text-slate-300">
                                    Preview not available for this file type.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {submission.status === "uploaded" && (
                    <div className="mt-4 space-y-3 border-t border-slate-700 pt-3">
                      <textarea
                        placeholder="Add remarks (optional)"
                        value={reviewRemarks}
                        onChange={(e) => setReviewRemarks(e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 placeholder-slate-500 outline-none focus:ring focus:ring-amber-300/30"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleReviewSubmission(submission.id, "validated")
                          }
                          disabled={reviewingSubmissionId === submission.id}
                          className="flex-1 rounded-md bg-green-600 px-3 py-2 text-xs text-white font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {reviewingSubmissionId === submission.id
                            ? "Approving..."
                            : "✓ Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleReviewSubmission(submission.id, "rejected")
                          }
                          disabled={reviewingSubmissionId === submission.id}
                          className="flex-1 rounded-md bg-red-600 px-3 py-2 text-xs text-white font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          {reviewingSubmissionId === submission.id
                            ? "Rejecting..."
                            : "✗ Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button
              onClick={() => setViewingRequirement(null)}
              variant="secondary"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="mt-3 rounded-lg border border-amber-700/50 bg-amber-900/20 p-3">
          <p className="text-xs text-amber-300 font-medium">
            Requirement Status Guide:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-200">
            <li>
              • <span className="text-green-400">Validated</span> - Admin
              approved
            </li>
            <li>
              • <span className="text-yellow-400">Uploaded</span> - Waiting for
              admin review (has View button)
            </li>
            <li>
              • <span className="text-red-400">Not Submitted</span> - Faculty
              hasn&apos;t submitted yet
            </li>
          </ul>
        </div>

        <div className="mt-4 space-y-2">
          {requirementStatus ? (
            DEFAULT_REQUIREMENTS.map((code) => {
              const status = requirementStatus[code] ?? "not_submitted";
              return (
                <div
                  key={code}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                >
                  <p className="text-sm text-slate-300">
                    {REQUIREMENT_LABEL[code]}
                  </p>
                  <div className="flex items-center gap-2">
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
                    {status === "uploaded" && (
                      <button
                        type="button"
                        onClick={() => handleViewRequirement(code)}
                        className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-400">
              No requirements data loaded. Please refresh the modal.
            </p>
          )}
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
