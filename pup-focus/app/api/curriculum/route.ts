import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const url = new URL(req.url);
    const programId = url.searchParams.get("programId");
    const includeHidden = url.searchParams.get("includeHidden") === "true";

    let query = supabase
      .from("curricula")
      .select("id, program_id, code, name, description, is_hidden, created_at, programs(id, code, name)")
      .order("created_at", { ascending: false });

    if (programId) {
      query = query.eq("program_id", programId);
    }

    if (!includeHidden) {
      query = query.or("is_hidden.is.null,is_hidden.eq.false");
    }

    const { data, error } = await query;

    if (error) {
      // Fallback query if columns before migration
      const fallbackQuery = supabase
        .from("curricula")
        .select("id, program_id, code, name, created_at, programs(id, code, name)")
        .order("created_at", { ascending: false });

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        return NextResponse.json({ curricula: [] });
      }

      const formatted = (fallbackData || []).map((c: any) => ({
        ...c,
        description: "",
        is_hidden: false,
        program: c.programs || null,
      }));

      return NextResponse.json({ curricula: formatted });
    }

    const formatted = (data || []).map((c: any) => ({
      id: c.id,
      program_id: c.program_id,
      code: c.code,
      name: c.name,
      description: c.description || "",
      is_hidden: Boolean(c.is_hidden),
      created_at: c.created_at,
      program: c.programs || null,
    }));

    return NextResponse.json({ curricula: formatted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch curricula", curricula: [] },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const body = await req.json();

    const program_id = (body.program_id || "").trim();
    const code = (body.code || "").trim();
    const name = (body.name || "").trim();
    const description = (body.description || "").trim();

    if (!program_id || !code || !name) {
      return NextResponse.json(
        { error: "Program ID, curriculum code, and curriculum name are required." },
        { status: 400 },
      );
    }

    let { data, error } = await supabase
      .from("curricula")
      .insert({
        program_id,
        code,
        name,
        description,
        is_hidden: false,
      })
      .select("id, program_id, code, name, description, is_hidden, created_at, programs(id, code, name)")
      .single();

    if (error) {
      if (
        error.code === "42703" ||
        error.code === "PGRST204" ||
        (error.message && error.message.toLowerCase().includes("column"))
      ) {
        const fallbackRes = await supabase
          .from("curricula")
          .insert({ program_id, code, name })
          .select("id, program_id, code, name, created_at, programs(id, code, name)")
          .single();

        if (!fallbackRes.error && fallbackRes.data) {
          return NextResponse.json({
            curriculum: {
              ...fallbackRes.data,
              description,
              is_hidden: false,
              program: (fallbackRes.data as any).programs || null,
            },
          }, { status: 201 });
        }
        if (fallbackRes.error) error = fallbackRes.error;
      }

      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Curriculum code "${code}" already exists for this program.` },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      curriculum: {
        ...data,
        program: (data as any).programs || null,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create curriculum." },
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
        { error: "Curriculum ID is required." },
        { status: 400 },
      );
    }

    const updates: Record<string, any> = {};
    if (code !== undefined) updates.code = String(code).trim();
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (is_hidden !== undefined) updates.is_hidden = Boolean(is_hidden);

    let { data, error } = await supabase
      .from("curricula")
      .update(updates)
      .eq("id", id)
      .select("id, program_id, code, name, description, is_hidden, created_at, programs(id, code, name)")
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
            .from("curricula")
            .update(safeUpdates)
            .eq("id", id)
            .select("id, program_id, code, name, created_at, programs(id, code, name)")
            .single();

          if (!fallbackRes.error && fallbackRes.data) {
            return NextResponse.json({
              curriculum: {
                ...fallbackRes.data,
                ...updates,
                program: (fallbackRes.data as any).programs || null,
              },
            });
          }
          if (fallbackRes.error) error = fallbackRes.error;
        } else {
          return NextResponse.json({
            curriculum: { id, ...updates },
          });
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      curriculum: {
        ...data,
        program: (data as any).programs || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update curriculum." },
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
        { error: "Curriculum ID is required." },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("curricula").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete curriculum." },
      { status: 500 },
    );
  }
}
