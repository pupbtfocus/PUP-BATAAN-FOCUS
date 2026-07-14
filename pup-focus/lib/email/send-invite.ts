import nodemailer from "nodemailer";
import { ROLE, ROLE_LABEL, type AppRole } from "../../config/roles";

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

function getAppBaseUrl() {
  const configuredBase = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.SITE_URL,
    process.env.URL,
  ]
    .find(Boolean)
    ?.trim();

  return (configuredBase || "https://pup-focus.local").replace(/\/$/, "");
}

function buildAppUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}

function buildEmailLayout({
  title,
  intro,
  body,
  actionLabel,
  actionHref,
  footerNote,
  logoSrc,
}: {
  title: string;
  intro: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  footerNote?: string;
  logoSrc?: string;
}) {
  const safeActionLabel = actionLabel ? escapeHtml(actionLabel) : "";
  const safeActionHref = actionHref ? escapeHtml(actionHref) : "";
  const safeFooterNote = footerNote ? escapeHtml(footerNote) : "";
  const safeLogoSrc = logoSrc ? escapeHtml(logoSrc) : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f7efe7;font-family:Arial,Helvetica,sans-serif;color:#2f1a1a;">
    <table role="presentation" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border-collapse:collapse;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(77,0,0,0.12);">
      <tr>
        <td style="background:linear-gradient(135deg,#4d0000 0%,#7a0000 100%);padding:28px 32px;text-align:center;">
          <div style="display:flex;align-items:center;justify-content:center;padding:14px;border-radius:999px;background:rgba(255,255,255,0.08);">
            ${safeLogoSrc ? `<img src="${safeLogoSrc}" alt="PUP seal" width="48" height="48" style="display:block;" />` : ""}
          </div>
          <h1 style="margin:18px 0 6px;font-size:28px;line-height:1.2;color:#fff8e7;">${escapeHtml(title)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#f8e3bc;">${escapeHtml(intro)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#2f1a1a;">${escapeHtml(body)}</p>
          ${
            safeActionLabel && safeActionHref
              ? `<div style="margin:24px 0 18px;text-align:center;"><a href="${safeActionHref}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#ffd700;color:#4d0000;text-decoration:none;font-weight:700;">${safeActionLabel}</a></div>`
              : ""
          }
          <p style="margin:0;font-size:14px;line-height:1.7;color:#6b4b4b;">${safeFooterNote || "If you did not expect this message, you can safely ignore it."}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildInviteEmailHtml({
  fullName,
  link,
  invitedRole = ROLE.ADMIN,
}: {
  fullName: string;
  link: string;
  invitedRole?: AppRole;
}) {
  const roleLabel = ROLE_LABEL[invitedRole] ?? "Account";
  const safeFullName = escapeHtml(fullName);
  const safeRoleLabel = escapeHtml(roleLabel);

  return buildEmailLayout({
    title: "Welcome to PUP FOCUS",
    intro: `Hello ${safeFullName}, your ${safeRoleLabel.toLowerCase()} account is almost ready.`,
    body: `Your access has been prepared for PUP FOCUS. Use the button below to continue setting up your account and get started right away.`,
    actionLabel: "Open invitation",
    actionHref: link,
    footerNote: `If you did not expect this invitation, you can ignore this email.`,
    logoSrc: buildAppUrl("/icons/pup-seal.png"),
  });
}

export function buildTempPasswordEmailHtml({
  fullName,
  tempPassword,
  signInHref,
}: {
  fullName: string;
  tempPassword: string;
  signInHref?: string;
}) {
  const safeFullName = escapeHtml(fullName);
  const safeTempPassword = escapeHtml(tempPassword);

  return buildEmailLayout({
    title: "Temporary Password",
    intro: `Hello ${safeFullName}, your account is ready.`,
    body: `Use the temporary password below to sign in to PUP FOCUS. After you sign in, please change your password immediately for security.`,
    actionLabel: "Sign in",
    actionHref: signInHref || buildAppUrl("/auth/sign-in"),
    footerNote: `Temporary password: ${safeTempPassword}`,
    logoSrc: buildAppUrl("/icons/pup-seal.png"),
  });
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

  const roleLabel = ROLE_LABEL[invitedRole] ?? "account";
  const subject = "PUP FOCUS - Account access";
  const text = `Hello ${fullName},\n\nYour ${roleLabel.toLowerCase()} account is ready. Use the link below to continue:\n\n${link}\n\nIf you did not expect this, ignore this message.`;
  const html = buildInviteEmailHtml({
    fullName,
    link,
    invitedRole,
  });

  const info = await transporter.sendMail({
    from: formatDisplayFromAddress(fromAddress),
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
  const html = buildTempPasswordEmailHtml({
    fullName,
    tempPassword,
    signInHref: buildAppUrl("/auth/sign-in"),
  });

  const info = await transporter.sendMail({
    from: formatDisplayFromAddress(fromAddress),
    to: normalizeEmailAddress(to),
    subject,
    text,
    html,
  });

  return info;
}
