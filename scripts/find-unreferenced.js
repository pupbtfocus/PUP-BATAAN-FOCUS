const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "pup-focus");
const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function walk(dir, fileList = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (
        [
          "node_modules",
          ".next",
          ".git",
          "dist",
          "build",
          ".parcel-cache",
          ".turbo",
        ].includes(it.name)
      )
        continue;
      walk(full, fileList);
    } else {
      fileList.push(full);
    }
  }
  return fileList;
}

function isSource(file) {
  return (
    exts.includes(path.extname(file)) &&
    file.includes(path.sep + "pup-focus" + path.sep)
  );
}

function readImports(file) {
  const c = fs.readFileSync(file, "utf8");
  const imports = new Set();
  const reImport = /import\s+(?:[^'"\n]+from\s+)?['"]([^'"]+)['"]/g;
  const reRequire = /require\(['"]([^'"]+)['"]\)/g;
  const reDynamic = /import\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = reImport.exec(c))) imports.add(m[1]);
  while ((m = reRequire.exec(c))) imports.add(m[1]);
  while ((m = reDynamic.exec(c))) imports.add(m[1]);
  return Array.from(imports);
}

function resolveImport(fromFile, imp) {
  if (imp.startsWith(".") || imp.startsWith("/")) {
    const base = path.dirname(fromFile);
    let candidate = path.resolve(base, imp);
    // try extensions and index files
    const tries = [candidate].concat(
      exts.map((e) => candidate + e),
      exts.map((e) => path.join(candidate, "index" + e)),
    );
    for (const t of tries) {
      if (fs.existsSync(t) && isSource(t)) return t;
    }
  }
  return null; // external module
}

function main() {
  const allFiles = walk(ROOT).filter(isSource);
  const fileSet = new Set(allFiles.map((f) => path.resolve(f)));

  const importsMap = new Map();
  for (const f of allFiles) {
    try {
      const imps = readImports(f);
      const resolved = imps.map((i) => resolveImport(f, i)).filter(Boolean);
      importsMap.set(path.resolve(f), resolved);
    } catch (e) {
      // ignore parse errors
    }
  }

  // build reverse map
  const referenced = new Set();
  for (const [from, arr] of importsMap.entries()) {
    for (const r of arr) referenced.add(path.resolve(r));
  }

  // mark entrypoints (Next app routes and api and components used by app)
  const entryPoints = allFiles
    .filter((f) => {
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      return (
        rel.startsWith("pup-focus/app/") ||
        rel.startsWith("pup-focus/pages/") ||
        rel.includes("/components/") ||
        rel.includes("/layout") ||
        rel.endsWith("page.tsx") ||
        rel.endsWith("layout.tsx")
      );
    })
    .map((f) => path.resolve(f));

  for (const e of entryPoints) referenced.add(e);

  // any source file not in referenced is a candidate
  const candidates = [];
  for (const f of allFiles) {
    const rf = path.resolve(f);
    if (!referenced.has(rf)) candidates.push(rf);
  }

  // filter out obvious generated or config files
  const filtered = candidates.filter(
    (c) =>
      !c.includes(path.sep + "scripts" + path.sep) &&
      !c.endsWith("test.ts") &&
      !c.endsWith(".d.ts"),
  );

  if (filtered.length === 0) {
    console.log("No likely-unreferenced source files found.");
    return;
  }

  console.log("Likely unreferenced source files (review before deleting):");
  for (const f of filtered) console.log(" - " + path.relative(ROOT, f));
}

main();
