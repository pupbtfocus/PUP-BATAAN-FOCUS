"use client";

import React, { useState } from "react";
import {
  Check,
  CheckCircle,
  Copy,
  Eye,
  EyeClosed,
  Hourglass,
  Key,
  Mail,
  NavArrowRight,
  Refresh,
  Shield,
  Star,
  SystemRestart,
  WarningCircle,
  WarningTriangle,
  Xmark,
  Page,
  Group,
  Activity,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Logo } from "@/components/ui/logo";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
  buildForgotPasswordEmailHtml,
  buildSubmissionWindowNotificationEmailHtml,
} from "@/lib/email/email-templates";
import { ROLE, type AppRole } from "@/config/roles";
import {
  AuthFeedbackModal,
  type AuthModalState,
} from "@/components/auth/auth-feedback-modal";
import successfullyIcon from "@/assets/icons animations/successfully.svg";
import failedIcon from "@/assets/icons animations/fail.svg";
import loadingIcon from "@/assets/icons animations/loading.svg";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import { CancelledInviteModal } from "@/components/auth/cancelled-invite-modal";
import { EmailVerificationCard } from "@/components/auth/email-verification-card";
import { AlertPopup } from "@/components/ui/alert-popup";
import { ArrowRight, Eye as LucideEye, EyeOff as LucideEyeOff, Check as LucideCheck, X as LucideX } from "lucide-react";
import { FacultyIncompleteRequirementsModal } from "@/features/faculty-management/components/faculty-incomplete-requirements-modal";

type PreviewTab =
  | "gmail"
  | "verification"
  | "change-password"
  | "login-feedback"
  | "modals";

