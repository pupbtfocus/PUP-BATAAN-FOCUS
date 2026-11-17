"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, Copy, Download, Lock, Refresh, SystemRestart, Trash } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

interface TotpFactorInfo {
  id: string;
  friendlyName: string;
  status: string;
}

interface PendingEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export interface MfaSecurityCardProps {
  /** Role/portal display label shown in prompts (e.g. "Admin", "Staff", "Faculty"). */
  accountLabel?: string;
  onFeedback?: (feedback: {
    title: string;
    message: string;
    type: "success" | "error";
  }) => void;
}

export function MfaSecurityCard({
  accountLabel = "Admin",
  onFeedback,
}: MfaSecurityCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [verifiedFactors, setVerifiedFactors] = useState<TotpFactorInfo[]>([]);
  const [pendingEnrollment, setPendingEnrollment] =
    useState<PendingEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [confirmDisableId, setConfirmDisableId] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [remainingBackupCount, setRemainingBackupCount] = useState<number>(0);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [confirmRegenerateCodes, setConfirmRegenerateCodes] = useState(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);

  const loadBackupCodeCount = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/mfa/recovery-codes", {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setRemainingBackupCount(Number(json.remainingCount ?? 0));
      }
    } catch {
      // Ignore transient lookup issues
    }
  }, []);

  const loadMfaFactors = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totpFactors = (data?.totp ?? []) as Array<{
        id: string;
        friendly_name?: string;
        status: string;
      }>;
      const verified = totpFactors
        .filter((factor) => factor.status === "verified")
        .map((factor) => ({
          id: factor.id,
          friendlyName: factor.friendly_name || "Authenticator App",
          status: factor.status,
        }));
      setVerifiedFactors(verified);
      if (verified.length > 0) {
        await loadBackupCodeCount();
      } else {
        setRemainingBackupCount(0);
      }
    } catch {
      setVerifiedFactors([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadBackupCodeCount]);

  useEffect(() => {
    void loadMfaFactors();
  }, [loadMfaFactors]);

  async function requestNewRecoveryCodes(showToast = true) {
    setIsGeneratingCodes(true);
    setInlineError(null);
    setCopiedBackupCodes(false);
    try {
      const res = await fetch("/api/auth/mfa/recovery-codes", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(json.codes)) {
        throw new Error(json.error || "Failed to generate backup codes.");
      }
      setRecoveryCodes(json.codes);
      setRemainingBackupCount(Number(json.remainingCount ?? json.codes.length));
      setConfirmRegenerateCodes(false);
      if (showToast) {
        onFeedback?.({
          title: "Backup Codes Generated",
          message: "Save your 8 single-use recovery codes somewhere safe.",
          type: "success",
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to generate backup recovery codes.";
      setInlineError(msg);
      if (showToast) {
        onFeedback?.({
          title: "Backup Codes Failed",
          message: msg,
          type: "error",
        });
      }
    } finally {
      setIsGeneratingCodes(false);
    }
  }

  async function handleStartEnrollment() {
    setIsProcessing(true);
    setInlineError(null);
    setVerificationCode("");

    try {
      const supabase = createClient();
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const allFactors = (existing?.all ?? []) as Array<{
        id: string;
        factor_type?: string;
        status?: string;
      }>;
      const unverified = allFactors.filter(
        (f) => f.factor_type === "totp" && f.status !== "verified",
      );
      for (const factor of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => null);
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "PUP FOCUS Bataan",
        friendlyName: `PUP FOCUS ${accountLabel} Authenticator`,
      });

      if (error || !data?.totp) {
        throw new Error(
          error?.message || "Unable to initialize 2FA setup. Check Supabase MFA settings.",
        );
      }

      setPendingEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to initialize 2FA enrollment.";
      setInlineError(msg);
      onFeedback?.({
        title: "2FA Setup Failed",
        message: msg,
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleVerifyEnrollment(event: React.FormEvent) {
    event.preventDefault();
    if (!pendingEnrollment) return;

    const cleanCode = verificationCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleanCode)) {
      setInlineError("Enter the 6-digit code from your Authenticator app.");
      return;
    }

    setIsProcessing(true);
    setInlineError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingEnrollment.factorId,
        code: cleanCode,
      });

      if (error) {
        throw new Error(error.message || "Invalid verification code.");
      }

      setPendingEnrollment(null);
      setVerificationCode("");
      await loadMfaFactors();
      await requestNewRecoveryCodes(false);
      onFeedback?.({
        title: "2FA Enabled",
        message: `Two-factor authentication is active. Save your 8 single-use backup codes shown below.`,
        type: "success",
      });
    } catch (err) {
      setInlineError(
        err instanceof Error ? err.message : "Invalid 6-digit code.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCancelEnrollment() {
    if (pendingEnrollment) {
      try {
        const supabase = createClient();
        await supabase.auth.mfa.unenroll({ factorId: pendingEnrollment.factorId });
      } catch {
        // Ignore cleanup failure
      }
    }
    setPendingEnrollment(null);
    setVerificationCode("");
    setInlineError(null);
  }

  async function handleDisableFactor(factorId: string) {
    setIsProcessing(true);
    setInlineError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        throw new Error(error.message || "Unable to disable 2FA factor.");
      }
      setConfirmDisableId(null);
      setRecoveryCodes(null);
      setRemainingBackupCount(0);
      await fetch("/api/auth/mfa/recovery-codes", { method: "DELETE" }).catch(
        () => null,
      );
      await loadMfaFactors();
      onFeedback?.({
        title: "2FA Disabled",
        message: "Authenticator App 2FA has been removed from this account.",
        type: "success",
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to disable 2FA.";
      setInlineError(msg);
      onFeedback?.({
        title: "Disable 2FA Failed",
        message: msg,
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  const isEnabled = verifiedFactors.length > 0;
  const setupInputId = `mfaSetupCode-${accountLabel.toLowerCase().replace(/\W+/g, "")}`;

  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-xs dark:bg-slate-900 p-4 sm:p-6 transition-colors">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <AppIcon icon={Lock} size="md" color="active" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-normal">
              Two-Factor Authentication (Authenticator App)
            </h2>
            {!isLoading &&
              (isEnabled ? (
                <span className="bg-[#0b5336] text-white border border-[#08412a] px-2.5 py-0.5 text-[11px] font-bold rounded-md shadow-2xs">
                  Protected (2FA Active)
                </span>
              ) : (
                <span className="bg-amber-500 text-slate-950 border border-amber-600 px-2.5 py-0.5 text-[11px] font-bold rounded-md shadow-2xs">
                  Recommended
                </span>
              ))}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-normal">
            Require a rotating 6-digit TOTP code from Google Authenticator, Microsoft Authenticator, or 1Password when signing into your {accountLabel} account.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadMfaFactors()}
          disabled={isLoading || isProcessing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          <AppIcon
            icon={Refresh}
            size="xs"
            color="inherit"
            className={isLoading ? "animate-spin" : ""}
          />
          <span>Refresh</span>
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {inlineError && (
          <div className="rounded-xl border border-[#5e0000] bg-[#780000] px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs">
            {inlineError}
          </div>
        )}

        {isLoading ? (
          <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ) : pendingEnrollment ? (
          <form
            onSubmit={handleVerifyEnrollment}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-4 shadow-2xs"
          >
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] items-center">
              <div className="mx-auto sm:mx-0 rounded-xl bg-white p-2.5 border border-slate-300 dark:border-slate-700 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingEnrollment.qrCode}
                  alt="Scan QR code in your Authenticator app"
                  className="h-36 w-36 object-contain"
                />
              </div>
              <div className="space-y-2.5 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Step 1: Scan this QR code in your Authenticator App
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Or enter this setup key manually:{" "}
                  <code className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-900 dark:text-amber-300 break-all">
                    {pendingEnrollment.secret}
                  </code>
                </p>
                <div className="space-y-1.5 pt-1">
                  <label
                    htmlFor={setupInputId}
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Step 2: Enter 6-digit verification code
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id={setupInputId}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) =>
                        setVerificationCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="000000"
                      className="w-36 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono font-bold tracking-[0.25em] text-center text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isProcessing || verificationCode.length !== 6}
                      className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <AppIcon
                          icon={SystemRestart}
                          size="xs"
                          color="inherit"
                          className="animate-spin"
                        />
                      ) : (
                        <AppIcon icon={Check} size="xs" color="inherit" />
                      )}
                      <span>Verify &amp; Activate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCancelEnrollment()}
                      disabled={isProcessing}
                      className="inline-flex items-center px-3.5 py-2 rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        ) : isEnabled ? (
          <div className="space-y-3">
            {verifiedFactors.map((factor) => (
              <div
                key={factor.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b5336] text-white shadow-2xs">
                    <AppIcon icon={Check} size="sm" color="inherit" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {factor.friendlyName}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Verified TOTP factor • Enforced at login and API level (`aal2`)
                    </p>
                  </div>
                </div>

                {confirmDisableId === factor.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDisableFactor(factor.id)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Confirm Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDisableId(null)}
                      disabled={isProcessing}
                      className="rounded-xl border border-slate-700 bg-slate-600 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDisableId(factor.id)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <AppIcon icon={Trash} size="xs" color="inherit" />
                    <span>Disable 2FA</span>
                  </button>
                )}
              </div>
            ))}

            {/* Single-Use Backup Recovery Codes */}
            {recoveryCodes ? (
              <div className="rounded-xl border-2 border-amber-500 bg-slate-50 dark:bg-slate-950 p-4 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Save Your 8 One-Time Backup Recovery Codes
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Store these safely offline. If you lose your Authenticator app, each code signs you in once. They will not be shown again.
                    </p>
                  </div>
                  <span className="rounded-md bg-[#0b5336] border border-[#08412a] px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                    {recoveryCodes.length} Codes
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {recoveryCodes.map((code) => (
                    <div
                      key={code}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-center font-mono text-xs font-bold tracking-wider text-slate-900 dark:text-amber-300"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(recoveryCodes.join("\n"));
                      setCopiedBackupCodes(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-2xs cursor-pointer"
                  >
                    <AppIcon
                      icon={copiedBackupCodes ? Check : Copy}
                      size="xs"
                      color="inherit"
                    />
                    <span>{copiedBackupCodes ? "Copied!" : "Copy All"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const content = [
                        "PUP FOCUS - Bataan Campus",
                        `Two-Factor Backup Recovery Codes (${accountLabel})`,
                        `Generated: ${new Date().toLocaleString()}`,
                        "Each code can only be used ONCE:",
                        "",
                        ...recoveryCodes,
                      ].join("\n");
                      const blob = new Blob([content], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `pup-focus-${accountLabel.toLowerCase()}-backup-codes.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-2xs cursor-pointer"
                  >
                    <AppIcon icon={Download} size="xs" color="inherit" />
                    <span>Download .txt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecoveryCodes(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-xs cursor-pointer"
                  >
                    I Have Saved These
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 shadow-2xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      One-Time Backup Recovery Codes
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md border shadow-2xs ${
                        remainingBackupCount > 0
                          ? "bg-[#0b5336] text-white border-[#08412a]"
                          : "bg-amber-500 text-slate-950 border-amber-600"
                      }`}
                    >
                      {remainingBackupCount} Remaining
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Use a backup code during Sign In if you ever lose your phone or Authenticator app.
                  </p>
                </div>

                {confirmRegenerateCodes ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isGeneratingCodes}
                      onClick={() => void requestNewRecoveryCodes(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingCodes && (
                        <AppIcon
                          icon={SystemRestart}
                          size="xs"
                          color="inherit"
                          className="animate-spin"
                        />
                      )}
                      <span>Replace Old Codes</span>
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingCodes}
                      onClick={() => setConfirmRegenerateCodes(false)}
                      className="rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] px-3 py-1.5 text-xs font-semibold text-white shadow-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isGeneratingCodes}
                    onClick={() => {
                      if (remainingBackupCount > 0) {
                        setConfirmRegenerateCodes(true);
                      } else {
                        void requestNewRecoveryCodes(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <AppIcon icon={Refresh} size="xs" color="inherit" />
                    <span>
                      {remainingBackupCount > 0
                        ? "Regenerate Codes"
                        : "Generate Backup Codes"}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 shadow-2xs">
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
              2FA is not yet enabled on your account. Setting it up ensures a stolen password alone cannot access your {accountLabel} Portal.
            </p>
            <button
              type="button"
              onClick={() => void handleStartEnrollment()}
              disabled={isProcessing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 sm:py-2 rounded-xl text-xs shadow-sm cursor-pointer transition-colors disabled:opacity-50 shrink-0"
            >
              {isProcessing ? (
                <>
                  <AppIcon
                    icon={SystemRestart}
                    size="sm"
                    color="inherit"
                    className="animate-spin"
                  />
                  <span>Starting Setup...</span>
                </>
              ) : (
                <>
                  <AppIcon icon={Lock} size="sm" color="inherit" />
                  <span>Enable 2FA (Authenticator App)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default MfaSecurityCard;
