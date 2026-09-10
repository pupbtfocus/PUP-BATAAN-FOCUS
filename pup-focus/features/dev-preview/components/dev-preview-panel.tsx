"use client";

import React, { useState } from "react";
import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  EyeClosed,
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
import { Logo } from "@/components/ui/logo";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
  buildSubmissionWindowNotificationEmailHtml,
} from "@/lib/email/email-templates";
import { ROLE, type AppRole } from "@/config/roles";

type PreviewTab = "gmail" | "verification" | "change-password" | "modals";

export function DevPreviewPanel() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("gmail");

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

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("gmail")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "gmail"
                ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail & Email</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("verification")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "verification"
                ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Verify Tab Screen</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("change-password")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "change-password"
                ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>First Login Change Pass</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("modals")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "modals"
                ? "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Modals Showcase</span>
          </button>
        </div>
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
                {emailCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{emailCopied ? "HTML Copied!" : "Copy Raw HTML"}</span>
              </button>
              <a
                href="/email-preview"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-2xs"
              >
                <span>Open in Popout Tab</span>
                <NavArrowRight className="w-3.5 h-3.5" />
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
                  <Mail className="w-4 h-4 text-rose-600" />
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
                <NavArrowRight className="w-3.5 h-3.5" />
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
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950 text-xs">
                <button
                  type="button"
                  onClick={() => setVerifyStatus("loading")}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer transition ${
                    verifyStatus === "loading"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  1. Loading / Verifying
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyStatus("success")}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer transition ${
                    verifyStatus === "success"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  2. Ready (Credentials Issued)
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyStatus("error")}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer transition ${
                    verifyStatus === "error"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold"
                      : "text-slate-600 dark:text-slate-400"
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
                <NavArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Live Preview of /auth/confirm UI */}
          <div className="relative rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-950 p-6 sm:p-12 flex items-center justify-center overflow-hidden min-h-[560px]">
            {/* Background Backdrop Glow */}
            <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />

            <div className="relative z-10 w-full max-w-[440px] mx-auto text-[#fff8e7]">
              {/* Curved Card Top Header SVG */}
              <div className="relative">
                <svg
                  viewBox="0 0 400 60"
                  className="w-full h-auto text-[#4d0000] fill-current stroke-amber-400/80 stroke-[2] block -mb-0.5 pointer-events-none"
                >
                  <path d="M 0,60 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,60 Z" />
                </svg>

                {/* PUP Logo centered in arch */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
                  <Logo size={115} className="mb-0" />
                </div>
              </div>

              {/* Card Body */}
              <section className="relative rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-[#4d0000] p-6 pt-7 sm:p-8 sm:pt-8 backdrop-blur-md shadow-2xl shadow-black/60">
                {/* Header / Title Area */}
                <div className="mt-2 mb-5 text-center">
                  <p className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-300 uppercase mb-1">
                    PUP FOCUS • BATAAN CAMPUS
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-amber-200 uppercase mb-1">
                    {verifyStatus === "loading"
                      ? "Verifying Link"
                      : verifyStatus === "success"
                      ? "Account Ready"
                      : "Invite Verification"}
                  </h2>
                  <div className="mx-auto my-2.5 h-[2px] w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
                  <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed max-w-sm mx-auto">
                    {verifyStatus === "loading"
                      ? "Verifying your invitation link..."
                      : verifyStatus === "success"
                      ? "Your institutional account is verified and ready. Please save your temporary login credentials below."
                      : "This invitation link was already used or has expired. Please request a new invite."}
                  </p>
                </div>

                {/* 1. Loading State */}
                {verifyStatus === "loading" && (
                  <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin" />
                      <SystemRestart className="absolute inset-0 m-auto h-6 w-6 text-amber-300 animate-spin" />
                    </div>
                    <p className="text-xs text-amber-200/80 font-medium tracking-wide uppercase">
                      Securing institutional session...
                    </p>
                  </div>
                )}

                {/* 2. Error State */}
                {verifyStatus === "error" && (
                  <div className="space-y-4 py-2">
                    <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-left flex items-start gap-3">
                      <WarningCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-rose-200/90 leading-relaxed">
                        <p className="font-semibold text-rose-200 mb-1">Verification Notice</p>
                        <p>This invite link was already used. Please ask an administrator to send a new invite or sign in if your account is already set up.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerifyStatus("success")}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs py-2.5 px-4 shadow-lg transition cursor-pointer"
                    >
                      <span>Return to Sign In</span>
                      <NavArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* 3. Success State */}
                {verifyStatus === "success" && (
                  <div className="space-y-4 pt-1">
                    {/* Welcome banner */}
                    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-2 text-xs text-emerald-200">
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="font-medium">Welcome, {recipientName}!</span>
                    </div>

                    {/* Email Card */}
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-amber-400" />
                        <span>Institutional Email</span>
                      </label>
                      <div className="flex items-center rounded-xl border border-amber-400/30 bg-black/30 p-1.5">
                        <input
                          type="text"
                          readOnly
                          value="preview@pupfocus.dev"
                          className="w-full bg-transparent px-2.5 text-xs text-slate-100 font-medium outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => copyVerifyText("preview@pupfocus.dev", "email")}
                          className="flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 px-2 py-1 text-[11px] font-semibold text-amber-200 transition shrink-0 cursor-pointer"
                        >
                          {copiedVerifyField === "email" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedVerifyField === "email" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Password Card */}
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-amber-400" />
                        <span>Temporary Password</span>
                      </label>
                      <div className="flex items-center rounded-xl border border-amber-400/30 bg-black/30 p-1.5">
                        <input
                          type={verifyShowPassword ? "text" : "password"}
                          readOnly
                          value="PupFocus_TempPass_9823#"
                          className="w-full bg-transparent px-2.5 text-xs text-slate-100 font-mono font-bold tracking-wider outline-none"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setVerifyShowPassword(!verifyShowPassword)}
                            className="p-1 text-amber-300 hover:text-amber-100 transition cursor-pointer"
                          >
                            {verifyShowPassword ? <EyeClosed className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyVerifyText("PupFocus_TempPass_9823#", "password")}
                            className="flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 px-2 py-1 text-[11px] font-semibold text-amber-200 transition cursor-pointer"
                          >
                            {copiedVerifyField === "password" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedVerifyField === "password" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Copy Both CTA */}
                    <button
                      type="button"
                      onClick={() =>
                        copyVerifyText(
                          "Email: preview@pupfocus.dev\nTemporary Password: PupFocus_TempPass_9823#",
                          "all"
                        )
                      }
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-200 font-semibold text-xs py-2 px-3 transition cursor-pointer"
                    >
                      {copiedVerifyField === "all" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedVerifyField === "all" ? "Credentials Copied to Clipboard!" : "Copy All Credentials"}</span>
                    </button>

                    {/* Sign In CTA Button */}
                    <button
                      type="button"
                      onClick={() => setActiveTab("change-password")}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-bold text-xs py-2.5 px-4 shadow-lg transition cursor-pointer mt-2"
                    >
                      <span>Proceed to Sign In & Change Pass</span>
                      <NavArrowRight className="h-4 w-4" />
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
              <Eye className="w-3.5 h-3.5" />
              <span>Launch as Fullscreen Modal</span>
            </button>
          </div>

          {/* Interactive Card */}
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-950 p-6 sm:p-12 flex items-center justify-center min-h-[500px]">
            <section className="w-full max-w-md rounded-3xl border border-[rgba(255,215,0,0.25)] bg-[#4d0000] p-8 shadow-2xl shadow-black/50 text-[#fff8e7]">
              <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700] font-bold">
                ᜉᜓᜉ᜔ ᜉ᜔ᜂᜃ᜔ᜂᜐ᜔
              </p>
              <h2 className="mt-3 text-2xl font-bold text-amber-100">Set a new password</h2>
              <p className="mt-2 text-xs text-[#f3d9b3] leading-relaxed">
                Create a permanent personal password to secure your institutional account.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSimulatePasswordSubmit}>
                <div>
                  <label className="block text-xs font-medium text-[#fff8e7] mb-1">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-xl border border-[rgba(255,215,0,0.25)] bg-black/30 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/70 hover:text-amber-100 cursor-pointer"
                    >
                      {showNewPass ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#fff8e7] mb-1">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Re-enter your new password"
                      className="w-full rounded-xl border border-[rgba(255,215,0,0.25)] bg-black/30 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/70 hover:text-amber-100 cursor-pointer"
                    >
                      {showConfirmPass ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {changePassError ? (
                  <p className="text-xs text-red-300 flex items-center gap-1.5">
                    <WarningCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{changePassError}</span>
                  </p>
                ) : null}

                {changePassSuccess ? (
                  <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{changePassSuccess}</span>
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSimulatingSave}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {isSimulatingSave ? (
                    <>
                      <SystemRestart className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving password...</span>
                    </>
                  ) : (
                    <span>Set new password & Proceed</span>
                  )}
                </button>
              </form>
            </section>
          </div>
        </div>
      )}

      {/* TAB 4: MODALS SHOWCASE */}
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
                  <Clock className="w-5 h-5" />
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
                  <WarningTriangle className="w-5 h-5" />
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
                  <WarningCircle className="w-5 h-5" />
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
          </div>
        </div>
      )}

      {/* FULLSCREEN PASSWORD CHANGE MODAL */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-md">
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute -top-12 right-0 p-2 text-slate-300 hover:text-white cursor-pointer"
            >
              <Xmark className="w-6 h-6" />
            </button>
            <section className="w-full rounded-3xl border border-[rgba(255,215,0,0.25)] bg-[#4d0000] p-8 shadow-2xl text-[#fff8e7]">
              <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700] font-bold">
                ᜉᜓᜉ᜔ ᜉ᜔ᜂᜃ᜔ᜂᜐ᜔
              </p>
              <h2 className="mt-3 text-2xl font-bold text-amber-100">Set a new password</h2>
              <p className="mt-2 text-xs text-[#f3d9b3]">
                Create a permanent password to secure your institutional account.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleSimulatePasswordSubmit}>
                <div>
                  <label className="block text-xs font-medium text-[#fff8e7] mb-1">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-[rgba(255,215,0,0.25)] bg-black/30 px-4 py-2.5 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#fff8e7] mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-[rgba(255,215,0,0.25)] bg-black/30 px-4 py-2.5 text-xs text-white outline-none"
                  />
                </div>
                {changePassError ? <p className="text-xs text-red-300">{changePassError}</p> : null}
                {changePassSuccess ? <p className="text-xs text-emerald-300">{changePassSuccess}</p> : null}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-black/40 hover:bg-black/60 text-slate-300 transition cursor-pointer"
                  >
                    Close Preview
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer"
                  >
                    Save & Test
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
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold">Extension Audit Logs</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <Xmark className="h-4 w-4" />
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
                  <NavArrowRight className="h-3.5 w-3.5 text-slate-400" />
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
                  <NavArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-bold font-mono">2026-09-17 at 11:59 PM</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHOWCASE MODAL 2: 10S SAFETY TIMER */}
      {activeShowcaseModal === "close-safety" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <p className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
              <WarningTriangle className="h-3.5 w-3.5 shrink-0" />
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
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
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
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <WarningTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold">No Requirements Configured</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You cannot open a submission window because no faculty compliance requirements have been activated for the current academic term.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveShowcaseModal(null)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
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
    </div>
  );
}
