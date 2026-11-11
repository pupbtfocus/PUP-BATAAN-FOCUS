import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import {
  REQUIREMENT_CODE,
  REQUIREMENT_LABEL,
} from "@/config/compliance";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { RequirementTemplate } from "@/features/requirement-templates/types/requirement-template.types";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";
import {
  cleanDescription,
  formatDescriptionWithHiddenTerms,
  normalizeTermKey,
  parseHiddenTerms,
} from "@/lib/requirement-templates/term-visibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SEEDS: Array<Omit<RequirementTemplate, "id" | "created_at" | "updated_at">> = [
  {
    title: REQUIREMENT_LABEL[REQUIREMENT_CODE.GRADE_SHEET],
    code: REQUIREMENT_CODE.GRADE_SHEET,
    description: "Official academic grade sheets signed and certified for the semester.",
    allowed_formats: ["PDF", "XLSX", "DOCX"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: REQUIREMENT_LABEL[REQUIREMENT_CODE.ENHANCED_SYLLABUS],
    code: REQUIREMENT_CODE.ENHANCED_SYLLABUS,
    description: "OBE-compliant syllabus including course outcomes, grading system, and weekly schedule.",
    allowed_formats: ["PDF", "DOCX"],
    max_size_mb: 5,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: REQUIREMENT_LABEL[REQUIREMENT_CODE.CLASS_ORIENTATION],
    code: REQUIREMENT_CODE.CLASS_ORIENTATION,
    description: "Narrative report and photo documentation of the initial class orientation.",
    allowed_formats: ["PDF", "DOCX", "PNG", "JPG"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: REQUIREMENT_LABEL[REQUIREMENT_CODE.MIDTERM_PACKAGE],
    code: REQUIREMENT_CODE.MIDTERM_PACKAGE,
    description: "Copy of midterm examinations with Table of Specifications (TOS) and Answer Key.",
    allowed_formats: ["PDF", "DOCX"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: REQUIREMENT_LABEL[REQUIREMENT_CODE.FINAL_PACKAGE],
    code: REQUIREMENT_CODE.FINAL_PACKAGE,
    description: "Copy of final examinations with Table of Specifications (TOS) and Answer Key.",
    allowed_formats: ["PDF", "DOCX"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
  {
    title: REQUIREMENT_LABEL[REQUIREMENT_CODE.CLASS_RECORDS],
    code: REQUIREMENT_CODE.CLASS_RECORDS,
    description: "Official class records showing midterm and final grade computations.",
    allowed_formats: ["PDF", "XLSX"],
    max_size_mb: 10,
    is_mandatory: true,
    is_active: true,
  },
];

const CANONICAL_ORDER: Record<string, number> = {
  [REQUIREMENT_CODE.GRADE_SHEET]: 1,
  [REQUIREMENT_CODE.ENHANCED_SYLLABUS]: 2,
  [REQUIREMENT_CODE.CLASS_ORIENTATION]: 3,
  [REQUIREMENT_CODE.MIDTERM_PACKAGE]: 4,
  [REQUIREMENT_CODE.FINAL_PACKAGE]: 5,
  [REQUIREMENT_CODE.CLASS_RECORDS]: 6,
};

function sortTemplatesStably(templates: RequirementTemplate[]): RequirementTemplate[] {
  return [...templates].sort((a, b) => {
    const orderA = CANONICAL_ORDER[a.code] ?? 1000;
    const orderB = CANONICAL_ORDER[b.code] ?? 1000;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.id || "").localeCompare(b.id || "");
  });
}

function deduplicateRequirementTemplates(templates: RequirementTemplate[]): {
  unique: RequirementTemplate[];
  duplicateIds: string[];
} {
  const seenCodes = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: RequirementTemplate[] = [];
  const duplicateIds: string[] = [];

  for (const t of templates) {
    const codeKey = (t.code || "").trim().toLowerCase();
    const titleKey = (t.title || "").trim().toLowerCase();

    const isDuplicate =
      (codeKey && seenCodes.has(codeKey)) ||
      (titleKey && seenTitles.has(titleKey));

    if (isDuplicate) {
      if (t.id && !t.id.startsWith("default-")) {
        duplicateIds.push(t.id);
      }
      continue;
    }

    if (codeKey) seenCodes.add(codeKey);
    if (titleKey) seenTitles.add(titleKey);
    unique.push(t);
  }

  return { unique, duplicateIds };
}

function isAdminRole(role: string | undefined) {
  return role === ROLE.STAFF || role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN || role === "staff";
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
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

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
        const sanitizedSeeds = DEFAULT_SEEDS.map(({ description: _d, ...s }) => s);
        const { data: seeded, error: seedError } = await supabase
          .from("requirement_templates")
          .insert(sanitizedSeeds)
          .select();

        if (!seedError && seeded && seeded.length > 0) {
          const { unique } = deduplicateRequirementTemplates(seeded);
          return NextResponse.json({ templates: unique });
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

    const { unique: deduplicatedRows, duplicateIds } = deduplicateRequirementTemplates(rows);

    // Asynchronously delete duplicate records from the database if any were found
    if (duplicateIds.length > 0) {
      void supabase
        .from("requirement_templates")
        .delete()
        .in("id", duplicateIds)
        .then(() => {
        });
    }

    const sortedRows = sortTemplatesStably(deduplicatedRows);
    const sanitizedRows = sortedRows.map((r) => ({
      ...r,
      description: cleanDescription(r.description),
    }));
    const filtered = onlyActive ? sanitizedRows.filter((r) => r.is_active) : sanitizedRows;
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

    const supabase = getServiceRoleClient();

    // Handle acquire current requirements / restore defaults action
    if (
      body.action === "restore_defaults" ||
      body.action === "acquire_current" ||
      body.action === "sync_current"
    ) {
      const { data: existingRows, error: fetchErr } = await supabase
        .from("requirement_templates")
        .select("id, code, title");

      if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      const existingMap = new Map<string, { id: string; code: string; title: string }>(
        (existingRows || []).map((r: { id: string; code: string; title: string }) => [r.code, r])
      );

      let syncedCount = 0;
      let insertedCount = 0;

      for (const seed of DEFAULT_SEEDS) {
        const existing = existingMap.get(seed.code);
        if (existing) {
          // Update existing standard template to match current system specifications
          const { error: updateErr } = await supabase
            .from("requirement_templates")
            .update({
              title: seed.title,
              allowed_formats: seed.allowed_formats,
              max_size_mb: seed.max_size_mb,
              is_mandatory: seed.is_mandatory,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (!updateErr) {
            syncedCount++;
          }
        } else {
          // Insert missing standard template
          const { description: _desc, ...seedPayload } = seed;
          const { error: insertErr } = await supabase
            .from("requirement_templates")
            .insert({
              ...seedPayload,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (!insertErr) {
            insertedCount++;
          }
        }
      }

      // Re-fetch all templates
      const { data: allTemplates } = await supabase
        .from("requirement_templates")
        .select("*")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      const { unique: deduplicatedAll, duplicateIds: postDupIds } = deduplicateRequirementTemplates(allTemplates || []);
      if (postDupIds.length > 0) {
        void supabase
          .from("requirement_templates")
          .delete()
          .in("id", postDupIds);
      }

      const sortedAll = sortTemplatesStably(deduplicatedAll);

      const totalUpdated = syncedCount + insertedCount;
      const message =
        totalUpdated > 0
          ? `Successfully acquired and synchronized ${totalUpdated} compliance requirement templates with current system specifications.`
          : "All standard compliance requirements are already up-to-date.";

      return NextResponse.json({
        success: true,
        syncedCount,
        insertedCount,
        restoredCount: totalUpdated,
        message,
        templates: sortedAll,
      });
    }

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

    // Check code and title uniqueness
    const { data: existingCode } = await supabase
      .from("requirement_templates")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    const { data: existingTitle } = await supabase
      .from("requirement_templates")
      .select("id")
      .ilike("title", title)
      .maybeSingle();

    if (existingTitle) {
      return NextResponse.json(
        { error: "A requirement template with this document title already exists." },
        { status: 409 }
      );
    }

    // If code already taken, ensure uniqueness by appending a unique timestamp suffix
    if (existingCode) {
      code = `${code.slice(0, 40)}_${Date.now().toString().slice(-6)}`;
    }

    const { data: created, error: insertError } = await supabase
      .from("requirement_templates")
      .insert({
        title,
        code,
        allowed_formats,
        max_size_mb,
        is_mandatory,
        is_active,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[requirement-templates POST error]:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    void logTransactionEvent({
      actorId: user.id,
      action: "template.create",
      entityType: "requirement_template",
      entityId: created?.id || user.id,
      metadata: { code, title, is_mandatory, is_active },
    });

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

    // If is_active is changed, synchronize term-based visibility so unhiding in future terms
    // does not retroactively pollute past terms/semesters
    if (typeof body.is_active === "boolean") {
      try {
        const { data: currentTerm } = await supabase
          .from("academic_terms")
          .select("academic_year, semester")
          .eq("status", "Current")
          .maybeSingle();

        if (currentTerm?.academic_year && currentTerm?.semester) {
          const termKey = `${currentTerm.academic_year}|${currentTerm.semester}`;
          const { data: existingTpl } = await supabase
            .from("requirement_templates")
            .select("description")
            .eq("id", id)
            .maybeSingle();

          const baseDesc = typeof body.description === "string" ? body.description : existingTpl?.description;
          const currentHiddenTerms = parseHiddenTerms(baseDesc);

          let newHiddenTerms: string[];
          if (body.is_active === false) {
            newHiddenTerms = Array.from(new Set([...currentHiddenTerms, termKey]));
          } else {
            // Unhiding: remove only current term from hidden list, preserving past terms!
            newHiddenTerms = currentHiddenTerms.filter((k) => {
              const [kAy, kSem] = k.split("|");
              return normalizeTermKey(kAy, kSem) !== normalizeTermKey(currentTerm.academic_year, currentTerm.semester);
            });
          }

          updatePayload.description = formatDescriptionWithHiddenTerms(baseDesc, newHiddenTerms);
        }
      } catch (termErr) {
        console.warn("Could not synchronize term-based visibility:", termErr);
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("requirement_templates")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    void logTransactionEvent({
      actorId: user.id,
      action: "template.update",
      entityType: "requirement_template",
      entityId: id,
      metadata: { ...updatePayload },
    });

    const sanitized = updated
      ? { ...updated, description: cleanDescription(updated.description) }
      : updated;

    return NextResponse.json({ template: sanitized, success: true });
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

    void logTransactionEvent({
      actorId: user.id,
      action: "template.delete",
      entityType: "requirement_template",
      entityId: id,
      metadata: { template_id: id },
    });

    return NextResponse.json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("DELETE requirement-templates error:", error);
    return NextResponse.json(
      { error: "Failed to delete requirement template" },
      { status: 500 }
    );
  }
}
