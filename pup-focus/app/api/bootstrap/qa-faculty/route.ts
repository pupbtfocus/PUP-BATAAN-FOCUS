import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

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

function generateQaFacultyAccounts() {
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

const QA_FACULTY_ACCOUNTS = generateQaFacultyAccounts();

async function bootstrapQaFaculty() {
  const supabase = getServiceRoleClient();

  // 1. Ensure 'faculty' role exists in public.roles
  let { data: facultyRole } = await supabase
    .from("roles")
    .select("id, code")
    .eq("code", ROLE.FACULTY)
    .maybeSingle();

  if (!facultyRole) {
    const { data: newRole, error: roleInsertErr } = await supabase
      .from("roles")
      .insert({ code: ROLE.FACULTY, name: "Faculty" })
      .select("id, code")
      .single();

    if (roleInsertErr) {
      throw new Error(`Failed to resolve or create faculty role: ${roleInsertErr.message}`);
    }
    facultyRole = newRole;
  }

  // 2. Fetch existing auth users list
  const userMap = new Map();
  let page = 1;
  while (true) {
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (listErr) {
      throw new Error(`Failed to list auth users: ${listErr.message}`);
    }
    for (const u of listData.users) {
      if (u.email) userMap.set(u.email.toLowerCase(), u);
    }
    if (listData.users.length < 1000) break;
    page++;
  }

  // 3. Cache programs
  const programMap = new Map();
  const { data: existingPrograms } = await supabase.from("programs").select("id, code, name");
  if (existingPrograms) {
    for (const p of existingPrograms) {
      programMap.set(p.code.toUpperCase(), p);
    }
  }

  async function resolveProgram(code: string, name: string) {
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

  const results = [];
  const CHUNK_SIZE = 5;

  for (let i = 0; i < QA_FACULTY_ACCOUNTS.length; i += CHUNK_SIZE) {
    const chunk = QA_FACULTY_ACCOUNTS.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (acc) => {
        const normalizedEmail = acc.email.toLowerCase().trim();
        const program = await resolveProgram(acc.programCode, acc.programName);
        const programId = program?.id ?? null;

        const userMetadata = {
          role: ROLE.FACULTY,
          full_name: acc.fullName,
          first_name: acc.firstName,
          middle_name: acc.middleName,
          last_name: acc.lastName,
          program_id: programId,
          program_code: program?.code ?? acc.programCode,
          must_change_password: false,
          force_password_change: false,
        };

        let authUserId: string;
        const existingAuthUser = userMap.get(normalizedEmail);

        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
          const { error: updateErr } = await supabase.auth.admin.updateUserById(authUserId, {
            password: acc.password,
            email_confirm: true,
            user_metadata: userMetadata,
            app_metadata: { role: ROLE.FACULTY },
          });
          if (updateErr) {
            throw new Error(`Failed to update auth user for ${acc.email}: ${updateErr.message}`);
          }
        } else {
          const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
            email: normalizedEmail,
            password: acc.password,
            email_confirm: true,
            user_metadata: userMetadata,
            app_metadata: { role: ROLE.FACULTY },
          });
          if (createErr || !createData.user) {
            throw new Error(`Failed to create auth user for ${acc.email}: ${createErr?.message}`);
          }
          authUserId = createData.user.id;
          userMap.set(normalizedEmail, createData.user);
        }

        // Upsert Profile
        const { data: profile } = await supabase
          .from("profiles")
          .upsert(
            {
              id: authUserId,
              user_id: authUserId,
              full_name: acc.fullName,
              email: normalizedEmail,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          )
          .select("id")
          .maybeSingle();

        const profileId = profile?.id ?? authUserId;

        // Upsert User Roles
        if (facultyRole?.id && profileId) {
          await supabase
            .from("user_roles")
            .upsert(
              { profile_id: profileId, role_id: facultyRole.id },
              { onConflict: "profile_id,role_id" }
            );
        }

        // Upsert Faculty Program Assignment
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

        return {
          email: normalizedEmail,
          fullName: acc.fullName,
          role: "faculty",
          program: program?.name ?? acc.programName,
          academicYear: acc.academicYear,
          term: acc.term,
          status: "ready",
        };
      })
    );
    results.push(...chunkResults);
  }

  return results;
}

export async function GET() {
  try {
    const data = await bootstrapQaFaculty();
    return NextResponse.json({ success: true, count: data.length, accounts: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to bootstrap QA faculty accounts", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const data = await bootstrapQaFaculty();
    return NextResponse.json({ success: true, count: data.length, accounts: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to bootstrap QA faculty accounts", details: String(error) },
      { status: 500 }
    );
  }
}
