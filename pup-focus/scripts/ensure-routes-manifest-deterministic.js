const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");
const sourceManifestPath = path.join(nextDir, "routes-manifest.json");
const deterministicManifestPath = path.join(
  nextDir,
  "routes-manifest-deterministic.json",
);

function run() {
  if (!fs.existsSync(sourceManifestPath)) {
    console.warn(
      "[postbuild] .next/routes-manifest.json not found; skipping deterministic manifest step.",
    );
    return;
  }

  if (fs.existsSync(deterministicManifestPath)) {
    console.log(
      "[postbuild] routes-manifest-deterministic.json already exists.",
    );
    return;
  }

  fs.copyFileSync(sourceManifestPath, deterministicManifestPath);
  console.log(
    "[postbuild] Created .next/routes-manifest-deterministic.json from routes-manifest.json.",
  );
}

run();
