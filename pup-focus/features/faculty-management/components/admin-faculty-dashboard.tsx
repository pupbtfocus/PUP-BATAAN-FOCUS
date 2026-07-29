"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { AdminAcademicTerms } from "@/features/admin-management/components/admin-academic-terms";
import {
  facultyAccountSchema,
  type FacultyAccountFormInput,
} from "@/features/faculty-management/schemas/faculty-account.schema";
import type {
  AdminSection,
  CreateFacultyResult,
  FacultyAccount,
  PendingFacultyAction,
} from "@/features/faculty-management/types/faculty-dashboard.types";
import { FacultyTable } from "./faculty-table";
import { AddFacultyModal } from "./faculty-modals/add-faculty-modal";
import { EditFacultyModal } from "./faculty-modals/edit-faculty-modal";
import { DeleteFacultyModal } from "./faculty-modals/delete-faculty-modal";
import { InviteStatusModal } from "./faculty-modals/invite-status-modal";
import { SubmissionWindowPanel } from "./submission-window-panel";
import { RequirementsPanel } from "./requirements-verification-panel";

const LOGIN_PAGE_IMAGES = [
  "/images/attachments/IMG_9399.jpeg",
  "/images/attachments/IMG_9402.jpeg",
];

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
      programId: "",
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

    if (kind === "activate") {
      await performActivateFaculty(facultyId);
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
      payload.append("programId", input.programId);

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
      form.reset({ firstName: "", middleName: "", lastName: "", email: "", programId: "" });
      setProfileImageFile(null);
      setProfileImageInputKey((value) => value + 1);

      await loadFacultyFromDatabase();
    } catch {
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
      } catch {
        if (response.ok) {
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
          // Keep default message
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

  function onActivateFaculty(facultyId: string) {
    setPendingFacultyAction({ kind: "activate", facultyId });
  }

  async function performActivateFaculty(facultyId: string) {
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
          // Keep default message
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
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 overflow-y-auto rounded-r-2xl border border-l-0 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-5 shadow-lg">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-lg">
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
                  <div className="inline-block w-max rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-[#7a0000] dark:text-amber-300">
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

                <section className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/80 p-5 shadow-lg shadow-black/20">
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

                  <FacultyTable
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
                  <div className="inline-block w-max rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-[#7a0000] dark:text-amber-300">
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
                  <div className="inline-block w-max rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-[#7a0000] dark:text-amber-300">
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
                  <div className="inline-block w-max rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-[#7a0000] dark:text-amber-300">
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

                <section className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/80 p-5 shadow-lg shadow-black/20">
                  <AdminAcademicTerms adminName={adminName ?? "Admin"} />
                </section>
              </article>
            ) : null}
          </div>
        </div>
      </div>

      {detailsModalOpen && detailsFacultyId ? (
        <EditFacultyModal
          facultyId={detailsFacultyId}
          facultyAccounts={facultyAccounts}
          onClose={() => setDetailsModalOpen(false)}
          onSave={refreshCurrentPanel}
        />
      ) : null}

      <DeleteFacultyModal
        pendingFacultyAction={pendingFacultyAction}
        pendingFaculty={pendingFaculty}
        onCancel={() => setPendingFacultyAction(null)}
        onConfirm={confirmPendingFacultyAction}
      />

      <InviteStatusModal
        isOpen={inviteModalOpen}
        inviteWasSent={inviteWasSent}
        inviteModalMessage={inviteModalMessage}
        onClose={() => setInviteModalOpen(false)}
      />

      <AddFacultyModal
        isOpen={addFacultyModalOpen}
        onClose={() => {
          setAddFacultyModalOpen(false);
          setCreateError(null);
          setCreateSuccess(null);
          setProfileImageFile(null);
          setProfileImageInputKey((value) => value + 1);
        }}
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
  );
}
