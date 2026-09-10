import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local missing");
  const env = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .reduce((acc, line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return acc;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      acc[k] = v;
      return acc;
    }, {});
  return env;
}

async function main() {
  const env = readEnv();
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const previewEmail = "preview@pupfocus.dev";
  const previewPassword = "PreviewPassword2026!";
  const previewFullName = "Developer Preview";

  console.log(`Checking if account ${previewEmail} already exists...`);
  const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listErr) {
    console.error("Error listing users:", listErr);
    process.exit(1);
  }

  const existingUser = usersData.users.find(
    (u) => (u.email || "").toLowerCase() === previewEmail.toLowerCase()
  );

  let userId;

  if (existingUser) {
    console.log(`Account ${previewEmail} exists (ID: ${existingUser.id}). Updating password & metadata...`);
    userId = existingUser.id;
    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
      password: previewPassword,
      email_confirm: true,
      user_metadata: {
        role: "super_admin",
        full_name: previewFullName,
        first_name: "Developer",
        last_name: "Preview",
        must_change_password: false,
        force_password_change: false,
      },
      app_metadata: {
        role: "super_admin",
      },
    });

    if (updateErr) {
      console.error("Error updating user:", updateErr);
      process.exit(1);
    }
  } else {
    console.log(`Creating new account ${previewEmail}...`);
    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email: previewEmail,
      password: previewPassword,
      email_confirm: true,
      user_metadata: {
        role: "super_admin",
        full_name: previewFullName,
        first_name: "Developer",
        last_name: "Preview",
        must_change_password: false,
        force_password_change: false,
      },
      app_metadata: {
        role: "super_admin",
      },
    });

    if (createErr) {
      console.error("Error creating user:", createErr);
      process.exit(1);
    }

    userId = createData.user.id;
    console.log(`Created user with ID: ${userId}`);
  }

  // Ensure profile row exists in profiles table
  console.log("Upserting profile row in public.profiles...");
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      user_id: userId,
      full_name: previewFullName,
      email: previewEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    console.warn("Notice: profile upsert error (non-fatal):", profileErr.message);
  } else {
    console.log("Profile row verified successfully.");
  }

  try {
    const { error: roleErr } = await supabase.from("user_roles").upsert(
      {
        user_id: userId,
        role: "super_admin",
      },
      { onConflict: "user_id" }
    );
    if (roleErr) {
      console.log("Note on user_roles table:", roleErr.message);
    }
  } catch (e) {
    // Non-fatal if table doesn't exist
  }

  console.log("-----------------------------------------");
  console.log("PREVIEW ACCOUNT READY:");
  console.log(`Email:    ${previewEmail}`);
  console.log(`Password: ${previewPassword}`);
  console.log(`Role:     super_admin`);
  console.log("-----------------------------------------");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
