import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..");
const nextDir = join(appRoot, ".next");
const deterministicManifest = join(
  nextDir,
  "routes-manifest-deterministic.json",
);
const routesManifest = join(nextDir, "routes-manifest.json");
const repoRoot = join(appRoot, "..");
const repoRootNextDir = join(repoRoot, ".next");
const repoRootDeterministicManifest = join(
  repoRootNextDir,
  "routes-manifest-deterministic.json",
);

function ensureManifest(targetPath) {
  const targetDir = dirname(targetPath);

  if (existsSync(targetPath)) {
    console.log(`[build] ${targetPath} already exists.`);
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(routesManifest, targetPath);
  console.log(`[build] Created ${targetPath} from routes-manifest.json.`);
}

function ensureFileFromSource(sourcePath, targetPath) {
  const targetDir = dirname(targetPath);

  if (!existsSync(sourcePath)) {
    return;
  }

  if (existsSync(targetPath)) {
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sourcePath, targetPath);
  console.log(`[build] Mirrored ${targetPath} from ${sourcePath}.`);
}

function syncDirectory(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
  console.log(`[build] Synced ${targetDir} from ${sourceDir}.`);
}

if (!existsSync(routesManifest)) {
  console.warn(
    "[build] routes-manifest.json was not found, could not create deterministic routes manifest.",
  );
  process.exit(0);
}

ensureManifest(deterministicManifest);

// Vercel can resolve post-build files from monorepo root (`/vercel/path0`).
// Mirror the deterministic manifest there as a safety fallback.
if (repoRootDeterministicManifest !== deterministicManifest) {
  ensureManifest(repoRootDeterministicManifest);
}

// Mirror core manifests and server artifacts that Vercel may lstat from
// monorepo root instead of the app root.
const rootManifestFiles = [
  "routes-manifest.json",
  "routes-manifest-deterministic.json",
  "build-manifest.json",
  "prerender-manifest.json",
  "app-path-routes-manifest.json",
];

for (const relativePath of rootManifestFiles) {
  ensureFileFromSource(
    join(nextDir, relativePath),
    join(repoRootNextDir, relativePath),
  );
}

const appServerDir = join(nextDir, "server");
const repoRootServerDir = join(repoRootNextDir, "server");

if (existsSync(appServerDir)) {
  mkdirSync(repoRootNextDir, { recursive: true });
  cpSync(appServerDir, repoRootServerDir, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
  console.log(
    `[build] Mirrored ${repoRootServerDir} from ${appServerDir} for Vercel root lookup.`,
  );
}

ensureFileFromSource(
  join(nextDir, "server", "pages-manifest.json"),
  join(repoRootNextDir, "server", "pages-manifest.json"),
);

// Sync the full app build output into the repo root .next directory so any
// Vercel post-build lookup against /vercel/path0/.next can resolve the same
// manifests and server artifacts.
syncDirectory(nextDir, repoRootNextDir);

// Some Vercel post-build checks attempt to read Next internals from
// /vercel/path0/node_modules/next/dist. If the Next package is installed
// under the app folder, mirror its `dist` to the repo-root node_modules so
// root-level lstat calls succeed.
const appNextDist = join(appRoot, "node_modules", "next", "dist");
const repoRootNextDist = join(repoRoot, "node_modules", "next", "dist");

if (existsSync(appNextDist)) {
  mkdirSync(join(repoRoot, "node_modules", "next"), { recursive: true });
  // Use force copy to overwrite any partial artifacts from previous builds.
  cpSync(appNextDist, repoRootNextDist, { recursive: true, force: true });
  console.log(
    `[build] Mirrored Next dist from ${appNextDist} to ${repoRootNextDist} for Vercel root lookup.`,
  );
}

// Also mirror the entire installed Next package (including package.json)
// so root-level lookups like /vercel/path0/node_modules/next/package.json succeed.
const appNextPkg = join(appRoot, "node_modules", "next");
const repoRootNextPkg = join(repoRoot, "node_modules", "next");
if (existsSync(appNextPkg)) {
  mkdirSync(join(repoRoot, "node_modules"), { recursive: true });
  cpSync(appNextPkg, repoRootNextPkg, { recursive: true, force: true });
  console.log(`[build] Mirrored full Next package from ${appNextPkg} to ${repoRootNextPkg}.`);
}

// Some packages (e.g. styled-jsx) are required by Next at runtime via
// root-level node_modules lookups. Mirror those packages into the repo-root
// node_modules so Vercel's lstat('/vercel/path0/node_modules/...') calls succeed.
const packagesToMirror = ["styled-jsx"];
for (const pkg of packagesToMirror) {
  const appPkgDir = join(appRoot, "node_modules", pkg);
  const repoPkgDir = join(repoRoot, "node_modules", pkg);

  if (!existsSync(appPkgDir)) {
    continue;
  }

  mkdirSync(join(repoRoot, "node_modules", pkg), { recursive: true });
  cpSync(appPkgDir, repoPkgDir, { recursive: true, force: true });
  console.log(`[build] Mirrored package ${pkg} to repo-root node_modules.`);
}
