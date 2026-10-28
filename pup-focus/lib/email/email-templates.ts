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
  const safeFocusLogoSrc = focusLogoSrc ? escapeHtml(focusLogoSrc.replace(/&amp;/g, "&")) : "";
  const hasDistinctFocusLogo = Boolean(safeFocusLogoSrc && safeFocusLogoSrc !== safePupLogoSrc);

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
          <!-- Logo: PUP Seal -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px auto;">
            <tr>
              <td style="vertical-align:middle;text-align:center;${hasDistinctFocusLogo ? "padding-right:12px;" : ""}">
                <img src="${safePupLogoSrc}" alt="PUP Seal" width="56" height="56" style="display:block;margin:0 auto;border-radius:50%;background:#ffffff;padding:2px;box-shadow:0 4px 10px rgba(0,0,0,0.35);" />
              </td>
              ${
                hasDistinctFocusLogo
                  ? `<td style="vertical-align:middle;padding:0 4px;color:#fbbf24;font-size:20px;font-weight:700;line-height:1;">
                •
              </td>
              <td style="vertical-align:middle;padding-left:12px;">
                <img src="${safeFocusLogoSrc}" alt="PUP FOCUS" width="56" height="56" style="display:block;margin:0 auto;border-radius:50%;background:#ffffff;padding:2px;box-shadow:0 4px 10px rgba(0,0,0,0.35);" />
              </td>`
                  : ""
              }
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
  const rawEmail = email || "preview@pupfocus.dev";
  const safeEmail = escapeHtml(rawEmail);
  const safeTempPassword = escapeHtml(tempPassword);
  const baseSignInUrl = signInHref || buildAppUrl("/auth/sign-in");
  const directSignInHref = `${baseSignInUrl}${baseSignInUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(rawEmail)}&temp=${encodeURIComponent(tempPassword)}`;
  const emailCopyHref = `${directSignInHref}&copy=email`;
  const passCopyHref = `${directSignInHref}&copy=password`;
  const bothCopyHref = `${directSignInHref}&copy=both`;

  const credentialsHtml = `
    <table role="presentation" width="100%" style="margin:20px 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:12px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#334155;">
            Temporary Credentials
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 18px 16px 18px;background:#ffffff;">
          
          <!-- Institutional Email Row -->
          <table role="presentation" width="100%" style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;border-collapse:separate;">
            <tr>
              <td style="padding:10px 14px;">
                <table role="presentation" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:3px;">
                        Institutional Email
                      </div>
                      <div style="font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:600;color:#0f172a;word-break:break-all;-webkit-user-select:text;-moz-user-select:text;user-select:text;cursor:text;">
                        ${safeEmail}
                      </div>
                    </td>
                    <td style="width:105px;text-align:right;vertical-align:middle;padding-left:10px;">
                      <a href="${emailCopyHref}" target="_blank" id="copy-email-btn" onclick="if(navigator.clipboard){navigator.clipboard.writeText('${safeEmail}');var b=this;b.innerHTML='Copied!';setTimeout(function(){b.innerHTML='Copy Email'},2000);return false;}" style="display:inline-block;padding:6px 12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;color:#334155;cursor:pointer;white-space:nowrap;text-decoration:none;">
                        Copy Email
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Temporary Password Row -->
          <table role="presentation" width="100%" style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;border-collapse:separate;">
            <tr>
              <td style="padding:10px 14px;">
                <table role="presentation" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:3px;">
                        Temporary Password
                      </div>
                      <div style="font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:600;color:#0f172a;word-break:break-all;-webkit-user-select:text;-moz-user-select:text;user-select:text;cursor:text;">
                        ${safeTempPassword}
                      </div>
                    </td>
                    <td style="width:125px;text-align:right;vertical-align:middle;padding-left:10px;">
                      <a href="${passCopyHref}" target="_blank" id="copy-pass-btn" onclick="if(navigator.clipboard){navigator.clipboard.writeText('${safeTempPassword}');var b=this;b.innerHTML='Copied!';setTimeout(function(){b.innerHTML='Copy Password'},2000);return false;}" style="display:inline-block;padding:6px 12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;color:#334155;cursor:pointer;white-space:nowrap;text-decoration:none;">
                        Copy Password
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:6px 0 0 0;font-size:11.5px;color:#64748b;line-height:1.5;text-align:center;">
            Your credentials will be autofilled directly upon opening — no need to copy and paste one by one.
          </p>
        </td>
      </tr>
    </table>
  `;

  return buildEmailLayout({
    title: "Temporary Credentials",
    intro: `Hello ${safeFirstName}, your account is ready.`,
    body: `Your credentials are ready. Use the button below to open and sign in to PUP FOCUS with your email and password autofilled directly (no need to copy and paste one by one). After you sign in, please change your password immediately for security.`,
    contentHtml: credentialsHtml,
    actionLabel: "Credentials Ready — Sign in to PUP FOCUS Directly",
    actionHref: directSignInHref,
    footerNote: `Temporary Password: ${safeTempPassword} • Account: ${safeEmail}`,
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
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
  });
}

