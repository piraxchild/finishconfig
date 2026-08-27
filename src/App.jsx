import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* ─────────────────────────────────────────────────────────────
   FINISH CONFIGURATOR
   UV convention: 1 UV unit = 1 metre. Every fabric slot's repeat
   is expressed in centimetres, so texture.repeat = 100 / repeatCm.
   In production, replace the procedural library below with GLBs
   exported from 3ds Max where each finish zone is its own named
   material. See buildPiece() and the LIBRARY manifest.
   ───────────────────────────────────────────────────────────── */

const T = {
  bg: "#E9E7E2",
  panel: "#F5F4F0",
  line: "#CFCBC3",
  ink: "#1E1E1C",
  mute: "#6F6B63",
  accent: "#2F5D62",
  accentInk: "#F2F4F3",
};

const HARD_FINISHES = [
  { id: "walnut", label: "Walnut", color: "#4A3323", rough: 0.55, metal: 0 },
  { id: "oak", label: "White oak", color: "#B69A72", rough: 0.6, metal: 0 },
  { id: "ash-black", label: "Ebonised ash", color: "#232120", rough: 0.5, metal: 0 },
  { id: "steel", label: "Blackened steel", color: "#2A2B2E", rough: 0.4, metal: 0.9 },
  { id: "brass", label: "Brushed brass", color: "#B8945A", rough: 0.35, metal: 1 },
  { id: "chrome", label: "Polished chrome", color: "#C9CBCE", rough: 0.15, metal: 1 },
];

/* Library manifest — in production this is index.json built from the folder scan. */
const LIBRARY = [
  {
    id: "sofa-03",
    name: "Sofa 03",
    dims: "220 × 95 × 78 cm",
    slots: [
      { key: "Seat", label: "Seat cushions", kind: "fabric", repeatCm: 30 },
      { key: "Back", label: "Back cushions", kind: "fabric", repeatCm: 30 },
      { key: "Pillow", label: "Throw pillows", kind: "fabric", repeatCm: 20 },
      { key: "Frame", label: "Base & legs", kind: "hard", finish: "walnut" },
    ],
  },
  {
    id: "lounge-01",
    name: "Lounge chair 01",
    dims: "82 × 88 × 74 cm",
    slots: [
      { key: "Seat", label: "Seat", kind: "fabric", repeatCm: 30 },
      { key: "Back", label: "Back", kind: "fabric", repeatCm: 30 },
      { key: "Frame", label: "Frame", kind: "hard", finish: "steel" },
    ],
  },
  {
    id: "ottoman-02",
    name: "Ottoman 02",
    dims: "70 × 70 × 42 cm",
    slots: [
      { key: "Top", label: "Top", kind: "fabric", repeatCm: 25 },
      { key: "Frame", label: "Legs", kind: "hard", finish: "brass" },
    ],
  },
];

/* ───────── geometry helpers ───────── */

// Box with real-world-scale UVs (1 uv = 1 m), like a properly unwrapped asset.
function box(w, h, d, slot, x = 0, y = 0, z = 0, radius = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    if (nx > 0.5) uv.setXY(i, pz, py);
    else if (ny > 0.5) uv.setXY(i, px, pz);
    else uv.setXY(i, px, py);
  }
  uv.needsUpdate = true;
  const m = new THREE.Mesh(g);
  m.position.set(x, y, z);
  m.userData.slot = slot;
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cyl(r, h, slot, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24));
  m.position.set(x, y, z);
  m.userData.slot = slot;
  m.castShadow = true;
  return m;
}

