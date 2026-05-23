import nodemailer from "nodemailer";
import { ROLE, ROLE_LABEL, type AppRole } from "@/config/roles";

type SendInviteOpts = {
  to: string;
  link: string;
  fullName: string;
  from?: string;
  invitedRole?: AppRole;
};

export async function sendInviteEmail({
  to,
  link,
  fullName,
  from,
  invitedRole = ROLE.ADMIN,
}: SendInviteOpts) {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = process.env.EMAIL_SMTP_PORT;
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      "SMTP configuration missing (EMAIL_SMTP_HOST/PORT/USER/PASS)",
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: {
      user,
      pass,
    },
  });

  const fromAddress =
    from || process.env.EMAIL_FROM || "pupbataanfocus.superadmin@gmail.com";

  const roleLabel = ROLE_LABEL[invitedRole];
  const roleLower = roleLabel.toLowerCase();
  const subject = `PUP FOCUS - ${roleLabel} invitation`;
  const text = `Hello ${fullName},\n\nYou have been invited to be a ${roleLower} for PUP FOCUS. Click the link to accept the invitation:\n\n${link}\n\nIf you did not expect this, ignore this message.`;

  const html = `<p>Hello ${fullName},</p>
  <p>You have been invited to be a <strong>${roleLower}</strong> for PUP FOCUS.</p>
  <p><a href="${link}">Click here to accept the invitation</a></p>
  <p>If you did not expect this, ignore this message.</p>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });

  return info;
}

type SendTempPasswordOpts = {
  to: string;
  tempPassword: string;
  fullName: string;
  from?: string;
};

export async function sendTempPasswordEmail({
  to,
  tempPassword,
  fullName,
  from,
}: SendTempPasswordOpts) {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = process.env.EMAIL_SMTP_PORT;
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      "SMTP configuration missing (EMAIL_SMTP_HOST/PORT/USER/PASS)",
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: {
      user,
      pass,
    },
  });

  const fromAddress =
    from || process.env.EMAIL_FROM || "pupbataanfocus.superadmin@gmail.com";

  const subject = "PUP FOCUS — Your temporary admin password";
  const text = `Hello ${fullName},\n\nYour email has been verified. You can sign in to PUP FOCUS with the following temporary password:\n\n${tempPassword}\n\nPlease sign in and change your password immediately. If you did not request this, contact your administrator.`;

  const html = `<p>Hello ${fullName},</p>
  <p>Your email has been verified. You can sign in to <strong>PUP FOCUS</strong> with the following temporary password:</p>
  <pre style="background:#111;padding:8px;border-radius:6px;color:#fff;">${tempPassword}</pre>
  <p>Please sign in and change your password immediately. If you did not request this, contact your administrator.</p>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });

  return info;
}