export function buildAdminPasswordResetEmailHtml({
  fullName,
  firstName,
  email,
  accountRoleLabel = "Account",
  resetLink,
}: {
  fullName?: string;
  firstName?: string;
  email?: string;
  accountRoleLabel?: string;
  resetLink: string;
}) {
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "there";
  const safeFirstName = escapeHtml(resolvedFirstName);
  const safeEmail = email ? escapeHtml(email) : "";
  const safeRoleLabel = escapeHtml(accountRoleLabel);

  const detailsHtml = `
    <table role="presentation" width="100%" style="margin:18px 0;background:#fffdf7;border:1.5px solid #f59e0b;border-radius:12px;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:14px 18px;">
          <div style="font-size:12px;color:#6b4b4b;margin-bottom:4px;">
            <strong>Account Type:</strong> <span style="color:#1e293b;font-weight:700;">${safeRoleLabel}</span>
          </div>
          ${
            safeEmail
              ? `<div style="font-size:13px;color:#2f1a1a;">
                  <strong>Account Email:</strong> <span style="font-family:monospace;font-weight:700;color:#780000;">${safeEmail}</span>
                </div>`
              : ""
          }
          <p style="margin:10px 0 0 0;font-size:12px;color:#854d0e;line-height:1.5;">
            Click the <strong>Reset Password</strong> button below to choose a new password and regain access to your account.
          </p>
        </td>
      </tr>
    </table>
  `;

  return buildEmailLayout({
    title: "Administrator Password Reset",
    intro: `Hello ${safeFirstName}, an administrator has sent you a password reset link.`,
    body: `A campus administrator initiated a password reset for your PUP FOCUS ${safeRoleLabel.toLowerCase()} account${safeEmail ? ` (${safeEmail})` : ""}. Click the button below to securely create your new password.`,
    contentHtml: detailsHtml,
    actionLabel: "Reset Password",
    actionHref: resetLink,
    footerNote: `This password reset link is valid for 1 hour. If you did not expect this reset, please contact your PUP Bataan campus administrator.`,
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
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
  });
}

export function buildEmailChangeVerificationHtml({
  fullName,
  firstName,
  newEmail,
  previousEmail,
  link,
}: {
  fullName?: string;
  firstName?: string;
  newEmail: string;
  previousEmail?: string;
  link: string;
}) {
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "there";
  const safeFirstName = escapeHtml(resolvedFirstName);
  const safeNewEmail = escapeHtml(newEmail);
  const safePreviousEmail = previousEmail ? escapeHtml(previousEmail) : "";

  const detailsHtml = `
    <table role="presentation" width="100%" style="margin:18px 0;background:#fffdf7;border:1.5px solid #f59e0b;border-radius:12px;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:14px 18px;">
          ${
            safePreviousEmail
              ? `<div style="font-size:12px;color:#6b4b4b;margin-bottom:6px;">
                  <strong>Previous Email:</strong> <span style="font-family:monospace;color:#475569;">${safePreviousEmail}</span>
                </div>`
              : ""
          }
          <div style="font-size:13px;color:#2f1a1a;">
            <strong>New Account Email:</strong> <span style="font-family:monospace;font-weight:700;color:#780000;">${safeNewEmail}</span>
          </div>
          <p style="margin:10px 0 0 0;font-size:12px;color:#854d0e;line-height:1.5;">
            All of your existing account content, compliance records, and uploaded submissions remain completely intact.
          </p>
        </td>
      </tr>
    </table>
  `;

  return buildEmailLayout({
    title: "Verify Your Updated Email",
    intro: `Hello ${safeFirstName}, your PUP FOCUS account email has been changed.`,
    body: `An institutional administrator updated the email address linked to your faculty account. Click the button below to verify your new email address and receive a fresh temporary password to sign back in.`,
    contentHtml: detailsHtml,
    actionLabel: "Verify New Email & Restore Access",
    actionHref: link,
    footerNote:
      "If you did not request this email change, please contact your PUP Bataan campus administrator immediately.",
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
  });
}

