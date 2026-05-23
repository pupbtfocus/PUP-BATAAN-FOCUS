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

mkdirSync(rootNextDir, { recursive: true });
if (!existsSync(rootDeterministicRoutesManifest)) {
  writeFileSync(rootDeterministicRoutesManifest, "{}\n");
}

if (!existsSync(appNodeModulesDir)) {
  execSync("npm ci", { cwd: appRoot, stdio: "inherit" });
}

execSync("node ./node_modules/next/dist/bin/next build --webpack", {
  cwd: appRoot,
  stdio: "inherit",
});

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
  cpSync(appRoutesManifest, appDeterministicRoutesManifest);
}

if (
  existsSync(rootRoutesManifest) &&
  !existsSync(rootDeterministicRoutesManifest)
) {
  cpSync(rootRoutesManifest, rootDeterministicRoutesManifest);
}

if (!existsSync(rootDeterministicRoutesManifest)) {
  writeFileSync(rootDeterministicRoutesManifest, "{}\n");
}
