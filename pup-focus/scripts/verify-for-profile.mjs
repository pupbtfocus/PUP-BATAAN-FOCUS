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

const DEFAULT_REQUIREMENTS = [
  "grade_sheet",
  "enhanced_syllabus",
  "class_orientation",
  "midterm_package",
  "final_package",
  "class_records",
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getProfileIdByEmail(email) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", email)
    .limit(1);

  return profiles?.[0]?.id ?? null;
}

function toRequirementStatus(rawStatus) {
  const status = (rawStatus ?? "").toLowerCase();
  if (status === "validated" || status === "approved") return "validated";
  if (
    status === "uploaded" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "pending_review" ||
    status === "pending"
  )
    return "uploaded";
  return "not_submitted";
}

async function run(email) {
  const profileId = await getProfileIdByEmail(email);
  if (!profileId) {
    console.error("Profile not found for", email);
    return;
  }

  console.log("Profile id:", profileId);

  const { data: submissions } = await supabase
    .from("submissions")
    .select("requirement_code, status, submitted_at")
    .eq("faculty_profile_id", profileId)
    .order("submitted_at", { ascending: false })
    .limit(1000);

  const requirementStatus = DEFAULT_REQUIREMENTS.reduce((acc, code) => {
    acc[code] = "not_submitted";
    return acc;
  }, {});
  const rank = { not_submitted: 0, uploaded: 1, validated: 2 };

  for (const row of submissions || []) {
    const code = row.requirement_code;
    if (!DEFAULT_REQUIREMENTS.includes(code)) continue;
    const mapped = toRequirementStatus(row.status);
    if (rank[mapped] > rank[requirementStatus[code]])
      requirementStatus[code] = mapped;
  }

  console.log(
    "Computed requirementStatus:",
    JSON.stringify(requirementStatus, null, 2),
  );
}

await run("mjhayxinadnam@gmail.com");