function buildPiece(id) {
  const g = new THREE.Group();
  if (id === "sofa-03") {
    g.add(box(2.2, 0.12, 0.95, "Frame", 0, 0.16, 0));
    for (let i = -1; i <= 1; i++) g.add(box(0.7, 0.16, 0.8, "Seat", i * 0.72, 0.3, 0.05));
    for (let i = -1; i <= 1; i++) {
      const b = box(0.7, 0.42, 0.16, "Back", i * 0.72, 0.58, -0.36);
      b.rotation.x = -0.12; g.add(b);
    }
    g.add(box(0.1, 0.34, 0.95, "Frame", -1.1, 0.39, 0));
    g.add(box(0.1, 0.34, 0.95, "Frame", 1.1, 0.39, 0));
    const p1 = box(0.42, 0.42, 0.12, "Pillow", -0.78, 0.6, -0.22); p1.rotation.z = 0.15; p1.rotation.x = -0.2; g.add(p1);
    const p2 = box(0.42, 0.42, 0.12, "Pillow", 0.78, 0.6, -0.22); p2.rotation.z = -0.15; p2.rotation.x = -0.2; g.add(p2);
    [[-1.0, -0.4], [1.0, -0.4], [-1.0, 0.4], [1.0, 0.4]].forEach(([x, z]) => g.add(cyl(0.025, 0.1, "Frame", x, 0.05, z)));
  } else if (id === "lounge-01") {
    g.add(box(0.72, 0.14, 0.7, "Seat", 0, 0.38, 0.05));
    const back = box(0.72, 0.5, 0.12, "Back", 0, 0.66, -0.28); back.rotation.x = -0.25; g.add(back);
    [[-0.34, 0.3], [0.34, 0.3], [-0.34, -0.3], [0.34, -0.3]].forEach(([x, z]) => {
      const l = cyl(0.014, 0.4, "Frame", x, 0.2, z); l.rotation.z = x < 0 ? 0.08 : -0.08; g.add(l);
    });
    g.add(box(0.76, 0.03, 0.03, "Frame", 0, 0.3, 0.3));
    g.add(box(0.76, 0.03, 0.03, "Frame", 0, 0.3, -0.3));
    g.add(box(0.03, 0.03, 0.66, "Frame", -0.37, 0.3, 0));
    g.add(box(0.03, 0.03, 0.66, "Frame", 0.37, 0.3, 0));
  } else {
    g.add(box(0.7, 0.24, 0.7, "Top", 0, 0.3, 0));
    [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(([x, z]) => g.add(cyl(0.02, 0.18, "Frame", x, 0.09, z)));
  }
  return g;
}

/* ───────── materials ───────── */

function fabricMaterial(cfg, texture) {
  const m = new THREE.MeshStandardMaterial({ color: cfg.tint || "#9A9A96", roughness: 0.92, metalness: 0 });
  if (texture) {
    m.map = texture;
    m.color.set(cfg.tint || "#ffffff");
  }
  return m;
}
function hardMaterial(finishId) {
  const f = HARD_FINISHES.find((x) => x.id === finishId) || HARD_FINISHES[0];
  return new THREE.MeshStandardMaterial({ color: f.color, roughness: f.rough, metalness: f.metal });
}

/* ───────── viewport ───────── */

function Viewport({ piece, config, onReady }) {
  const mount = useRef();
  const state = useRef({});

  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(T.bg);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b3a8, 0.9));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.3);
    key.position.set(2.5, 4, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 6;
    key.shadow.camera.left = key.shadow.camera.bottom = -3;
    key.shadow.camera.right = key.shadow.camera.top = 3;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdde8ff, 0.5);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.22 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // orbit
    const orbit = { theta: 0.6, phi: 1.15, dist: 3.2, target: new THREE.Vector3(0, 0.4, 0), drag: false, lx: 0, ly: 0 };
    const updateCam = () => {
      const s = Math.sin(orbit.phi);
      camera.position.set(
        orbit.target.x + orbit.dist * s * Math.sin(orbit.theta),
        orbit.target.y + orbit.dist * Math.cos(orbit.phi),
        orbit.target.z + orbit.dist * s * Math.cos(orbit.theta)
      );
      camera.lookAt(orbit.target);
    };
    const onDown = (e) => { orbit.drag = true; orbit.lx = e.clientX; orbit.ly = e.clientY; };
    const onUp = () => (orbit.drag = false);
    const onMove = (e) => {
      if (!orbit.drag) return;
      orbit.theta -= (e.clientX - orbit.lx) * 0.006;
      orbit.phi = Math.min(1.5, Math.max(0.25, orbit.phi - (e.clientY - orbit.ly) * 0.006));
      orbit.lx = e.clientX; orbit.ly = e.clientY;
      updateCam();
    };
    const onWheel = (e) => { e.preventDefault(); orbit.dist = Math.min(8, Math.max(1.2, orbit.dist * (1 + e.deltaY * 0.001))); updateCam(); };
    const c = renderer.domElement;
    c.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    c.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    updateCam();

    let raf;
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera); };
    loop();

    state.current = { renderer, scene, camera, orbit, updateCam, model: null };
    onReady(state.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      c.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      c.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  // swap model
  useEffect(() => {
    const s = state.current;
    if (!s.scene) return;
    if (s.model) s.scene.remove(s.model);
    s.model = buildPiece(piece.id);
    s.scene.add(s.model);
    const bb = new THREE.Box3().setFromObject(s.model);
    const size = bb.getSize(new THREE.Vector3());
    s.orbit.target.set(0, size.y / 2, 0);
    s.orbit.dist = Math.max(size.x, size.y, size.z) * 1.9;
    s.updateCam();
  }, [piece.id]);

  // apply materials
  useEffect(() => {
    const s = state.current;
    if (!s.model) return;
    const cache = {};
    s.model.traverse((o) => {
      if (!o.isMesh || !o.userData.slot) return;
      const key = o.userData.slot;
      if (!cache[key]) {
        const cfg = config[key];
        if (cfg.kind === "hard") cache[key] = hardMaterial(cfg.finish);
        else cache[key] = fabricMaterial(cfg, cfg.texture);
      }
      if (o.material !== cache[key]) o.material = cache[key];
    });
  }, [config, piece.id]);

  return <div ref={mount} style={{ position: "absolute", inset: 0, cursor: "grab" }} />;
}

