import { cpSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const workspaceRoot = resolve(process.cwd());
const appRoot = resolve(workspaceRoot, "pup-focus");
const appNextDir = resolve(appRoot, ".next");
const rootNextDir = resolve(workspaceRoot, ".next");
const appNodeModulesDir = resolve(appRoot, "node_modules");
const rootDeterministicRoutesManifest = resolve(
  rootNextDir,
  "routes-manifest-deterministic.json",
);
const wrapperMarker = resolve(workspaceRoot, ".vercel-wrapper-ran");

function log(...args) {
  try {
    // ensure messages appear in Vercel build logs
    console.log("[build-vercel]", ...args);
  } catch (e) {}
}

log("workspaceRoot=", workspaceRoot);
log("appRoot=", appRoot);

mkdirSync(rootNextDir, { recursive: true });

// write an early deterministic manifest and marker so Vercel's trace lstat can succeed
writeFileSync(
  rootDeterministicRoutesManifest,
  JSON.stringify({ createdBy: "build-vercel", ts: Date.now() }) + "\n",
);
writeFileSync(wrapperMarker, "ok\n");
log(
  "wrote early marker and deterministic manifest:",
  rootDeterministicRoutesManifest,
  wrapperMarker,
);

if (!existsSync(appNodeModulesDir)) {
  log("running npm ci in appRoot", appRoot);
  execSync("npm ci", { cwd: appRoot, stdio: "inherit" });
}

log("building nested Next.js app at", appRoot);
execSync("node ./node_modules/next/dist/bin/next build --webpack", {
  cwd: appRoot,
  stdio: "inherit",
});

log("copying", appNextDir, "->", rootNextDir);
cpSync(appNextDir, rootNextDir, { recursive: true });

const appRoutesManifest = resolve(appNextDir, "routes-manifest.json");
const appDeterministicRoutesManifest = resolve(
  appNextDir,
  "routes-manifest-deterministic.json",
);
const rootRoutesManifest = resolve(rootNextDir, "routes-manifest.json");

if (
  existsSync(appRoutesManifest) &&
  !existsSync(appDeterministicRoutesManifest)
) {
  log("copying app routes-manifest -> app deterministic manifest");
  cpSync(appRoutesManifest, appDeterministicRoutesManifest);
}

if (
  existsSync(rootRoutesManifest) &&
  !existsSync(rootDeterministicRoutesManifest)
) {
  log("copying root routes-manifest -> root deterministic manifest");
  cpSync(rootRoutesManifest, rootDeterministicRoutesManifest);
}

if (!existsSync(rootDeterministicRoutesManifest)) {
  log("final write of deterministic manifest");
  writeFileSync(
    rootDeterministicRoutesManifest,
    JSON.stringify({ createdBy: "build-vercel-final", ts: Date.now() }) + "\n",
  );
}

log(
  "build-vercel completed; final deterministic manifest at",
  rootDeterministicRoutesManifest,
);
