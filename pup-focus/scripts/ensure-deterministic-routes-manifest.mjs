import { copyFileSync, existsSync } from "node:fs";
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

if (existsSync(deterministicManifest)) {
  console.log("[build] routes-manifest-deterministic.json already exists.");
  process.exit(0);
}

if (!existsSync(routesManifest)) {
  console.warn(
    "[build] routes-manifest.json was not found, could not create deterministic routes manifest.",
  );
  process.exit(0);
}

copyFileSync(routesManifest, deterministicManifest);
console.log(
  "[build] Created routes-manifest-deterministic.json from routes-manifest.json.",
);
