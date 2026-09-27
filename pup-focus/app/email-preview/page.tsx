"use client";

import { useState } from "react";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
  buildForgotPasswordEmailHtml,
} from "../../lib/email/email-templates";
import { ROLE } from "../../config/roles";
import { CancelledInviteModal } from "@/components/auth/cancelled-invite-modal";
import { WarningTriangle, Eye } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export default function EmailPreviewPage() {
  const [showCancelledModal, setShowCancelledModal] = useState(false);

  const inviteHtml = buildInviteEmailHtml({
    fullName: "Jane Doe",
    link: "https://pup-focus.local/auth/confirm?email=faculty%40pup.edu.ph",
    invitedRole: ROLE.FACULTY,
  });

  const tempPasswordHtml = buildTempPasswordEmailHtml({
    fullName: "Jane Doe",
    email: "faculty@pup.edu.ph",
    tempPassword: "TempPass123!",
  });

  const forgotPasswordHtml = buildForgotPasswordEmailHtml({
    fullName: "Jane Doe",
    email: "faculty@pup.edu.ph",
    resetLink: "https://pup-focus.local/auth/change-password",
  });

  return (
    <main
      style={{
        background: "#f7efe7",
        minHeight: "100vh",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "980px",
          margin: "0 auto",
          display: "grid",
          gap: "24px",
        }}
      >
        {/* Cancelled Invitation Modal Preview Section */}
        <section
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 24px rgba(77,0,0,0.12)",
            border: "2px solid #f87171",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fef2f2", color: "#991b1b", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                <AppIcon icon={WarningTriangle} size="xs" color="inherit" />
                <span>Email Accept Action: Invitation Cancelled</span>
              </div>
              <h1 style={{ margin: "0", color: "#4d0000", fontSize: "20px" }}>
                Cancelled Invitation Acceptance Modal
              </h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
                When an invited user clicks the <strong>&quot;Accept Invitation&quot;</strong> button in their email after the invite has been cancelled by an administrator, this modal automatically appears.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCancelledModal(true)}
              style={{
                background: "#780000",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                padding: "10px 18px",
                fontWeight: "bold",
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(120, 0, 0, 0.3)",
              }}
            >
              <AppIcon icon={Eye} size="sm" color="white" />
              <span>Preview Live Modal</span>
            </button>
          </div>

          <div
            style={{
              background: "linear-gradient(to bottom, #4e0303, #350000, #200000)",
              borderRadius: "16px",
              padding: "24px",
              color: "#fff8e7",
              textAlign: "center",
              border: "1px solid rgba(244, 63, 94, 0.4)",
              maxWidth: "460px",
              margin: "0 auto",
            }}
          >
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#180000", border: "2px solid rgba(244, 63, 94, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <span style={{ fontSize: "28px" }}>⚠️</span>
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", color: "#fecdd3" }}>
              Invitation Cancelled
            </h3>
            <div style={{ display: "inline-block", background: "rgba(136, 19, 55, 0.7)", border: "1px solid rgba(244, 63, 94, 0.5)", borderRadius: "999px", padding: "3px 12px", fontSize: "11px", fontWeight: "bold", color: "#fda4af", marginBottom: "12px" }}>
              Access Revoked by Administrator
            </div>
            <div style={{ background: "rgba(0, 0, 0, 0.4)", borderRadius: "10px", padding: "10px", textAlign: "left", marginBottom: "14px", border: "1px solid rgba(251, 191, 36, 0.3)", fontSize: "12px" }}>
              <div style={{ fontWeight: "bold", color: "#fef08a" }}>Jane Doe</div>
              <div style={{ color: "#cbd5e1", fontSize: "11px", fontFamily: "monospace" }}>faculty@pup.edu.ph</div>
            </div>
            <p style={{ fontSize: "12px", color: "rgba(255, 228, 230, 0.9)", margin: "0 0 8px", lineHeight: "1.5" }}>
              This account invitation has been cancelled or revoked by the institutional administrator.
            </p>
            <p style={{ fontSize: "11px", color: "rgba(254, 205, 211, 0.7)", margin: "0 0 16px", lineHeight: "1.4" }}>
              The link in your email is no longer active. If you believe this cancellation was made in mistake, please contact your department chairperson or PUP Bataan administrator.
            </p>
            <button
              type="button"
              onClick={() => setShowCancelledModal(true)}
              style={{
                background: "linear-gradient(to right, #fbbf24, #f59e0b)",
                color: "#3d0000",
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontSize: "11px",
                padding: "10px 18px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Test Interactive Modal
            </button>
          </div>
        </section>

        <section
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 24px rgba(77,0,0,0.12)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
            <div>
              <h1 style={{ margin: "0 0 4px", color: "#4d0000", fontSize: "20px" }}>
                Account Invitation Email Preview
              </h1>
              <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                Clicking the <strong>&quot;Accept Invitation&quot;</strong> button inside this email simulates what happens if the invite has been cancelled.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCancelledModal(true)}
              style={{
                background: "#780000",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "8px 16px",
                fontWeight: "bold",
                fontSize: "12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(120, 0, 0, 0.25)",
              }}
            >
              <AppIcon icon={Eye} size="xs" color="white" />
              <span>Preview Cancelled Invite Modal</span>
            </button>
          </div>
          <div
            onClick={(e) => {
              const anchor = (e.target as HTMLElement).closest("a");
              if (anchor) {
                e.preventDefault();
                setShowCancelledModal(true);
              }
            }}
            style={{ cursor: "pointer" }}
            title="Click 'Accept Invitation' to preview the Cancelled Invite Modal"
            dangerouslySetInnerHTML={{ __html: inviteHtml }}
          />
        </section>

        <section
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 24px rgba(77,0,0,0.12)",
          }}
        >
          <h1 style={{ margin: "0 0 18px", color: "#4d0000" }}>
            Temporary Credentials Email Preview
          </h1>
          <div dangerouslySetInnerHTML={{ __html: tempPasswordHtml }} />
        </section>

        <section
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 24px rgba(77,0,0,0.12)",
          }}
        >
          <h1 style={{ margin: "0 0 18px", color: "#4d0000" }}>
            Forgot Password (Reset) Email Preview
          </h1>
          <div dangerouslySetInnerHTML={{ __html: forgotPasswordHtml }} />
        </section>
      </div>

      {/* Interactive Cancelled Invite Modal */}
      <CancelledInviteModal
        isOpen={showCancelledModal}
        email="faculty@pup.edu.ph"
        fullName="Jane Doe"
        onClose={() => setShowCancelledModal(false)}
        onReturnToSignIn={() => {
          setShowCancelledModal(false);
          window.location.href = "/";
        }}
      />
    </main>
  );
}
