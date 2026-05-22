#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

async function main() {
  const args = process.argv.slice(2);
  const to = args[0];
  if (!to) {
    console.error("Usage: node scripts/send-test-invite.js <recipient-email>");
    process.exit(1);
  }

  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local not found at", envPath);
    process.exit(1);
  }

  const env = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .reduce((acc, line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return acc;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      acc[k] = v;
      return acc;
    }, {});

  // Set envs for this process
  Object.assign(process.env, env);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase URL or service role key missing in .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("Generating invite link for", to);
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: to,
    data: {
      full_name: "Test Invite",
      role: "admin",
      created_via: "super_admin_admin_panel",
      created_by_super_admin_id: "script",
    },
    options: {
      redirectTo: "http://localhost:3000/auth/confirm?next=/super-admin/admin",
    },
  });

  if (error) {
    console.error("generateLink error:", error);
    process.exit(1);
  }

  const actionLink = data?.properties?.action_link;
  const otp = data?.properties?.email_otp;
  console.log("action_link:", actionLink);
  if (!actionLink) {
    console.error("No action_link returned");
    process.exit(1);
  }

  // Send via SMTP
  const host = process.env.EMAIL_SMTP_HOST;
  const port = process.env.EMAIL_SMTP_PORT;
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;

  if (!host || !port || !user || !pass) {
    console.error("SMTP env vars missing (EMAIL_SMTP_HOST/PORT/USER/PASS)");
    console.log("Link (fallback):", actionLink);
    process.exit(0);
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });

  const subject = "PUP FOCUS — Admin invitation";
  const text = `Hello,\n\nYou have been invited to be an admin for PUP FOCUS. Click the link to accept:\n\n${actionLink}\n\nOTP: ${otp || "(none)"}\n`;
  const html = `<p>Hello,</p><p>You have been invited to be an <strong>admin</strong> for PUP FOCUS.</p><p><a href="${actionLink}">Accept invitation</a></p><p>OTP: ${otp || "(none)"}</p>`;

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log("Email sent:", info.messageId || info.response);
    console.log("Link:", actionLink);
  } catch (e) {
    console.error("Failed to send email:", e);
    console.log("Link (fallback):", actionLink);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
