// Scans public/library/*/ for .glb files and writes index.json + per-piece piece.json.
// Run:  node scripts/scan-library.mjs
// Re-running keeps any labels/defaults you've edited in piece.json and only adds new slots.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "public", "library");
const HARD = /frame|leg|base|metal|wood|steel|brass|chrome|oak|walnut/i;

// Max's glTF exporter prefixes converted materials with "AdskMat" and some
// exporters append ".001"-style suffixes — strip both for display purposes.
const cleanName = (n) => n.replace(/^AdskMat/i, "").replace(/\.\d+$/, "").trim() || n;

function glbMaterialNames(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB (magic mismatch)");
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const mats = json.materials || [];
  // Only materials actually assigned to geometry — matches what the app sees.
  const used = new Set();
  let unassigned = 0;
  (json.meshes || []).forEach((m) => (m.primitives || []).forEach((p) => {
    if (p.material === undefined) unassigned++;
    else used.add(p.material);
  }));
  const names = [...new Set([...used].map((i) => mats[i]?.name || "Unnamed"))];
  // Warn when geometry using a material carries no UVs (exporter drops them
  // when no texture is applied in Max — swatches then render as one flat color).
  const noUV = new Set();
  (json.meshes || []).forEach((m) => (m.primitives || []).forEach((p) => {
    if (p.material !== undefined && !(p.attributes && "TEXCOORD_0" in p.attributes))
      noUV.add(mats[p.material]?.name || "Unnamed");
  }));
  noUV.forEach((n) => console.warn(`  WARNING: "${n}" geometry has no UV coordinates — apply any bitmap to that material's base color in Max and re-export`));
  mats.forEach((m, i) => {
    if (!used.has(i)) console.warn(`  note: material "${m.name || i}" is defined in the file but not assigned to any geometry`);
  });
  if (unassigned) console.warn(`  note: ${unassigned} mesh part(s) have no material at all (will show as "Unnamed")`);
  return names;
}

function titleCase(s) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const pieces = [];
function hasGlb(dir) { return readdirSync(dir).some((f) => f.toLowerCase().endsWith(".glb")); }

// Two levels: library/<category>/<piece>/ or library/<piece>/ (category "Unsorted")
const targets = [];
for (const top of readdirSync(ROOT)) {
  const full = join(ROOT, top);
  if (!statSync(full).isDirectory()) continue;
  if (hasGlb(full)) targets.push({ dir: top, path: top, category: "Unsorted" });
  else for (const sub of readdirSync(full)) {
    const subFull = join(full, sub);
    if (statSync(subFull).isDirectory() && hasGlb(subFull)) targets.push({ dir: sub, path: `${top}/${sub}`, category: top });
    else if (statSync(subFull).isDirectory()) console.warn(`skip ${top}/${sub}: no .glb`);
  }
}

for (const { dir, path, category } of targets) {
  const full = join(ROOT, path);
  const glb = readdirSync(full).find((f) => f.toLowerCase().endsWith(".glb"));
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
    const nice = cleanName(key);
    return HARD.test(nice)
      ? { key, label: titleCase(nice), kind: "hard", finish: "walnut" }
      : { key, label: titleCase(nice), kind: "fabric", repeatCm: 30 };
  });

  const piece = {
    id: path,
    path,
    category,
    name: existing.name || titleCase(dir),
    dims: existing.dims || "",
    file: glb,
    ...(thumb ? { thumb } : {}),
    slots,
  };
  writeFileSync(manifestPath, JSON.stringify(piece, null, 2) + "\n");
  pieces.push(piece);
  console.log(`${path}: ${slots.length} slots — ${names.join(", ")}`);
}

writeFileSync(join(ROOT, "index.json"), JSON.stringify({ pieces }, null, 2) + "\n");
console.log(`wrote index.json with ${pieces.length} piece(s)`);
