"use client";

import { Button } from "@/components/ui/button";

export interface InviteStatusModalProps {
  isOpen: boolean;
  inviteWasSent: boolean;
  inviteModalMessage: string;
  onClose: () => void;
}

export function InviteStatusModal({
  isOpen,
  inviteWasSent,
  inviteModalMessage,
  onClose,
}: InviteStatusModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
          {inviteWasSent ? "Invitation Sent" : "Invite Link Generated"}
        </p>
        <h3 className="mt-3 text-xl font-semibold text-[#fff8e7]">
          {inviteWasSent ? "Email sent successfully" : "Email delivery failed"}
        </h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-[#f3d9b3]">
          {inviteModalMessage}
        </p>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
