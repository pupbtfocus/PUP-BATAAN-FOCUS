import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

function loadEnv(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch (err) {
    return {};
  }
}

const env = loadEnv(path.join(repoRoot, ".env.local"));
const SUPABASE_URL =
  env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fix() {
  console.log("=== FIXING FACULTY USER_ROLES ===\n");

  // 1. Get the faculty role ID
  const { data: facultyRole, error: roleErr } = await supabase
    .from("roles")
    .select("id")
    .eq("code", "faculty")
    .maybeSingle();

  if (roleErr || !facultyRole) {
    console.error("Cannot find faculty role:", roleErr?.message);
    process.exit(1);
  }
  console.log(`Faculty role ID: ${facultyRole.id}`);

  // 2. Find all profiles
  const { data: facultyProfiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, user_id, full_name");

  if (pErr) {
    console.error("Cannot query profiles:", pErr.message);
    process.exit(1);
  }

  if (!facultyProfiles || facultyProfiles.length === 0) {
    console.log("No profiles found. Nothing to fix.");
    return;
  }

  console.log(`Found ${facultyProfiles.length} profile(s)\n`);

  // 3. For each faculty profile, ensure a user_roles entry with the correct faculty role exists
  let fixed = 0;
  let skipped = 0;

  for (const prof of facultyProfiles) {
    if (!prof.id) {
      console.log(`  SKIP: ${prof.email} has no id`);
      skipped++;
      continue;
    }

    // Check if correct faculty user_role already exists
    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("profile_id", prof.id)
      .eq("role_id", facultyRole.id)
      .maybeSingle();

    if (existing) {
      console.log(`  OK: ${prof.email} already has correct faculty user_role`);
      skipped++;
      continue;
    }

    // Also fix any incorrect user_roles pointing to wrong role
    // (e.g., profile has admin role_id instead of faculty role_id)
    const { data: wrongRoles } = await supabase
      .from("user_roles")
      .select("id, role_id")
      .eq("profile_id", au.profile_id);

    if (wrongRoles && wrongRoles.length > 0) {
      // Check if any of these are non-faculty roles that should be faculty
      for (const wr of wrongRoles) {
        if (wr.role_id !== facultyRole.id) {
          console.log(`  ⚠️  ${au.email} has user_role with wrong role_id=${wr.role_id}, will add correct faculty role`);
        }
      }
    }

    // Insert the correct faculty user_role
    const { error: insertErr } = await supabase
      .from("user_roles")
      .upsert(
        {
          profile_id: au.profile_id,
          role_id: facultyRole.id,
        },
        { onConflict: "profile_id,role_id" }
      );

    if (insertErr) {
      console.log(`  ERROR: ${au.email} - ${insertErr.message}`);
    } else {
      console.log(`  ✅ FIXED: ${au.email} - added faculty user_role`);
      fixed++;
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, Skipped: ${skipped}`);

  // 4. Verify
  console.log("\n--- Verification ---");
  const { data: verifyRoles } = await supabase
    .from("user_roles")
    .select("profile_id, role_id")
    .eq("role_id", facultyRole.id);

  console.log(`user_roles with faculty role: ${verifyRoles?.length ?? 0}`);
  for (const vr of verifyRoles ?? []) {
    console.log(`  profile_id=${vr.profile_id}`);
  }
}

await fix();