/* ───────── texture creation ───────── */

function makeTexture(image, cfg) {
  const tex = new THREE.Texture(image);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = cfg.mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  const rep = 100 / Math.max(2, cfg.repeatCm);
  tex.repeat.set(rep, rep);
  tex.rotation = (cfg.rotation * Math.PI) / 180;
  tex.center.set(0.5, 0.5);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/* ───────── UI ───────── */

const label = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.mute, fontFamily: "ui-monospace, Menlo, monospace" };

function Slider({ value, min, max, step, onChange, unit, name }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 52px", alignItems: "center", gap: 10, marginTop: 8 }}>
      <span style={label}>{name}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ accentColor: T.accent, width: "100%" }} />
      <span style={{ fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}{unit}</span>
    </div>
  );
}

function SlotCard({ slot, cfg, onChange, active, onFocus }) {
  const fileRef = useRef();
  const onFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => onChange({ image: img, imageUrl: url, imageName: file.name });
    img.src = url;
  };

  return (
    <div
      onClick={onFocus}
      style={{ background: T.panel, border: `1px solid ${active ? T.accent : T.line}`, padding: 14, marginBottom: 10, cursor: "default" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif", fontSize: 17 }}>{slot.label}</div>
        <span style={label}>{slot.kind === "hard" ? "hard finish" : "fabric"}</span>
      </div>

      {slot.kind === "hard" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 10 }}>
          {HARD_FINISHES.map((f) => (
            <button
              key={f.id}
              onClick={() => onChange({ finish: f.id })}
              style={{
                border: `1px solid ${cfg.finish === f.id ? T.accent : T.line}`,
                background: "transparent", padding: 6, textAlign: "left", cursor: "pointer", fontSize: 11, color: T.ink,
              }}
            >
              <div style={{ height: 22, background: f.color, marginBottom: 5 }} />
              {f.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current.click()}
            style={{
              marginTop: 10, height: 92, border: `1px dashed ${T.line}`, display: "grid", placeItems: "center",
              cursor: "pointer", overflow: "hidden", position: "relative",
              backgroundImage: cfg.imageUrl ? `url(${cfg.imageUrl})` : "none",
              backgroundSize: `${Math.max(12, cfg.repeatCm * 2)}px`,
              backgroundColor: cfg.tint || "#DAD8D2",
            }}
          >
            {!cfg.imageUrl && <span style={{ ...label, textTransform: "none", letterSpacing: 0 }}>Drop a vendor scan here, or click to choose</span>}
            {cfg.imageUrl && (
              <span style={{ position: "absolute", bottom: 4, right: 6, fontSize: 10, background: "rgba(245,244,240,.85)", padding: "2px 5px", maxWidth: "85%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cfg.imageName}
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files[0])} />
          </div>
          <Slider name="Repeat" value={cfg.repeatCm} min={5} max={120} step={1} unit=" cm" onChange={(v) => onChange({ repeatCm: v })} />
          <Slider name="Rotation" value={cfg.rotation} min={0} max={180} step={1} unit="°" onChange={(v) => onChange({ rotation: v })} />
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10 }}>
            <label style={{ ...label, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={cfg.mirror} onChange={(e) => onChange({ mirror: e.target.checked })} style={{ accentColor: T.accent }} />
              Mirror tiles
            </label>
            <label style={{ ...label, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="color" value={cfg.tint || "#ffffff"} onChange={(e) => onChange({ tint: e.target.value })} style={{ width: 22, height: 18, padding: 0, border: `1px solid ${T.line}`, background: "none" }} />
              Tint
            </label>
            {cfg.imageUrl && (
              <button onClick={() => onChange({ image: null, imageUrl: null, imageName: null, texture: null })} style={{ ...label, marginLeft: "auto", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function initConfig(piece) {
  const c = {};
  piece.slots.forEach((s) => {
    c[s.key] = s.kind === "hard"
      ? { kind: "hard", finish: s.finish }
      : { kind: "fabric", repeatCm: s.repeatCm, rotation: 0, mirror: false, tint: "#ffffff", image: null, imageUrl: null, imageName: null, texture: null };
  });
  return c;
}

export default function FinishConfigurator() {
  const [piece, setPiece] = useState(LIBRARY[0]);
  const [config, setConfig] = useState(() => initConfig(LIBRARY[0]));
  const [active, setActive] = useState(null);
  const three = useRef(null);

  const choosePiece = (p) => { setPiece(p); setConfig(initConfig(p)); setActive(null); };

  const updateSlot = useCallback((key, patch) => {
    setConfig((prev) => {
      const next = { ...prev[key], ...patch };
      if (next.kind === "fabric") {
        if (next.texture) next.texture.dispose();
        next.texture = next.image ? makeTexture(next.image, next) : null;
      }
      return { ...prev, [key]: next };
    });
  }, []);

  const snapshot = () => {
    const s = three.current;
    if (!s) return;
    const a = document.createElement("a");
    a.href = s.renderer.domElement.toDataURL("image/png");
    a.download = `${piece.id}-config.png`;
    a.click();
  };

  const exportSpec = () => {
    const spec = {
      piece: piece.id,
      slots: Object.fromEntries(
        Object.entries(config).map(([k, v]) => [k, v.kind === "hard"
          ? { finish: v.finish }
          : { sample: v.imageName, repeatCm: v.repeatCm, rotation: v.rotation, mirror: v.mirror, tint: v.tint }])
      ),
      exported: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${piece.id}-finishes.json`;
    a.click();
  };

  const fabricCount = piece.slots.filter((s) => s.kind === "fabric").length;
  const filled = piece.slots.filter((s) => s.kind === "fabric" && config[s.key]?.imageUrl).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 340px", height: "100vh", background: T.bg, color: T.ink, fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif", fontSize: 13 }}>
      {/* Library rail */}
      <aside style={{ borderRight: `1px solid ${T.line}`, padding: 18, overflowY: "auto" }}>
        <div style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif", fontSize: 22, lineHeight: 1.1, marginBottom: 4 }}>Finish<br />configurator</div>
        <div style={{ ...label, marginBottom: 18 }}>Library · {LIBRARY.length} pieces</div>
        {LIBRARY.map((p) => (
          <button
            key={p.id}
            onClick={() => choosePiece(p)}
            style={{
              display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: 10,
              background: piece.id === p.id ? T.ink : "transparent", color: piece.id === p.id ? T.panel : T.ink,
              border: `1px solid ${piece.id === p.id ? T.ink : T.line}`, cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 14 }}>{p.name}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{p.dims}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{p.slots.length} finish zones</div>
          </button>
        ))}
        <div style={{ ...label, textTransform: "none", letterSpacing: 0, marginTop: 24, lineHeight: 1.5 }}>
          Pieces appear here automatically when a model folder is added to the library.
        </div>
      </aside>

      {/* Viewport */}
      <main style={{ position: "relative" }}>
        <Viewport piece={piece} config={config} onReady={(s) => (three.current = s)} />
        <div style={{ position: "absolute", top: 18, left: 20, pointerEvents: "none" }}>
          <div style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif", fontSize: 28 }}>{piece.name}</div>
          <div style={label}>{filled} of {fabricCount} fabric zones assigned · drag to orbit, scroll to zoom</div>
        </div>
        <div style={{ position: "absolute", bottom: 18, left: 20, display: "flex", gap: 8 }}>
          <button onClick={snapshot} style={{ background: T.accent, color: T.accentInk, border: "none", padding: "9px 14px", cursor: "pointer", fontSize: 13 }}>Save image</button>
          <button onClick={exportSpec} style={{ background: "transparent", color: T.ink, border: `1px solid ${T.ink}`, padding: "9px 14px", cursor: "pointer", fontSize: 13 }}>Export finish spec</button>
        </div>
      </main>

      {/* Slots panel */}
      <aside style={{ borderLeft: `1px solid ${T.line}`, padding: 18, overflowY: "auto" }}>
        <div style={{ ...label, marginBottom: 12 }}>Finish zones</div>
        {piece.slots.map((s) => (
          <SlotCard
            key={s.key}
            slot={s}
            cfg={config[s.key]}
            active={active === s.key}
            onFocus={() => setActive(s.key)}
            onChange={(patch) => updateSlot(s.key, patch)}
          />
        ))}
      </aside>
    </div>
  );
}
