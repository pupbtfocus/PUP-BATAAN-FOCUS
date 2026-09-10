"use client";

import { useState } from "react";
import { Check, Copy } from "iconoir-react";
import { Button } from "@/components/ui/button";

export interface InviteStatusModalProps {
  isOpen: boolean;
  inviteWasSent: boolean;
  inviteModalMessage: string;
  email?: string | null;
  tempPassword?: string | null;
  onClose: () => void;
}

export function InviteStatusModal({
  isOpen,
  inviteWasSent,
  inviteModalMessage,
  email,
  tempPassword,
  onClose,
}: InviteStatusModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleCopy = () => {
    const textToCopy = [
      email ? `Email: ${email}` : "",
      tempPassword ? `Temporary Password: ${tempPassword}` : "",
      `Login URL: ${window.location.origin}/`,
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 backdrop-blur">
        <p className={`text-xs uppercase tracking-[0.28em] font-semibold ${inviteWasSent ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
          {inviteWasSent ? "Invitation Sent" : "Invite Link Generated"}
        </p>
        <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
          {inviteWasSent ? "Email Sent Successfully" : "Email Delivery Failed"}
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
          {inviteModalMessage}
        </p>

        {tempPassword ? (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2 text-xs">
            {email ? (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Email:</span>
                <span className="text-slate-900 dark:text-slate-100 font-mono select-all">{email}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Temporary Password:</span>
              <span className="text-slate-900 dark:text-slate-100 font-mono font-bold select-all bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                {tempPassword}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200 dark:border-slate-800">
              The faculty member will be required to change this password upon their first sign-in.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          {tempPassword ? (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Credentials</span>
                </>
              )}
            </button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold px-5 py-2 rounded-xl transition cursor-pointer"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
