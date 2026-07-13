import nodemailer from "nodemailer";
import { ROLE, ROLE_LABEL, type AppRole } from "@/config/roles";

function normalizeSmtpValue(value: string | undefined) {
  return value?.trim() || "";
}

function normalizeSmtpPassword(value: string | undefined) {
  return normalizeSmtpValue(value).replace(/\s+/g, "");
}

function normalizeEmailAddress(value: string) {
  return value.trim();
}

function formatDisplayFromAddress(address: string) {
  return {
    name: "PUP FOCUS",
    address,
  };
}

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
  const host = normalizeSmtpValue(process.env.EMAIL_SMTP_HOST);
  const port = normalizeSmtpValue(process.env.EMAIL_SMTP_PORT);
  const user = normalizeSmtpValue(process.env.EMAIL_SMTP_USER);
  const pass = normalizeSmtpPassword(process.env.EMAIL_SMTP_PASS);

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

  const fromAddress = normalizeEmailAddress(
    from || process.env.EMAIL_FROM || "pupbataanfocus.superadmin@gmail.com",
  );

  const roleLabel = ROLE_LABEL[invitedRole];
  const roleLower = roleLabel.toLowerCase();
  const subject = `PUP FOCUS - ${roleLabel} invitation`;
  const text = `Hello ${fullName},\n\nYou have been invited to be a ${roleLower} for PUP FOCUS. Click the link to accept the invitation:\n\n${link}\n\nIf you did not expect this, ignore this message.`;

  const html = `
    <div>
      <p>Hello ${fullName},</p>
      <p>You have been invited to be a <strong>${roleLower}</strong> for PUP FOCUS.</p>
      <p><a href="${link}">Click here to accept the invitation</a></p>
      <p>If you did not expect this, ignore this message.</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: formatDisplayFromAddress(fromAddress),
    replyTo: fromAddress,
    sender: user,
    to: normalizeEmailAddress(to),
    subject,
    text,
    html,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
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
  const host = normalizeSmtpValue(process.env.EMAIL_SMTP_HOST);
  const port = normalizeSmtpValue(process.env.EMAIL_SMTP_PORT);
  const user = normalizeSmtpValue(process.env.EMAIL_SMTP_USER);
  const pass = normalizeSmtpPassword(process.env.EMAIL_SMTP_PASS);

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

  const fromAddress = normalizeEmailAddress(
    from || process.env.EMAIL_FROM || "pupbataanfocus.superadmin@gmail.com",
  );

  const subject = "PUP FOCUS — Your temporary password";
  const text = `Hello ${fullName},\n\nYour email has been verified. You can sign in to PUP FOCUS with the following temporary password:\n\n${tempPassword}\n\nPlease sign in and change your password immediately. If you did not request this, contact your administrator.`;

  const html = `
    <div>
      <p>Hello ${fullName},</p>
      <p>Your email has been verified. You can sign in to <strong>PUP FOCUS</strong> with the following temporary password:</p>
      <pre>${tempPassword}</pre>
      <p>Please sign in and change your password immediately. If you did not request this, contact your administrator.</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: formatDisplayFromAddress(fromAddress),
    replyTo: fromAddress,
    sender: user,
    to: normalizeEmailAddress(to),
    subject,
    text,
    html,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
  });

  return info;
}
