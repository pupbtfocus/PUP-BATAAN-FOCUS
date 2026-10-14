export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - not authenticated" },
        { status: 401 }
      );
    }

    const supabaseAdmin = getServiceRoleClient();

    // 1. Resolve faculty profile ID
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    const profileId = profile?.id || user.id;

    // 2. Resolve active academic term
    const url = new URL(request.url);
    const requestedYear = url.searchParams.get("academicYear")?.trim();
    const requestedSem = url.searchParams.get("semester")?.trim();

    let targetYear = requestedYear || null;
    let targetSem = requestedSem || null;
    let activeTermRow: { academic_year: string; semester: string } | null = null;

    if (!targetYear || !targetSem) {
      const { data: currentTerm } = await supabaseAdmin
        .from("academic_terms")
        .select("academic_year, semester, status")
        .eq("status", "Current")
        .maybeSingle();

      if (currentTerm) {
        targetYear = targetYear || currentTerm.academic_year;
        targetSem = targetSem || currentTerm.semester;
        activeTermRow = currentTerm;
      }
    } else {
      activeTermRow = { academic_year: targetYear, semester: targetSem };
    }

    // 3. Query classes for this faculty profile
    const facultyIds = Array.from(new Set([profileId, user.id]));
    let query = supabaseAdmin
      .from("faculty_classes")
      .select("id, faculty_profile_id, academic_year, semester, academic_term_id, subject_code, description, units, section_code, created_at")
      .in("faculty_profile_id", facultyIds)
      .order("created_at", { ascending: false });

    if (targetYear && targetSem) {
      query = query.or(
        `and(academic_year.eq."${targetYear}",semester.eq."${targetSem}"),and(academic_year.is.null,semester.is.null)`
      );
    }

    const { data: classes, error } = await query;

    if (error) {
      console.warn(
        "Failed to query faculty_classes with term scoping, falling back to basic query:",
        error.message
      );
      const { data: fallbackClasses } = await supabaseAdmin
        .from("faculty_classes")
        .select("id, faculty_profile_id, academic_term_id, subject_code, description, units, section_code, created_at")
        .in("faculty_profile_id", facultyIds)
        .order("created_at", { ascending: false });

      return NextResponse.json({
        classes: fallbackClasses || [],
        activeTerm: activeTermRow,
      });
    }

    return NextResponse.json({
      classes: classes || [],
      activeTerm: activeTermRow,
    });
  } catch (error) {
    console.error("GET /api/faculty/classes error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
        classes: [],
      },
      { status: 500 }
    );
  }
}
