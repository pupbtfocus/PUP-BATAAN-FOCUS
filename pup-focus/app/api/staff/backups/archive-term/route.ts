import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const academicYear = (body.academic_year || "").trim();
    const semester = (body.semester || "").trim();

    if (!academicYear) {
      return NextResponse.json(
        { error: "Academic Year is required for archiving." },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Update academic_terms table
    let termQuery = supabase
      .from("academic_terms")
      .update({
        status: "Archived",
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("academic_year", academicYear);

    if (semester) {
      termQuery = termQuery.eq("semester", semester);
    }

    const { error: termError } = await termQuery;
    if (termError) {
      console.warn("academic_terms archive update warning:", termError.message);
    }

    // 2. Mark related submissions as archived
    // If submissions have academic_year / semester or assignment lookup
    try {
      const { data: assignments } = await supabase
        .from("faculty_program_assignments")
        .select("id")
        .eq("academic_year", academicYear);

      if (assignments && assignments.length > 0) {
        const assignmentIds = assignments.map((a) => a.id);
        await supabase
          .from("submissions")
          .update({ is_archived: true })
          .in("faculty_assignment_id", assignmentIds);
      }
    } catch {
      // ignore
    }

    // 3. Log audit event
    try {
      await supabase.from("audit_logs").insert({
        action: "ARCHIVE_ACADEMIC_TERM",
        entity_type: "academic_terms",
        actor_id: user.id,
        actor_name: user.email || "Super Admin",
        details: {
          academic_year: academicYear,
          semester: semester || "All Semesters",
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: `Academic term ${academicYear} ${semester ? `(${semester})` : ""} successfully archived into the compliance vault.`,
      academic_year: academicYear,
      semester: semester || null,
    });
  } catch (error) {
    console.error("POST /api/admin/backups/archive-term error:", error);
    return NextResponse.json(
      { error: "Failed to archive academic term" },
      { status: 500 }
    );
  }
}
