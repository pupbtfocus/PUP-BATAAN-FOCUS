import { cpSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const workspaceRoot = resolve(process.cwd());
const appRoot = resolve(workspaceRoot, "pup-focus");
const appNextDir = resolve(appRoot, ".next");
const rootNextDir = resolve(workspaceRoot, ".next");
const appNodeModulesDir = resolve(appRoot, "node_modules");

if (!existsSync(appNodeModulesDir)) {
  execSync("npm ci", { cwd: appRoot, stdio: "inherit" });
}

execSync("node ./node_modules/next/dist/bin/next build --webpack", {
  cwd: appRoot,
  stdio: "inherit",
});

if (existsSync(rootNextDir)) {
  rmSync(rootNextDir, { recursive: true, force: true });
}

cpSync(appNextDir, rootNextDir, { recursive: true });
