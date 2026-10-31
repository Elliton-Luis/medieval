import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { plasterTexture, stoneTexture, thatchTexture, tileTexture, woodTexture } from "./textures.js";
import { makeRandom } from "./utils.js";

// Casas medievais com colisores por parede, vãos reais (porta e janelas), enxaimel,
// telhado com beiral, interior mobiliado e peças destrutíveis.

let shared = null;
function materials() {
  if (shared) return shared;
  const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1, metalness: 0, flatShading: true, ...extra });
  const ghost = (map) => new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1, flatShading: true, transparent: true, opacity: 0.16, depthWrite: false });
  shared = {
    stone: std(stoneTexture()),
    wood: std(woodTexture()),
    plaster: std(plasterTexture()),
    thatch: std(thatchTexture(), { side: THREE.DoubleSide }),
    tile: std(tileTexture(), { side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: "#2b2724", roughness: 0.7, metalness: 0.5, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ color: "#2c3a44", emissive: "#e8a24c", emissiveIntensity: 0.5, roughness: 0.4, flatShading: true }),
    ghostPlaster: ghost(plasterTexture()),
    ghostWood: ghost(woodTexture()),
    furnWood: new THREE.MeshStandardMaterial({ map: woodTexture(), color: "#b8905e", roughness: 1, flatShading: true }),
    furnDark: new THREE.MeshStandardMaterial({ map: woodTexture(), color: "#6f5238", roughness: 1, flatShading: true }),
    cloth: new THREE.MeshStandardMaterial({ color: "#d9d1bb", roughness: 1, flatShading: true }),
    clay: new THREE.MeshStandardMaterial({ color: "#a65c3c", roughness: 0.9, flatShading: true }),
    fire: new THREE.MeshStandardMaterial({ color: "#ff8a3a", emissive: "#ff6a1a", emissiveIntensity: 1.6, flatShading: true }),
  };
  return shared;
}

const PLASTER = ["#e8dcc0", "#dccaa6", "#efe5cd", "#d5bd94", "#e2d2b4", "#cdb690"];
const TIMBER = ["#3d2e22", "#4b3727", "#33281e", "#54402c"];
const THATCH = ["#c9b06a", "#b99f58", "#d2bb78"];
const TILE = ["#9a5238", "#8a4630", "#a8603f", "#7a3d2c"];
const SHUTTER = ["#5f8250", "#7a4f3c", "#4f6785", "#8a4038", "#6a5a34"];

const _color = new THREE.Color();
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);

// Caixa com UV proporcional ao tamanho, cor de vértice e AO leve na base.
function boxGeometry(w, h, d, x, y, z, color, random, rot = null, ao = 0.34) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uv.getX(i) * sizes[face][0] * 0.5, uv.getY(i) * sizes[face][1] * 0.5);
    }
  }
  if (rot) _euler.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  else _euler.set(0, 0, 0);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _matrix.compose(_pos, _quat, _one);
  g.applyMatrix4(_matrix);
  const tone = 0.92 + random() * 0.14;
  _color.set(color);
  const positions = g.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const height = positions.getY(i);
    const f = tone * (1 - ao * Math.max(0, 1 - Math.max(0, height) / 1.1));
    colors[i * 3] = _color.r * f;
    colors[i * 3 + 1] = _color.g * f;
    colors[i * 3 + 2] = _color.b * f;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function furnMesh(material, w, h, d, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  parent.add(mesh);
  return mesh;
}