export function buildEmailChangeTempPasswordHtml({
  fullName,
  firstName,
  email,
  tempPassword,
  signInHref,
}: {
  fullName?: string;
  firstName?: string;
  email: string;
  tempPassword: string;
  signInHref?: string;
}) {
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "there";
  const safeFirstName = escapeHtml(resolvedFirstName);
  const safeTempPassword = escapeHtml(tempPassword);
  const safeEmail = escapeHtml(email);
  const baseSignInUrl = signInHref || buildAppUrl("/auth/sign-in");
  const directSignInHref = `${baseSignInUrl}${baseSignInUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}&temp=${encodeURIComponent(tempPassword)}`;
  const emailCopyHref = `${directSignInHref}&copy=email`;
  const passCopyHref = `${directSignInHref}&copy=password`;
  const bothCopyHref = `${directSignInHref}&copy=both`;

  const credentialsHtml = `
    <table role="presentation" width="100%" style="margin:20px 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:12px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#334155;">
            Updated Account Credentials
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 18px 16px 18px;background:#ffffff;">
          
          <!-- Verified Email Row -->
          <table role="presentation" width="100%" style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;border-collapse:separate;">
            <tr>
              <td style="padding:10px 14px;">
                <table role="presentation" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:3px;">
                        Verified Email
                      </div>
                      <div style="font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:600;color:#0f172a;word-break:break-all;-webkit-user-select:text;-moz-user-select:text;user-select:text;cursor:text;">
                        ${safeEmail}
                      </div>
                    </td>
                    <td style="width:105px;text-align:right;vertical-align:middle;padding-left:10px;">
                      <a href="${emailCopyHref}" target="_blank" id="copy-update-email-btn" onclick="if(navigator.clipboard){navigator.clipboard.writeText('${safeEmail}');var b=this;b.innerHTML='Copied!';setTimeout(function(){b.innerHTML='Copy Email'},2000);return false;}" style="display:inline-block;padding:6px 12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;color:#334155;cursor:pointer;white-space:nowrap;text-decoration:none;">
                        Copy Email
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Temporary Password Row -->
          <table role="presentation" width="100%" style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;border-collapse:separate;">
            <tr>
              <td style="padding:10px 14px;">
                <table role="presentation" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:3px;">
                        Temporary Password
                      </div>
                      <div style="font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:600;color:#0f172a;word-break:break-all;-webkit-user-select:text;-moz-user-select:text;user-select:text;cursor:text;">
                        ${safeTempPassword}
                      </div>
                    </td>
                    <td style="width:125px;text-align:right;vertical-align:middle;padding-left:10px;">
                      <a href="${passCopyHref}" target="_blank" id="copy-update-pass-btn" onclick="if(navigator.clipboard){navigator.clipboard.writeText('${safeTempPassword}');var b=this;b.innerHTML='Copied!';setTimeout(function(){b.innerHTML='Copy Password'},2000);return false;}" style="display:inline-block;padding:6px 12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;color:#334155;cursor:pointer;white-space:nowrap;text-decoration:none;">
                        Copy Password
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:6px 0 0 0;font-size:11.5px;color:#64748b;line-height:1.5;text-align:center;">
            Your credentials will be autofilled directly upon opening — no need to copy and paste one by one.
          </p>
        </td>
      </tr>
    </table>
  `;

  return buildEmailLayout({
    title: "New Email Verified",
    intro: `Hello ${safeFirstName}, your updated email address is now verified.`,
    body: `Your existing PUP FOCUS account is ready to use with your new email address. Click the button below to sign in directly with your email and password automatically filled in (no need to copy and paste one by one).`,
    contentHtml: credentialsHtml,
    actionLabel: "Credentials Ready — Sign in to PUP FOCUS Directly",
    actionHref: directSignInHref,
    footerNote: `Temporary Password: ${safeTempPassword} • Verified Email: ${safeEmail}`,
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
  });
}

