import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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
