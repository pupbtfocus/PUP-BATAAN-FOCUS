#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

async function readEnv() {
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

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const fullNameArg = args[1] || "";
  if (!email) {
    console.error(
      "Usage: node scripts/bootstrap-existing-admin.js <email> [Full Name]",
    );
    process.exit(1);
  }

  const env = await readEnv();
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase env vars missing in .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("Looking up auth users...");
  const { data: authUsersData, error: listErr } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.error("Failed to list auth users:", listErr);
    process.exit(1);
  }
  const found = authUsersData.users.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (!found) {
    console.error("No auth user found with email", email);
    process.exit(1);
  }
  const userId = found.id;
  const metadata = found.user_metadata || {};
  const fullName =
    fullNameArg || metadata.full_name || found.email || "Admin User";

  console.log("Finding admin role id...");
  const { data: roleData, error: roleErr } = await supabase
    .from("roles")
    .select("id,code")
    .eq("code", "admin")
    .maybeSingle();
  if (roleErr) {
    console.error("Failed to read roles:", roleErr);
    process.exit(1);
  }
  if (!roleData || !roleData.id) {
    console.error(
      'Admin role not found - ensure roles are seeded with code="admin"',
    );
    process.exit(1);
  }
  const adminRoleId = roleData.id;

  console.log("Upserting profile...");
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userId, full_name: fullName, email: email },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (profileErr) {
    console.error("Profile upsert failed:", profileErr);
    process.exit(1);
  }

  console.log("Upserting user_roles...");
  const { error: urErr } = await supabase
    .from("user_roles")
    .upsert(
      { profile_id: profile.id, role_id: adminRoleId },
      { onConflict: "profile_id,role_id" },
    );
  if (urErr) {
    console.error("user_roles upsert failed:", urErr);
    process.exit(1);
  }

  console.log("Upserting app_users...");
  const inviteMetadata = {
    is_active: true,
    created_via: "super_admin_admin_panel",
    invite_accepted_at: new Date().toISOString(),
  };
  const { error: appUsersErr } = await supabase.from("app_users").upsert(
    {
      auth_user_id: userId,
      profile_id: profile.id,
      email: email,
      full_name: fullName,
      role: "admin",
      metadata: inviteMetadata,
    },
    { onConflict: "email" },
  );
  if (appUsersErr) {
    console.error("app_users upsert failed:", appUsersErr);
    process.exit(1);
  }

  console.log("Upserting admins table...");
  const { error: adminsErr } = await supabase
    .from("admins")
    .upsert(
      {
        profile_id: profile.id,
        full_name: fullName,
        email: email,
        is_active: true,
      },
      { onConflict: "email" },
    );
  if (adminsErr) {
    console.error("admins upsert failed:", adminsErr);
    process.exit(1);
  }

  console.log("Bootstrap completed for", email);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