export function buildDeadlineReminderEmailHtml({
  fullName,
  firstName,
  endDate,
  endTimeLabel,
  academicYear,
  semester,
  actionHref,
  daysRemaining = 3,
}: {
  fullName: string;
  firstName?: string;
  endDate: string;
  endTimeLabel: string;
  academicYear?: string;
  semester?: string;
  actionHref: string;
  daysRemaining?: number;
}) {
  const resolvedFirstName =
    firstName?.trim() ||
    fullName?.trim().split(/\s+/)[0] ||
    "Faculty Member";
  const safeFirstName = escapeHtml(resolvedFirstName);

  const termText = academicYear && semester ? `for ${escapeHtml(academicYear)} (${escapeHtml(semester)})` : "";
  const remainingLabel = daysRemaining === 1 ? "1 day" : `${daysRemaining} days`;

  const deadlineCardHtml = `
    <table role="presentation" width="100%" style="border-collapse:collapse;margin:20px 0 16px 0;background:#fffbeb;border:1.5px solid #f59e0b;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:12px 18px;background:linear-gradient(135deg,#780000 0%,#4d0000 100%);color:#fff8e7;border-bottom:2px solid #f59e0b;">
          <span style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#ffd700;">
            ⏰ Upcoming Deadline: ${remainingLabel.toUpperCase()} REMAINING
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;width:140px;font-size:13px;font-weight:700;color:#6b4b4b;vertical-align:middle;">
                Closing Date:
              </td>
              <td style="padding:6px 0;font-size:14px;font-weight:700;color:#1e293b;vertical-align:middle;">
                ${escapeHtml(endDate)}
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;font-weight:700;color:#6b4b4b;vertical-align:middle;">
                Closing Time:
              </td>
              <td style="padding:6px 0;font-size:14px;font-weight:700;color:#780000;vertical-align:middle;">
                ${escapeHtml(endTimeLabel)}
              </td>
            </tr>
            ${
              academicYear && semester
                ? `<tr>
              <td style="padding:6px 0;font-size:13px;font-weight:700;color:#6b4b4b;vertical-align:middle;">
                Academic Term:
              </td>
              <td style="padding:6px 0;font-size:14px;font-weight:600;color:#334155;vertical-align:middle;">
                A.Y. ${escapeHtml(academicYear)} • ${escapeHtml(semester)}
              </td>
            </tr>`
                : ""
            }
          </table>
          <p style="margin:14px 0 0 0;font-size:12px;color:#854d0e;line-height:1.5;">
            ⚠️ <strong>Important:</strong> Uploads will lock automatically when the timer reaches zero. Documents requiring revisions or late submissions will require an administrator-approved extension request.
          </p>
        </td>
      </tr>
    </table>
  `;

  return buildEmailLayout({
    title: `Submission Deadline Reminder (${remainingLabel} Remaining)`,
    intro: `Hello ${safeFirstName}, this is an important reminder regarding your required document submissions.`,
    body: `The faculty submission window ${termText} is scheduled to close in ${remainingLabel}. Please review your assigned subject loads and upload all pending compliance documents before the portal closes.`,
    contentHtml: deadlineCardHtml,
    actionLabel: "Open Faculty Portal & Submit",
    actionHref,
    footerNote:
      "If you have already submitted and completed all required compliance documents for this term, thank you. You may disregard this reminder.",
    pupLogoSrc: buildAppUrl("/icons/pup-seal.png"),
  });
}