export function createHouse(scene, world, opts) {
  const M = materials();
  const random = makeRandom(opts.seed * 2654435761);
  const turns = ((Math.round(opts.ry / (Math.PI / 2)) % 4) + 4) % 4;
  const ry = turns * (Math.PI / 2);
  const c = [1, 0, -1, 0][turns];
  const s = [0, 1, 0, -1][turns];
  const W = opts.width ?? 5.4 + random() * 2.4;
  const D = opts.depth ?? 4.8 + random() * 2.0;
  const t = 0.28;
  const H = 2.85 + random() * 0.45;
  const pitch = 1.5 + random() * 0.9;
  const thatch = random() < 0.5;
  const plasterColor = PLASTER[Math.floor(random() * PLASTER.length)];
  const timberColor = TIMBER[Math.floor(random() * TIMBER.length)];
  const roofColor = thatch ? THATCH[Math.floor(random() * THATCH.length)] : TILE[Math.floor(random() * TILE.length)];
  const shutterColor = SHUTTER[Math.floor(random() * SHUTTER.length)];
  const side = random() < 0.5 ? -1 : 1;
  const doorX = (random() - 0.5) * (W * 0.3);
  const porch = random() < 0.4;

  const toWorld = (lx, lz) => ({ x: opts.x + lx * c + lz * s, z: opts.z - lx * s + lz * c });
  const worldRect = (x0, x1, z0, z1) => {
    const a = toWorld(x0, z0);
    const b = toWorld(x1, z1);
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
  };

  // piso: o ponto mais alto do terreno sob a casa e cálculo do desnível até o ponto mais baixo
  let floorY = -Infinity;
  let minGroundY = Infinity;
  for (const lx of [-W / 2 - 0.5, 0, W / 2 + 0.5]) {
    for (const lz of [-D / 2 - 0.6, 0, D / 2 + 0.8]) {
      const p = toWorld(lx, lz);
      const h = world.heightAt(p.x, p.z);
      if (h > floorY) floorY = h;
      if (h < minGroundY) minGroundY = h;
    }
  }
  floorY += 0.06;
  const foundationDepth = Math.max(2.8, floorY - minGroundY + 2.2);
  const footprint = worldRect(-W / 2 - 0.18, W / 2 + 0.18, -D / 2 - 0.18, D / 2 + 0.18);
  world.floors.push({ ...footprint, y: floorY });
  // patamar/degrau de pedra na entrada para transição suave de altura
  const stepFootprint = worldRect(doorX - 0.9, doorX + 0.9, D / 2, D / 2 + 0.72);
  world.floors.push({ ...stepFootprint, y: floorY - 0.04 });

  const lists = { stone: [], wood: [], plaster: [], roof: [], ceiling: [], dark: [], glass: [] };
  const add = (list, w, h, d, x, y, z, color, rot, ao) => lists[list].push(boxGeometry(w, h, d, x, y, z, color, random, rot, ao));
  const colliders = [];
  const addCollider = (x0, x1, z0, z1, y0, y1, flags) => {
    const r = worldRect(x0, x1, z0, z1);
    const box = world.addBox(r.minX, r.maxX, r.minZ, r.maxZ, floorY + y0, floorY + y1, flags);
    colliders.push(box);
    return box;
  };

  // --- paredes com aberturas ---
  const openings = { front: [], back: [], left: [], right: [] };
  const door = { c: doorX, w: 1.1, bottom: 0, top: 2.15, type: "door" };
  openings.front.push(door);
  const windowAt = (wall, center, w = 0.95) => openings[wall].push({ c: center, w, bottom: 0.95, top: 1.95, type: "window" });
  windowAt("front", doorX > 0 ? -W * 0.3 : W * 0.3);
  if (W > 6.6) windowAt("front", doorX > 0 ? W * 0.32 : -W * 0.32);
  windowAt("back", 0);
  windowAt("left", 0);
  windowAt("right", 0);

  const walls = {
    front: { axis: "x", fixed: D / 2, out: 1, from: -W / 2, to: W / 2 },
    back: { axis: "x", fixed: -D / 2, out: -1, from: -W / 2, to: W / 2 },
    right: { axis: "z", fixed: W / 2, out: 1, from: -D / 2 + t, to: D / 2 - t },
    left: { axis: "z", fixed: -W / 2, out: -1, from: -D / 2 + t, to: D / 2 - t },
  };

  const wallBox = (wall, a0, a1, y0, y1, listName, color, extra = 0, inset = 0) => {
    const mid = wall.fixed - wall.out * (t / 2);
    const th = t + extra;
    const center = mid + wall.out * (extra / 2);
    if (wall.axis === "x") add(listName, a1 - a0, y1 - y0, th, (a0 + a1) / 2, (y0 + y1) / 2, center, color);
    else add(listName, th, y1 - y0, a1 - a0, center, (y0 + y1) / 2, (a0 + a1) / 2, color);
  };
  const wallCollider = (wall, a0, a1, y0, y1, flags) => {
    const lo = Math.min(wall.fixed, wall.fixed - wall.out * t);
    const hi = Math.max(wall.fixed, wall.fixed - wall.out * t);
    if (wall.axis === "x") return addCollider(a0, a1, lo, hi, y0, y1, flags);
    return addCollider(lo, hi, a0, a1, y0, y1, flags);
  };
  // objeto fino sobre a parede exterior (enxaimel, janela, etc.)
  const outerBox = (wall, a, y, w, h, depth, offset, listName, color, rot) => {
    const p = wall.fixed + wall.out * (depth / 2 + offset);
    if (wall.axis === "x") add(listName, w, h, depth, a, y, p, color, rot, 0.1);
    else add(listName, depth, h, w, p, y, a, color, rot, 0.1);
  };

  // Colisores de movimento herméticos nas 4 paredes (impossível entrar senão pela porta aberta)
  const wallThick = t + 0.08;
  addCollider(-W / 2 - 0.12, W / 2 + 0.12, -D / 2 - 0.08, -D / 2 + wallThick, -foundationDepth, H, { move: true, shot: false, cam: true });
  addCollider(-W / 2 - 0.08, -W / 2 + wallThick, -D / 2 - 0.12, D / 2 + 0.12, -foundationDepth, H, { move: true, shot: false, cam: true });
  addCollider(W / 2 - wallThick, W / 2 + 0.08, -D / 2 - 0.12, D / 2 + 0.12, -foundationDepth, H, { move: true, shot: false, cam: true });
  addCollider(-W / 2 - 0.12, doorX - door.w / 2, D / 2 - wallThick, D / 2 + 0.08, -foundationDepth, H, { move: true, shot: false, cam: true });
  addCollider(doorX + door.w / 2, W / 2 + 0.12, D / 2 - wallThick, D / 2 + 0.08, -foundationDepth, H, { move: true, shot: false, cam: true });

  let doorWorld = null;
  const windows = [];
  for (const name of Object.keys(walls)) {
    const wall = walls[name];
    const list = openings[name].slice().sort((a, b) => a.c - b.c);
    const pieces = [];
    let cursor = wall.from;
    for (const o of list) {
      const a0 = o.c - o.w / 2;
      const a1 = o.c + o.w / 2;
      if (a0 > cursor) pieces.push([cursor, a0, 0, H, "full"]);
      if (o.bottom > 0) pieces.push([a0, a1, 0, o.bottom, "below"]);
      pieces.push([a0, a1, o.top, H, "above"]);
      cursor = a1;
    }
    if (cursor < wall.to) pieces.push([cursor, wall.to, 0, H, "full"]);

    for (const [a0, a1, y0, y1, kind] of pieces) {
      // Peças acima da porta (kind === "above") não bloqueiam movimento no chão, só tiros e câmera
      wallCollider(wall, a0, a1, y0, y1, { move: kind !== "above", shot: true, cam: true });
      const stoneTop = Math.min(y1, 0.55);
      if (y0 < 0.55) wallBox(wall, a0, a1, y0, stoneTop, "stone", "#b9b3a6", 0.05);
      if (y1 > 0.55) wallBox(wall, a0, a1, Math.max(y0, 0.55), y1, "plaster", plasterColor);
    }

    // enxaimel: vigas aparentes sobre o reboco
    const post = 0.14;
    const frameDepth = 0.06;
    const spans = [];
    let sc = wall.from;
    for (const o of list) {
      if (o.c - o.w / 2 > sc) spans.push([sc, o.c - o.w / 2]);
      sc = o.c + o.w / 2;
    }
    if (sc < wall.to) spans.push([sc, wall.to]);
    const beamAt = (y) => outerBox(wall, (wall.from + wall.to) / 2, y, wall.to - wall.from, 0.13, frameDepth, 0.0, "wood", timberColor);
    beamAt(0.58);
    beamAt(H - 0.1);
    if (name === "front" || name === "back") {
      outerBox(wall, wall.from + post / 2, H / 2, post, H, frameDepth + 0.04, 0, "wood", timberColor);
      outerBox(wall, wall.to - post / 2, H / 2, post, H, frameDepth + 0.04, 0, "wood", timberColor);
    }
    for (const [a0, a1] of spans) {
      const len = a1 - a0;
      if (len < 0.9) continue;
      const bays = Math.max(1, Math.round(len / 1.7));
      const bay = len / bays;
      for (let i = 0; i <= bays; i++) {
        const a = a0 + i * bay;
        if (a <= wall.from + 0.05 || a >= wall.to - 0.05) continue;
        outerBox(wall, a, H / 2, post, H - 0.1, frameDepth, 0, "wood", timberColor);
      }
      for (let i = 0; i < bays; i++) {
        const mid = a0 + (i + 0.5) * bay;
        const run = bay - 0.1;
        const rise = H - 0.95;
        const length = Math.hypot(run, rise);
        const angle = Math.atan2(rise, run) * (i % 2 ? -1 : 1);
        // diagonal: gira em torno do eixo normal à parede
        if (wall.axis === "x") outerBox(wall, mid, 0.62 + rise / 2, length, 0.1, frameDepth, 0.0, "wood", timberColor, [0, 0, angle]);
        else outerBox(wall, mid, 0.62 + rise / 2, length, 0.1, frameDepth, 0.0, "wood", timberColor, [angle, 0, 0]);
      }
    }

    // aberturas: portal, janela, vidro, venezianas
    for (const o of list) {
      const wc = o.c;
      const jambH = o.top - o.bottom;
      outerBox(wall, wc - o.w / 2 - 0.06, o.bottom + jambH / 2, 0.12, jambH, 0.1, 0.01, "wood", timberColor);
      outerBox(wall, wc + o.w / 2 + 0.06, o.bottom + jambH / 2, 0.12, jambH, 0.1, 0.01, "wood", timberColor);
      outerBox(wall, wc, o.top + 0.06, o.w + 0.3, 0.14, 0.1, 0.01, "wood", timberColor);
      if (o.type === "window") {
        outerBox(wall, wc, o.bottom - 0.05, o.w + 0.3, 0.1, 0.16, 0.0, "stone", "#a9a396");
        const gp = wall.fixed - wall.out * (t / 2);
        if (wall.axis === "x") add("glass", o.w, jambH, 0.05, wc, o.bottom + jambH / 2, gp, "#ffffff", null, 0);
        else add("glass", 0.05, jambH, o.w, gp, o.bottom + jambH / 2, wc, "#ffffff", null, 0);
        outerBox(wall, wc, o.bottom + jambH / 2, 0.05, jambH, 0.03, -0.12, "wood", timberColor);
        outerBox(wall, wc, o.bottom + jambH / 2, o.w, 0.05, 0.03, -0.12, "wood", timberColor);
        // venezianas abertas, coladas à parede
        for (const sd of [-1, 1]) {
          outerBox(wall, wc + sd * (o.w / 2 + 0.3), o.bottom + jambH / 2, 0.5, jambH, 0.05, 0.02, "wood", shutterColor);
        }
        const wp = wall.axis === "x" ? toWorld(wc, wall.fixed) : toWorld(wall.fixed, wc);
        windows.push({ x: wp.x, z: wp.z });
      } else {
        const wp = wall.axis === "x" ? toWorld(wc, wall.fixed + 0.3) : toWorld(wall.fixed + 0.3, wc);
        doorWorld = { x: wp.x, z: wp.z };
      }
    }
  }

  // Fundação / terreno de pedras sólido sob toda a casa e degraus até o chão (nunca flutua)
  add("stone", W + 0.44, foundationDepth + 0.04, D + 0.44, 0, -foundationDepth / 2 + 0.02, 0, "#9e988c", null, 0.25);
  add("stone", W + 0.68, Math.max(1.2, foundationDepth - 0.2), D + 0.68, 0, -foundationDepth / 2 - 0.1, 0, "#8d877b", null, 0.3);
  // Soleira e escada de pedra na porta até o chão
  add("stone", 1.65, foundationDepth + 0.14, 0.62, doorX, -foundationDepth / 2 + 0.07, D / 2 + 0.34, "#b4aea0", null, 0.12);
  add("stone", 1.85, foundationDepth - 0.04, 0.52, doorX, -foundationDepth / 2 - 0.02, D / 2 + 0.78, "#9c9689", null, 0.18);
  const plinth = (w, d, x, z) => add("stone", w, foundationDepth + 0.18, d, x, -foundationDepth / 2 + 0.09, z, "#a8a296", null, 0.2);
  const dl = doorX - 0.55;
  const dr = doorX + 0.55;
  plinth(dl + W / 2 + 0.2, 0.36, (-W / 2 - 0.1 + dl) / 2, D / 2 + 0.03);
  plinth(W / 2 + 0.1 - dr, 0.36, (dr + W / 2 + 0.1) / 2, D / 2 + 0.03);
  plinth(W + 0.24, 0.36, 0, -D / 2 - 0.03);
  plinth(0.36, D + 0.14, -W / 2 - 0.03, 0);
  plinth(0.36, D + 0.14, W / 2 + 0.03, 0);

  // piso e vigas do teto
  add("wood", W - 2 * t, 0.12, D - 2 * t, 0, 0.0, 0, "#9b7a52", null, 0);
  for (let i = -1; i <= 1; i++) add("ceiling", 0.2, 0.2, D - 2 * t, i * (W / 3), H - 0.15, 0, timberColor, null, 0);
  add("ceiling", W - 2 * t, 0.2, 0.2, 0, H - 0.15, 0, timberColor, null, 0);

  // --- telhado com beiral (cumeeira ao longo de x) ---
  const ovF = 0.6;
  const ovS = 0.4;
  const run = D / 2 + ovF;
  const rise = pitch + 0.12;
  const slopeLen = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const thick = thatch ? 0.34 : 0.14;
  for (const sd of [-1, 1]) {
    add("roof", W + 2 * ovS, thick, slopeLen + 0.05, 0, H - 0.1 + rise / 2 + 0.02, sd * run / 2, roofColor, [sd * angle, 0, 0], 0.15);
  }
  add("roof", W + 2 * ovS + 0.1, 0.16, 0.34, 0, H + pitch + 0.1, 0, thatch ? "#a8904e" : "#6d3a2c", null, 0);
  // empenas triangulares de reboco com vigas
  const shape = new THREE.Shape();
  shape.moveTo(-D / 2, 0);
  shape.lineTo(D / 2, 0);
  shape.lineTo(0, pitch + 0.05);
  shape.closePath();
  for (const sd of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.translate(sd > 0 ? W / 2 - t : -W / 2, H - 0.02, 0);
    const uvs = g.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 0.5, uvs.getY(i) * 0.5);
    _color.set(plasterColor);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = _color.r;
      colors[i + 1] = _color.g;
      colors[i + 2] = _color.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    lists.plaster.push(g.index ? g.toNonIndexed() : g);
    add("wood", 0.12, pitch + 0.1, 0.12, sd * (W / 2 + 0.03), H + pitch / 2, 0, timberColor, [0, 0, 0], 0.05);
  }
  // chaminé externa (vai até o fundo da fundação de pedra) e lareira interna
  const hx = side * W * 0.22;
  const chimTop = H + pitch + 0.55;
  const chimH = chimTop + foundationDepth;
  add("stone", 0.95, chimH, 0.75, hx, (chimTop - foundationDepth) / 2, -D / 2 - 0.25, "#9a948a", null, 0.3);
  add("stone", 1.1, 0.16, 0.9, hx, H + pitch + 0.6, -D / 2 - 0.25, "#7e786f", null, 0);
  add("stone", 1.4, 1.15, 0.75, hx, 0.575, -D / 2 + t + 0.37, "#a39d90", null, 0.3);
  add("dark", 0.8, 0.62, 0.12, hx, 0.45, -D / 2 + t + 0.76, "#ffffff", null, 0);
  addCollider(hx - 0.48, hx + 0.48, -D / 2 - 0.62, -D / 2 + 0.12, -foundationDepth, chimTop, { move: true, shot: true, cam: true });
  addCollider(hx - 0.7, hx + 0.7, -D / 2 + t, -D / 2 + t + 0.75, 0, 1.2, { move: true, shot: true, cam: false });

  // --- meshes mesclados ---
  const group = new THREE.Group();
  group.position.set(opts.x, floorY, opts.z);
  group.rotation.y = ry;
  scene.add(group);
  const meshes = {};
  const build = (name, material, castShadow = false) => {
    if (lists[name].length === 0) return null;
    const merged = mergeGeometries(lists[name].map((g) => (g.index ? g.toNonIndexed() : g)), false);
    for (const g of lists[name]) g.dispose();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    group.add(mesh);
    meshes[name] = mesh;
    return mesh;
  };
  build("stone", M.stone, true);
  build("wood", M.wood, true);
  build("plaster", M.plaster, true);
  build("roof", thatch ? M.thatch : M.tile, true);
  build("ceiling", M.wood);
  build("dark", M.dark);
  build("glass", M.glass);

  // --- porta animada ---
  const hinge = doorX - door.w / 2;
  const pivot = new THREE.Group();
  pivot.position.set(hinge, 0, D / 2 - t / 2);
  group.add(pivot);
  const doorMat = M.furnWood;
  const panel = furnMesh(doorMat, door.w - 0.04, 2.1, 0.08, door.w / 2, 1.05, 0, pivot);
  for (const y of [0.45, 1.7]) {
    furnMesh(M.dark, 0.16, 0.12, 0.1, 0.12, y, 0.01, pivot);
    furnMesh(M.dark, door.w - 0.2, 0.08, 0.1, door.w / 2, y, 0, pivot);
  }
  furnMesh(M.dark, 0.06, 0.06, 0.14, door.w - 0.14, 1.05, 0, pivot);
  const doorBox = addCollider(doorX - door.w / 2 - 0.06, doorX + door.w / 2 + 0.06, D / 2 - wallThick, D / 2 + 0.08, -0.2, door.top, { move: true, shot: true, cam: true });
  const doorState = { pivot, box: doorBox, open: false, angle: 0, target: 0, x: doorWorld.x, z: doorWorld.z };

  // --- mobília ---
  const props = [];
  const px = (lx, lz) => toWorld(lx, lz);
  const innerX = W / 2 - t;
  const innerZ = D / 2 - t;
  const registerProp = (mesh, box, kind, hp, lx, lz, h, loot = null) => {
    const p = px(lx, lz);
    props.push({ mesh, box, kind, hp, x: p.x, z: p.z, y: floorY + h / 2, h, radius: 0.55, loot, broken: false });
  };

  // cama
  const bed = new THREE.Group();
  const bedX = -side * (innerX - 0.6);
  const bedZ = -innerZ + 1.15;
  bed.position.set(bedX, 0, bedZ);
  furnMesh(M.furnDark, 1.0, 0.32, 2.1, 0, 0.26, 0, bed);
  furnMesh(M.cloth, 0.9, 0.16, 1.95, 0, 0.5, 0, bed);
  const blanket = new THREE.MeshStandardMaterial({ color: SHUTTER[Math.floor(random() * SHUTTER.length)], roughness: 1, flatShading: true });
  furnMesh(blanket, 0.95, 0.12, 1.1, 0, 0.6, 0.4, bed);
  furnMesh(M.cloth, 0.6, 0.12, 0.35, 0, 0.62, -0.78, bed);
  furnMesh(M.furnDark, 1.0, 0.7, 0.1, 0, 0.5, -1.08, bed);
  group.add(bed);
  const bedBox = addCollider(bedX - 0.5, bedX + 0.5, bedZ - 1.05, bedZ + 1.05, 0, 0.7, { move: true, shot: true, cam: false });
  const bedWorld = px(bedX, bedZ);

  // baú com tampa articulada
  const chest = new THREE.Group();
  const chestX = -side * (innerX - 0.5);
  const chestZ = innerZ - 0.5;
  chest.position.set(chestX, 0, chestZ);
  furnMesh(M.furnDark, 0.9, 0.45, 0.55, 0, 0.225, 0, chest);
  furnMesh(M.dark, 0.92, 0.07, 0.57, 0, 0.35, 0, chest);
  const lid = new THREE.Group();
  lid.position.set(0, 0.45, -0.27);
  chest.add(lid);
  furnMesh(M.furnWood, 0.9, 0.14, 0.55, 0, 0.07, 0.27, lid);
  furnMesh(M.dark, 0.1, 0.1, 0.06, 0, 0.0, 0.56, lid);
  group.add(chest);
  const chestBox = addCollider(chestX - 0.45, chestX + 0.45, chestZ - 0.28, chestZ + 0.28, 0, 0.6, { move: true, shot: true, cam: false });
  const chestWorld = px(chestX, chestZ);
  const chestState = { lid, opened: false, x: chestWorld.x, z: chestWorld.z, box: chestBox, openAmount: 0 };

  // mesa e bancos (destrutíveis)
  const tableX = -side * 0.3;
  const tableZ = 0.15;
  const table = new THREE.Group();
  table.position.set(tableX, 0, tableZ);
  furnMesh(M.furnWood, 1.3, 0.08, 0.8, 0, 0.84, 0, table);
  for (const [lx, lz] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]]) furnMesh(M.furnDark, 0.09, 0.8, 0.09, lx, 0.4, lz, table);
  group.add(table);
  const tableBox = addCollider(tableX - 0.65, tableX + 0.65, tableZ - 0.4, tableZ + 0.4, 0, 0.9, { move: true, shot: true, cam: false });
  registerProp(table, tableBox, "mesa", 3, tableX, tableZ, 0.9);
  const seats = [];
  for (const sd of [-1, 1]) {
    const bench = new THREE.Group();
    const bz = tableZ + sd * 0.78;
    bench.position.set(tableX, 0, bz);
    furnMesh(M.furnWood, 1.15, 0.07, 0.3, 0, 0.45, 0, bench);
    for (const lx of [-0.45, 0.45]) furnMesh(M.furnDark, 0.08, 0.43, 0.26, lx, 0.22, 0, bench);
    group.add(bench);
    const benchBox = addCollider(tableX - 0.58, tableX + 0.58, bz - 0.16, bz + 0.16, 0, 0.5, { move: false, shot: true, cam: false });
    registerProp(bench, benchBox, "banco", 2, tableX, bz, 0.5);
    const seatW = px(tableX, bz);
    seats.push({
      x: seatW.x,
      z: seatW.z,
      yaw: ry + (sd > 0 ? Math.PI : 0),
      isChurchPew: false,
      label: "E · sentar no banco",
    });
  }

  // estante com potes
  const shelfX = side * (innerX - 0.22);
  const shelfZ = 0.4;
  const shelf = new THREE.Group();
  shelf.position.set(shelfX, 0, shelfZ);
  furnMesh(M.furnDark, 0.36, 1.9, 1.3, 0, 0.95, 0, shelf);
  for (const y of [0.5, 1.0, 1.5]) furnMesh(M.furnWood, 0.42, 0.05, 1.34, -side * 0.04, y, 0, shelf);
  group.add(shelf);
  addCollider(shelfX - 0.2, shelfX + 0.2, shelfZ - 0.66, shelfZ + 0.66, 0, 1.9, { move: true, shot: true, cam: false });
  for (const y of [0.5, 1.0, 1.5]) {
    for (const lz of [-0.4, 0, 0.4]) {
      if (random() < 0.3) continue;
      const pot = new THREE.Group();
      pot.position.set(shelfX - side * 0.1, y + 0.03, shelfZ + lz);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), M.clay);
      body.scale.set(1, 1.1, 1);
      body.position.y = 0.11;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.08, 6), M.clay);
      neck.position.y = 0.24;
      pot.add(body, neck);
      group.add(pot);
      const p = px(shelfX - side * 0.1, shelfZ + lz);
      props.push({ mesh: pot, box: null, kind: "pote", hp: 1, x: p.x, z: p.z, y: floorY + y + 0.15, h: 0.3, radius: 0.22, loot: random() < 0.35 ? { coins: [1, 3] } : null, broken: false });
    }
  }
  // tapete
  const rug = furnMesh(new THREE.MeshStandardMaterial({ color: SHUTTER[Math.floor(random() * SHUTTER.length)], roughness: 1 }), 1.7, 0.02, 1.2, tableX, 0.08, tableZ, group);
  rug.receiveShadow = true;
  // lenha na lareira
  const logs = furnMesh(M.fire, 0.5, 0.18, 0.18, hx, 0.3, -D / 2 + t + 0.55, group);

  const hw = px(hx, -D / 2 + t + 0.6);
  const torchSpots = [];
  const tl = px(doorX + (doorX > 0 ? -1.05 : 1.05), D / 2 + 0.14);
  torchSpots.push({ x: tl.x, y: floorY + 2.0, z: tl.z, nx: s, nz: c });

  const houseObj = {
    id: opts.id, type: opts.type || "home", name: opts.name || "Casa", price: opts.price || 0,
    x: opts.x, z: opts.z, ry, floorY, W, D, thatch,
    rect: worldRect(-innerX, innerX, -innerZ, innerZ),
    outer: footprint,
    group, meshes, M,
    door: doorState,
    chest: chestState,
    bed: { x: bedWorld.x, z: bedWorld.z, box: bedBox },
    hearth: { x: hw.x, y: floorY + 0.5, z: hw.z },
    props, seats, colliders, windows, torchSpots, doorFront: doorWorld,
    owner: null, burned: false, inside: false, enterCooldown: 0,
    logs,
    // pontos de palha do beiral, usados pelo fogo
    thatchSpots: thatch ? [toWorld(0, D / 2 + 0.6), toWorld(0, -D / 2 - 0.6)] : [],
  };
  houseObj.contains = (x, z) => x > houseObj.rect.minX && x < houseObj.rect.maxX && z > houseObj.rect.minZ && z < houseObj.rect.maxZ;
  return houseObj;
}

