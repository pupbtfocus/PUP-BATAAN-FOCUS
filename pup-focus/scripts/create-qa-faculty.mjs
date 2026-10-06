import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      let v = line.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      acc[k] = v;
      return acc;
    }, {});
  return env;
}

const QA_ACCOUNTS = [
  {
    email: "qa.faculty1@pupfocus.dev",
    password: "PupFocusQA2026!",
    fullName: "QA Faculty One",
    firstName: "QA",
    middleName: "Faculty",
    lastName: "One",
    programCode: "BSIT",
    programName: "BS Information Technology",
    academicYear: "2026-2027",
    term: "1st Sem",
  },
  {
    email: "qa.faculty2@pupfocus.dev",
    password: "PupFocusQA2026!",
    fullName: "QA Faculty Two",
    firstName: "QA",
    middleName: "Faculty",
    lastName: "Two",
    programCode: "BSBA",
    programName: "BS Business Administration",
    academicYear: "2026-2027",
    term: "1st Sem",
  },
];

async function main() {
  const env = readEnv();
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("=== Provisioning QA Faculty Accounts ===");

  // 1. Ensure faculty role exists
  let { data: facultyRole } = await supabase
    .from("roles")
    .select("id, code")
    .eq("code", "faculty")
    .maybeSingle();

  if (!facultyRole) {
    const { data: newRole, error: roleErr } = await supabase
      .from("roles")
      .insert({ code: "faculty", name: "Faculty" })
      .select("id, code")
      .single();
    if (roleErr) {
      console.error("Error creating faculty role:", roleErr);
      process.exit(1);
    }
    facultyRole = newRole;
  }

  console.log(`Faculty Role ID: ${facultyRole.id}`);

  // 2. Process each account
  for (const acc of QA_ACCOUNTS) {
    console.log(`\nProcessing: ${acc.fullName} (${acc.email})...`);

    // Resolve program
    let { data: program } = await supabase
      .from("programs")
      .select("id, code, name")
      .or(`code.ilike.${acc.programCode},name.ilike.%${acc.programName}%`)
      .limit(1)
      .maybeSingle();

    if (!program) {
      const { data: createdProg, error: progErr } = await supabase
        .from("programs")
        .insert({
          code: acc.programCode,
          name: acc.programName,
        })
        .select("id, code, name")
        .single();

      if (!progErr && createdProg) {
        program = createdProg;
      }
    }

    const programId = program?.id ?? null;
    console.log(`Program: ${program?.name || acc.programName} (ID: ${programId})`);

    // Check auth user
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listErr) {
      console.error("Error listing users:", listErr);
      process.exit(1);
    }

    const existingUser = listData.users.find(
      (u) => (u.email || "").toLowerCase() === acc.email.toLowerCase()
    );

    let userId;
    const userMetadata = {
      role: "faculty",
      full_name: acc.fullName,
      first_name: acc.firstName,
      middle_name: acc.middleName,
      last_name: acc.lastName,
      program_id: programId,
      program_code: program?.code ?? acc.programCode,
      must_change_password: false,
      force_password_change: false,
    };

    if (existingUser) {
      userId = existingUser.id;
      console.log(`User exists (ID: ${userId}). Updating password & metadata...`);
      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password: acc.password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: { role: "faculty" },
      });
      if (updateErr) {
        console.error("Error updating user:", updateErr);
      }
    } else {
      console.log("Creating new user...");
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: { role: "faculty" },
      });
      if (createErr || !createData.user) {
        console.error("Error creating user:", createErr);
        continue;
      }
      userId = createData.user.id;
    }

    // Upsert profile
    const { data: profile, error: profError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          user_id: userId,
          full_name: acc.fullName,
          email: acc.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .maybeSingle();

    if (profError) {
      console.warn("Profile upsert warning:", profError.message);
    }

    const profileId = profile?.id ?? userId;

    // Upsert user_roles
    if (facultyRole?.id && profileId) {
      const { error: urError } = await supabase
        .from("user_roles")
        .upsert(
          {
            profile_id: profileId,
            role_id: facultyRole.id,
          },
          { onConflict: "profile_id,role_id" }
        );
      if (urError) {
        console.warn("user_roles upsert warning:", urError.message);
      }
    }

    // Upsert faculty_program_assignments
    if (programId && profileId) {
      const { error: fpaErr1 } = await supabase
        .from("faculty_program_assignments")
        .upsert(
          {
            faculty_profile_id: profileId,
            program_id: programId,
            academic_year: acc.academicYear,
            term: acc.term,
          },
          { onConflict: "faculty_profile_id,program_id,academic_year,term" }
        );
      if (fpaErr1) {
        console.warn("FPA upsert 1 warning:", fpaErr1.message);
      }

      const { error: fpaErr2 } = await supabase
        .from("faculty_program_assignments")
        .upsert(
          {
            faculty_profile_id: profileId,
            program_id: programId,
            academic_year: acc.academicYear,
            term: "1st Semester",
          },
          { onConflict: "faculty_profile_id,program_id,academic_year,term" }
        );
      if (fpaErr2) {
        console.warn("FPA upsert 2 warning:", fpaErr2.message);
      }
    }

    console.log(`✓ ${acc.fullName} configured successfully.`);
  }

  console.log("\n=========================================");
  console.log("QA FACULTY ACCOUNTS READY:");
  for (const acc of QA_ACCOUNTS) {
    console.log(`- Name:     ${acc.fullName}`);
    console.log(`  Email:    ${acc.email}`);
    console.log(`  Password: ${acc.password}`);
    console.log(`  Program:  ${acc.programName} (${acc.academicYear}, ${acc.term})`);
  }
  console.log("=========================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
