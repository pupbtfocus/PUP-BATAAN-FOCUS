import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

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
    const { subject_code, description, units, section_code, academic_term_id, academic_year, semester } = body;

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
        { error: "Section Code is required (e.g. BSIT 4-1)." },
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

    // 2. Resolve target academic term (id, academic_year & semester)
    let termId = academic_term_id || null;
    let targetYear = (typeof academic_year === "string" ? academic_year.trim() : "") || null;
    let targetSem = (typeof semester === "string" ? semester.trim() : "") || null;

    try {
      const { data: activeTerm } = await supabaseAdmin
        .from("academic_terms")
        .select("*")
        .eq("status", "Current")
        .maybeSingle();

      if (activeTerm) {
        termId = termId || (activeTerm as any).id || null;
        targetYear = targetYear || (activeTerm as any).academic_year || null;
        targetSem = targetSem || (activeTerm as any).semester || null;
      }
    } catch {
      // Safe fallback if table structure differs
    }

    // 3. Insert class record into faculty_classes
    const insertPayload: Record<string, any> = {
      faculty_profile_id: profileId,
      subject_code: subject_code.trim(),
      description: description.trim(),
      units: parsedUnits,
      section_code: section_code.trim(),
    };

    if (termId) insertPayload.academic_term_id = termId;
    if (targetYear) insertPayload.academic_year = targetYear;
    if (targetSem) insertPayload.semester = targetSem;

    let createdClass = null;
    const { data: initialData, error: insertError } = await supabaseAdmin
      .from("faculty_classes")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      if (insertError.message.includes("column") || insertError.code === "42703") {
        const fallbackPayload = {
          faculty_profile_id: profileId,
          subject_code: subject_code.trim(),
          description: description.trim(),
          units: parsedUnits,
          section_code: section_code.trim(),
        };
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from("faculty_classes")
          .insert(fallbackPayload)
          .select()
          .single();

        if (fallbackError) {
          console.error("Failed to insert into faculty_classes (fallback):", fallbackError);
          return NextResponse.json(
            { error: `Failed to create class load: ${fallbackError.message}` },
            { status: 500 }
          );
        }
        createdClass = fallbackData;
      } else {
        console.error("Failed to insert into faculty_classes:", insertError);
        return NextResponse.json(
          { error: `Failed to create class load: ${insertError.message}` },
          { status: 500 }
        );
      }
    } else {
      createdClass = initialData;
    }

    void logTransactionEvent({
      actorId: user.id,
      action: "class.create",
      entityType: "faculty_class",
      entityId: createdClass?.id || user.id,
      metadata: {
        subject_code: createdClass?.subject_code,
        section_code: createdClass?.section_code,
        description: createdClass?.description,
        units: createdClass?.units,
        academic_year: createdClass?.academic_year || academic_year,
        semester: createdClass?.semester || semester,
      },
    });

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