export function DevPreviewPanel() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("gmail");

  // Login Success, Fail & Loading Preview State
  const [authFeedbackModal, setAuthFeedbackModal] = useState<AuthModalState | null>(null);
  const [testLoginEmail, setTestLoginEmail] = useState("preview@pupfocus.dev");
  const [testLoginPassword, setTestLoginPassword] = useState("PreviewPassword2026!");
  const [previewAnimationKey, setPreviewAnimationKey] = useState(Date.now());
  const [showSystemLoadingScreen, setShowSystemLoadingScreen] = useState(false);
  const [isSimulatingLoginSequence, setIsSimulatingLoginSequence] = useState(false);

  // Email Preview State
  const [emailTemplate, setEmailTemplate] = useState<"invite" | "temp-credentials" | "forgot-password" | "window">("invite");
  const [emailRole, setEmailRole] = useState<AppRole>(ROLE.ADMIN);
  const [recipientName, setRecipientName] = useState("Jane Doe");
  const [recipientEmail, setRecipientEmail] = useState("preview@pupfocus.dev");
  const [emailCopied, setEmailCopied] = useState(false);
  const [credentialsCopiedField, setCredentialsCopiedField] = useState<"email" | "password" | "all" | null>(null);
  const [gmailStarred, setGmailStarred] = useState(false);

  // Verification Screen Preview State
  const [verifyStatus, setVerifyStatus] = useState<"loading" | "success" | "error" | "cancelled">("success");
  const [showCancelledInviteModalPreview, setShowCancelledInviteModalPreview] = useState(false);

  // First Login Change Password Preview State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSimulatingSave, setIsSimulatingSave] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [devToast, setDevToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modals Showcase State
  const [activeShowcaseModal, setActiveShowcaseModal] = useState<
    "extension-logs" | "close-safety" | "warning-requirements" | "faculty-not-submitted" | null
  >(null);
  const [safetyCountdown, setSafetyCountdown] = useState(10);

  // Extract first name only for faculty/admin display
  const recipientFirstName = recipientName.trim().split(/\s+/)[0] || "User";

  // Generate Email HTML
  const getRenderedEmailHtml = () => {
    if (emailTemplate === "invite") {
      return buildInviteEmailHtml({
        fullName: recipientName,
        firstName: recipientFirstName,
        link: "#preview-invite-link",
        invitedRole: emailRole,
      });
    }
    if (emailTemplate === "temp-credentials") {
      return buildTempPasswordEmailHtml({
        fullName: recipientName,
        firstName: recipientFirstName,
        email: recipientEmail,
        tempPassword: "PupFocus_TempPass_9823#",
        signInHref: "#preview-signin",
      });
    }
    if (emailTemplate === "forgot-password") {
      return buildForgotPasswordEmailHtml({
        fullName: recipientName,
        firstName: recipientFirstName,
        email: recipientEmail,
        resetLink: "#preview-reset-password",
      });
    }
    return buildSubmissionWindowNotificationEmailHtml({
      fullName: recipientName,
      firstName: recipientFirstName,
      startDate: "September 10, 2026",
      endDate: "September 24, 2026",
      startTimeLabel: "08:00 AM",
      endTimeLabel: "11:59 PM",
      actionHref: "#preview-window",
    });
  };

  const copyCredentialsText = async (text: string, field: "email" | "password" | "all") => {
    try {
      await navigator.clipboard.writeText(text);
      setCredentialsCopiedField(field);
      setTimeout(() => setCredentialsCopiedField(null), 2500);
    } catch {
      // ignore
    }
  };

  const copyEmailHtml = async () => {
    try {
      await navigator.clipboard.writeText(getRenderedEmailHtml());
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSimulatePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDevToast(null);

    if (newPassword.length < 8) {
      setDevToast({
        type: "error",
        message: "Password must be at least 8 characters long.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setDevToast({
        type: "error",
        message: "Password confirmation does not match.",
      });
      return;
    }

    setIsSimulatingSave(true);
    setTimeout(() => {
      setIsSimulatingSave(false);
      setDevToast({
        type: "success",
        message: "Password updated successfully! Redirecting to dashboard...",
      });
      setTimeout(() => {
        setNewPassword("");
        setConfirmPassword("");
        if (isPasswordModalOpen) setIsPasswordModalOpen(false);
      }, 2500);
    }, 1000);
  };

  const handleSimulateRealisticLogin = (outcome: "success" | "fail") => {
    setIsSimulatingLoginSequence(true);
    setAuthFeedbackModal({
      title: "Authenticating...",
      message: "Verifying institutional credentials with campus directory...",
      variant: "loading",
    });

    setTimeout(() => {
      setIsSimulatingLoginSequence(false);
      if (outcome === "success") {
        setAuthFeedbackModal({
          title: "Login Successful",
          message: `Welcome back, ${testLoginEmail.split("@")[0] || "User"}!`,
          actionLabel: "Continue",
          variant: "success",
        });
      } else {
        setAuthFeedbackModal({
          title: "Login Failed",
          message:
            "Invalid institutional email address or password. Please verify your credentials and try again.",
          actionLabel: "Try Again",
          variant: "error",
        });
      }
    }, 1600);
  };

  const handleTriggerSystemLoading = () => {
    setShowSystemLoadingScreen(true);
    setTimeout(() => {
      setShowSystemLoadingScreen(false);
    }, 3200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
      {/* Top Header Card */}
      <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-500/60 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Developer Feature Preview
            </span>
            <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-medium px-2 py-0.5 rounded-full">
              Live QA Sandbox
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Features & Modal Interactive Previews
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Test and preview user verification flows, Gmail email templates, first-time login screens, and system dialogs without modifying production data.
          </p>
        </div>

        {/* Global Action Badges */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <AppIcon icon={Shield} size="md" color="active" />
            <span>Mock Mode: Safe</span>
          </span>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500/60 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("gmail")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            activeTab === "gmail"
              ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <AppIcon icon={Mail} size="md" color="inherit" />
          <span>Gmail & Email</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("verification")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            activeTab === "verification"
              ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <AppIcon icon={Shield} size="md" color="inherit" />
          <span>Verify Tab Screen</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("change-password")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            activeTab === "change-password"
              ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <AppIcon icon={Key} size="md" color="inherit" />
          <span>First Login Change Pass</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("login-feedback")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            activeTab === "login-feedback"
              ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <AppIcon icon={CheckCircle} size="md" color="success" />
          <span>Login, Fail & Loading</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("modals")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            activeTab === "modals"
              ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <AppIcon icon={Eye} size="md" color="inherit" />
          <span>Modals Showcase</span>
        </button>
      </div>

      {/* TAB 1: GMAIL & EMAIL TEMPLATES */}
      {activeTab === "gmail" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Template:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950 text-xs">
                  <button
                    type="button"
                    onClick={() => setEmailTemplate("invite")}
                    className={`px-3 py-1 rounded-md font-medium cursor-pointer transition ${
                      emailTemplate === "invite"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Account Invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailTemplate("temp-credentials")}
                    className={`px-3 py-1 rounded-md font-medium cursor-pointer transition ${
                      emailTemplate === "temp-credentials"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Temporary Credentials
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailTemplate("forgot-password")}
                    className={`px-3 py-1 rounded-md font-medium cursor-pointer transition ${
                      emailTemplate === "forgot-password"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Forgot Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailTemplate("window")}
                    className={`px-3 py-1 rounded-md font-medium cursor-pointer transition ${
                      emailTemplate === "window"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Submission Window Announcement
                  </button>
                </div>

                {emailTemplate === "invite" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Role:
                    </span>
                    <select
                      value={emailRole}
                      onChange={(e) => setEmailRole(e.target.value as AppRole)}
                      className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-slate-800 dark:text-slate-200 outline-none"
                    >
                      <option value={ROLE.ADMIN}>Admin</option>
                      <option value={ROLE.FACULTY}>Faculty</option>
                      <option value={ROLE.SUPER_ADMIN}>Super Admin</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyEmailHtml}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  {emailCopied ? <AppIcon icon={Check} size="sm" color="success" /> : <AppIcon icon={Copy} size="sm" color="inherit" />}
                  <span>{emailCopied ? "HTML Copied!" : "Copy Raw HTML"}</span>
                </button>
                {emailTemplate === "forgot-password" && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#3d0000] transition cursor-pointer shadow-2xs"
                  >
                    <AppIcon icon={Key} size="sm" color="inherit" />
                    <span>Launch "Forgot Password" Modal</span>
                  </button>
                )}
                {emailTemplate === "invite" && (
                  <button
                    type="button"
                    onClick={() => setShowCancelledInviteModalPreview(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white transition cursor-pointer shadow-2xs"
                  >
                    <AppIcon icon={WarningTriangle} size="sm" color="inherit" />
                    <span>Preview "Cancelled Invite" Modal</span>
                  </button>
                )}
                <a
                  href="/email-preview"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-2xs"
                >
                  <span>Open in Popout Tab</span>
                  <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                </a>
              </div>
            </div>

            {/* Recipient Details Filter Row */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Full Name:
                </span>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient Name"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-slate-800 dark:text-slate-200 outline-none w-36"
                />
                <span className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-medium">
                  Greeting uses first name: <strong>Hello {recipientFirstName},</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Email Address:
                </span>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Email Address"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-slate-800 dark:text-slate-200 outline-none w-48"
                />
              </div>
            </div>

            {/* Interactive Temporary Credentials Quick Bar (when temp-credentials is selected) */}
            {emailTemplate === "temp-credentials" && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-[11px]">
                    <AppIcon icon={Key} size="sm" color="warning" />
                    <span>Temporary Credentials:</span>
                  </span>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Email:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{recipientEmail}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Password:</span>
                    <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">PupFocus_TempPass_9823#</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => copyCredentialsText(recipientEmail, "email")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition cursor-pointer"
                  >
                    {credentialsCopiedField === "email" ? (
                      <>
                        <AppIcon icon={Check} size="xs" color="success" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Email Copied</span>
                      </>
                    ) : (
                      <>
                        <AppIcon icon={Copy} size="xs" color="inherit" />
                        <span>Copy Email</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyCredentialsText("PupFocus_TempPass_9823#", "password")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition cursor-pointer"
                  >
                    {credentialsCopiedField === "password" ? (
                      <>
                        <AppIcon icon={Check} size="xs" color="success" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Password Copied</span>
                      </>
                    ) : (
                      <>
                        <AppIcon icon={Copy} size="xs" color="inherit" />
                        <span>Copy Password</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyCredentialsText(
                        `Email: ${recipientEmail}\nTemporary Password: PupFocus_TempPass_9823#`,
                        "all"
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-2xs"
                  >
                    {credentialsCopiedField === "all" ? (
                      <>
                        <AppIcon icon={Check} size="xs" color="inherit" />
                        <span>All Copied!</span>
                      </>
                    ) : (
                      <>
                        <AppIcon icon={Copy} size="xs" color="inherit" />
                        <span>Copy Both</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Realistic Gmail Webmail Mockup */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
            {/* Gmail Top Bar */}
            <div className="bg-slate-100 dark:bg-slate-950 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 pl-2">
                  <AppIcon icon={Mail} size="md" color="danger" />
                  <span>Gmail Inbox • {recipientEmail}</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Simulated Institutional Webmail
              </div>
            </div>

            {/* Email Header inside Gmail */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#4d0000] border-2 border-amber-400/80 text-amber-300 font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm">
                  PF
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {emailTemplate === "invite"
                        ? "Welcome to PUP FOCUS — Account Access"
                        : emailTemplate === "temp-credentials"
                        ? "Your Temporary Credentials for PUP FOCUS"
                        : emailTemplate === "forgot-password"
                        ? "Reset your PUP FOCUS Password"
                        : "PUP FOCUS — Submission Window Schedule Announcement"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setGmailStarred(!gmailStarred)}
                      className="cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          gmailStarred
                            ? "text-amber-500 fill-amber-500"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    From: <span className="font-medium text-slate-700 dark:text-slate-300">PUP FOCUS System</span> &lt;no-reply@pupfocus.edu.ph&gt; • To: {recipientFirstName} &lt;{recipientEmail}&gt;
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 self-start sm:self-auto">
                Just now (0 min ago)
              </div>
            </div>

            {/* Cancelled Invite Simulation Hint Banner */}
            {emailTemplate === "invite" && (
              <div className="mx-4 sm:mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
                  <AppIcon icon={WarningTriangle} size="sm" color="inherit" />
                  <span>
                    <strong>Interactive Preview:</strong> Click the <strong>&quot;Accept Invitation&quot;</strong> button inside the email below to test the <strong>Cancelled Invite Modal</strong> flow.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelledInviteModalPreview(true)}
                  className="shrink-0 px-3 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Open Modal Directly
                </button>
              </div>
            )}

            {/* Email Body Container */}
            <div className="p-4 sm:p-8 bg-[#f7efe7] dark:bg-slate-950/60 overflow-x-auto">
              <div
                className={`max-w-[620px] mx-auto transition-all ${emailTemplate === "invite" ? "cursor-pointer" : ""}`}
                onClick={(e) => {
                  const target = (e.target as HTMLElement).closest("a");
                  if (target && emailTemplate === "invite") {
                    e.preventDefault();
                    setShowCancelledInviteModalPreview(true);
                  }
                }}
                title={emailTemplate === "invite" ? "Click 'Accept Invitation' to preview Cancelled Invite Modal" : undefined}
                dangerouslySetInnerHTML={{ __html: getRenderedEmailHtml() }}
              />
            </div>

            {/* Email Footer Bar with Contextual CTA */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                {emailTemplate === "invite"
                  ? "Clicking the button in the invitation email takes the user directly to the /auth/confirm verification tab."
                  : emailTemplate === "temp-credentials"
                  ? "Clicking 'Sign in to PUP FOCUS' directs the user to sign in with their temporary credentials, prompting a first-time password change."
                  : emailTemplate === "forgot-password"
                  ? "Clicking 'Reset Password' directs the user to /auth/change-password with a secure institutional reset token."
                  : "Submission window emails inform faculty about active deadlines with direct links to their document dashboard."}
              </span>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      emailTemplate === "invite"
                        ? "verification"
                        : emailTemplate === "temp-credentials" || emailTemplate === "forgot-password"
                        ? "change-password"
                        : "gmail"
                    )
                  }
                  className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  <span>
                    {emailTemplate === "invite"
                      ? "Switch to Verify Tab Screen Preview"
                      : emailTemplate === "temp-credentials" || emailTemplate === "forgot-password"
                      ? "Switch to Password Change Screen Preview"
                      : "Refresh Email Preview"}
                  </span>
                  <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                </button>

                {emailTemplate === "invite" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("verification");
                      setVerifyStatus("cancelled");
                      setShowCancelledInviteModalPreview(true);
                    }}
                    className="inline-flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer ml-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg px-2.5 py-1 text-xs"
                  >
                    <span>Test Accept Click if Cancelled (Modal)</span>
                    <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VERIFICATION TAB SCREEN (/auth/confirm) */}
      {activeTab === "verification" && (
        <div className="space-y-4">
          {/* Status Controls Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Simulate Screen State:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-1 bg-slate-100 dark:bg-slate-950 text-xs">
                <button
                  type="button"
                  onClick={() => setVerifyStatus("loading")}
                  className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer transition ${
                    verifyStatus === "loading"
                      ? "bg-amber-400 text-slate-950 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  1. Loading / Verifying
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyStatus("success")}
                  className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer transition ${
                    verifyStatus === "success"
                      ? "bg-amber-400 text-slate-950 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  2. Ready (Credentials Issued)
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyStatus("error")}
                  className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer transition ${
                    verifyStatus === "error"
                      ? "bg-amber-400 text-slate-950 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  3. Error / Link Expired
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyStatus("cancelled")}
                  className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer transition ${
                    verifyStatus === "cancelled"
                      ? "bg-amber-400 text-slate-950 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  4. Cancelled Invite
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelledInviteModalPreview(true)}
                  className="px-2.5 py-1.5 rounded-md font-medium text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
                  title="Preview the standalone modal popup dialog"
                >
                  Modal Dialog
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/auth/confirm"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                <span>Live Route /auth/confirm</span>
                <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
              </a>
            </div>
          </div>

          {/* Live Preview of /auth/confirm UI */}
          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-6 sm:p-12 flex items-center justify-center overflow-hidden min-h-[520px]">
            <EmailVerificationCard
              status={verifyStatus}
              email="preview@pupfocus.dev"
              fullName={recipientName}
              temporaryPassword="PupFocus_TempPass_9823#"
              errorMessage={
                verifyStatus === "cancelled"
                  ? "This account invitation has been cancelled or revoked by the institutional administrator. The link in your email is no longer active."
                  : "This invitation link was already used or has expired. Please ask an administrator to send a new invite or sign in if your account is already set up."
              }
              onSignIn={() => setActiveTab("change-password")}
              onReturnToSignIn={() => setActiveTab("login-feedback")}
            />
          </div>
        </div>
      )}

      {/* TAB 3: FIRST LOGIN CHANGE PASSWORD */}
      {activeTab === "change-password" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                First-Time Login Security Gate & Password Recovery
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Preview the first-time login change password screen, the official PUP FOCUS password recovery modal, and top-right solid alerts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/change-password?preview=true"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                <span>Live Route /change-password</span>
                <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
              </a>
              <button
                type="button"
                onClick={() => setIsForgotPasswordModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#3d0000] transition cursor-pointer shadow-2xs"
              >
                <AppIcon icon={Key} size="sm" color="inherit" />
                <span>Launch "Forgot Password" Modal</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-[#780000] hover:bg-[#5E0000] text-white transition cursor-pointer shadow-2xs"
              >
                <AppIcon icon={Eye} size="sm" color="inherit" />
                <span>Launch Fullscreen Modal (New Design)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDevToast({
                    type: "success",
                    message: "Password reset email sent! Please check your institutional inbox.",
                  })
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#0b5336] hover:bg-[#0e6341] text-white transition cursor-pointer shadow-2xs border border-emerald-400/80"
              >
                <AppIcon icon={CheckCircle} size="sm" color="inherit" />
                <span>Test Solid Green Toast</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDevToast({
                    type: "error",
                    message: "Auth session missing! Please request a new password reset link.",
                  })
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white transition cursor-pointer shadow-2xs border border-amber-400/80"
              >
                <AppIcon icon={WarningCircle} size="sm" color="inherit" />
                <span>Test Solid Maroon Toast</span>
              </button>
            </div>
          </div>

          {/* Interactive Card with Login Screen Background */}
          <div className="relative rounded-2xl border border-slate-300 dark:border-slate-800 bg-[#5f0000] p-4 sm:p-10 flex items-center justify-center overflow-hidden min-h-[580px]">
            {/* Campus photo background matching the login screen */}
            <div
              className="absolute inset-0 bg-cover bg-center pointer-events-none"
              style={{ backgroundImage: "url('/images/attachments/IMG_9399.jpeg')" }}
            />
            {/* Overlay with Blur and Gradient matching Login Screen */}
            <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px] pointer-events-none" />
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/50 via-black/20 to-black/30 pointer-events-none" />

            <div className="relative z-10 w-full max-w-[390px] sm:max-w-md mx-auto my-auto drop-shadow-2xl">
              <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
                {/* Email-style Maroon Header Banner (No Logo, matching Account Ready) */}
                <div className="bg-gradient-to-br from-[#4d0000] to-[#780000] px-6 py-6 sm:px-8 sm:py-7 text-center">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#fff8e7]">
                    Set New Password
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-[#f8e3bc] leading-relaxed max-w-sm mx-auto">
                    Create a permanent password to secure your institutional account
                  </p>
                </div>

                {/* Card Body */}
                <div className="p-6 sm:p-7">
                  <form className="space-y-4" onSubmit={handleSimulatePasswordSubmit}>
                    {/* New Password Field */}
                    <div className="space-y-1.5 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-xs uppercase font-semibold tracking-wider text-slate-600 dark:text-slate-300">
                          New Password
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Min. 8 characters</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type={showNewPass ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={8}
                          placeholder="Enter new password"
                          autoComplete="new-password"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#780000]/20 focus:border-[#780000] dark:focus:border-amber-400 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title={showNewPass ? "Hide password" : "Show password"}
                          aria-label={showNewPass ? "Hide password" : "Show password"}
                        >
                          {showNewPass ? (
                            <LucideEyeOff className="w-4 h-4" />
                          ) : (
                            <LucideEye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password Field */}
                    <div className="space-y-1.5 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-xs uppercase font-semibold tracking-wider text-slate-600 dark:text-slate-300">
                          Confirm Password
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Must match</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type={showConfirmPass ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                          placeholder="Confirm new password"
                          autoComplete="new-password"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#780000]/20 focus:border-[#780000] dark:focus:border-amber-400 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title={showConfirmPass ? "Hide password" : "Show password"}
                          aria-label={showConfirmPass ? "Hide password" : "Show password"}
                        >
                          {showConfirmPass ? (
                            <LucideEyeOff className="w-4 h-4" />
                          ) : (
                            <LucideEye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSimulatingSave}
                      className="w-full flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#780000]/30 cursor-pointer disabled:opacity-50 mt-2"
                    >
                      {isSimulatingSave ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving Password...</span>
                        </>
                      ) : (
                        <>
                          <span>Set Password & Proceed</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Footer Note */}
                  <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                      If you have questions or need assistance, please contact your PUP Bataan campus administrator.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LOGIN FEEDBACK & LOADING */}
      {activeTab === "login-feedback" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Institutional Sign-In Feedback & Loading Systems
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect authentic modal animations, gradient borders, loading states, and redirect transitions experienced by users during login.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Authenticating...",
                    message:
                      "Verifying institutional credentials with campus security...",
                    variant: "loading",
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-2xs"
              >
                <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                <span>Launch Loading Modal</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Login Successful",
                    message: "Welcome back, Developer Preview!",
                    actionLabel: "Continue",
                    variant: "success",
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-2xs"
              >
                <AppIcon icon={CheckCircle} size="sm" color="inherit" />
                <span>Launch Login Success</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Login Failed",
                    message:
                      "Invalid institutional email address or password. Please verify your credentials and try again.",
                    actionLabel: "Try Again",
                    variant: "error",
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-2xs"
              >
                <AppIcon icon={Xmark} size="sm" color="inherit" />
                <span>Launch Login Failed</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Account Restricted",
                    message:
                      "Your institutional account has been deactivated by a campus administrator. Please contact IT support.",
                    actionLabel: "Understood",
                    variant: "error",
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                <AppIcon icon={WarningTriangle} size="sm" color="active" />
                <span>Launch Restricted Alert</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerSystemLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-800 dark:text-amber-300 transition cursor-pointer"
              >
                <AppIcon icon={Hourglass} size="sm" color="active" />
                <span>Preview System Loading Screen</span>
              </button>
            </div>
          </div>

          {/* 3-Column Side-by-Side In-Page Inspection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {/* 1. LOADING CARD MOCKUP */}
            <div className="flex flex-col justify-between p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-h-[360px]">
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  State 1: Loading & Verification
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewAnimationKey(Date.now())}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <AppIcon icon={Refresh} size="xs" color="inherit" />
                  <span>Replay</span>
                </button>
              </div>

              <div className="flex flex-col items-center justify-center text-center my-auto py-4">
                <div className="relative w-16 h-16 flex items-center justify-center my-2">
                  <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-slate-800" />
                  <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#780000] border-r-[#780000] dark:border-t-amber-400 dark:border-r-amber-400 animate-spin" />
                  <div className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-xs p-0.5">
                    <img
                      src="/icons/pup-seal.png"
                      alt="PUP Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                  Authenticating...
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[240px]">
                  Verifying institutional credentials with campus directory...
                </p>

                <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <AppIcon icon={SystemRestart} size="xs" color="inherit" className="animate-spin text-[#780000] dark:text-amber-400" />
                  <span>Securing institutional session...</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Authenticating...",
                    message: "Verifying institutional credentials with campus security...",
                    variant: "loading",
                  })
                }
                className="w-full mt-4 flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5E0000] text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
              >
                <span>Launch Loading Modal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. SUCCESS CARD MOCKUP */}
            <div className="flex flex-col justify-between p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-h-[360px]">
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  State 2: Success
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewAnimationKey(Date.now())}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <AppIcon icon={Refresh} size="xs" color="inherit" />
                  <span>Replay</span>
                </button>
              </div>

              <div className="flex flex-col items-center justify-center text-center my-auto py-4">
                <div key={previewAnimationKey} className="relative w-16 h-16 flex items-center justify-center my-2">
                  <div className="absolute inset-0 rounded-full border-[3px] border-emerald-300 dark:border-emerald-700 bg-emerald-100/70 dark:bg-emerald-950/50 animate-auth-ring" />
                  <div className="relative z-10 w-11 h-11 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-md animate-auth-success">
                    <LucideCheck className="w-7 h-7 stroke-[3.5] animate-auth-check" />
                  </div>
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                  Login Successful
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[240px]">
                  Welcome back to PUP FOCUS. Securing institutional session...
                </p>

                <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <AppIcon icon={SystemRestart} size="xs" color="inherit" className="animate-spin" />
                  <span>Redirecting to your portal...</span>
                </div>
              </div>

              <div className="w-full mt-4 h-9 flex items-center justify-center text-xs text-slate-400">
                <span>Auto-redirecting to dashboard</span>
              </div>
            </div>

            {/* 3. FAIL CARD MOCKUP */}
            <div className="flex flex-col justify-between p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-h-[360px]">
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  State 3: Failed
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewAnimationKey(Date.now())}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <AppIcon icon={Refresh} size="xs" color="inherit" />
                  <span>Replay</span>
                </button>
              </div>

              <div className="flex flex-col items-center justify-center text-center my-auto py-4">
                <div key={previewAnimationKey} className="relative w-16 h-16 flex items-center justify-center my-2">
                  <div className="absolute inset-0 rounded-full border-[3px] border-rose-300 dark:border-rose-700 bg-rose-100/70 dark:bg-rose-950/50 animate-auth-ring" />
                  <div className="relative z-10 w-11 h-11 rounded-full bg-rose-600 dark:bg-rose-500 text-white flex items-center justify-center shadow-md animate-auth-error">
                    <LucideX className="w-7 h-7 stroke-[3.5] animate-auth-x" />
                  </div>
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                  Login Failed
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[240px]">
                  Invalid institutional email address or password. Please verify credentials.
                </p>

                <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                  <span>Invalid Credentials</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Login Failed",
                    message:
                      "Invalid institutional email address or password. Please verify your credentials and try again.",
                    actionLabel: "Try Again",
                    variant: "error",
                  })
                }
                className="w-full mt-4 flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5E0000] text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
              >
                <AppIcon icon={Refresh} size="xs" color="inherit" />
                <span>Try Again</span>
              </button>
            </div>
          </div>

          {/* Interactive Live Login Simulation Box */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Live Interactive Sign-In Tester & Sequence Simulator
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Test realistic full-screen authentication sequences (Loading spinner → Verified Success / Failed notice) as experienced by faculty and admins.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={testLoginEmail}
                  onChange={(e) => setTestLoginEmail(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 outline-none text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={testLoginPassword}
                  onChange={(e) => setTestLoginPassword(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 outline-none text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              {/* Realistic Sequence 1: Loading -> Success */}
              <button
                type="button"
                disabled={isSimulatingLoginSequence}
                onClick={() => handleSimulateRealisticLogin("success")}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <AppIcon icon={SystemRestart} size="md" color="inherit" className="text-slate-950 animate-spin" />
                <span>Simulate Flow (Loading → Success)</span>
              </button>

              {/* Realistic Sequence 2: Loading -> Fail */}
              <button
                type="button"
                disabled={isSimulatingLoginSequence}
                onClick={() => handleSimulateRealisticLogin("fail")}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <AppIcon icon={SystemRestart} size="md" color="inherit" className="text-slate-950 animate-spin" />
                <span>Simulate Flow (Loading → Fail)</span>
              </button>

              {/* Instant Loading Only */}
              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Authenticating...",
                    message:
                      "Verifying institutional credentials with campus directory...",
                    variant: "loading",
                  })
                }
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <AppIcon icon={SystemRestart} size="md" color="inherit" className="animate-spin" />
                <span>Launch Loading Modal Only</span>
              </button>

              {/* Instant Success Only */}
              <button
                type="button"
                onClick={() => {
                  setAuthFeedbackModal({
                    title: "Login Successful",
                    message: `Welcome back, ${testLoginEmail.split("@")[0]}!`,
                    actionLabel: "Continue",
                    variant: "success",
                  });
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <AppIcon icon={CheckCircle} size="md" color="inherit" />
                <span>Instant Login Success</span>
              </button>

              {/* Instant Fail Only */}
              <button
                type="button"
                onClick={() => {
                  setAuthFeedbackModal({
                    title: "Login Failed",
                    message:
                      "Invalid institutional email address or password. Please verify your credentials and try again.",
                    actionLabel: "Try Again",
                    variant: "error",
                  });
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <AppIcon icon={Xmark} size="md" color="inherit" />
                <span>Instant Login Failed</span>
              </button>

              {/* Full-Screen Loading Screen Preview */}
              <button
                type="button"
                onClick={handleTriggerSystemLoading}
                className="px-4 py-2 rounded-xl border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-800 dark:text-amber-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <AppIcon icon={Hourglass} size="md" color="active" />
                <span>Preview System Loading Screen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MODALS SHOWCASE */}
      {activeTab === "modals" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Interactive System Modals Launcher
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any button below to trigger and inspect the active dialogs, confirmation timers, and alert modals used across PUP FOCUS.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Modal Card 1: Extension Audit Logs */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AppIcon icon={Hourglass} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Extension Audit Logs
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect the Super Admin exclusive extension history modal with before/after dates, presets (+24h, +1 week), and scope filters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveShowcaseModal("extension-logs")}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 transition cursor-pointer"
              >
                Launch Extension Logs Modal
              </button>
            </div>

            {/* Modal Card 2: 10s Safety Countdown */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AppIcon icon={WarningTriangle} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    10s Safety Timer Modal
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The destructive action protection modal with animated circular 10-second countdown before enabling the confirm button.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSafetyCountdown(10);
                  setActiveShowcaseModal("close-safety");
                }}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 transition cursor-pointer"
              >
                Launch Safety Timer Modal
              </button>
            </div>

            {/* Modal Card 3: Warning Requirements */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500">
                  <AppIcon icon={WarningCircle} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Requirements Warning
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The cautionary modal alerting the admin when attempting to open submissions without active requirements configured.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveShowcaseModal("warning-requirements")}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 transition cursor-pointer"
              >
                Launch Warning Modal
              </button>
            </div>

            {/* Modal Card 4: Login Success Feedback Modal */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <AppIcon icon={CheckCircle} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Login Success Modal
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect the authentic animated checkmark feedback modal with ambient glow and auto-redirect indicator displayed upon login.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Login Successful",
                    message: "Welcome back, Developer Preview!",
                    actionLabel: "Continue",
                    variant: "success",
                  })
                }
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
              >
                Launch Login Success Modal
              </button>
            </div>

            {/* Modal Card 5: Login Failed Feedback Modal */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AppIcon icon={Xmark} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Login Failed Modal
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect the animated error feedback modal displayed when invalid institutional credentials are submitted.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Login Failed",
                    message:
                      "Invalid institutional email address or password. Please verify your credentials and try again.",
                    actionLabel: "Try Again",
                    variant: "error",
                  })
                }
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
              >
                Launch Login Failed Modal
              </button>
            </div>

            {/* Modal Card 6: Account Restricted Modal */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500">
                  <AppIcon icon={WarningTriangle} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Account Restricted Modal
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect the error modal shown when an inactive account attempts to sign into the system.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Account Restricted",
                    message:
                      "Your institutional account has been deactivated by an administrator. Please contact system support.",
                    actionLabel: "Understood",
                    variant: "error",
                  })
                }
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 transition cursor-pointer"
              >
                Launch Restricted Modal
              </button>
            </div>

            {/* Modal Card 7: Auth Loading Modal */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500">
                  <AppIcon icon={SystemRestart} size="lg" color="inherit" className="animate-spin" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Authentication Loading Modal
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect the authentic animated hourglass loading modal displayed while checking credentials and securing the session.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAuthFeedbackModal({
                    title: "Authenticating...",
                    message:
                      "Verifying institutional credentials with campus security...",
                    variant: "loading",
                  })
                }
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition cursor-pointer"
              >
                Launch Loading Modal
              </button>
            </div>

            {/* Modal Card 8: Full-Screen System Loading Screen */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <AppIcon icon={Hourglass} size="lg" color="active" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    System Loading Screen
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The institutional full-screen loading backdrop with PUP Seal, FOCUS emblem, and animated loader used across dashboard routes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerSystemLoading}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 transition cursor-pointer shadow-xs"
              >
                Launch System Loading Screen
              </button>
            </div>

            {/* Modal Card 9: Forgot Password Modal (PUP System Aesthetic) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500">
                  <AppIcon icon={Key} size="lg" color="active" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Forgot Password Modal
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect the redesigned PUP FOCUS password reset modal featuring brand maroon gradient, 3D curved top gold crest, centered logo badge, and high-contrast labels.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPasswordModalOpen(true)}
                className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#3d0000] transition cursor-pointer shadow-2xs"
              >
                Launch Forgot Password Modal
              </button>
            </div>

            {/* Modal Card 10: Top-Right Solid Toast Popups (AlertPopup) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <AppIcon icon={CheckCircle} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Top-Right Solid Alerts
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect top-right solid popups replacing inline banners: solid vibrant green for success and solid rich maroon for errors (such as Auth session missing).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDevToast({
                      type: "success",
                      message: "Password reset email sent! Please check your institutional inbox.",
                    })
                  }
                  className="flex-1 py-2 px-2.5 text-[11px] font-bold rounded-lg bg-[#0b5336] hover:bg-[#0e6341] text-white transition cursor-pointer shadow-2xs border border-emerald-400/80 text-center"
                >
                  Test Solid Green
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDevToast({
                      type: "error",
                      message: "Auth session missing! Please request a new password reset link.",
                    })
                  }
                  className="flex-1 py-2 px-2.5 text-[11px] font-bold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white transition cursor-pointer shadow-2xs border border-amber-400/80 text-center"
                >
                  Test Solid Maroon
                </button>
              </div>
            </div>

            {/* Modal Card 11: Faculty Incomplete Requirements Alert Modal */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500">
                  <AppIcon icon={WarningCircle} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Faculty Pending Requirements Alert
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect the alert popup shown to faculty upon dashboard access for requirements that are Not Submitted, for Revise, or Pending for Validation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveShowcaseModal("faculty-not-submitted")}
                className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-xs active:scale-[0.98]"
              >
                Launch Faculty Pending Modal
              </button>
            </div>

            {/* Modal Card 12: Cancelled Invitation Acceptance Modal */}
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AppIcon icon={WarningTriangle} size="lg" color="inherit" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Cancelled Invite Modal
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect the warning modal displayed when an invited faculty or admin clicks the &quot;Accept Invitation&quot; email button after their invitation has been revoked or cancelled by an administrator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelledInviteModalPreview(true)}
                className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-rose-700 hover:bg-rose-800 text-white transition cursor-pointer shadow-xs active:scale-[0.98]"
              >
                Launch Cancelled Invite Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PASSWORD CHANGE MODAL */}
      {isPasswordModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto"
          onClick={() => setIsPasswordModalOpen(false)}
        >
          {/* Campus photo background matching the login screen */}
          <div
            className="absolute inset-0 bg-cover bg-center pointer-events-none"
            style={{ backgroundImage: "url('/images/attachments/IMG_9399.jpeg')" }}
          />
          {/* Overlay with Blur and Gradient matching Login Screen */}
          <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px] pointer-events-none" />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/60 via-black/30 to-black/40 pointer-events-none" />

          <div
            className="relative z-10 w-full max-w-[390px] sm:max-w-md my-auto drop-shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
              {/* Email-style Maroon Header Banner (No Logo, matching Account Ready) */}
              <div className="bg-gradient-to-br from-[#4d0000] to-[#780000] px-6 py-6 sm:px-8 sm:py-7 text-center">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#fff8e7]">
                  Set New Password
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-[#f8e3bc] leading-relaxed max-w-sm mx-auto">
                  Create a permanent password to secure your institutional account
                </p>
              </div>

              {/* Card Body */}
              <div className="p-6 sm:p-7">
                <form className="space-y-4" onSubmit={handleSimulatePasswordSubmit}>
                  {/* New Password Field */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase font-semibold tracking-wider text-slate-600 dark:text-slate-300">
                        New Password
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">Min. 8 characters</span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showNewPass ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#780000]/20 focus:border-[#780000] dark:focus:border-amber-400 transition"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title={showNewPass ? "Hide password" : "Show password"}
                        aria-label={showNewPass ? "Hide password" : "Show password"}
                      >
                        {showNewPass ? (
                          <LucideEyeOff className="w-4 h-4" />
                        ) : (
                          <LucideEye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase font-semibold tracking-wider text-slate-600 dark:text-slate-300">
                        Confirm Password
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">Must match</span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#780000]/20 focus:border-[#780000] dark:focus:border-amber-400 transition"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title={showConfirmPass ? "Hide password" : "Show password"}
                        aria-label={showConfirmPass ? "Hide password" : "Show password"}
                      >
                        {showConfirmPass ? (
                          <LucideEyeOff className="w-4 h-4" />
                        ) : (
                          <LucideEye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsPasswordModalOpen(false)}
                      className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      Close Preview
                    </button>
                    <button
                      type="submit"
                      disabled={isSimulatingSave}
                      className="flex-1 py-2.5 text-xs font-medium rounded-xl bg-[#780000] hover:bg-[#5E0000] text-white transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSimulatingSave ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <span>Set Password & Proceed</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Footer Note */}
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    If you have questions or need assistance, please contact your PUP Bataan campus administrator.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOWCASE MODAL 1: EXTENSION LOGS */}
      {activeShowcaseModal === "extension-logs" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-2xs shrink-0 flex items-center justify-center">
                  <AppIcon icon={Hourglass} size="md" color="default" />
                </div>
                <h3 className="text-base font-bold">Extension Audit Logs</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors cursor-pointer shadow-xs"
                aria-label="Close"
              >
                <AppIcon icon={Xmark} size="md" color="inherit" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">PUP FOCUS Super Admin</span>
                    <span className="rounded bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase">
                      +24 HOURS
                    </span>
                    <span className="rounded bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium">
                      Scope: Global
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Sep 10, 2026, 2:00 PM</span>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Deadline Change:</span>
                  <span className="text-slate-500 line-through">2026-09-17 11:59 PM</span>
                  <AppIcon icon={NavArrowRight} size="sm" color="muted" />
                  <span className="font-bold font-mono">2026-09-18 at 11:59 PM</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Christian Jay Mandani</span>
                    <span className="rounded bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase">
                      +1 WEEK
                    </span>
                    <span className="rounded bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium">
                      Scope: Global
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Sep 10, 2026, 1:55 PM</span>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Deadline Change:</span>
                  <span className="text-slate-500 line-through">2026-09-10 11:59 PM</span>
                  <AppIcon icon={NavArrowRight} size="sm" color="muted" />
                  <span className="font-bold font-mono">2026-09-17 at 11:59 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOWCASE MODAL 2: 10S SAFETY TIMER */}
      {activeShowcaseModal === "close-safety" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <p className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
              <AppIcon icon={WarningTriangle} size="sm" color="inherit" />
              Destructive Action Preview
            </p>
            <h3 className="text-xl font-bold">Close Submissions Now?</h3>
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              This will immediately close the active submission window and clear the schedule.
            </p>

            <div className="flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-4 py-3">
              <div className="h-10 w-10 rounded-full border-2 border-rose-500 flex items-center justify-center font-bold text-rose-600 text-sm">
                {safetyCountdown}
              </div>
              <p className="text-[11px] text-rose-800 dark:text-rose-300">
                10-second safety lockout protection against accidental closures.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition-all cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white cursor-pointer shadow-xs"
              >
                Confirm Close Submissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHOWCASE MODAL 3: WARNING REQUIREMENTS */}
      {activeShowcaseModal === "warning-requirements" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex items-center justify-center mx-auto text-slate-700 dark:text-slate-300 shadow-2xs">
              <AppIcon icon={WarningTriangle} size="md" color="default" />
            </div>
            <h3 className="text-xl font-bold">No Requirements Configured</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You cannot open a submission window because no faculty compliance requirements have been activated for the current academic term.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="flex-1 py-2.5 rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold cursor-pointer shadow-xs transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="flex-1 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                Review Requirements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHOWCASE MODAL 4: FACULTY INCOMPLETE / NOT SUBMITTED MODAL */}
      <FacultyIncompleteRequirementsModal
        isOpen={activeShowcaseModal === "faculty-not-submitted"}
        onClose={() => setActiveShowcaseModal(null)}
        onGoToSubmissions={() => {
          setActiveShowcaseModal(null);
          setDevToast({
            type: "success",
            message: "Navigation: Redirecting to Documents to be Submitted",
          });
        }}
        notSubmittedCount={4}
        rejectedCount={1}
        pendingValidationCount={2}
        deadlineDisplay="Oct 15, 2026, 11:59 PM"
      />

      {/* FULL-SCREEN SYSTEM LOADING PREVIEW OVERLAY */}
      {showSystemLoadingScreen && (
        <div
          className="fixed inset-0 z-50 cursor-pointer"
          onClick={() => setShowSystemLoadingScreen(false)}
          title="Click anywhere to dismiss loading screen preview"
        >
          <SystemLoadingScreen text="Loading PUP FOCUS Campus Dashboard..." />
          <button
            type="button"
            onClick={() => setShowSystemLoadingScreen(false)}
            className="fixed top-6 right-6 z-50 px-3.5 py-1.5 rounded-full bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-semibold border border-[#5e0000] transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-black/50"
          >
            <AppIcon icon={Xmark} size="sm" color="inherit" />
            <span>Dismiss Preview</span>
          </button>
        </div>
      )}

      {/* AUTH FEEDBACK MODAL (LOGIN SUCCESS, FAIL & LOADING) */}
      <AuthFeedbackModal
        modal={authFeedbackModal}
        onClose={() => setAuthFeedbackModal(null)}
      />

      {/* FORGOT PASSWORD MODAL (PUP BRANDED AESTHETIC) */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        initialEmail={recipientEmail}
      />

      {/* CANCELLED INVITE MODAL PREVIEW */}
      <CancelledInviteModal
        isOpen={showCancelledInviteModalPreview}
        email={recipientEmail}
        fullName={recipientName}
        onClose={() => setShowCancelledInviteModalPreview(false)}
        onReturnToSignIn={() => {
          setShowCancelledInviteModalPreview(false);
          setActiveTab("login-feedback");
        }}
      />

      {/* TOP-RIGHT SOLID ALERT POPUP (GREEN SUCCESS / MAROON ERROR) */}
      {devToast && (
        <AlertPopup
          type={devToast.type}
          message={devToast.message}
          onClose={() => setDevToast(null)}
          position="top-right"
          autoCloseMs={5000}
        />
      )}
    </div>
  );
}
