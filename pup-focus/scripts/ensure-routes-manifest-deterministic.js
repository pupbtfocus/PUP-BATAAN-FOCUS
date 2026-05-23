const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");
const sourceManifestPath = path.join(nextDir, "routes-manifest.json");
const deterministicManifestPath = path.join(
  nextDir,
  "routes-manifest-deterministic.json",
);
const parentNextDir = path.resolve(process.cwd(), "..", ".next");
const parentDeterministicManifestPath = path.join(
  parentNextDir,
  "routes-manifest-deterministic.json",
);
const parentSourceManifestPath = path.join(
  parentNextDir,
  "routes-manifest.json",
);

function copyFileIfMissing(sourcePath, targetPath, logMessage) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  console.log(logMessage);
}

function copyDirIfMissing(sourceDir, targetDir, logMessage) {
  if (!fs.existsSync(sourceDir) || fs.existsSync(targetDir)) {
    return;
  }

  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(logMessage);
}

function ensureLocalManifest() {
  if (!fs.existsSync(sourceManifestPath)) {
    console.warn(
      "[postbuild] .next/routes-manifest.json not found; skipping deterministic manifest step.",
    );
    return false;
  }

  if (fs.existsSync(deterministicManifestPath)) {
    console.log(
      "[postbuild] routes-manifest-deterministic.json already exists.",
    );
    return true;
  }

  fs.copyFileSync(sourceManifestPath, deterministicManifestPath);
  console.log(
    "[postbuild] Created .next/routes-manifest-deterministic.json from routes-manifest.json.",
  );

  return true;
}

function ensureParentFallbackManifest() {
  const isVercel = process.env.VERCEL === "1";
  if (!isVercel) {
    return;
  }

  const sourceForParent = fs.existsSync(deterministicManifestPath)
    ? deterministicManifestPath
    : sourceManifestPath;

  if (!fs.existsSync(sourceForParent)) {
    return;
  }

  fs.mkdirSync(parentNextDir, { recursive: true });

  if (!fs.existsSync(parentDeterministicManifestPath)) {
    fs.copyFileSync(sourceForParent, parentDeterministicManifestPath);
    console.log(
      "[postbuild] Created parent .next/routes-manifest-deterministic.json fallback for Vercel packaging.",
    );
  }

  if (
    !fs.existsSync(parentSourceManifestPath) &&
    fs.existsSync(sourceManifestPath)
  ) {
    fs.copyFileSync(sourceManifestPath, parentSourceManifestPath);
    console.log(
      "[postbuild] Created parent .next/routes-manifest.json fallback for Vercel packaging.",
    );
  }

  const filesToMirror = [
    "app-path-routes-manifest.json",
    "build-manifest.json",
    "prerender-manifest.json",
    "react-loadable-manifest.json",
    "required-server-files.json",
    "routes-manifest.json",
    "routes-manifest-deterministic.json",
    path.join("server", "pages-manifest.json"),
    path.join("server", "app-paths-manifest.json"),
  ];

  for (const relativePath of filesToMirror) {
    copyFileIfMissing(
      path.join(nextDir, relativePath),
      path.join(parentNextDir, relativePath),
      `[postbuild] Mirrored parent .next/${relativePath} for Vercel packaging.`,
    );
  }

  const dirsToMirror = ["server", "static"];
  for (const relativePath of dirsToMirror) {
    copyDirIfMissing(
      path.join(nextDir, relativePath),
      path.join(parentNextDir, relativePath),
      `[postbuild] Mirrored parent .next/${relativePath} directory for Vercel packaging.`,
    );
  }
}

function run() {
  ensureLocalManifest();
  ensureParentFallbackManifest();
}

run();
