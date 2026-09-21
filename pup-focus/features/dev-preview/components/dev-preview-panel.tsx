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
  const [emailTemplate, setEmailTemplate] = useState<"invite" | "temp-password" | "window">("invite");
  const [emailRole, setEmailRole] = useState<AppRole>(ROLE.ADMIN);
  const [recipientName, setRecipientName] = useState("Jane Doe");
  const [emailCopied, setEmailCopied] = useState(false);
  const [gmailStarred, setGmailStarred] = useState(false);

  // Verification Screen Preview State
  const [verifyStatus, setVerifyStatus] = useState<"loading" | "success" | "error">("success");
  const [verifyShowPassword, setVerifyShowPassword] = useState(false);
  const [copiedVerifyField, setCopiedVerifyField] = useState<"email" | "password" | "all" | null>(null);

  // First Login Change Password Preview State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassSuccess, setChangePassSuccess] = useState<string | null>(null);
  const [isSimulatingSave, setIsSimulatingSave] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Modals Showcase State
  const [activeShowcaseModal, setActiveShowcaseModal] = useState<
    "extension-logs" | "close-safety" | "warning-requirements" | null
  >(null);
  const [safetyCountdown, setSafetyCountdown] = useState(10);

  // Generate Email HTML
  const getRenderedEmailHtml = () => {
    if (emailTemplate === "invite") {
      return buildInviteEmailHtml({
        fullName: recipientName,
        link: "#preview-invite-link",
        invitedRole: emailRole,
      });
    }
    if (emailTemplate === "temp-password") {
      return buildTempPasswordEmailHtml({
        fullName: recipientName,
        tempPassword: "PupFocus_TempPass_9823#",
        signInHref: "#preview-signin",
      });
    }
    return buildSubmissionWindowNotificationEmailHtml({
      fullName: recipientName,
      startDate: "September 10, 2026",
      endDate: "September 24, 2026",
      startTimeLabel: "08:00 AM",
      endTimeLabel: "11:59 PM",
      actionHref: "#preview-window",
    });
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

  const copyVerifyText = async (text: string, field: "email" | "password" | "all") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedVerifyField(field);
      setTimeout(() => setCopiedVerifyField(null), 2500);
    } catch {
      // ignore
    }
  };

  const handleSimulatePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);
    setChangePassSuccess(null);

    if (newPassword.length < 8) {
      setChangePassError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePassError("Password confirmation does not match.");
      return;
    }

    setIsSimulatingSave(true);
    setTimeout(() => {
      setIsSimulatingSave(false);
      setChangePassSuccess("Password updated successfully! Redirecting to dashboard...");
      setTimeout(() => {
        setChangePassSuccess(null);
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
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
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
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
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
                  onClick={() => setEmailTemplate("temp-password")}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer transition ${
                    emailTemplate === "temp-password"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Temporary Password
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

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Recipient:
                </span>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient Name"
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1 text-slate-800 dark:text-slate-200 outline-none w-36"
                />
              </div>
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
                  <span>Gmail Inbox • preview@pupfocus.dev</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Simulated Institutional Webmail
              </div>
            </div>

            {/* Email Header inside Gmail */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-600/20 text-amber-700 dark:text-amber-400 font-bold flex items-center justify-center text-sm shrink-0">
                  PF
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {emailTemplate === "invite"
                        ? "Welcome to PUP FOCUS — Account Access"
                        : emailTemplate === "temp-password"
                        ? "Your Temporary Password for PUP FOCUS"
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
                    From: <span className="font-medium text-slate-700 dark:text-slate-300">PUP FOCUS System</span> &lt;no-reply@pupfocus.edu.ph&gt; • To: {recipientName} &lt;preview@pupfocus.dev&gt;
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 self-start sm:self-auto">
                Just now (0 min ago)
              </div>
            </div>

            {/* Email Body Container */}
            <div className="p-4 sm:p-8 bg-[#f7efe7] dark:bg-slate-950/60 overflow-x-auto">
              <div
                className="max-w-[620px] mx-auto transition-all"
                dangerouslySetInnerHTML={{ __html: getRenderedEmailHtml() }}
              />
            </div>

            {/* Email Footer Bar with CTA to test Verification Tab */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                Clicking the button in the invitation email takes the user directly to the <strong>/auth/confirm</strong> verification tab.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("verification")}
                className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                <span>Switch to Verify Tab Screen Preview</span>
                <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
              </button>
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

          {/* Live Preview of /auth/confirm UI - identical background to login screen */}
          <div className="relative rounded-2xl border border-slate-300 dark:border-slate-800 bg-[#5f0000] p-4 sm:p-10 flex items-center justify-center overflow-hidden min-h-[580px]">
            {/* Campus photo background matching the login screen */}
            <div
              className="absolute inset-0 bg-cover bg-center pointer-events-none"
              style={{ backgroundImage: "url('/images/attachments/IMG_9399.jpeg')" }}
            />
            {/* Overlay with Blur and Gradient matching Login Screen */}
            <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px] pointer-events-none" />
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/50 via-black/20 to-black/30 pointer-events-none" />

            <div className="relative z-10 w-full max-w-[390px] sm:max-w-md mx-auto my-auto drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)] text-[#fff8e7]">
              {/* Curved Card Top Header SVG with 3D Golden Crest Lighting */}
              <div className="relative">
                <svg
                  viewBox="0 0 400 64"
                  className="w-full h-auto block -mb-1 pointer-events-none overflow-visible"
                >
                  <defs>
                    <linearGradient id="verifyCardTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#8a0c0c" />
                      <stop offset="40%" stopColor="#780000" />
                      <stop offset="85%" stopColor="#680000" />
                      <stop offset="100%" stopColor="#680000" />
                    </linearGradient>
                    <linearGradient id="verifyTopGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                      <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                      <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                      <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                      <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                      <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="verifyTopAmbientSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.65" />
                      <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#780000" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <path
                    d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                    fill="url(#verifyCardTopGrad)"
                  />
                  <path
                    d="M 2,20 Q 2,2 20,2 L 142,2 C 158,2 162,37 200,37 C 238,37 242,2 258,2 L 380,2 Q 398,2 398,20"
                    fill="none"
                    stroke="url(#verifyTopAmbientSheen)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 1,64 L 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20 L 399,64"
                    fill="none"
                    stroke="rgba(245, 158, 11, 0.75)"
                    strokeWidth="2"
                  />
                  <path
                    d="M 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20"
                    fill="none"
                    stroke="url(#verifyTopGoldCrest)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 25,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 375,1"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.5)"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
                  <Logo size={115} className="mb-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" />
                </div>
              </div>

              {/* Card Body - Vibrant PUP Brand Maroon matching Login Screen */}
              <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-gradient-to-b from-[#680000] via-[#5e0000] to-[#4d0000] p-6 pt-7 sm:p-8 sm:pt-8 backdrop-blur-xl">
                {/* 1. Loading State */}
                {verifyStatus === "loading" && (
                  <div className="py-4 flex flex-col items-center justify-center text-center">
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-amber-400/60 shadow-inner my-2">
                      <img
                        src={
                          typeof loadingIcon === "string"
                            ? loadingIcon
                            : (loadingIcon as any)?.src ?? "/icons-animations/loading.svg"
                        }
                        alt="Verifying"
                        className="h-14 w-14 object-contain"
                      />
                    </div>
                    <h3 className="mt-3 text-2xl font-black uppercase tracking-wider text-amber-300">
                      Verifying Link
                    </h3>
                    <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide max-w-[280px]">
                      Verifying your invitation link with campus directory...
                    </p>
                    <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold tracking-wide text-amber-300/90 py-1">
                      <AppIcon icon={SystemRestart} size="md" color="active" className="animate-spin" />
                      <span>Securing institutional session...</span>
                    </div>
                  </div>
                )}

                {/* 2. Error State */}
                {verifyStatus === "error" && (
                  <div className="py-4 flex flex-col items-center justify-center text-center">
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-rose-500/50 shadow-inner my-2">
                      <img
                        src={
                          typeof failedIcon === "string"
                            ? failedIcon
                            : (failedIcon as any)?.src ?? "/icons-animations/fail.svg"
                        }
                        alt="Verification Failed"
                        className="h-14 w-14 object-contain"
                      />
                    </div>
                    <h3 className="mt-3 text-2xl font-black uppercase tracking-wider text-rose-200">
                      Verification Failed
                    </h3>
                    <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-rose-500/70 to-transparent shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                    <p className="text-rose-100/90 text-xs sm:text-sm font-medium tracking-wide leading-relaxed max-w-[300px]">
                      This invitation link was already used or has expired. Please ask an administrator to send a new invite or sign in if your account is already set up.
                    </p>

                    <button
                      type="button"
                      onClick={() => setVerifyStatus("success")}
                      className="mt-6 h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2"
                    >
                      <span>Return to Sign In</span>
                      <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                    </button>
                  </div>
                )}

                {/* 3. Success State */}
                {verifyStatus === "success" && (
                  <div className="flex flex-col items-center text-center">
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-emerald-500/50 shadow-inner my-2">
                      <img
                        src={
                          typeof successfullyIcon === "string"
                            ? successfullyIcon
                            : (successfullyIcon as any)?.src ?? "/icons-animations/successfully.svg"
                        }
                        alt="Success"
                        className="h-14 w-14 object-contain"
                      />
                    </div>

                    <h3 className="mt-3 text-2xl font-black uppercase tracking-wider text-amber-300">
                      Account Ready
                    </h3>
                    <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide">
                      Welcome, {recipientName}! Save your temporary login credentials:
                    </p>

                    {/* Credentials Card */}
                    <div className="mt-4 w-full space-y-2.5 text-left">
                      {/* Email Row */}
                      <div className="rounded-xl border border-amber-400/40 bg-black/40 p-2.5 flex items-center justify-between gap-2 shadow-inner">
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                            Institutional Email
                          </span>
                          <span className="block text-xs sm:text-sm text-slate-100 font-medium truncate">
                            preview@pupfocus.dev
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyVerifyText("preview@pupfocus.dev", "email")}
                          className="rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition shrink-0 cursor-pointer flex items-center gap-1"
                          title="Copy email"
                        >
                          {copiedVerifyField === "email" ? (
                            <>
                              <AppIcon icon={Check} size="xs" color="success" />
                              <span className="text-emerald-300 text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <AppIcon icon={Copy} size="xs" color="inherit" />
                              <span className="text-[11px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Password Row */}
                      <div className="rounded-xl border border-amber-400/40 bg-black/40 p-2.5 flex items-center justify-between gap-2 shadow-inner">
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                            Temporary Password
                          </span>
                          <span className="block text-xs sm:text-sm text-amber-200 font-mono font-bold tracking-wider truncate">
                            {verifyShowPassword ? "PupFocus_TempPass_9823#" : "••••••••••••••••••••"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setVerifyShowPassword(!verifyShowPassword)}
                            className="p-1.5 rounded-lg text-amber-300/80 hover:text-amber-200 hover:bg-amber-400/10 transition cursor-pointer"
                            title={verifyShowPassword ? "Hide password" : "Show password"}
                          >
                            {verifyShowPassword ? (
                              <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                            ) : (
                              <AppIcon icon={Eye} size="sm" color="inherit" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyVerifyText("PupFocus_TempPass_9823#", "password")}
                            className="rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition cursor-pointer flex items-center gap-1"
                            title="Copy password"
                          >
                            {copiedVerifyField === "password" ? (
                              <>
                                <AppIcon icon={Check} size="xs" color="success" />
                                <span className="text-emerald-300 text-[11px]">Copied</span>
                              </>
                            ) : (
                              <>
                                <AppIcon icon={Copy} size="xs" color="inherit" />
                                <span className="text-[11px]">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Email Sent Notice */}
                    <div className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2 text-center text-[11px] font-medium text-amber-200/90 shadow-xs">
                      <AppIcon icon={Mail} size="xs" color="active" className="shrink-0" />
                      <span>A copy of your temporary credentials has also been sent to your email.</span>
                    </div>

                    {/* Primary CTA Button */}
                    <button
                      type="button"
                      onClick={() => setActiveTab("change-password")}
                      className="mt-5 h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Sign In</span>
                      <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                    </button>

                    {/* Simple copy both helper */}
                    <button
                      type="button"
                      onClick={() =>
                        copyVerifyText(
                          "Email: preview@pupfocus.dev\nTemporary Password: PupFocus_TempPass_9823#",
                          "all"
                        )
                      }
                      className="mt-2.5 text-center text-[11px] font-semibold text-amber-200/80 hover:text-amber-100 transition py-1 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {copiedVerifyField === "all" ? (
                        <>
                          <AppIcon icon={Check} size="xs" color="success" />
                          <span className="text-emerald-300">All credentials copied to clipboard!</span>
                        </>
                      ) : (
                        <>
                          <AppIcon icon={Copy} size="xs" color="inherit" />
                          <span>Copy both email & password</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FIRST LOGIN CHANGE PASSWORD */}
      {activeTab === "change-password" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                First-Time Login Security Gate (/auth/change-password)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                When an account is flagged with <code className="text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">must_change_password: true</code>, the application automatically redirects them to set a personal password before granting dashboard access.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-2xs"
            >
              <AppIcon icon={Eye} size="sm" color="inherit" />
              <span>Launch as Fullscreen Modal</span>
            </button>
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

            <div className="relative z-10 w-full max-w-[390px] sm:max-w-md mx-auto my-auto drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)] text-[#fff8e7]">
              {/* Curved Card Top Header SVG with 3D Golden Crest Lighting */}
              <div className="relative">
                <svg
                  viewBox="0 0 400 64"
                  className="w-full h-auto block -mb-1 pointer-events-none overflow-visible"
                >
                  <defs>
                    <linearGradient id="changePassPreviewTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#8a0c0c" />
                      <stop offset="40%" stopColor="#780000" />
                      <stop offset="85%" stopColor="#680000" />
                      <stop offset="100%" stopColor="#680000" />
                    </linearGradient>
                    <linearGradient id="changePassPreviewTopGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                      <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                      <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                      <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                      <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                      <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="changePassPreviewTopAmbientSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.65" />
                      <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#780000" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <path
                    d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                    fill="url(#changePassPreviewTopGrad)"
                  />
                  <path
                    d="M 2,20 Q 2,2 20,2 L 142,2 C 158,2 162,37 200,37 C 238,37 242,2 258,2 L 380,2 Q 398,2 398,20"
                    fill="none"
                    stroke="url(#changePassPreviewTopAmbientSheen)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 1,64 L 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20 L 399,64"
                    fill="none"
                    stroke="rgba(245, 158, 11, 0.75)"
                    strokeWidth="2"
                  />
                  <path
                    d="M 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20"
                    fill="none"
                    stroke="url(#changePassPreviewTopGoldCrest)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 25,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 375,1"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.5)"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
                  <Logo size={115} className="mb-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" />
                </div>
              </div>

              {/* Card Body - Vibrant PUP Brand Maroon matching Login Screen */}
              <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-gradient-to-b from-[#680000] via-[#5e0000] to-[#4d0000] p-6 pt-7 sm:p-8 sm:pt-8 backdrop-blur-xl">
                <div className="mt-2 mb-6 sm:mb-7 text-center">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-amber-300 uppercase mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    Set New Password
                  </h2>
                  <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                  <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide">
                    Create a permanent password to secure your institutional account
                  </p>
                </div>

                <form className="space-y-4" onSubmit={handleSimulatePasswordSubmit}>
                  {/* New Password Field */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                        <AppIcon icon={Key} size="sm" color="active" />
                        <span>New Password</span>
                      </label>
                      <span className="text-[10px] text-amber-200/70 font-medium">Min. 8 characters</span>
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
                        className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] pl-4 pr-11 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                        title={showNewPass ? "Hide password" : "Show password"}
                        aria-label={showNewPass ? "Hide password" : "Show password"}
                      >
                        {showNewPass ? (
                          <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                        ) : (
                          <AppIcon icon={Eye} size="sm" color="inherit" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                        <AppIcon icon={Key} size="sm" color="active" />
                        <span>Confirm Password</span>
                      </label>
                      <span className="text-[10px] text-amber-200/70 font-medium">Must match</span>
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
                        className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] pl-4 pr-11 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                        title={showConfirmPass ? "Hide password" : "Show password"}
                        aria-label={showConfirmPass ? "Hide password" : "Show password"}
                      >
                        {showConfirmPass ? (
                          <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                        ) : (
                          <AppIcon icon={Eye} size="sm" color="inherit" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error Notification */}
                  {changePassError ? (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-left flex items-start gap-2.5 text-xs text-rose-200">
                      <AppIcon icon={WarningCircle} size="sm" color="danger" className="shrink-0 mt-0.5" />
                      <span>{changePassError}</span>
                    </div>
                  ) : null}

                  {/* Success Notification */}
                  {changePassSuccess ? (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-left flex items-start gap-2.5 text-xs text-emerald-200">
                      <AppIcon icon={CheckCircle} size="sm" color="success" className="shrink-0 mt-0.5" />
                      <span>{changePassSuccess}</span>
                    </div>
                  ) : null}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSimulatingSave}
                    className="mt-2 h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSimulatingSave ? (
                      <>
                        <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                        <span>Saving Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Set Password & Proceed</span>
                        <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                      </>
                    )}
                  </button>
                </form>
              </section>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {/* 1. LOADING CARD MOCKUP */}
            <div className="flex flex-col items-center justify-center p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-950">
              <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs">
                <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <AppIcon icon={SystemRestart} size="sm" color="active" className="animate-spin" />
                  State 1: Loading & Verification
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewAnimationKey(Date.now())}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <AppIcon icon={Refresh} size="xs" color="inherit" />
                  <span>Replay</span>
                </button>
              </div>

              <div className="relative w-full max-w-[320px] overflow-hidden rounded-[2rem] border border-amber-400/80 bg-gradient-to-b from-[#4e0303] via-[#350000] to-[#200000] p-6 text-[#fff8e7] shadow-2xl shadow-black/60 ring-1 ring-amber-400/30">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

                <div className="flex flex-col items-center justify-center text-center">
                  <div className="relative flex items-center justify-center my-1.5">
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-amber-400/60 shadow-inner">
                      <img
                        key={previewAnimationKey}
                        src={
                          typeof loadingIcon === "string"
                            ? loadingIcon
                            : (loadingIcon as any)?.src ??
                              "/icons-animations/loading.svg"
                        }
                        alt="Loading..."
                        className="h-14 w-14 object-contain"
                      />
                    </div>
                  </div>

                  <h3 className="mt-3 text-xl font-black uppercase tracking-wider text-amber-300">
                    Authenticating...
                  </h3>

                  <div className="h-0.5 w-12 rounded-full my-2 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

                  <p className="text-xs font-medium leading-relaxed text-amber-100/90 max-w-[240px]">
                    Verifying institutional credentials with campus directory...
                  </p>

                  <div className="mt-4 w-full flex flex-col items-center gap-2">
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-wide text-amber-300/90 py-0.5">
                      <AppIcon icon={SystemRestart} size="sm" color="active" className="animate-spin" />
                      <span>Securing institutional session...</span>
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
                      className="mt-1 h-10 w-full rounded-2xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950 tracking-widest uppercase text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
                    >
                      <span>Launch Loading Modal</span>
                      <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SUCCESS CARD MOCKUP */}
            <div className="flex flex-col items-center justify-center p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-950">
              <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <AppIcon icon={CheckCircle} size="sm" color="inherit" />
                  State 2: Success
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewAnimationKey(Date.now())}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <AppIcon icon={Refresh} size="xs" color="inherit" />
                  <span>Replay</span>
                </button>
              </div>

              <div className="relative w-full max-w-[320px] overflow-hidden rounded-[2rem] border border-amber-400/60 bg-gradient-to-b from-[#4e0303] via-[#350000] to-[#200000] p-6 text-[#fff8e7] shadow-2xl shadow-black/60">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

                <div className="flex flex-col items-center justify-center text-center">
                  <div className="relative flex items-center justify-center my-1.5">
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-emerald-500/50 shadow-inner">
                      <img
                        key={previewAnimationKey}
                        src={
                          typeof successfullyIcon === "string"
                            ? successfullyIcon
                            : (successfullyIcon as any)?.src ??
                              "/icons-animations/successfully.svg"
                        }
                        alt="Success"
                        className="h-14 w-14 object-contain"
                      />
                    </div>
                  </div>

                  <h3 className="mt-3 text-xl font-black uppercase tracking-wider text-amber-300">
                    Login Successful
                  </h3>

                  <div className="h-0.5 w-12 rounded-full my-2 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

                  <p className="text-xs font-medium leading-relaxed text-amber-100/90 max-w-[240px]">
                    Welcome back to PUP FOCUS. Securing institutional session...
                  </p>

                  <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold tracking-wide text-amber-300/90 py-1">
                    <AppIcon icon={SystemRestart} size="sm" color="active" className="animate-spin" />
                    <span>Redirecting to your portal...</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. FAIL CARD MOCKUP */}
            <div className="flex flex-col items-center justify-center p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-950">
              <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs">
                <span className="font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <AppIcon icon={WarningCircle} size="sm" color="inherit" />
                  State 3: Failed
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewAnimationKey(Date.now())}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <AppIcon icon={Refresh} size="xs" color="inherit" />
                  <span>Replay</span>
                </button>
              </div>

              <div className="relative w-full max-w-[320px] overflow-hidden rounded-[2rem] border border-rose-500/50 bg-gradient-to-b from-[#4e0303] via-[#350000] to-[#200000] p-6 text-[#fff8e7] shadow-2xl shadow-black/60">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent" />

                <div className="flex flex-col items-center justify-center text-center">
                  <div className="relative flex items-center justify-center my-1.5">
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-rose-500/50 shadow-inner">
                      <img
                        key={previewAnimationKey}
                        src={
                          typeof failedIcon === "string"
                            ? failedIcon
                            : (failedIcon as any)?.src ??
                              "/icons-animations/fail.svg"
                        }
                        alt="Failed"
                        className="h-14 w-14 object-contain"
                      />
                    </div>
                  </div>

                  <h3 className="mt-3 text-xl font-black uppercase tracking-wider text-rose-200">
                    Login Failed
                  </h3>

                  <div className="h-0.5 w-12 rounded-full my-2 bg-gradient-to-r from-transparent via-rose-500/70 to-transparent" />

                  <p className="text-xs font-medium leading-relaxed text-rose-100/80 max-w-[240px]">
                    Invalid institutional email address or password. Please verify credentials.
                  </p>

                  <div className="mt-4 w-full">
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
                      className="h-10 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 cursor-pointer flex items-center justify-center gap-2 shadow-md"
                    >
                      <AppIcon icon={Refresh} size="sm" color="inherit" />
                      <span>Try Again</span>
                    </button>
                  </div>
                </div>
              </div>
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
            className="relative z-10 w-full max-w-[390px] sm:max-w-md my-auto drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)] text-[#fff8e7]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Curved Card Top Header SVG with 3D Golden Crest Lighting */}
            <div className="relative">
              <svg
                viewBox="0 0 400 64"
                className="w-full h-auto block -mb-1 pointer-events-none overflow-visible"
              >
                <defs>
                  <linearGradient id="changePassModalTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#8a0c0c" />
                    <stop offset="40%" stopColor="#780000" />
                    <stop offset="85%" stopColor="#680000" />
                    <stop offset="100%" stopColor="#680000" />
                  </linearGradient>
                  <linearGradient id="changePassModalTopGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                    <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                    <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                    <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                    <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                    <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="changePassModalTopAmbientSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.65" />
                    <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#780000" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <path
                  d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                  fill="url(#changePassModalTopGrad)"
                />
                <path
                  d="M 2,20 Q 2,2 20,2 L 142,2 C 158,2 162,37 200,37 C 238,37 242,2 258,2 L 380,2 Q 398,2 398,20"
                  fill="none"
                  stroke="url(#changePassModalTopAmbientSheen)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M 1,64 L 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20 L 399,64"
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.75)"
                  strokeWidth="2"
                />
                <path
                  d="M 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20"
                  fill="none"
                  stroke="url(#changePassModalTopGoldCrest)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 25,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 375,1"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.5)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
                <Logo size={115} className="mb-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" />
              </div>
            </div>

            {/* Card Body - Vibrant PUP Brand Maroon matching Login Screen */}
            <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-gradient-to-b from-[#680000] via-[#5e0000] to-[#4d0000] p-6 pt-7 sm:p-8 sm:pt-8 backdrop-blur-xl">
              <div className="mt-2 mb-6 sm:mb-7 text-center">
                <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-amber-300 uppercase mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  Set New Password
                </h2>
                <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide">
                  Create a permanent password to secure your institutional account
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSimulatePasswordSubmit}>
                {/* New Password Field */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                      <AppIcon icon={Key} size="sm" color="active" />
                      <span>New Password</span>
                    </label>
                    <span className="text-[10px] text-amber-200/70 font-medium">Min. 8 characters</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] pl-4 pr-11 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                      title={showNewPass ? "Hide password" : "Show password"}
                      aria-label={showNewPass ? "Hide password" : "Show password"}
                    >
                      {showNewPass ? (
                        <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                      ) : (
                        <AppIcon icon={Eye} size="sm" color="inherit" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                      <AppIcon icon={Key} size="sm" color="active" />
                      <span>Confirm Password</span>
                    </label>
                    <span className="text-[10px] text-amber-200/70 font-medium">Must match</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] pl-4 pr-11 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                      title={showConfirmPass ? "Hide password" : "Show password"}
                      aria-label={showConfirmPass ? "Hide password" : "Show password"}
                    >
                      {showConfirmPass ? (
                        <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                      ) : (
                        <AppIcon icon={Eye} size="sm" color="inherit" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Notification */}
                {changePassError ? (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-left flex items-start gap-2.5 text-xs text-rose-200">
                    <AppIcon icon={WarningCircle} size="sm" color="danger" className="shrink-0 mt-0.5" />
                    <span>{changePassError}</span>
                  </div>
                ) : null}

                {/* Success Notification */}
                {changePassSuccess ? (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-left flex items-start gap-2.5 text-xs text-emerald-200">
                    <AppIcon icon={CheckCircle} size="sm" color="success" className="shrink-0 mt-0.5" />
                    <span>{changePassSuccess}</span>
                  </div>
                ) : null}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-900/80 hover:bg-slate-900 text-slate-300 border border-white/15 transition cursor-pointer shadow-xs"
                  >
                    Close Preview
                  </button>
                  <button
                    type="submit"
                    disabled={isSimulatingSave}
                    className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isSimulatingSave ? "Saving..." : "Save & Test"}
                  </button>
                </div>
              </form>
            </section>
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
            className="fixed top-6 right-6 z-50 px-3.5 py-1.5 rounded-full bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-semibold backdrop-blur-md border border-[#5e0000] transition cursor-pointer flex items-center gap-1.5 shadow-lg"
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
    </div>
  );
}
