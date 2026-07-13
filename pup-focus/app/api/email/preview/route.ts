import { NextResponse } from "next/server";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
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
    tempPassword: "TempPass123!",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email Preview</title>
    <style>
      body { margin:0; padding:24px; background:#f7efe7; font-family:Arial, sans-serif; }
      .panel { max-width: 980px; margin:0 auto; display:grid; gap:24px; }
      .card { background:#fff; border-radius:16px; padding:24px; box-shadow:0 10px 24px rgba(77,0,0,0.12); }
      h2 { margin:0 0 12px; color:#4d0000; }
    </style>
  </head>
  <body>
    <div class="panel">
      <div class="card">
        <h2>Invite Email Preview</h2>
        <div>${inviteHtml}</div>
      </div>
      <div class="card">
        <h2>Temporary Password Email Preview</h2>
        <div>${tempPasswordHtml}</div>
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
