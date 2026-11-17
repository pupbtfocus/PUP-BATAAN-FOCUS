"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Lock, SystemRestart } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export interface UserMfaResetRowProps {
  userId: string;
  userName?: string | null;
  allowReset?: boolean;
}

export function UserMfaResetRow({
  userId,
  userName,
  allowReset = true,
}: UserMfaResetRowProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/staff/users/reset-mfa?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const json = await res.json();
        setEnabled(Boolean(json.enabled));
        setCanReset(Boolean(json.canReset) && allowReset);
      } else {
        setEnabled(false);
        setCanReset(false);
      }
    } catch {
      setEnabled(false);
      setCanReset(false);
    } finally {
      setIsLoading(false);
    }
  }, [userId, allowReset]);

  useEffect(() => {
    setConfirming(false);
    setFeedback(null);
    void fetchStatus();
  }, [fetchStatus]);

  async function handleConfirmReset() {
    setIsResetting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/staff/users/reset-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to reset user 2FA.");
      }
      setEnabled(false);
      setConfirming(false);
      setFeedback({
        type: "success",
        text: `2FA cleared for ${userName || "this account"}. They can re-enroll in Settings.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to reset 2FA.",
      });
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="py-1.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-slate-500 dark:text-slate-400 shrink-0 inline-flex items-center gap-1.5">
          <AppIcon icon={Lock} size="xs" color="inherit" />
          <span>Two-Factor Auth</span>
        </span>

        {isLoading ? (
          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            Checking...
          </span>
        ) : enabled ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-[#0b5336] text-white border border-[#08412a] shadow-2xs">
              Enabled
            </span>
            {canReset && !confirming && (
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setConfirming(true);
                }}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white shadow-2xs transition-colors cursor-pointer"
              >
                Reset 2FA
              </button>
            )}
          </div>
        ) : (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-600 text-white border border-slate-700 shadow-2xs">
            Not Enabled
          </span>
        )}
      </div>

      {confirming && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 space-y-2 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
            Remove lost Authenticator &amp; backup codes for{" "}
            <span className="font-bold text-slate-900 dark:text-white">
              {userName || "this user"}
            </span>
            ?
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isResetting}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-slate-700 bg-slate-600 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isResetting}
              onClick={() => void handleConfirmReset()}
              className="inline-flex items-center gap-1 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-50"
            >
              {isResetting && (
                <AppIcon
                  icon={SystemRestart}
                  size="xs"
                  color="inherit"
                  className="animate-spin"
                />
              )}
              <span>Confirm Reset</span>
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-2xs ${
            feedback.type === "success"
              ? "bg-[#0b5336] border border-[#08412a]"
              : "bg-[#780000] border border-[#5e0000]"
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
