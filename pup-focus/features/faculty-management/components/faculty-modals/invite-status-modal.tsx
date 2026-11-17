"use client";

import { useState } from "react";
import { Check, Copy, Key, SendMail } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { ModalHeader } from "@/components/ui/modal-header";

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

    try {
      localStorage.setItem(
        "pup_focus_last_credentials",
        JSON.stringify({
          email: email || "",
          password: tempPassword || "",
        })
      );
    } catch {}

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4"
    >
      <div
        className="fixed inset-0 h-lvh bg-black/75 backdrop-blur-sm touch-none overscroll-none"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-slate-100 backdrop-blur">
        <ModalHeader
          icon={inviteWasSent ? SendMail : Key}
          title={inviteWasSent ? "Email Sent Successfully" : "Invite Link Generated"}
          subtitle={inviteWasSent ? "Invitation Sent" : "Manual Activation Required"}
          className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 rounded-t-2xl"
        />
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-400">
          {inviteModalMessage}
        </p>

        {tempPassword ? (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2 text-xs">
            {email ? (
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Email:</span>
                <span className="text-slate-900 dark:text-slate-100 font-mono select-all break-all">{email}</span>
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
                  <AppIcon icon={Check} size="sm" color="success" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <AppIcon icon={Copy} size="sm" color="inherit" />
                  <span>Copy Credentials</span>
                </>
              )}
            </button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="maroon"
            onClick={onClose}
            className="cursor-pointer"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