/**
 * Cria uma Igreja / Capela totalmente entrável com porta articulada, nave interna,
 * bancos (pews) para sentar e rezar, altar-mor sagrado, pia de água benta,
 * corda de sino funcional, caixa de ofertas e atril de escrituras.
 */
export function createChurchBuilding(scene, world, opts) {
  const M = materials();
  const random = makeRandom((opts.seed || 777) * 2654435761);
  const turns = ((Math.round((opts.ry || 0) / (Math.PI / 2)) % 4) + 4) % 4;
  const ry = turns * (Math.PI / 2);
  const c = [1, 0, -1, 0][turns];
  const s = [0, 1, 0, -1][turns];
  const W = 6.8;
  const D = 9.8;
  const t = 0.3;
  const H = 3.85;
  const pitch = 1.95;
  const plasterColor = "#e6dac0";
  const timberColor = "#3d2e22";
  const roofColor = "#5c4234";

  const toWorld = (lx, lz) => ({ x: opts.x + lx * c + lz * s, z: opts.z - lx * s + lz * c });
  const worldRect = (x0, x1, z0, z1) => {
    const a = toWorld(x0, z0);
    const b = toWorld(x1, z1);
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
  };

  let floorY = -Infinity;
  let minGroundY = Infinity;
  for (const lx of [-W / 2 - 0.5, 0, W / 2 + 0.5]) {
    for (const lz of [-D / 2 - 0.6, 0, D / 2 + 1.0]) {
      const p = toWorld(lx, lz);
      const h = world.heightAt(p.x, p.z);
      if (h > floorY) floorY = h;
      if (h < minGroundY) minGroundY = h;
    }
  }
  floorY += 0.06;
  const foundationDepth = Math.max(2.8, floorY - minGroundY + 2.2);
  const footprint = worldRect(-W / 2 - 0.2, W / 2 + 0.2, -D / 2 - 0.2, D / 2 + 0.2);
  world.floors.push({ ...footprint, y: floorY });
  const stepFootprint = worldRect(-1.2, 1.2, D / 2, D / 2 + 0.9);
  world.floors.push({ ...stepFootprint, y: floorY - 0.04 });

  const lists = { stone: [], wood: [], plaster: [], roof: [], ceiling: [], dark: [], glass: [] };
  const add = (list, w, h, d, x, y, z, color, rot, ao) => lists[list].push(boxGeometry(w, h, d, x, y, z, color, random, rot, ao));
  const colliders = [];
  const addCollider = (x0, x1, z0, z1, y0, y1, flags) => {
    const r = worldRect(x0, x1, z0, z1);
    const box = world.addBox(r.minX, r.maxX, r.minZ, r.maxZ, floorY + y0, floorY + y1, flags);
    colliders.push(box);
    return box;
  };

  const doorW = 1.36;
  const doorTop = 2.45;
  const openings = {
    front: [{ c: 0, w: doorW, bottom: 0, top: doorTop, type: "door" }],
    back: [{ c: 0, w: 1.2, bottom: 1.5, top: 3.1, type: "window" }],
    left: [
      { c: -2.2, w: 0.85, bottom: 1.2, top: 2.8, type: "window" },
      { c: 1.2, w: 0.85, bottom: 1.2, top: 2.8, type: "window" },
    ],
    right: [
      { c: -2.2, w: 0.85, bottom: 1.2, top: 2.8, type: "window" },
      { c: 1.2, w: 0.85, bottom: 1.2, top: 2.8, type: "window" },
    ],
  };

  const walls = {
    front: { axis: "x", fixed: D / 2, out: 1, from: -W / 2, to: W / 2 },
    back: { axis: "x", fixed: -D / 2, out: -1, from: -W / 2, to: W / 2 },
    right: { axis: "z", fixed: W / 2, out: 1, from: -D / 2 + t, to: D / 2 - t },
    left: { axis: "z", fixed: -W / 2, out: -1, from: -D / 2 + t, to: D / 2 - t },
  };

  const wallBox = (wall, a0, a1, y0, y1, listName, color, extra = 0) => {
    const mid = wall.fixed - wall.out * (t / 2);
    const th = t + extra;
    const center = mid + wall.out * (extra / 2);
    if (wall.axis === "x") add(listName, a1 - a0, y1 - y0, th, (a0 + a1) / 2, (y0 + y1) / 2, center, color);
    else add(listName, th, y1 - y0, a1 - a0, center, (y0 + y1) / 2, (a0 + a1) / 2, color);
  };
  const wallCollider = (wall, a0, a1, y0, y1, flags) => {
    const lo = Math.min(wall.fixed, wall.fixed - wall.out * t);
    const hi = Math.max(wall.fixed, wall.fixed - wall.out * t);
    if (wall.axis === "x") return addCollider(a0, a1, lo, hi, y0, y1, flags);
    return addCollider(lo, hi, a0, a1, y0, y1, flags);
  };
  const outerBox = (wall, a, y, w, h, depth, offset, listName, color, rot) => {
    const p = wall.fixed + wall.out * (depth / 2 + offset);
    if (wall.axis === "x") add(listName, w, h, depth, a, y, p, color, rot, 0.1);
    else add(listName, depth, h, w, p, y, a, color, rot, 0.1);
  };

  const wallThick = t + 0.08;
  addCollider(-W / 2 - 0.12, W / 2 + 0.12, -D / 2 - 0.08, -D / 2 + wallThick, -foundationDepth, H, { move: true, shot: false, cam: true });
  addCollider(-W / 2 - 0.08, -W / 2 + wallThick, -D / 2 - 0.12, D / 2 + 0.12, -foundationDepth, H, { move: true, shot: false, cam: true });
  addCollider(W / 2 - wallThick, W / 2 + 0.08, -D / 2 - 0.12, D / 2 + 0.12, -foundationDepth, H, { move: true, shot: false, cam: true });
  addCollider(-W / 2 - 0.12, -doorW / 2, D / 2 - wallThick, D / 2 + 0.08, -foundationDepth, H, { move: true, shot: false, cam: true });
  addCollider(doorW / 2, W / 2 + 0.12, D / 2 - wallThick, D / 2 + 0.08, -foundationDepth, H, { move: true, shot: false, cam: true });

  let doorWorld = toWorld(0, D / 2 + 0.3);
  const windows = [];
  for (const name of Object.keys(walls)) {
    const wall = walls[name];
    const list = openings[name].slice().sort((a, b) => a.c - b.c);
    const pieces = [];
    let cursor = wall.from;
    for (const o of list) {
      const a0 = o.c - o.w / 2;
      const a1 = o.c + o.w / 2;
      if (a0 > cursor) pieces.push([cursor, a0, 0, H, "full"]);
      if (o.bottom > 0) pieces.push([a0, a1, 0, o.bottom, "below"]);
      pieces.push([a0, a1, o.top, H, "above"]);
      cursor = a1;
    }
    if (cursor < wall.to) pieces.push([cursor, wall.to, 0, H, "full"]);

    for (const [a0, a1, y0, y1, kind] of pieces) {
      wallCollider(wall, a0, a1, y0, y1, { move: kind !== "above", shot: true, cam: true });
      const stoneTop = Math.min(y1, 0.85);
      if (y0 < 0.85) wallBox(wall, a0, a1, y0, stoneTop, "stone", "#b4aea0", 0.06);
      if (y1 > 0.85) wallBox(wall, a0, a1, Math.max(y0, 0.85), y1, "plaster", plasterColor);
    }

    for (const o of list) {
      const wc = o.c;
      const jambH = o.top - o.bottom;
      outerBox(wall, wc - o.w / 2 - 0.08, o.bottom + jambH / 2, 0.15, jambH, 0.12, 0.01, "stone", "#9c9688");
      outerBox(wall, wc + o.w / 2 + 0.08, o.bottom + jambH / 2, 0.15, jambH, 0.12, 0.01, "stone", "#9c9688");
      outerBox(wall, wc, o.top + 0.08, o.w + 0.34, 0.16, 0.14, 0.01, "stone", "#9c9688");
      if (o.type === "window") {
        const gp = wall.fixed - wall.out * (t / 2);
        if (wall.axis === "x") add("glass", o.w, jambH, 0.05, wc, o.bottom + jambH / 2, gp, "#ffd88a", null, 0);
        else add("glass", 0.05, jambH, o.w, gp, o.bottom + jambH / 2, wc, "#ffd88a", null, 0);
        const wp = wall.axis === "x" ? toWorld(wc, wall.fixed) : toWorld(wall.fixed, wc);
        windows.push({ x: wp.x, z: wp.z });
      }
    }
  }

  // Fundação de pedra e escadaria frontal da igreja
  add("stone", W + 0.55, foundationDepth + 0.04, D + 0.55, 0, -foundationDepth / 2 + 0.02, 0, "#969084", null, 0.25);
  add("stone", 2.4, foundationDepth + 0.14, 0.85, 0, -foundationDepth / 2 + 0.07, D / 2 + 0.45, "#b4aea0", null, 0.12);
  add("stone", 2.7, foundationDepth - 0.04, 0.65, 0, -foundationDepth / 2 - 0.02, D / 2 + 0.95, "#9c9689", null, 0.18);

  // Piso de pedra polida e vigas do teto
  add("stone", W - 2 * t, 0.12, D - 2 * t, 0, 0.0, 0, "#b8b1a3", null, 0.05);
  for (let i = -2; i <= 2; i++) add("ceiling", 0.22, 0.24, W - 2 * t, 0, H - 0.15, i * (D / 6), timberColor, null, 0);

  // Telhado de duas águas (cumeeira ao longo de Z)
  const ovS = 0.55;
  const ovF = 0.45;
  const run = W / 2 + ovS;
  const rise = pitch + 0.12;
  const slopeLen = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  for (const sd of [-1, 1]) {
    add("roof", slopeLen + 0.06, 0.18, D + 2 * ovF, sd * (run / 2), H - 0.1 + rise / 2 + 0.02, 0, roofColor, [0, 0, -sd * angle], 0.15);
  }
  add("roof", 0.36, 0.2, D + 2 * ovF + 0.1, 0, H + pitch + 0.1, 0, "#473328", null, 0);

  const group = new THREE.Group();
  group.position.set(opts.x, floorY, opts.z);
  group.rotation.y = ry;
  scene.add(group);
  const meshes = {};
  const build = (name, material, castShadow = false) => {
    if (lists[name].length === 0) return null;
    const merged = mergeGeometries(lists[name].map((g) => (g.index ? g.toNonIndexed() : g)), false);
    for (const g of lists[name]) g.dispose();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    group.add(mesh);
    meshes[name] = mesh;
    return mesh;
  };
  build("stone", M.stone, true);
  build("wood", M.wood, true);
  build("plaster", M.plaster, true);
  build("roof", M.tile, true);
  build("ceiling", M.wood);
  build("dark", M.dark);
  build("glass", M.glass);

  // Torre do sino sobre o pórtico frontal (some junto com o telhado ao entrar na igreja)
  const towerTop = new THREE.Group();
  towerTop.position.set(0, H + 0.2, D / 2 - 1.35);
  group.add(towerTop);
  meshes.towerTop = towerTop;
  furnMesh(M.stone, 2.75, 4.6, 2.75, 0, 2.3, 0, towerTop);
  furnMesh(M.furnDark, 3.15, 0.28, 3.15, 0, 4.65, 0, towerTop);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.15, 3.2, 4), M.tile);
  spire.position.set(0, 6.35, 0);
  spire.rotation.y = Math.PI / 4;
  towerTop.add(spire);
  const goldMat = new THREE.MeshStandardMaterial({ color: "#e6c15c", metalness: 0.65, roughness: 0.35, flatShading: true });
  furnMesh(goldMat, 0.14, 1.25, 0.14, 0, 8.35, 0, towerTop);
  furnMesh(goldMat, 0.78, 0.14, 0.14, 0, 8.65, 0, towerTop);

  // Sino articulado dentro do campanário
  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 4.2, 0);
  towerTop.add(bellPivot);
  const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.58, 8), goldMat);
  bellBody.position.set(0, -0.32, 0);
  bellPivot.add(bellBody);

  // Porta da igreja articulada
  const hinge = -doorW / 2;
  const pivot = new THREE.Group();
  pivot.position.set(hinge, 0, D / 2 - t / 2);
  group.add(pivot);
  furnMesh(M.furnDark, doorW - 0.04, doorTop - 0.05, 0.09, doorW / 2, (doorTop - 0.05) / 2, 0, pivot);
  for (const y of [0.55, 1.85]) {
    furnMesh(M.dark, doorW - 0.18, 0.09, 0.12, doorW / 2, y, 0, pivot);
  }
  furnMesh(goldMat, 0.1, 0.18, 0.15, doorW - 0.2, 1.15, 0, pivot);
  const doorBox = addCollider(-doorW / 2 - 0.06, doorW / 2 + 0.06, D / 2 - wallThick, D / 2 + 0.08, -0.2, doorTop, { move: true, shot: true, cam: true });
  const doorState = { pivot, box: doorBox, open: false, angle: 0, target: 0, x: doorWorld.x, z: doorWorld.z };

  // --- Interior Sagrado da Igreja ---
  const redCarpetMat = new THREE.MeshStandardMaterial({ color: "#8c2d26", roughness: 0.95, flatShading: true });
  const whiteClothMat = new THREE.MeshStandardMaterial({ color: "#f2ead7", roughness: 0.9, flatShading: true });
  const holyWaterMat = new THREE.MeshStandardMaterial({ color: "#6ec5e9", emissive: "#246a8a", emissiveIntensity: 0.45, roughness: 0.25, flatShading: true });

  // Tapete vermelho central até o altar
  furnMesh(redCarpetMat, 1.35, 0.03, D - 2.6, 0, 0.07, 0.35, group);

  // 4 Bancos compridos de igreja (Pews) com encosto — 8 assentos voltados para o altar
  const seats = [];
  const props = [];
  for (const sideX of [-1.75, 1.75]) {
    for (const rowZ of [-0.45, 1.45]) {
      const pew = new THREE.Group();
      pew.position.set(sideX, 0, rowZ);
      // Assento, encosto e apoios laterais
      furnMesh(M.furnDark, 1.85, 0.08, 0.44, 0, 0.46, 0, pew);
      furnMesh(M.furnWood, 1.85, 0.52, 0.08, 0, 0.74, 0.19, pew);
      for (const lx of [-0.82, 0.82]) {
        furnMesh(M.furnDark, 0.1, 0.88, 0.48, lx, 0.44, 0, pew);
      }
      group.add(pew);
      addCollider(sideX - 0.92, sideX + 0.92, rowZ - 0.22, rowZ + 0.22, 0, 0.85, { move: false, shot: true, cam: false });

      for (const offsetSeatX of [-0.45, 0.45]) {
        const seatWorld = toWorld(sideX + offsetSeatX, rowZ - 0.05);
        seats.push({
          x: seatWorld.x,
          z: seatWorld.z,
          yaw: ry + Math.PI, // Olhando para o Altar-Mor (-Z local)
          isChurchPew: true,
          label: "E · sentar no banco da igreja",
        });
      }
    }
  }

  // Altar-Mor Sagrado no fundo da nave (-Z)
  const altarZ = -D / 2 + 1.45;
  const altarGroup = new THREE.Group();
  altarGroup.position.set(0, 0, altarZ);
  // Degrau do presbitério
  furnMesh(M.stone, 3.6, 0.16, 1.9, 0, 0.08, 0, altarGroup);
  // Mesa do altar com toalha branca e friso dourado
  furnMesh(M.stone, 2.2, 0.96, 0.92, 0, 0.56, 0, altarGroup);
  furnMesh(whiteClothMat, 2.24, 0.32, 0.96, 0, 0.92, 0, altarGroup);
  furnMesh(goldMat, 1.9, 0.08, 0.98, 0, 0.78, 0, altarGroup);
  // Cruz Dourada no centro do altar + Cálice + 2 Candelabros acesos
  furnMesh(goldMat, 0.09, 0.78, 0.09, 0, 1.45, -0.12, altarGroup);
  furnMesh(goldMat, 0.46, 0.09, 0.09, 0, 1.62, -0.12, altarGroup);
  furnMesh(goldMat, 0.12, 0.22, 0.12, 0.35, 1.18, 0.08, altarGroup);
  for (const cx of [-0.72, 0.72]) {
    furnMesh(goldMat, 0.1, 0.36, 0.1, cx, 1.24, 0, altarGroup);
    furnMesh(whiteClothMat, 0.06, 0.2, 0.06, cx, 1.5, 0, altarGroup);
    furnMesh(M.fire, 0.05, 0.09, 0.05, cx, 1.64, 0, altarGroup);
  }
  group.add(altarGroup);
  addCollider(-1.12, 1.12, altarZ - 0.48, altarZ + 0.48, 0, 1.15, { move: true, shot: true, cam: false });
  const altarPraySpot = toWorld(0, altarZ + 1.05);

  // Pia de Água Benta (entrada à esquerda)
  const fontX = -2.25;
  const fontZ = D / 2 - 1.35;
  const fontGroup = new THREE.Group();
  fontGroup.position.set(fontX, 0, fontZ);
  furnMesh(M.stone, 0.42, 0.82, 0.42, 0, 0.41, 0, fontGroup);
  furnMesh(M.stone, 0.72, 0.22, 0.72, 0, 0.9, 0, fontGroup);
  furnMesh(holyWaterMat, 0.54, 0.06, 0.54, 0, 1.02, 0, fontGroup);
  group.add(fontGroup);
  addCollider(fontX - 0.36, fontX + 0.36, fontZ - 0.36, fontZ + 0.36, 0, 1.05, { move: true, shot: true, cam: false });
  const holyFontWorld = toWorld(fontX, fontZ);

  // Corda do Sino da Torre (entrada à direita)
  const ropeX = 2.25;
  const ropeZ = D / 2 - 1.35;
  const ropeGroup = new THREE.Group();
  ropeGroup.position.set(ropeX, 0, ropeZ);
  furnMesh(M.furnWood, 0.05, H - 0.5, 0.05, 0, (H - 0.5) / 2 + 0.45, 0, ropeGroup);
  furnMesh(goldMat, 0.14, 0.24, 0.14, 0, 0.52, 0, ropeGroup);
  group.add(ropeGroup);
  const bellRopeWorld = toWorld(ropeX, ropeZ);

  // Caixa de Ofertas / Dízimo (próxima ao altar à esquerda)
  const boxX = -2.25;
  const boxZ = -D / 2 + 2.55;
  const offGroup = new THREE.Group();
  offGroup.position.set(boxX, 0, boxZ);
  furnMesh(M.furnDark, 0.55, 0.85, 0.48, 0, 0.425, 0, offGroup);
  furnMesh(goldMat, 0.58, 0.08, 0.5, 0, 0.72, 0, offGroup);
  group.add(offGroup);
  addCollider(boxX - 0.28, boxX + 0.28, boxZ - 0.25, boxZ + 0.25, 0, 0.9, { move: true, shot: true, cam: false });
  const offeringBoxWorld = toWorld(boxX, boxZ);

  // Atril das Escrituras Sagradas (próximo ao altar à direita)
  const lecX = 2.05;
  const lecZ = -D / 2 + 2.55;
  const lecGroup = new THREE.Group();
  lecGroup.position.set(lecX, 0, lecZ);
  furnMesh(M.furnDark, 0.18, 1.05, 0.18, 0, 0.52, 0, lecGroup);
  const desk = furnMesh(M.furnWood, 0.58, 0.08, 0.46, 0, 1.08, 0, lecGroup);
  desk.rotation.x = 0.35;
  const book = furnMesh(whiteClothMat, 0.44, 0.05, 0.32, 0, 1.14, 0.02, lecGroup);
  book.rotation.x = 0.35;
  group.add(lecGroup);
  addCollider(lecX - 0.28, lecX + 0.28, lecZ - 0.25, lecZ + 0.25, 0, 1.2, { move: true, shot: true, cam: false });
  const lecternWorld = toWorld(lecX, lecZ);

  // Estande externo de velas votivas ao lado da porta
  const standLocal = new THREE.Group();
  standLocal.position.set(2.35, 0, D / 2 + 0.95);
  group.add(standLocal);
  furnMesh(M.stone, 1.0, foundationDepth + 0.04, 0.7, 0, -foundationDepth / 2 + 0.02, 0, standLocal);
  furnMesh(M.furnWood, 0.8, 0.9, 0.5, 0, 0.45, 0, standLocal);
  for (const cx of [-0.25, 0, 0.25]) {
    furnMesh(whiteClothMat, 0.07, 0.22, 0.07, cx, 1.0, 0, standLocal);
    furnMesh(M.fire, 0.05, 0.06, 0.05, cx, 1.14, 0, standLocal);
  }
  addCollider(1.9, 2.8, D / 2 + 0.65, D / 2 + 1.25, -foundationDepth, 1.1, { move: true, shot: true, cam: false });

  const innerX = W / 2 - t;
  const innerZ = D / 2 - t;
  const spawn = toWorld(0, D / 2 + 2.6);
  const stand = toWorld(2.35, D / 2 + 1.65);
  const torches = [-1.45, 1.45].map((lx) => {
    const p = toWorld(lx, D / 2 + 0.18);
    return { x: p.x, y: floorY + 2.15, z: p.z, nx: s, nz: c, post: false };
  });

  const churchObj = {
    id: opts.id || `church-${opts.name}`,
    type: "church",
    name: opts.name || "Igreja",
    price: 0,
    x: opts.x,
    z: opts.z,
    ry,
    floorY,
    W,
    D,
    thatch: false,
    rect: worldRect(-innerX, innerX, -innerZ, innerZ),
    outer: footprint,
    group,
    meshes,
    M,
    door: doorState,
    chest: { lid: null, opened: true, x: 0, z: 0, box: null, openAmount: 1 },
    bed: { x: 99999, z: 99999, box: null },
    hearth: { x: altarPraySpot.x, y: floorY + 1.1, z: altarPraySpot.z },
    altar: { x: altarPraySpot.x, z: altarPraySpot.z, yaw: ry + Math.PI },
    holyFont: { x: holyFontWorld.x, z: holyFontWorld.z, cooldown: 0 },
    bellRope: { x: bellRopeWorld.x, z: bellRopeWorld.z, bellPivot, swingTimer: 0 },
    offeringBox: { x: offeringBoxWorld.x, z: offeringBoxWorld.z },
    lectern: { x: lecternWorld.x, z: lecternWorld.z },
    props,
    seats,
    colliders,
    windows,
    torchSpots: torches,
    torches,
    spawn,
    stand,
    doorFront: doorWorld,
    owner: null,
    burned: false,
    inside: false,
    enterCooldown: 0,
    thatchSpots: [],
  };
  churchObj.contains = (x, z) => x > churchObj.rect.minX && x < churchObj.rect.maxX && z > churchObj.rect.minZ && z < churchObj.rect.maxZ;
  return churchObj;
}

