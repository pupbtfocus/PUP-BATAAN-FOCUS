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

const PROGRAMS_POOL = [
  { code: "BSIT", name: "Bachelor of Science in Information Technology" },
  { code: "BSBA", name: "BS Business Administration" },
  { code: "BEED", name: "Bachelor of Elementary Education" },
  { code: "BSA", name: "Bachelor of Science in Accountancy" },
  { code: "BSMA", name: "Bachelor of Science in Management Accounting" },
  { code: "BSIE", name: "Bachelor of Science in Industrial Engineering" },
  { code: "BSBAHRM", name: "Bachelor of Science in Business Administration major in Human Resource Management" },
  { code: "BSEnt", name: "Bachelor of Science in Entrepreneurship" },
  { code: "DIT", name: "Diploma in Information Technology" },
  { code: "DOMT-LOM", name: "Diploma in Office Management Technology major in Legal Office Management" },
];

function generateQaAccounts() {
  const accounts = [
    {
      email: "qa.faculty1@pupfocus.dev",
      password: "PupFocusQA2026!",
      fullName: "QA Faculty One",
      firstName: "QA",
      middleName: "Faculty",
      lastName: "One",
      programCode: "BSIT",
      programName: "Bachelor of Science in Information Technology",
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

  // Accounts 3 to 50 (48 additional test faculty accounts)
  for (let i = 3; i <= 50; i++) {
    const prog = PROGRAMS_POOL[(i - 1) % PROGRAMS_POOL.length];
    accounts.push({
      email: `qa.faculty${i}@pupfocus.dev`,
      password: "PupFocusQA2026!",
      fullName: `QA Faculty ${i}`,
      firstName: "QA",
      middleName: "Faculty",
      lastName: `${i}`,
      programCode: prog.code,
      programName: prog.name,
      academicYear: "2026-2027",
      term: "1st Sem",
    });
  }

  return accounts;
}

const QA_ACCOUNTS = generateQaAccounts();

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

  console.log(`=== Provisioning ${QA_ACCOUNTS.length} QA Faculty Accounts (2 Existing + 48 New) ===`);

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

  // 2. Pre-fetch existing auth users to avoid repeated API calls
  console.log("Fetching existing auth users list...");
  const userMap = new Map();
  let page = 1;
  while (true) {
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (listErr) {
      console.error("Error listing users:", listErr);
      process.exit(1);
    }
    for (const u of listData.users) {
      if (u.email) userMap.set(u.email.toLowerCase(), u);
    }
    if (listData.users.length < 1000) break;
    page++;
  }
  console.log(`Loaded ${userMap.size} existing auth users.`);

  // 3. Cache programs
  const programMap = new Map();
  const { data: existingPrograms } = await supabase.from("programs").select("id, code, name");
  if (existingPrograms) {
    for (const p of existingPrograms) {
      programMap.set(p.code.toUpperCase(), p);
    }
  }

  async function resolveProgram(code, name) {
    if (programMap.has(code.toUpperCase())) {
      return programMap.get(code.toUpperCase());
    }
    const { data: createdProg } = await supabase
      .from("programs")
      .insert({ code, name })
      .select("id, code, name")
      .single();
    if (createdProg) {
      programMap.set(code.toUpperCase(), createdProg);
      return createdProg;
    }
    return null;
  }

  // 4. Process accounts in chunks of 5 for optimal performance
  const CHUNK_SIZE = 5;
  for (let i = 0; i < QA_ACCOUNTS.length; i += CHUNK_SIZE) {
    const chunk = QA_ACCOUNTS.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (acc) => {
        const normalizedEmail = acc.email.toLowerCase();
        const program = await resolveProgram(acc.programCode, acc.programName);
        const programId = program?.id ?? null;

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

        let userId;
        const existingUser = userMap.get(normalizedEmail);

        if (existingUser) {
          userId = existingUser.id;
          await supabase.auth.admin.updateUserById(userId, {
            password: acc.password,
            email_confirm: true,
            user_metadata: userMetadata,
            app_metadata: { role: "faculty" },
          });
        } else {
          const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
            email: acc.email,
            password: acc.password,
            email_confirm: true,
            user_metadata: userMetadata,
            app_metadata: { role: "faculty" },
          });
          if (createErr || !createData.user) {
            console.error(`Error creating user ${acc.email}:`, createErr?.message);
            return;
          }
          userId = createData.user.id;
          userMap.set(normalizedEmail, createData.user);
        }

        // Upsert profile
        const { data: profile } = await supabase
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

        const profileId = profile?.id ?? userId;

        // Upsert user_roles
        if (facultyRole?.id && profileId) {
          await supabase
            .from("user_roles")
            .upsert(
              { profile_id: profileId, role_id: facultyRole.id },
              { onConflict: "profile_id,role_id" }
            );
        }

        // Upsert faculty_program_assignments
        if (programId && profileId) {
          await supabase.from("faculty_program_assignments").upsert(
            {
              faculty_profile_id: profileId,
              program_id: programId,
              academic_year: acc.academicYear,
              term: acc.term,
            },
            { onConflict: "faculty_profile_id,program_id,academic_year,term" }
          );

          await supabase.from("faculty_program_assignments").upsert(
            {
              faculty_profile_id: profileId,
              program_id: programId,
              academic_year: acc.academicYear,
              term: "1st Semester",
            },
            { onConflict: "faculty_profile_id,program_id,academic_year,term" }
          );
        }

        console.log(`✓ Provisioned: ${acc.fullName} (${acc.email}) -> ${acc.programCode}`);
      })
    );
  }

  console.log("\n=========================================");
  console.log(`✓ Successfully configured ${QA_ACCOUNTS.length} QA Faculty Accounts!`);
  console.log("Credentials Pattern:");
  console.log("- Emails:    qa.faculty1@pupfocus.dev ... qa.faculty50@pupfocus.dev");
  console.log("  Password:  PupFocusQA2026!");
  console.log("=========================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
