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

async function diagnose() {
  console.log("=== DIAGNOSING FACULTY VISIBILITY ===\n");

  // 1. Check roles table
  console.log("--- 1. Roles table ---");
  const { data: roles, error: rolesErr } = await supabase
    .from("roles")
    .select("*");
  if (rolesErr) {
    console.log("ERROR reading roles:", rolesErr.message);
  } else {
    console.log("Roles:", JSON.stringify(roles, null, 2));
  }

  // 2. Check user_roles table
  console.log("\n--- 2. User roles table ---");
  const { data: userRoles, error: urErr } = await supabase
    .from("user_roles")
    .select("*")
    .limit(50);
  if (urErr) {
    console.log("ERROR reading user_roles:", urErr.message);
  } else {
    console.log(`user_roles count: ${userRoles?.length ?? 0}`);
    console.log("user_roles:", JSON.stringify(userRoles, null, 2));
  }



  // 4. Check profiles table
  console.log("\n--- 4. Profiles table ---");
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, email")
    .limit(50);
  if (profErr) {
    console.log("ERROR reading profiles:", profErr.message);
  } else {
    console.log(`profiles count: ${profiles?.length ?? 0}`);
    for (const p of profiles ?? []) {
      console.log(`  - ${p.email} | full_name=${p.full_name} | id=${p.id} | user_id=${p.user_id}`);
    }
  }

  // 5. Check auth users
  console.log("\n--- 5. Auth users ---");
  const { data: authData, error: authErr } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (authErr) {
    console.log("ERROR listing auth users:", authErr.message);
  } else {
    console.log(`auth users count: ${authData?.users?.length ?? 0}`);
    for (const u of authData?.users ?? []) {
      const meta = u.user_metadata ?? {};
      console.log(
        `  - ${u.email} | role=${meta.role ?? "none"} | id=${u.id} | confirmed=${u.email_confirmed_at ? "yes" : "no"}`
      );
    }
  }

  // 6. Check faculty_program_assignments
  console.log("\n--- 6. Faculty program assignments ---");
  const { data: fpa, error: fpaErr } = await supabase
    .from("faculty_program_assignments")
    .select("*")
    .limit(50);
  if (fpaErr) {
    console.log("ERROR reading faculty_program_assignments:", fpaErr.message);
  } else {
    console.log(`faculty_program_assignments count: ${fpa?.length ?? 0}`);
    console.log(JSON.stringify(fpa, null, 2));
  }

  // 7. Summary: find mismatches
  console.log("\n--- 7. ANALYSIS ---");
  
  const facultyRole = (roles ?? []).find(r => r.code === "faculty");
  if (!facultyRole) {
    console.log("⚠️  CRITICAL: No 'faculty' role found in the roles table! The faculty list API will always return empty.");
    console.log("   Fix: Insert a row into the 'roles' table with code='faculty'");
  } else {
    console.log(`✅ Faculty role found: id=${facultyRole.id}`);
    
    const facultyUserRoles = (userRoles ?? []).filter(ur => ur.role_id === facultyRole.id);
    console.log(`   user_roles with faculty role: ${facultyUserRoles.length}`);
    
    if (facultyUserRoles.length === 0) {
      console.log("⚠️  No user_roles entries for the faculty role. Faculty list will be empty.");
    }
  }


  
  const facultyAuthUsers = (authData?.users ?? []).filter(u => u.user_metadata?.role === "faculty");
  console.log(`   auth users with role=faculty: ${facultyAuthUsers.length}`);

  // Check for faculty auth users missing from user_roles
  if (facultyRole && facultyAuthUsers.length > 0) {
    const profileIdSet = new Set((userRoles ?? []).filter(ur => ur.role_id === facultyRole.id).map(ur => ur.profile_id));
    const missingFromUserRoles = [];
    
    for (const authUser of facultyAuthUsers) {
      const profile = (profiles ?? []).find(p => p.user_id === authUser.id);
      if (profile && !profileIdSet.has(profile.id)) {
        missingFromUserRoles.push({ email: authUser.email, profileId: profile.id, authUserId: authUser.id });
      }
    }
    
    if (missingFromUserRoles.length > 0) {
      console.log(`\n⚠️  ${missingFromUserRoles.length} faculty auth users have profiles but NO user_roles entry:`);
      for (const m of missingFromUserRoles) {
        console.log(`   - ${m.email} (profileId=${m.profileId})`);
      }
    }
  }
}

await diagnose();
