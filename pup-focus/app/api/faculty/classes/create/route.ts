import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const { subject_code, description, units, section_code, academic_term_id } = body;

    // Validation
    if (!subject_code || typeof subject_code !== "string" || !subject_code.trim()) {
      return NextResponse.json(
        { error: "Subject Code is required (e.g. COMP 023)." },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "Description is required (e.g. Social and Professional Issues in Computing)." },
        { status: 400 }
      );
    }

    if (!section_code || typeof section_code !== "string" || !section_code.trim()) {
      return NextResponse.json(
        { error: "Section Code is required (e.g. BSIT-BT 4-1)." },
        { status: 400 }
      );
    }

    const parsedUnits = Number(units) > 0 ? Number(units) : 3.0;

    const supabaseAdmin = getServiceRoleClient();

    // 1. Resolve faculty profile ID
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    const profileId = profile?.id || user.id;

    // 2. Resolve target academic term ID
    let termId = academic_term_id || null;
    if (!termId) {
      try {
        const { data: activeTerm } = await supabaseAdmin
          .from("academic_terms")
          .select("*")
          .eq("status", "Current")
          .maybeSingle();

        if (activeTerm) {
          termId = (activeTerm as any).id || null;
        }
      } catch {
        // Safe fallback if table structure differs
      }
    }

    // 3. Insert class record into faculty_classes
    const { data: createdClass, error: insertError } = await supabaseAdmin
      .from("faculty_classes")
      .insert({
        faculty_profile_id: profileId,
        academic_term_id: termId,
        subject_code: subject_code.trim(),
        description: description.trim(),
        units: parsedUnits,
        section_code: section_code.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert into faculty_classes:", insertError);
      return NextResponse.json(
        { error: `Failed to create class load: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      class: createdClass,
      message: `Class ${createdClass.subject_code} (${createdClass.section_code}) created successfully.`,
    });
  } catch (error) {
    console.error("POST /api/faculty/classes/create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
