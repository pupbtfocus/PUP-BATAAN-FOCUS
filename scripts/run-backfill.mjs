import fs from "fs";
import path from "path";

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

const repoRoot = path.resolve(new URL(import.meta.url).pathname, "..", "..");
const envPath = path.join(repoRoot, "pup-focus", ".env.local");
const env = loadEnv(envPath);

const SUPABASE_URL =
  env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing Supabase env vars. Ensure .env.local contains NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

console.log("Using Supabase URL:", SUPABASE_URL);

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function backfill() {
  console.log("Querying submissions with null faculty_profile_id...");
  const { data: submissions, error: subErr } = await supabase
    .from("submissions")
    .select("id")
    .is("faculty_profile_id", null)
    .limit(1000);

  if (subErr) {
    console.error("Failed to query submissions:", subErr.message);
    process.exit(1);
  }

  if (!submissions || submissions.length === 0) {
    console.log("No submissions with null faculty_profile_id found.");
    return;
  }

  const results = [];

  for (const row of submissions) {
    const submissionId = row.id;
    try {
      const { data: doc, error: docErr } = await supabase
        .from("document_versions")
        .select("storage_path")
        .eq("submission_id", submissionId)
        .limit(1)
        .maybeSingle();

      if (docErr || !doc || !doc.storage_path) {
        results.push({
          submissionId,
          ok: false,
          error: docErr?.message || "no document version",
        });
        console.warn(submissionId, "-> no document version");
        continue;
      }

      const parts = doc.storage_path.split("/");
      const profileId = parts.length >= 3 ? parts[1] : null;

      if (!profileId) {
        results.push({
          submissionId,
          ok: false,
          error: "could not parse profile id",
        });
        console.warn(
          submissionId,
          "-> could not parse profile id from",
          doc.storage_path,
        );
        continue;
      }

      const { error: updateErr } = await supabase
        .from("submissions")
        .update({ faculty_profile_id: profileId })
        .eq("id", submissionId);

      if (updateErr) {
        results.push({
          submissionId,
          ok: false,
          profileId,
          error: updateErr.message,
        });
        console.warn(submissionId, "-> update failed:", updateErr.message);
        continue;
      }

      results.push({ submissionId, ok: true, profileId });
      console.log(submissionId, "-> updated with profile", profileId);
    } catch (err) {
      results.push({ submissionId, ok: false, error: String(err) });
      console.error(submissionId, "-> exception:", err);
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  console.log(`Backfill complete: ${successCount}/${results.length} updated.`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log("Failures:", failed);
  }
}

await backfill();
