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

const SUBMISSION_ID = "7f84c3ed-bc81-4f2b-a706-0f953b951619";

async function show() {
  const { data: submission, error } = await supabase
    .from("submissions")
    .select(
      `id, faculty_profile_id, requirement_code, status, submitted_at, created_at, curriculum_id`,
    )
    .eq("id", SUBMISSION_ID)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch submission:", error.message);
    process.exit(1);
  }

  console.log("Submission:", JSON.stringify(submission, null, 2));
  console.log("faculty_profile_id:", submission?.faculty_profile_id ?? null);

  if (submission?.faculty_profile_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_id")
      .eq("id", submission.faculty_profile_id)
      .maybeSingle();
    console.log("Profile:", JSON.stringify(profile || null, null, 2));
  }

  const { data: docs } = await supabase
    .from("document_versions")
    .select("id, storage_path, mime_type, size_bytes, created_at")
    .eq("submission_id", SUBMISSION_ID)
    .order("created_at", { ascending: true });

  console.log("Document versions:", JSON.stringify(docs || [], null, 2));
}

await show();
