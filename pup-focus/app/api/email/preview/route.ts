import { NextResponse } from "next/server";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
  buildForgotPasswordEmailHtml,
} from "../../../../lib/email/send-invite";
import { ROLE } from "../../../../config/roles";

export async function GET() {
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

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PUP FOCUS — Email Templates Preview</title>
    <style>
      body { margin:0; padding:24px; background:#f7efe7; font-family:Arial, sans-serif; }
      .panel { max-width: 980px; margin:0 auto; display:grid; gap:24px; }
      .card { background:#fff; border-radius:16px; padding:24px; box-shadow:0 10px 24px rgba(77,0,0,0.12); }
      h2 { margin:0 0 16px; color:#4d0000; font-size: 20px; }
    </style>
  </head>
  <body>
    <div class="panel">
      <div class="card">
        <h2>Account Invitation Email Preview</h2>
        <div>${inviteHtml}</div>
      </div>
      <div class="card">
        <h2>Temporary Credentials Email Preview</h2>
        <div>${tempPasswordHtml}</div>
      </div>
      <div class="card">
        <h2>Forgot Password (Reset) Email Preview</h2>
        <div>${forgotPasswordHtml}</div>
      </div>
    </div>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

