import { ROLE, ROLE_LABEL, type AppRole } from "../../config/roles";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getAppBaseUrl() {
  const configuredBase = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.SITE_URL,
    process.env.URL,
  ]
    .find(Boolean)
    ?.trim();

  return (configuredBase || "https://pupfocus.cjaayy.dev").replace(/\/$/, "");
}

export function buildAppUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}

export function buildEmailLayout({
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
          <div style="display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;">
            ${safeLogoSrc ? `<img src="${safeLogoSrc}" alt="PUP seal" width="56" height="56" style="display:block;border-radius:999px;background:rgba(255,255,255,0.08);padding:6px;" />` : ""}
            <div style="min-width:0;max-width:100%;text-align:center;">
              <h1 style="margin:0;font-size:32px;line-height:1.1;color:#fff8e7;">${escapeHtml(title)}</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#f8e3bc;">${escapeHtml(intro)}</p>
            </div>
          </div>
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
  firstName,
  link,
  invitedRole = ROLE.ADMIN,
}: {
  fullName?: string;
  firstName?: string;
  link: string;
  invitedRole?: AppRole;
}) {
  const roleLabel = ROLE_LABEL[invitedRole] ?? "Faculty";
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "there";
  const safeFirstName = escapeHtml(resolvedFirstName);
  const safeRoleLabel = escapeHtml(roleLabel);

  return buildEmailLayout({
    title: "Welcome to PUP FOCUS",
    intro: `Hello ${safeFirstName}, your ${safeRoleLabel.toLowerCase()} account is almost ready.`,
    body: `Your access has been prepared for PUP FOCUS. Use the button below to continue setting up your account and get started right away.`,
    actionLabel: "Open invitation",
    actionHref: link,
    footerNote: `If you did not expect this invitation, you can ignore this email.`,
    logoSrc: buildAppUrl("/icons/pup-seal.png"),
  });
}

export function buildTempPasswordEmailHtml({
  fullName,
  firstName,
  tempPassword,
  signInHref,
}: {
  fullName?: string;
  firstName?: string;
  tempPassword: string;
  signInHref?: string;
}) {
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "there";
  const safeFirstName = escapeHtml(resolvedFirstName);
  const safeTempPassword = escapeHtml(tempPassword);

  return buildEmailLayout({
    title: "Temporary Password",
    intro: `Hello ${safeFirstName}, your account is ready.`,
    body: `Use the temporary password below to sign in to PUP FOCUS. After you sign in, please change your password immediately for security.`,
    actionLabel: "Sign in",
    actionHref: signInHref || buildAppUrl("/auth/sign-in"),
    footerNote: `Temporary password: ${safeTempPassword}`,
    logoSrc: buildAppUrl("/icons/pup-seal.png"),
  });
}

export function buildSubmissionWindowNotificationEmailHtml({
  fullName,
  startDate,
  endDate,
  startTimeLabel,
  endTimeLabel,
  actionHref,
}: {
  fullName: string;
  startDate: string;
  endDate: string;
  startTimeLabel: string;
  endTimeLabel: string;
  actionHref: string;
}) {
  const safeFullName = escapeHtml(fullName);

  return buildEmailLayout({
    title: "Submission Window Opened",
    intro: `Hello ${safeFullName}, the faculty submission window has been scheduled.`,
    body: `The submission window is now open from ${escapeHtml(startDate)} ${escapeHtml(startTimeLabel)} to ${escapeHtml(endDate)} ${escapeHtml(endTimeLabel)}. Please submit any pending requirements through your dashboard before the deadline.`,
    actionLabel: "Open Faculty Dashboard",
    actionHref,
    footerNote:
      "If you have already submitted all requirements, thank you. Otherwise, please complete your outstanding submissions on time.",
    logoSrc: buildAppUrl("/icons/pup-seal.png"),
  });
}
