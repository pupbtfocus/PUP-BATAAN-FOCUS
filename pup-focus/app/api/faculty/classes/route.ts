export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

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
    const filterByTerm = url.searchParams.get("filterByTerm") === "true";

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
    // Classes and subjects persist across terms and are NOT reset when an Academic Year or Semester ends.
    // Only the requirements checklist is reset per term for new uploads.
    const facultyIds = Array.from(new Set([profileId, user.id]));
    let query = supabaseAdmin
      .from("faculty_classes")
      .select("id, faculty_profile_id, academic_year, semester, academic_term_id, subject_code, description, units, section_code, is_archived, created_at")
      .in("faculty_profile_id", facultyIds)
      .order("created_at", { ascending: false });

    // Only apply term filtering if explicitly requested via filterByTerm=true
    if (filterByTerm && targetYear && targetSem) {
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
        classes: (fallbackClasses || []).map((c: any) => ({
          ...c,
          is_archived: false,
        })),
        activeTerm: activeTermRow,
      });
    }

    return NextResponse.json({
      classes: (classes || []).map((c: any) => ({
        ...c,
        is_archived: Boolean(c.is_archived),
      })),
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

export async function PATCH(request: NextRequest) {
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
    const { id, subject_code, description, units, section_code, is_archived } = body;

    if (!id) {
      return NextResponse.json({ error: "Class ID is required" }, { status: 400 });
    }

    const supabaseAdmin = getServiceRoleClient();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    const profileId = profile?.id || user.id;
    const facultyIds = Array.from(new Set([profileId, user.id]));

    // Check ownership
    const { data: existingClass, error: findError } = await supabaseAdmin
      .from("faculty_classes")
      .select("id, faculty_profile_id, subject_code, section_code")
      .eq("id", id)
      .in("faculty_profile_id", facultyIds)
      .maybeSingle();

    if (findError || !existingClass) {
      return NextResponse.json(
        { error: "Class not found or access denied" },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, any> = {};
    if (typeof subject_code === "string" && subject_code.trim()) {
      updatePayload.subject_code = subject_code.trim();
    }
    if (typeof description === "string" && description.trim()) {
      updatePayload.description = description.trim();
    }
    if (typeof section_code === "string" && section_code.trim()) {
      updatePayload.section_code = section_code.trim();
    }
    if (units !== undefined) {
      const parsedUnits = Number(units);
      if (parsedUnits > 0) updatePayload.units = parsedUnits;
    }
    if (typeof is_archived === "boolean") {
      updatePayload.is_archived = is_archived;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No fields to update provided" }, { status: 400 });
    }

    const { data: updatedClass, error: updateError } = await supabaseAdmin
      .from("faculty_classes")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      // If error is due to missing is_archived column (e.g. error code 42703)
      if (
        updatePayload.is_archived !== undefined &&
        (updateError.message.includes("column") || updateError.code === "42703")
      ) {
        delete updatePayload.is_archived;
        if (Object.keys(updatePayload).length > 0) {
          const { data: fallbackUpdated, error: fallbackError } = await supabaseAdmin
            .from("faculty_classes")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .single();

          if (fallbackError) {
            return NextResponse.json({ error: fallbackError.message }, { status: 500 });
          }
          const finalClass = { ...fallbackUpdated, is_archived };
          void logTransactionEvent({
            actorId: user.id,
            action: "class.update",
            entityType: "faculty_class",
            entityId: id,
            metadata: {
              subject_code: finalClass.subject_code,
              section_code: finalClass.section_code,
              changes: updatePayload,
            },
          });
          return NextResponse.json({
            success: true,
            class: finalClass,
          });
        }
        return NextResponse.json({
          success: true,
          class: { ...existingClass, is_archived },
        });
      }

      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    void logTransactionEvent({
      actorId: user.id,
      action: "class.update",
      entityType: "faculty_class",
      entityId: id,
      metadata: {
        subject_code: updatedClass.subject_code,
        section_code: updatedClass.section_code,
        changes: updatePayload,
      },
    });

    return NextResponse.json({ success: true, class: updatedClass });
  } catch (error) {
    console.error("PATCH /api/faculty/classes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const url = new URL(request.url);
    let classId = url.searchParams.get("id");
    if (!classId) {
      const body = await request.json().catch(() => ({}));
      classId = body.id;
    }

    if (!classId) {
      return NextResponse.json({ error: "Class ID is required" }, { status: 400 });
    }

    const supabaseAdmin = getServiceRoleClient();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    const profileId = profile?.id || user.id;
    const facultyIds = Array.from(new Set([profileId, user.id]));

    // Check ownership
    const { data: existingClass, error: findError } = await supabaseAdmin
      .from("faculty_classes")
      .select("id, faculty_profile_id, subject_code, section_code")
      .eq("id", classId)
      .in("faculty_profile_id", facultyIds)
      .maybeSingle();

    if (findError || !existingClass) {
      return NextResponse.json(
        { error: "Class not found or access denied" },
        { status: 404 }
      );
    }

    // Safely unlink or clean up submissions associated with this class to avoid FK constraints
    await supabaseAdmin
      .from("submissions")
      .update({ class_id: null })
      .eq("class_id", classId);

    const { error: deleteError } = await supabaseAdmin
      .from("faculty_classes")
      .delete()
      .eq("id", classId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    void logTransactionEvent({
      actorId: user.id,
      action: "class.delete",
      entityType: "faculty_class",
      entityId: classId,
      metadata: {
        subject_code: existingClass.subject_code,
        section_code: existingClass.section_code,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Class ${existingClass.subject_code} (${existingClass.section_code}) deleted successfully.`,
    });
  } catch (error) {
    console.error("DELETE /api/faculty/classes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
