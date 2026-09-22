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
  const { data: allDocs, error } = await supabase
    .from("document_versions")
    .select("id, submission_id, version_number, storage_path, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching document_versions:", error);
    return;
  }

  console.log(`Total rows in document_versions: ${allDocs.length}`);
  
  // Group by submission_id
  const bySub = new Map();
  for (const doc of allDocs) {
    if (!bySub.has(doc.submission_id)) bySub.set(doc.submission_id, []);
    bySub.get(doc.submission_id).push(doc);
  }

  let multiVersionCount = 0;
  for (const [subId, docs] of bySub.entries()) {
    if (docs.length > 1) {
      multiVersionCount++;
      console.log(`Submission ${subId} has ${docs.length} versions:`, docs.map(d => ({ id: d.id, ver: d.version_number, path: d.storage_path })));
    }
  }

  console.log(`Submissions with multiple versions: ${multiVersionCount} out of ${bySub.size} unique submissions.`);
}

main();
