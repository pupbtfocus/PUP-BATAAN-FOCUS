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
  contentHtml,
  actionLabel,
  actionHref,
  footerNote,
  logoSrc,
  pupLogoSrc,
  focusLogoSrc,
}: {
  title: string;
  intro: string;
  body?: string;
  contentHtml?: string;
  actionLabel?: string;
  actionHref?: string;
  footerNote?: string;
  logoSrc?: string;
  pupLogoSrc?: string;
  focusLogoSrc?: string;
}) {
  const safeActionLabel = actionLabel ? escapeHtml(actionLabel) : "";
  const safeActionHref = actionHref ? escapeHtml(actionHref.replace(/&amp;/g, "&")) : "";
  const safeFooterNote = footerNote ? escapeHtml(footerNote) : "";
  const safePupLogoSrc = escapeHtml((pupLogoSrc || logoSrc || buildAppUrl("/icons/pup-seal.png")).replace(/&amp;/g, "&"));
  const safeFocusLogoSrc = escapeHtml((focusLogoSrc || buildAppUrl("/icons/pup-focus-emblem-logo.png")).replace(/&amp;/g, "&"));

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f7efe7;font-family:Arial,Helvetica,sans-serif;color:#2f1a1a;">
    <table role="presentation" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border-collapse:collapse;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(77,0,0,0.14);border:1px solid rgba(120,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#4d0000 0%,#780000 100%);padding:32px 28px;text-align:center;">
          <!-- Dual Logos: PUP Seal & PUP FOCUS Emblem -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px auto;">
            <tr>
              <td style="vertical-align:middle;padding-right:12px;">
                <img src="${safePupLogoSrc}" alt="PUP Seal" width="52" height="52" style="display:block;border-radius:50%;border:2px solid #fbbf24;background:#ffffff;padding:2px;box-shadow:0 4px 10px rgba(0,0,0,0.35);" />
              </td>
              <td style="vertical-align:middle;padding:0 4px;color:#fbbf24;font-size:20px;font-weight:700;line-height:1;">
                •
              </td>
              <td style="vertical-align:middle;padding-left:12px;">
                <img src="${safeFocusLogoSrc}" alt="PUP FOCUS" width="52" height="52" style="display:block;border-radius:50%;border:2px solid #fbbf24;background:#ffffff;padding:2px;box-shadow:0 4px 10px rgba(0,0,0,0.35);" />
              </td>
            </tr>
          </table>
          <div style="min-width:0;max-width:100%;text-align:center;">
            <h1 style="margin:0;font-size:26px;font-weight:800;line-height:1.2;color:#fff8e7;letter-spacing:0.3px;">${escapeHtml(title)}</h1>
            <p style="margin:10px auto 0;font-size:15px;line-height:1.6;color:#f8e3bc;max-width:480px;">${escapeHtml(intro)}</p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 28px;">
          ${body ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#2f1a1a;">${escapeHtml(body)}</p>` : ""}
          ${contentHtml ? contentHtml : ""}
          ${
            safeActionLabel && safeActionHref
              ? `<div style="margin:28px 0 24px;text-align:center;">
                  <a href="${safeActionHref}" style="display:inline-block;padding:15px 36px;border-radius:9999px;background:#fbbf24;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#3d0000;text-decoration:none;font-size:15px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;border:2px solid #fbbf24;box-shadow:0 4px 14px rgba(217,119,6,0.35);">
                    ${safeActionLabel}
                  </a>
                </div>`
              : ""
          }
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f1e2d6;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#7a5c5c;text-align:center;">${safeFooterNote || "If you did not expect this message, you can safely ignore it."}</p>
          </div>
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
    actionLabel: "Accept Invitation & Sign In",
    actionHref: link,
    footerNote: `If you did not expect this invitation, you can safely ignore this email.`,
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
    focusLogoSrc: buildAppUrl("/icons/pup-focus-emblem-logo.png"),
  });
}

