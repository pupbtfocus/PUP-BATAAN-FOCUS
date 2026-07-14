import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
} from "../../lib/email/send-invite";
import { ROLE } from "../../config/roles";

export default function EmailPreviewPage() {
  const inviteHtml = buildInviteEmailHtml({
    fullName: "Jane Doe",
    link: "https://pup-focus.local/auth/sign-in",
    invitedRole: ROLE.FACULTY,
  });

  const tempPasswordHtml = buildTempPasswordEmailHtml({
    fullName: "Jane Doe",
    tempPassword: "TempPass123!",
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
            Invite Email Preview
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
            Temporary Password Email Preview
          </h1>
          <div dangerouslySetInnerHTML={{ __html: tempPasswordHtml }} />
        </section>
      </div>
    </main>
  );
}
