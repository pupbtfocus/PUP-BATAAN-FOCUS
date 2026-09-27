import fs from "fs";
import { createClient } from "@supabase/supabase-js";

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

const env = loadEnv(".env.local");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function syncFacultyUserRoles() {
  console.log("=== SYNCING FACULTY USER ROLES ===");

  // 1. Get faculty role
  const { data: facultyRole, error: roleErr } = await supabase
    .from("roles")
    .select("id, code")
    .eq("code", "faculty")
    .single();

  if (roleErr || !facultyRole) {
    console.error("Faculty role not found:", roleErr);
    process.exit(1);
  }
  console.log("Faculty role id:", facultyRole.id);

  // 2. Get all auth users
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const facultyAuthUsers = (authData?.users ?? []).filter((u) => {
    const r = (u.user_metadata?.role || u.app_metadata?.role || "").toLowerCase();
    return r === "faculty";
  });
  console.log(`Found ${facultyAuthUsers.length} faculty in auth.users`);

  // 3. Get all profiles
  const { data: profiles } = await supabase.from("profiles").select("*");
  const profileByUserId = new Map();
  const profileByEmail = new Map();
  for (const p of profiles ?? []) {
    if (p.user_id) profileByUserId.set(p.user_id, p);
    if (p.email) profileByEmail.set(p.email.toLowerCase(), p);
  }

  // 4. Get faculty_program_assignments
  const { data: assignments } = await supabase.from("faculty_program_assignments").select("*");
  const assignedProfileIds = new Set((assignments ?? []).map((a) => a.faculty_profile_id));
  console.log(`Found ${assignedProfileIds.size} faculty profile IDs in assignments`);

  // Collect all profile IDs that belong to faculty
  const facultyProfileIds = new Set();

  for (const u of facultyAuthUsers) {
    let prof = profileByUserId.get(u.id) || profileByEmail.get(u.email?.toLowerCase());
    if (!prof) {
      console.log(`Creating missing profile for ${u.email}...`);
      const { data: newProf, error: pErr } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: u.id,
            email: u.email,
            full_name: u.user_metadata?.full_name || u.email,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (!pErr && newProf) {
        prof = newProf;
      }
    }
    if (prof?.id) {
      facultyProfileIds.add(prof.id);
    }
  }

  for (const profId of assignedProfileIds) {
    if (profId) facultyProfileIds.add(profId);
  }

  console.log(`Total unique faculty profiles to ensure in user_roles: ${facultyProfileIds.size}`);

  // 5. Ensure each profile has a user_roles record with faculty role
  for (const profileId of facultyProfileIds) {
    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("profile_id", profileId)
      .eq("role_id", facultyRole.id)
      .maybeSingle();

    if (!existing) {
      console.log(`Inserting faculty user_roles for profile_id: ${profileId}`);
      const { error: insErr } = await supabase.from("user_roles").upsert(
        {
          profile_id: profileId,
          role_id: facultyRole.id,
        },
        { onConflict: "profile_id,role_id" }
      );
      if (insErr) {
        console.error(`Failed to insert user_role for ${profileId}:`, insErr.message);
      } else {
        console.log(`Successfully added faculty role for ${profileId}`);
      }
    } else {
      console.log(`Profile ${profileId} already has faculty user_roles`);
    }
  }

  // 6. Verify final count
  const { data: finalRoles } = await supabase
    .from("user_roles")
    .select("profile_id, role_id")
    .eq("role_id", facultyRole.id);

  console.log(`\nVerified faculty user_roles count in DB: ${finalRoles?.length ?? 0}`);
}

syncFacultyUserRoles();
