#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

console.log("=== PUP-FOCUS Build Script ===");
console.log("Node version:", process.version);
console.log("NPM version:", execSync("npm --version").toString().trim());
console.log("Current directory:", process.cwd());

try {
  console.log("\n1. Installing dependencies...");
  execSync("npm install", { stdio: "inherit" });

  console.log("\n2. Running Next.js webpack build...");
  execSync("next build --webpack", { stdio: "inherit" });

  console.log("\n=== Build completed successfully ===");
  process.exit(0);
} catch (error) {
  console.error("\n=== Build failed ===");
  console.error("Error:", error.message);
  process.exit(1);
}
