import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch (err) {
    return {};
  }
}

const env = loadEnv(path.join(process.cwd(), ".env.local"));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: subs, error } = await supabase
    .from("submissions")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(5);

  console.log("Error:", error);
  for (const s of subs || []) {
    console.log({
      id: s.id,
      code: s.requirement_code,
      status: s.status,
      remarks: s.remarks,
      admin_remarks: s.admin_remarks,
      submitted_at: s.submitted_at
    });
  }

  // Also check review decisions
  const { data: decisions } = await supabase
    .from("review_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("Recent decisions:", decisions);
}

main();
