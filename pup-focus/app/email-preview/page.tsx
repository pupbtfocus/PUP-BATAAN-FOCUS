import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
  buildForgotPasswordEmailHtml,
} from "../../lib/email/email-templates";
import { ROLE } from "../../config/roles";

export default function EmailPreviewPage() {
  const inviteHtml = buildInviteEmailHtml({
    fullName: "Jane Doe",
    link: "https://pup-focus.local/auth/sign-in",
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
        <section
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 24px rgba(77,0,0,0.12)",
          }}
        >
          <h1 style={{ margin: "0 0 18px", color: "#4d0000" }}>
            Account Invitation Email Preview
          </h1>
          <div dangerouslySetInnerHTML={{ __html: inviteHtml }} />
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
    </main>
  );
}

