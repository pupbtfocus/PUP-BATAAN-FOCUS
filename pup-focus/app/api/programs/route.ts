import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const DEFAULT_PROGRAMS = [
  { code: "BEED", name: "Bachelor of Elementary Education" },
  { code: "BSA", name: "Bachelor of Science in Accountancy" },
  { code: "BSMA", name: "Bachelor of Science in Management Accounting" },
  { code: "BSIE", name: "Bachelor of Science in Industrial Engineering" },
  { code: "BSIT", name: "Bachelor of Science in Information Technology" },
  {
    code: "BSBAHRM",
    name: "Bachelor of Science in Business Administration major in Human Resource Management",
  },
  { code: "BSEnt", name: "Bachelor of Science in Entrepreneurship" },
  { code: "DIT", name: "Diploma in Information Technology" },
  {
    code: "DOMT-LOM",
    name: "Diploma in Office Management Technology major in Legal Office Management",
  },
];

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const url = new URL(req.url);
    const includeHidden = url.searchParams.get("includeHidden") === "true";

    // Query programs without curricula dependency
    let query = supabase
      .from("programs")
      .select("id, code, name, description, is_hidden, created_at")
      .order("code", { ascending: true });

    if (!includeHidden) {
      query = query.or("is_hidden.is.null,is_hidden.eq.false");
    }

    const { data: programs, error } = await query;

    if (error) {
      // If error might be due to missing columns before migration, fallback to simple select
      const fallbackQuery = supabase
        .from("programs")
        .select("id, code, name")
        .order("code", { ascending: true });

      const { data: fallbackPrograms, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        return NextResponse.json(
          { error: fallbackError.message, programs: DEFAULT_PROGRAMS.map((p) => ({ id: p.code, ...p, is_hidden: false })) },
          { status: 500 },
        );
      }

      const formatted = (fallbackPrograms || []).map((p: any) => ({
        ...p,
        description: "",
        is_hidden: false,
        curricula_count: 0,
      }));

      return NextResponse.json({ programs: formatted });
    }

    if (!programs || programs.length === 0) {
      // Auto-populate default programs if table is empty
      const { data: inserted, error: insertError } = await supabase
        .from("programs")
        .upsert(
          DEFAULT_PROGRAMS.map((p) => ({
            code: p.code,
            name: p.name,
          })),
          { onConflict: "code" },
        )
        .select("id, code, name")
        .order("code", { ascending: true });

      if (!insertError && inserted && inserted.length > 0) {
        return NextResponse.json({
          programs: inserted.map((p) => ({ ...p, is_hidden: false, curricula_count: 0 })),
        });
      }

      return NextResponse.json({
        programs: DEFAULT_PROGRAMS.map((p) => ({ id: p.code, ...p, is_hidden: false, curricula_count: 0 })),
      });
    }

    const formatted = programs.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description || "",
      is_hidden: Boolean(p.is_hidden),
      created_at: p.created_at,
    }));

    return NextResponse.json({ programs: formatted });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch programs",
        programs: DEFAULT_PROGRAMS.map((p) => ({ id: p.code, ...p, is_hidden: false, curricula_count: 0 })),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const body = await req.json();

    const code = (body.code || "").trim().toUpperCase();
    const name = (body.name || "").trim();
    const description = (body.description || "").trim();

    if (!code || !name) {
      return NextResponse.json(
        { error: "Program code and name are required." },
        { status: 400 },
      );
    }

    let { data, error } = await supabase
      .from("programs")
      .insert({
        code,
        name,
        description,
        is_hidden: false,
      })
      .select()
      .single();

    if (error) {
      // If error is due to missing columns before migration 0032 (e.g. description or is_hidden)
      if (
        error.code === "42703" ||
        error.code === "PGRST204" ||
        (error.message && error.message.toLowerCase().includes("column"))
      ) {
        const fallbackRes = await supabase
          .from("programs")
          .insert({ code, name })
          .select("id, code, name")
          .single();

        if (!fallbackRes.error && fallbackRes.data) {
          return NextResponse.json(
            { program: { ...fallbackRes.data, description, is_hidden: false } },
            { status: 201 },
          );
        }
        if (fallbackRes.error) {
          error = fallbackRes.error;
        }
      }

      // If code unique constraint violated
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Program with code "${code}" already exists.` },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ program: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create program." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const body = await req.json();
    const { id, code, name, description, is_hidden } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Program ID is required." },
        { status: 400 },
      );
    }

    const updates: Record<string, any> = {};
    if (code !== undefined) updates.code = String(code).trim().toUpperCase();
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (is_hidden !== undefined) updates.is_hidden = Boolean(is_hidden);

    let { data, error } = await supabase
      .from("programs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (
        error.code === "42703" ||
        error.code === "PGRST204" ||
        (error.message && error.message.toLowerCase().includes("column"))
      ) {
        const safeUpdates: Record<string, any> = {};
        if (updates.code) safeUpdates.code = updates.code;
        if (updates.name) safeUpdates.name = updates.name;

        if (Object.keys(safeUpdates).length > 0) {
          const fallbackRes = await supabase
            .from("programs")
            .update(safeUpdates)
            .eq("id", id)
            .select("id, code, name")
            .single();

          if (!fallbackRes.error && fallbackRes.data) {
            return NextResponse.json({
              program: { ...fallbackRes.data, ...updates },
            });
          }
          if (fallbackRes.error) error = fallbackRes.error;
        } else {
          return NextResponse.json({
            program: { id, ...updates },
          });
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ program: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update program." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Program ID is required." },
        { status: 400 },
      );
    }

    // Safely unlink or clean up any program assignments referencing this program
    try {
      await supabase.from("faculty_program_assignments").delete().eq("program_id", id);
      await supabase.from("admin_assignments").delete().eq("program_id", id);
    } catch {
      // Safe fallback if tables don't exist
    }

    const { error } = await supabase.from("programs").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete program." },
      { status: 500 },
    );
  }
}
