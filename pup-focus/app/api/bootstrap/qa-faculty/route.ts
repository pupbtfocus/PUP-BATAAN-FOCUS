import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

const QA_FACULTY_ACCOUNTS = [
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

  const results = [];

  for (const acc of QA_FACULTY_ACCOUNTS) {
    const normalizedEmail = acc.email.toLowerCase().trim();

    // 2. Resolve program
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

    // 3. Check existing Auth user
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listErr) {
      throw new Error(`Failed to list auth users: ${listErr.message}`);
    }

    const existingAuthUser = listData.users.find(
      (u) => (u.email || "").toLowerCase() === normalizedEmail
    );

    let authUserId: string;

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

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      const { error: updateErr } = await supabase.auth.admin.updateUserById(authUserId, {
        password: acc.password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: {
          role: ROLE.FACULTY,
        },
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
        app_metadata: {
          role: ROLE.FACULTY,
        },
      });

      if (createErr || !createData.user) {
        throw new Error(`Failed to create auth user for ${acc.email}: ${createErr?.message}`);
      }
      authUserId = createData.user.id;
    }

    // 4. Upsert Profile
    const { data: profile, error: profileErr } = await supabase
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

    if (profileErr) {
      console.warn(`Profile upsert error for ${acc.email}:`, profileErr.message);
    }

    const profileId = profile?.id ?? authUserId;

    // 5. Upsert User Roles
    if (facultyRole?.id && profileId) {
      await supabase
        .from("user_roles")
        .upsert(
          {
            profile_id: profileId,
            role_id: facultyRole.id,
          },
          { onConflict: "profile_id,role_id" }
        );
    }

    // 6. Upsert Faculty Program Assignment
    if (programId && profileId) {
      // Upsert with exact term '1st Sem'
      await supabase
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

      // Also upsert with standard long-form '1st Semester' for compatibility
      await supabase
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
    }

    results.push({
      email: normalizedEmail,
      fullName: acc.fullName,
      role: "faculty",
      program: acc.programName,
      academicYear: acc.academicYear,
      term: acc.term,
      status: "ready",
    });
  }

  return results;
}

export async function GET() {
  try {
    const data = await bootstrapQaFaculty();
    return NextResponse.json({ success: true, accounts: data });
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
    return NextResponse.json({ success: true, accounts: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to bootstrap QA faculty accounts", details: String(error) },
      { status: 500 }
    );
  }
}
