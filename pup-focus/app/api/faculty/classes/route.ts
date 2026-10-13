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

    let termId: string | null = null;
    let activeTermRow: { id: string; academic_year: string; semester: string } | null = null;

    if (requestedYear && requestedSem) {
      const { data: matchedTerm } = await supabaseAdmin
        .from("academic_terms")
        .select("*")
        .eq("academic_year", requestedYear)
        .ilike("semester", `%${requestedSem}%`)
        .maybeSingle();

      if (matchedTerm) {
        termId = (matchedTerm as any).id || null;
        activeTermRow = matchedTerm;
      }
    }

    if (!termId) {
      const { data: currentTerm } = await supabaseAdmin
        .from("academic_terms")
        .select("*")
        .eq("status", "Current")
        .maybeSingle();

      if (currentTerm) {
        termId = (currentTerm as any).id || null;
        activeTermRow = currentTerm;
      }
    }

    // 3. Query classes for this faculty profile
    const facultyIds = Array.from(new Set([profileId, user.id]));
    let query = supabaseAdmin
      .from("faculty_classes")
      .select("id, faculty_profile_id, academic_term_id, subject_code, description, units, section_code, created_at")
      .in("faculty_profile_id", facultyIds)
      .order("created_at", { ascending: false });

    if (termId) {
      query = query.eq("academic_term_id", termId);
    }

    const { data: classes, error } = await query;

    if (error) {
      console.error("Failed to query faculty_classes:", error);
      // Return empty array gracefully if table is fresh or has no entries
      return NextResponse.json({
        classes: [],
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
