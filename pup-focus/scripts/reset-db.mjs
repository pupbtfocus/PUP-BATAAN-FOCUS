// Usage (from /pup-focus):  node scripts/reset-db.mjs [--yes]
// Wipes all submissions/data, empties ALL storage buckets, deletes every
// account except super_admin, and resets academic terms and submission schedules.
// Buckets and catalog config tables (programs, requirement templates, roles) are kept.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  try {
    const env = {};
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[t.slice(0, i).trim()] = v;
    }
    return env;
  } catch {
    return {};
  }
}

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv(path.join(appRoot, ".env.local"));
const URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const NIL = "00000000-0000-0000-0000-000000000000";

// Data tables wiped completely (children first). Missing tables are skipped.
const DATA_TABLES = [
  { table: "review_decisions", filter: (q) => q.neq("id", NIL) },
  { table: "document_versions", filter: (q) => q.neq("id", NIL) },
  { table: "submissions", filter: (q) => q.neq("id", NIL) },
  { table: "extension_requests", filter: (q) => q.neq("id", NIL) },
  { table: "notifications", filter: (q) => q.neq("id", NIL) },
  { table: "audit_logs", filter: (q) => q.neq("id", NIL) },
  { table: "submission_window_logs", filter: (q) => q.neq("id", NIL) },
  { table: "submission_window_terms", filter: (q) => q.neq("academic_year", "") },
  { table: "submission_windows", filter: (q) => q.gte("id", 0) },
  { table: "system_backups", filter: (q) => q.neq("id", NIL) },
  { table: "faculty_classes", filter: (q) => q.neq("id", NIL) },
  { table: "faculty_program_assignments", filter: (q) => q.neq("id", NIL) },
  { table: "admin_assignments", filter: (q) => q.neq("id", NIL) },
  { table: "academic_terms", filter: (q) => q.neq("academic_year", "") },
];
// Account tables: rows tied to non-super-admin users are removed.
const ACCOUNT_TABLES_BY_PROFILE = [
  { table: "user_roles", col: "profile_id" },
  { table: "admins", col: "profile_id" },
  { table: "faculty", col: "profile_id" },
  { table: "profiles", col: "id" },
];
// Intentionally untouched: roles, programs, requirement_templates, compliance_template_items

function isSuper(u) {
  const r = u.user_metadata?.role ?? u.app_metadata?.role;
  return r === "super_admin" || r === "admin";
}

async function confirm() {
  if (process.argv.includes("--yes")) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('Type "RESET" to wipe data, storage, schedules, terms, and all non-super-admin accounts: ', r));
  rl.close();
  return answer.trim() === "RESET";
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function emptyFolder(bucket, prefix) {
  let removed = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error || !data || data.length === 0) break;
    const files = [];
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) removed += await emptyFolder(bucket, full); // folder
      else files.push(full);
    }
    if (files.length === 0) break;
    const { error: rmErr } = await supabase.storage.from(bucket).remove(files);
    if (rmErr) {
      console.error(`  ! ${bucket}: ${rmErr.message}`);
      break;
    }
    removed += files.length;
  }
  return removed;
}

async function wipeTable(table, apply) {
  const { error, count } = await apply(supabase.from(table).delete({ count: "exact" }));
  if (error) {
    const missing = /does not exist|schema cache|Could not find/i.test(error.message);
    console.log(`  - ${table}: ${missing ? "skipped (not found)" : "ERROR " + error.message}`);
  } else {
    console.log(`  - ${table}: ${count ?? "?"} rows deleted`);
  }
}

async function main() {
  const users = await listAllUsers();
  let supers = users.filter(isSuper);
  if (supers.length === 0) {
    const { data: rows, error } = await supabase
      .from("user_roles")
      .select("profiles!inner(user_id), roles!inner(code)")
      .in("roles.code", ["admin", "super_admin"]);
    if (error) console.log(`  (role lookup failed: ${error.message})`);
    const ids = new Set((rows || []).map((r) => r.profiles?.user_id));
    supers = users.filter((u) => ids.has(u.id));
  }
  if (supers.length === 0 && (process.env.SUPER_ADMIN_EMAIL || env.SUPER_ADMIN_EMAIL)) {
    const em = (process.env.SUPER_ADMIN_EMAIL || env.SUPER_ADMIN_EMAIL).toLowerCase();
    supers = users.filter((u) => u.email?.toLowerCase() === em);
  }
  const superIds = new Set(supers.map((u) => u.id));
  if (supers.length === 0) {
    console.error("No super_admin account found. Aborting so you don't lock yourself out.");
    process.exit(1);
  }
  const toDelete = users.filter((u) => !superIds.has(u.id));
  console.log(`Keeping super admin(s): ${supers.map((u) => u.email).join(", ")}`);
  console.log(`Will delete ${toDelete.length} other account(s), all data rows, and all bucket files.`);
  if (!(await confirm())) {
    console.log("Cancelled.");
    return;
  }

  const { data: keepProfiles } = await supabase.from("profiles").select("id").in("user_id", supers.map((u) => u.id));
  const keepProfileIds = (keepProfiles || []).map((p) => p.id);
  const keepList = `(${keepProfileIds.join(",")})`;

  console.log("\nStorage:");
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) console.error(`  ! listBuckets: ${bErr.message}`);
  for (const b of buckets || []) {
    const n = await emptyFolder(b.name, "");
    console.log(`  - ${b.name}: ${n} files removed`);
  }

  console.log("\nData tables:");
  for (const entry of DATA_TABLES) {
    const table = typeof entry === "string" ? entry : entry.table;
    const filter = typeof entry === "object" && entry.filter ? entry.filter : (q) => q.neq("id", NIL);
    await wipeTable(table, filter);
  }

  console.log("\nAccount tables:");
  for (const { table, col } of ACCOUNT_TABLES_BY_PROFILE) {
    await wipeTable(table, (q) => (keepProfileIds.length ? q.not(col, "in", keepList) : q.neq(col, NIL)));
  }
  await wipeTable("app_users", (q) => q.not("user_id", "in", `(${supers.map((u) => u.id).join(",")})`));

  console.log("\nAuth users:");
  let ok = 0;
  for (const u of toDelete) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.log(`  ! ${u.email}: ${error.message}`);
    else ok++;
  }
  console.log(`  - ${ok}/${toDelete.length} deleted`);
  console.log("\nReset complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
