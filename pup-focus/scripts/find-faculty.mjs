import fs from "fs";
import path from "path";
const repoRoot = process.cwd();
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
const env = loadEnv(path.join(repoRoot, ".env.local"));
const SUPABASE_URL =
  env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function find() {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, user_roles(roles(code))")
    .limit(200);

  if (!profiles) {
    console.log("No profile entries found");
    return;
  }

  const matches = (profiles || []).filter((p) => {
    const name = (p?.full_name || "").toLowerCase();
    return name.includes("christian") || name.includes("mandani");
  });

  console.log("Matches:", JSON.stringify(matches, null, 2));
}

await find();