export function buildTempPasswordEmailHtml({
  fullName,
  firstName,
  email = "preview@pupfocus.dev",
  tempPassword,
  signInHref,
}: {
  fullName?: string;
  firstName?: string;
  email?: string;
  tempPassword: string;
  signInHref?: string;
}) {
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "there";
  const safeFirstName = escapeHtml(resolvedFirstName);
  const safeTempPassword = escapeHtml(tempPassword);
  const safeEmail = escapeHtml(email || "preview@pupfocus.dev");

  const credentialsHtml = `
    <table role="presentation" width="100%" style="margin:20px 0;background:#fffdf7;border:2px solid #f59e0b;border-radius:12px;border-collapse:separate;overflow:hidden;box-shadow:0 2px 8px rgba(245,158,11,0.12);">
      <tr>
        <td style="padding:12px 18px;background:linear-gradient(135deg,#780000 0%,#4d0000 100%);color:#fff8e7;border-bottom:2px solid #f59e0b;">
          <span style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#ffd700;">
            🔑 Temporary Credentials
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;width:150px;font-size:13px;font-weight:700;color:#6b4b4b;vertical-align:middle;">
                Institutional Email:
              </td>
              <td style="padding:8px 0;font-size:14px;font-family:monospace;font-weight:700;color:#1e293b;user-select:all;vertical-align:middle;">
                <span style="background:#f8fafc;padding:5px 10px;border-radius:6px;border:1px solid #e2e8f0;display:inline-block;">
                  ${safeEmail}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;font-weight:700;color:#6b4b4b;vertical-align:middle;">
                Temporary Password:
              </td>
              <td style="padding:8px 0;font-size:15px;font-family:monospace;font-weight:800;color:#780000;user-select:all;vertical-align:middle;">
                <span style="background:#fef3c7;padding:5px 12px;border-radius:6px;border:1.5px dashed #f59e0b;display:inline-block;">
                  ${safeTempPassword}
                </span>
              </td>
            </tr>
          </table>
          <p style="margin:14px 0 0 0;font-size:12px;color:#854d0e;line-height:1.5;">
            💡 <strong>Note:</strong> You can highlight and copy your credentials above. For your security, you will be required to change your temporary password immediately upon your first sign-in.
          </p>
        </td>
      </tr>
    </table>
  `;

  return buildEmailLayout({
    title: "Temporary Credentials",
    intro: `Hello ${safeFirstName}, your account is ready.`,
    body: `Use the temporary credentials below to sign in to PUP FOCUS. After you sign in, please change your password immediately for security.`,
    contentHtml: credentialsHtml,
    actionLabel: "Sign in to PUP FOCUS",
    actionHref: signInHref || buildAppUrl("/auth/sign-in"),
    footerNote: `Temporary Password: ${safeTempPassword} • Account: ${safeEmail}`,
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
    focusLogoSrc: buildAppUrl("/icons/pup-focus-emblem-logo.png"),
  });
}

export function buildForgotPasswordEmailHtml({
  fullName,
  firstName,
  email,
  resetLink,
}: {
  fullName?: string;
  firstName?: string;
  email?: string;
  resetLink: string;
}) {
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "there";
  const safeFirstName = escapeHtml(resolvedFirstName);
  const safeEmail = email ? escapeHtml(email) : "";

  return buildEmailLayout({
    title: "Reset Your Password",
    intro: `Hello ${safeFirstName}, we received a request to reset your PUP FOCUS password.`,
    body: `A password reset was requested for your institutional account${safeEmail ? ` (${safeEmail})` : ""}. Click the button below to securely set a new password. This link is valid for 1 hour.`,
    actionLabel: "Reset Password",
    actionHref: resetLink,
    footerNote: `If you did not request a password reset, you can safely ignore this email. Your current password will remain active.`,
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
    focusLogoSrc: buildAppUrl("/icons/pup-focus-emblem-logo.png"),
  });
}

export function buildSubmissionWindowNotificationEmailHtml({
  fullName,
  firstName,
  startDate,
  endDate,
  startTimeLabel,
  endTimeLabel,
  actionHref,
}: {
  fullName: string;
  firstName?: string;
  startDate: string;
  endDate: string;
  startTimeLabel: string;
  endTimeLabel: string;
  actionHref: string;
}) {
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "there";
  const safeFirstName = escapeHtml(resolvedFirstName);

  const isAlwaysOpen =
    endDate.startsWith("2099") ||
    endDate.toLowerCase().includes("indefinite") ||
    endDate.toLowerCase().includes("always open");

  const bodyText = isAlwaysOpen
    ? `The submission window is now open starting ${escapeHtml(startDate)} ${escapeHtml(startTimeLabel)} with no closing deadline (Always Open). You can submit your requirements at any time.`
    : `The submission window is now open from ${escapeHtml(startDate)} ${escapeHtml(startTimeLabel)} to ${escapeHtml(endDate)} ${escapeHtml(endTimeLabel)}. Please submit any pending requirements through your dashboard before the deadline.`;

  return buildEmailLayout({
    title: "Submission Window Opened",
    intro: `Hello ${safeFirstName}, the faculty submission window has been scheduled.`,
    body: bodyText,
    actionLabel: "Open Faculty Dashboard",
    actionHref,
    footerNote:
      "If you have already submitted all requirements, thank you. Otherwise, please complete your outstanding submissions at your earliest convenience.",
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
    focusLogoSrc: buildAppUrl("/icons/pup-focus-emblem-logo.png"),
  });
}

