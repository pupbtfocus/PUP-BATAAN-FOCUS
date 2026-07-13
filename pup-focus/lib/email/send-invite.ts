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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    from || process.env.EMAIL_FROM || user,
  );

  const roleLabel = ROLE_LABEL[invitedRole];
  const roleLower = roleLabel.toLowerCase();
  const subject = "PUP FOCUS - Account access";
  const text = `Hello ${fullName},\n\nYour ${roleLower} account is ready. Use the link below to continue:\n\n${link}\n\nIf you did not expect this, ignore this message.`;

  const html = `
    <div>
      <p>Hello ${fullName},</p>
      <p>Your <strong>${roleLower}</strong> account is ready. Use the link below to continue:</p>
      <p><a href="${link}">Open account access</a></p>
      <p>If you did not expect this, ignore this message.</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: formatDisplayFromAddress(fromAddress),
    replyTo: fromAddress,
    to: normalizeEmailAddress(to),
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
    from || process.env.EMAIL_FROM || user,
  );

  const subject = "PUP FOCUS - Login details";
  const text = `Hello ${fullName},\n\nYour account is ready. Use the temporary password below to sign in to PUP FOCUS:\n\n${tempPassword}\n\nPlease sign in and change your password after logging in.`;
  const escapedFullName = escapeHtml(fullName);
  const escapedTempPassword = escapeHtml(tempPassword);

  const html = `
    <div>
      <p>Hello ${escapedFullName},</p>
      <p>Your account is ready. Use the temporary password below to sign in to <strong>PUP FOCUS</strong>:</p>
      <p><code>${escapedTempPassword}</code></p>
      <p>Please sign in and change your password after logging in.</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: formatDisplayFromAddress(fromAddress),
    replyTo: fromAddress,
    to: normalizeEmailAddress(to),
    subject,
    text,
    html,
  });

  return info;
}
