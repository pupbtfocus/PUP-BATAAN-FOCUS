import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const supabase = getServiceRoleClient();
    const { data: programs, error } = await supabase
      .from("programs")
      .select("id, code, name")
      .order("code", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message, programs: DEFAULT_PROGRAMS.map((p) => ({ id: p.code, ...p })) },
        { status: 500 },
      );
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
        return NextResponse.json({ programs: inserted });
      }

      return NextResponse.json({
        programs: DEFAULT_PROGRAMS.map((p) => ({ id: p.code, ...p })),
      });
    }

    return NextResponse.json({ programs });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch programs",
        programs: DEFAULT_PROGRAMS.map((p) => ({ id: p.code, ...p })),
      },
      { status: 500 },
    );
  }
}
