"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent } from "@/components/sidebar";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/shared/logout-button";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";
import { AdminAcademicTerms } from "@/features/admin-management/components/admin-academic-terms";
import { AdminSettings } from "@/features/admin-management/components/admin-settings";
import { createClient } from "@/lib/supabase/client";
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

function normalizeAdminSection(raw?: string | null): AdminSection | null {
  if (!raw) return null;
  const val = raw.toLowerCase().trim();
  if (val === "dashboard") return "dashboard";
  if (
    val === "facultymanagement" ||
    val === "faculty-management" ||
    val === "faculty"
  )
    return "facultyManagement";
  if (
    val === "requirements" ||
    val === "requirements-verification"
  )
    return "requirements";
  if (
    val === "submissionwindow" ||
    val === "submission-window"
  )
    return "submissionWindow";
  if (
    val === "academicterms" ||
    val === "academic-terms"
  )
    return "academicTerms";
  if (
    val === "settings" ||
    val === "admin-settings"
  )
    return "settings";
  if (val === "details") return "details";
  return null;
}

export function AdminFacultyDashboard({
  adminName,
  adminEmail,
  initialTab,
}: {
  adminName?: string | null;
  adminEmail?: string | null;
  initialTab?: string | null;
}) {
  const searchParams = useSearchParams();

  // Initialize active tab from SSR-safe parameters (identical on server and client)
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    const fromProp = normalizeAdminSection(initialTab);
    if (fromProp) return fromProp;

    const tabParam = searchParams?.get("tab") || searchParams?.get("section");
    const fromParams = normalizeAdminSection(tabParam);
    if (fromParams) return fromParams;

    return "facultyManagement";
  });

  const [facultyAccounts, setFacultyAccounts] = useState<FacultyAccount[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(
    null,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Restore stored tab if no URL param was provided, then mark mounted
  useEffect(() => {
    const tabParam = searchParams?.get("tab") || searchParams?.get("section");
    if (!tabParam) {
      try {
        const stored =
          localStorage.getItem("activeAdminTab") ||
          localStorage.getItem("activeAdminSection");
        const fromStorage = normalizeAdminSection(stored);
        if (fromStorage && fromStorage !== activeSection) {
          setActiveSection(fromStorage);
          const url = new URL(window.location.href);
          url.searchParams.set("tab", fromStorage);
          window.history.replaceState(null, "", url.toString());
        }
      } catch {}
    }
    setIsMounted(true);
  }, []);

  // Sync tab state when URL changes externally (e.g. browser back/forward buttons)
  useEffect(() => {
    const tabParam = searchParams?.get("tab") || searchParams?.get("section");
    const normalizedParam = normalizeAdminSection(tabParam);
    if (normalizedParam && normalizedParam !== activeSection) {
      setActiveSection(normalizedParam);
    }
  }, [searchParams, activeSection]);

  const handleSetActiveSection = (section: AdminSection) => {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("activeAdminTab", section);
        localStorage.setItem("activeAdminSection", section);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", section);
        window.history.replaceState(null, "", url.toString());
      } catch {}
    }
  };
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
  const [adminAvatarUrl, setAdminAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    void loadFacultyFromDatabase();

    async function loadAdminAvatar() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const activeAvatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;

        if (activeAvatar) {
          if (!activeAvatar.startsWith("http")) {
            const cleanPath = activeAvatar.replace(/^avatars\//, "");
            const { data: pub } = supabase.storage
              .from("avatars")
              .getPublicUrl(cleanPath);
            setAdminAvatarUrl(pub?.publicUrl || activeAvatar);
          } else {
            setAdminAvatarUrl(activeAvatar);
          }
        }
      } catch (e) {
        console.warn("Failed to load admin avatar:", e);
      }
    }

    void loadAdminAvatar();
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
      form.reset({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        programId: "",
      });
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

  if (!isMounted) {
    return <SystemLoadingScreen />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Consolidated Top Header (All Views) */}
      <header className="w-full bg-gradient-to-r from-[#400000] via-[#2a0000] to-[#1a0000] border-b border-amber-500/20 px-4 py-3 flex items-center justify-between shrink-0 z-40">
        {/* Left: Mobile Menu Trigger & Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 text-amber-300 hover:bg-amber-500/10 rounded-xl transition-all"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <BrandMark size={28} className="shrink-0" />
            <span className="font-bold text-slate-100 text-sm sm:text-base tracking-wide">
              PUP FOCUS
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationDrawer />
          <LogoutButton />
        </div>
      </header>

      {/* Body Wrapper */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Fixed Sidebar */}
        <aside className="hidden md:flex w-56 flex-col bg-[#0d121f] border-r border-slate-800/80 shrink-0 p-2.5">
          <SidebarContent
            activeSection={activeSection}
            setActiveSection={handleSetActiveSection}
            adminName={adminName}
            profileImageUrl={adminAvatarUrl}
          />
        </aside>

        {/* Mobile Navigation Drawer / Sheet */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[60] md:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="relative w-64 max-w-[80%] bg-[#0d121f] h-full p-3 border-r border-slate-800 flex flex-col justify-between z-10 shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Navigation</span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  aria-label="Close navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SidebarContent
                activeSection={activeSection}
                setActiveSection={handleSetActiveSection}
                adminName={adminName}
                profileImageUrl={adminAvatarUrl}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* Scrollable Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#090d16]">
          <div className="max-w-7xl mx-auto w-full">
            {activeSection === "dashboard" ? (
              <article className="space-y-6">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BrandMark size={90} className="rounded-full" />
                    <p className="mt-4 text-xs uppercase tracking-[0.28em] text-[#ffd700]">
                      Polytechnic University of the Philippines - Bataan Campus
                    </p>
                    <h3 className="mt-2 text-3xl font-bold tracking-tight text-[#fff8e7]">
                      PUP FOCUS Dashboard
                    </h3>
                  </div>
                </div>
              </article>
            ) : null}

                {activeSection === "facultyManagement" ? (
                  <article className="space-y-4 p-2 sm:p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                          Faculty Management
                        </h1>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setCreateError(null);
                            setCreateSuccess(null);
                            setAddFacultyModalOpen(true);
                          }}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-lg bg-amber-400 hover:bg-amber-300 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-slate-950 transition"
                        >
                          + Add Faculty
                        </button>
                        <button
                          type="button"
                          onClick={() => void refreshCurrentPanel()}
                          disabled={isLoading}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 sm:py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-850 hover:text-white transition disabled:opacity-50"
                        >
                          {isLoading ? "Refreshing..." : "⟳ Refresh"}
                        </button>
                      </div>
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
                  </article>
                ) : null}

                {activeSection === "requirements" ? (
                  <article className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-100 tracking-tight">
                          Requirements Verification
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshCurrentPanel()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-850 hover:text-white transition disabled:opacity-50"
                      >
                        {isLoading ? "Refreshing..." : "⟳ Refresh"}
                      </button>
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
                  <article className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-100 tracking-tight">
                          Submission Window
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshCurrentPanel()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-850 hover:text-white transition disabled:opacity-50"
                      >
                        {isLoading ? "Refreshing..." : "⟳ Refresh"}
                      </button>
                    </div>

                    <SubmissionWindowPanel
                      onWindowChange={() =>
                        setVerificationResetTrigger((prev) => prev + 1)
                      }
                    />
                  </article>
                ) : null}

                {activeSection === "academicTerms" ? (
                  <article className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-100 tracking-tight">
                          Academic Term Management
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshCurrentPanel()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-850 hover:text-white transition disabled:opacity-50"
                      >
                        {isLoading ? "Refreshing..." : "⟳ Refresh"}
                      </button>
                    </div>

                    <section className="rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md p-4 shadow-lg">
                      <AdminAcademicTerms adminName={adminName ?? "Admin"} />
                    </section>
                  </article>
                ) : null}

                {activeSection === "settings" ? (
                  <article className="p-4 md:p-5">
                    <AdminSettings
                      adminName={adminName ?? "Admin"}
                      adminEmail={adminEmail ?? null}
                      profileImageUrl={adminAvatarUrl}
                    />
                  </article>
                ) : null}
          </div>
        </main>
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
