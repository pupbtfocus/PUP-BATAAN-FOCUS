#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function readEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local missing");
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
  return env;
}

function generatePassword(len = 14) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const providedPassword = args[1];
  if (!email) {
    console.error(
      "Usage: node scripts/set-user-password.js <email> [password]",
    );
    process.exit(1);
  }

  const env = readEnv();
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase env vars missing in .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // find auth user
  const { data: listData, error: listErr } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.error("Failed to list users:", listErr);
    process.exit(1);
  }
  const user = listData.users.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    console.error("No auth user found with email", email);
    process.exit(1);
  }

  const password = providedPassword || generatePassword(14);

  console.log("Setting password for", email);
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
  });
  if (error) {
    console.error("Failed to set password:", error);
    process.exit(1);
  }

  console.log("Password set successfully.");
  console.log("TEMP_PASSWORD:", password);
  console.log("Advise the user to change their password after login.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
