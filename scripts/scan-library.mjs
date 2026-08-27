// Scans public/library/*/ for .glb files and writes index.json + per-piece piece.json.
// Run:  node scripts/scan-library.mjs
// Re-running keeps any labels/defaults you've edited in piece.json and only adds new slots.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "public", "library");
const HARD = /frame|leg|base|metal|wood|steel|brass|chrome|oak|walnut/i;

function glbMaterialNames(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB (magic mismatch)");
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  return (json.materials || []).map((m, i) => m.name || `Material ${i + 1}`);
}

function titleCase(s) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const pieces = [];
for (const dir of readdirSync(ROOT)) {
  const full = join(ROOT, dir);
  if (!statSync(full).isDirectory()) continue;
  const glb = readdirSync(full).find((f) => f.toLowerCase().endsWith(".glb"));
  if (!glb) { console.warn(`skip ${dir}: no .glb`); continue; }
  const thumb = readdirSync(full).find((f) => /^thumb\.(jpg|jpeg|png|webp)$/i.test(f));

  const manifestPath = join(full, "piece.json");
  let existing = {};
  if (existsSync(manifestPath)) {
    const raw = readFileSync(manifestPath, "utf8").trim();
    if (raw) {
      try { existing = JSON.parse(raw); }
      catch (e) { console.warn(`${dir}/piece.json is not valid JSON (${e.message}); regenerating it`); }
    }
  }
  const prevSlots = existing.slots || [];

  const names = glbMaterialNames(join(full, glb));
  const slots = names.map((key) => {
    const kept = prevSlots.find((s) => s.key === key);
    if (kept) return kept;
    return HARD.test(key)
      ? { key, label: titleCase(key), kind: "hard", finish: "walnut" }
      : { key, label: titleCase(key), kind: "fabric", repeatCm: 30 };
  });

  const piece = {
    id: dir,
    name: existing.name || titleCase(dir),
    dims: existing.dims || "",
    file: glb,
    ...(thumb ? { thumb } : {}),
    slots,
  };
  writeFileSync(manifestPath, JSON.stringify(piece, null, 2) + "\n");
  pieces.push(piece);
  console.log(`${dir}: ${slots.length} slots — ${names.join(", ")}`);
}

writeFileSync(join(ROOT, "index.json"), JSON.stringify({ pieces }, null, 2) + "\n");
console.log(`wrote index.json with ${pieces.length} piece(s)`);
