"use client";

import { useState } from "react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
          Faculty Account Created
        </p>
        <h3 className="mt-2 text-xl font-semibold text-[#fff8e7]">
          {inviteWasSent ? "Credentials Sent via Email" : "Temporary Credentials Ready"}
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-[#f3d9b3]">
          {inviteModalMessage}
        </p>

        {tempPassword ? (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-950/40 p-3.5 space-y-2 text-xs">
            {email ? (
              <div className="flex justify-between items-center">
                <span className="text-amber-200/80 font-medium">Email:</span>
                <span className="text-[#fff8e7] font-mono select-all">{email}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center">
              <span className="text-amber-200/80 font-medium">Temporary Password:</span>
              <span className="text-[#ffd700] font-mono font-bold select-all bg-amber-900/60 px-2 py-0.5 rounded">
                {tempPassword}
              </span>
            </div>
            <p className="text-[11px] text-amber-200/60 italic pt-1 border-t border-amber-400/20">
              The faculty member will be required to change this password upon their first sign-in.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          {tempPassword ? (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(255,215,0,0.3)] bg-[#ffd700]/10 hover:bg-[#ffd700]/20 px-3.5 py-2 text-xs font-semibold text-[#ffd700] transition cursor-pointer"
            >
              {copied ? "✓ Copied!" : "📋 Copy Credentials"}
            </button>
          ) : (
            <div />
          )}

          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
