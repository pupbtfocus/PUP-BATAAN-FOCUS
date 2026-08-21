import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { RequirementTemplate } from "@/features/requirement-templates/types/requirement-template.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SEEDS: Array<Omit<RequirementTemplate, "id" | "created_at" | "updated_at">> = [
  {
    title: "Grade Sheets",
    code: "grade_sheet",
    description: "Official academic grade sheets signed and certified for the semester.",
    allowed_formats: ["PDF", "XLSX", "DOCX"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: "Enhanced Course Syllabus",
    code: "enhanced_syllabus",
    description: "OBE-compliant syllabus including course outcomes, grading system, and weekly schedule.",
    allowed_formats: ["PDF", "DOCX"],
    max_size_mb: 5,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: "Class Orientation Documentation",
    code: "class_orientation",
    description: "Narrative report and photo documentation of the initial class orientation.",
    allowed_formats: ["PDF", "DOCX", "PNG", "JPG"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: "Midterm Examination Package",
    code: "midterm_package",
    description: "Copy of midterm examinations with Table of Specifications (TOS) and Answer Key.",
    allowed_formats: ["PDF", "DOCX"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: "Final Examination Package",
    code: "final_package",
    description: "Copy of final examinations with Table of Specifications (TOS) and Answer Key.",
    allowed_formats: ["PDF", "DOCX"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: "Class Records",
    code: "class_records",
    description: "Official class records showing midterm and final grade computations.",
    allowed_formats: ["PDF", "XLSX"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
];

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    // If unauthenticated or not an admin, return active templates if requested or check user
    const onlyActive = request.nextUrl.searchParams.get("active") === "true";

    const supabase = getServiceRoleClient();

    // Check if table exists
    const { data: rows, error } = await supabase
      .from("requirement_templates")
      .select("*")
      .order("is_mandatory", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("requirement_templates table lookup fallback:", error.message);
      // Fallback to defaults
      const mapped = DEFAULT_SEEDS.map((s, idx) => ({
        id: `default-${idx + 1}`,
        ...s,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      return NextResponse.json({ templates: mapped });
    }

    // If table is empty, auto-seed defaults
    if (!rows || rows.length === 0) {
      try {
        const { data: seeded, error: seedError } = await supabase
          .from("requirement_templates")
          .insert(DEFAULT_SEEDS)
          .select();

        if (!seedError && seeded && seeded.length > 0) {
          return NextResponse.json({ templates: seeded });
        }
      } catch (err) {
        console.error("Auto-seeding requirement templates failed:", err);
      }

      const mapped = DEFAULT_SEEDS.map((s, idx) => ({
        id: `default-${idx + 1}`,
        ...s,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      return NextResponse.json({ templates: mapped });
    }

    const filtered = onlyActive ? rows.filter((r) => r.is_active) : rows;
    return NextResponse.json({ templates: filtered });
  } catch (error) {
    console.error("GET requirement-templates error:", error);
    return NextResponse.json(
      { error: "Failed to load requirement templates" },
      { status: 500 }
    );
  }
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
    const title = (body.title || "").trim();
    let code = (body.code || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const description = (body.description || "").trim();
    const allowed_formats = Array.isArray(body.allowed_formats) && body.allowed_formats.length > 0
      ? body.allowed_formats
      : ["PDF"];
    const max_size_mb = Number(body.max_size_mb) || 5;
    const is_mandatory = body.is_mandatory !== false;
    const is_active = body.is_active !== false;

    if (!title) {
      return NextResponse.json({ error: "Document Name is required." }, { status: 400 });
    }

    if (!code) {
      code = title.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/__+/g, "_");
    }

    const supabase = getServiceRoleClient();

    // Check code uniqueness
    const { data: existing } = await supabase
      .from("requirement_templates")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `A requirement template with code "${code}" already exists.` },
        { status: 400 }
      );
    }

    const { data: created, error: insertError } = await supabase
      .from("requirement_templates")
      .insert({
        title,
        code,
        description: description || null,
        allowed_formats,
        max_size_mb,
        is_mandatory,
        is_active,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ template: created, success: true }, { status: 201 });
  } catch (error) {
    console.error("POST requirement-templates error:", error);
    return NextResponse.json(
      { error: "Failed to create requirement template" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const id = body.id;

    if (!id) {
      return NextResponse.json({ error: "Template ID is required." }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === "string" && body.title.trim()) {
      updatePayload.title = body.title.trim();
    }
    if (typeof body.description !== "undefined") {
      updatePayload.description = body.description ? body.description.trim() : null;
    }
    if (Array.isArray(body.allowed_formats) && body.allowed_formats.length > 0) {
      updatePayload.allowed_formats = body.allowed_formats;
    }
    if (typeof body.max_size_mb === "number" || typeof body.max_size_mb === "string") {
      updatePayload.max_size_mb = Number(body.max_size_mb) || 5;
    }
    if (typeof body.is_mandatory === "boolean") {
      updatePayload.is_mandatory = body.is_mandatory;
    }
    if (typeof body.is_active === "boolean") {
      updatePayload.is_active = body.is_active;
    }

    const supabase = getServiceRoleClient();

    const { data: updated, error: updateError } = await supabase
      .from("requirement_templates")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ template: updated, success: true });
  } catch (error) {
    console.error("PUT requirement-templates error:", error);
    return NextResponse.json(
      { error: "Failed to update requirement template" },
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

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID is required." }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { error: deleteError } = await supabase
      .from("requirement_templates")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("DELETE requirement-templates error:", error);
    return NextResponse.json(
      { error: "Failed to delete requirement template" },
      { status: 500 }
    );
  }
}
