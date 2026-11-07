import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ============================================================================
// Utilitários de modelagem de monstros (barato por construção):
//  - addDetail(): várias primitivas (chifres, costelas, garras, dentes, manchas de sangue)
//    viram UMA única malha com vertex colors (1 draw call, 0 texturas extras).
//  - finalizeMonster(): funde as partes estáticas já existentes de cada grupo por material
//    (menos meshes/materiais clonados), pintando AO falso (escuro embaixo) e sangue/ferrugem
//    em vertex color. Partes animadas (referenciadas pela entidade) NUNCA são fundidas.
// ============================================================================

const _detailMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.82,
  metalness: 0.08,
  flatShading: true,
});

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

function hash3(x, y, z) {
  let h = Math.imul((x * 1000) | 0, 374761393) ^ Math.imul((y * 1000) | 0, 668265263) ^ Math.imul((z * 1000) | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Cor por vértice: gradiente vertical (AO falso) e variação sutil por face. */
function paintAO(geo, hex, minY, maxY, ao = 0.55) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  _c.set(hex);
  const range = Math.max(0.0001, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - minY) / range, 0, 1);
    const k = ao + (1 - ao) * t;
    colors[i * 3] = _c.r * k;
    colors[i * 3 + 1] = _c.g * k;
    colors[i * 3 + 2] = _c.b * k;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function makePrim(def) {
  let g;
  switch (def.t) {
    case "cone": g = new THREE.ConeGeometry(def.a[0], def.a[1], def.a[2] ?? 4); break;
    case "box": g = new THREE.BoxGeometry(def.a[0], def.a[1], def.a[2]); break;
    case "sph": g = new THREE.SphereGeometry(def.a[0], def.a[1] ?? 6, def.a[2] ?? 4); break;
    case "cyl": g = new THREE.CylinderGeometry(def.a[0], def.a[1], def.a[2], def.a[3] ?? 5); break;
    default: g = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }
  if (g.index) g = g.toNonIndexed();
  _e.set(def.r?.[0] ?? 0, def.r?.[1] ?? 0, def.r?.[2] ?? 0);
  _q.setFromEuler(_e);
  _v.set(def.p?.[0] ?? 0, def.p?.[1] ?? 0, def.p?.[2] ?? 0);
  _s.set(def.s?.[0] ?? 1, def.s?.[1] ?? 1, def.s?.[2] ?? 1);
  _m4.compose(_v, _q, _s);
  g.applyMatrix4(_m4);
  g.deleteAttribute("uv");
  g.computeBoundingBox();
  paintAO(g, def.c ?? 0xcfc4a6, g.boundingBox.min.y, g.boundingBox.max.y, def.ao ?? 0.6);
  return g;
}

/**
 * Cria uma malha única a partir de uma lista de primitivas.
 * def: { t:"cone|box|sph|cyl", a:[args], p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz], c:0xRRGGBB, ao:0..1 }
 */
export function addDetail(parent, defs, name = "Detail") {
  const geos = defs.map(makePrim);
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mesh = new THREE.Mesh(merged, _detailMat);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Fusão das partes estáticas
// ---------------------------------------------------------------------------
function collectProtected(owner) {
  const set = new Set();
  const visit = (val, depth) => {
    if (!val || depth > 3) return;
    if (val.isObject3D) { set.add(val); return; }
    if (Array.isArray(val)) { for (const x of val) visit(x, depth + 1); return; }
    if (typeof val === "object" && (val.constructor === Object)) {
      for (const k of Object.keys(val)) visit(val[k], depth + 1);
    }
  };
  if (owner) for (const k of Object.keys(owner)) { if (k !== "scene" && k !== "world" && k !== "player" && k !== "npcs" && k !== "combat" && k !== "effects") visit(owner[k], 0); }
  return set;
}

const _vcMaterials = new Map();
function vcMaterial(mat) {
  let m = _vcMaterials.get(mat);
  if (!m) {
    m = mat.clone();
    m.vertexColors = true;
    _vcMaterials.set(mat, m);
  }
  return m;
}

function mergeGroup(group, protectedSet) {
  const byMat = new Map();
  for (const c of group.children) {
    if (!c.isMesh || c.isInstancedMesh || c.isSkinnedMesh || c.children.length > 0) continue;
    if (protectedSet.has(c) || !c.visible) continue;
    const mat = c.material;
    if (!mat || Array.isArray(mat) || mat.isMeshBasicMaterial || mat.transparent || mat.vertexColors) continue;
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(c);
  }
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const geos = [];
    let minY = Infinity;
    let maxY = -Infinity;
    let cast = false;
    for (const m of meshes) {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      m.updateMatrix();
      g.applyMatrix4(m.matrix);
      for (const name of Object.keys(g.attributes)) {
        if (name !== "position" && name !== "normal") g.deleteAttribute(name);
      }
      g.computeBoundingBox();
      minY = Math.min(minY, g.boundingBox.min.y);
      maxY = Math.max(maxY, g.boundingBox.max.y);
      cast = cast || m.castShadow;
      geos.push(g);
    }
    const range = Math.max(0.0001, maxY - minY);
    for (const g of geos) {
      const pos = g.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i += 3) {
        // por triângulo: ruído de sujeira + manchas de sangue/ferrugem nas faces baixas
        const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        const n = hash3(cx, cy, cz);
        const grime = 0.9 + n * 0.14;
        const lowT = THREE.MathUtils.clamp(1 - (cy - minY) / range, 0, 1);
        const blood = n > 0.84 && lowT > 0.25 ? 0.65 : 0;
        for (let k = 0; k < 3; k++) {
          const t = THREE.MathUtils.clamp((pos.getY(i + k) - minY) / range, 0, 1);
          const ao = (0.5 + 0.5 * t) * grime;
          const r = THREE.MathUtils.lerp(ao, 0.34 * ao + 0.1, blood);
          const gg = THREE.MathUtils.lerp(ao, 0.03 + 0.1 * ao, blood);
          const b = THREE.MathUtils.lerp(ao, 0.04 + 0.1 * ao, blood);
          colors[(i + k) * 3] = Math.min(1, r);
          colors[(i + k) * 3 + 1] = gg;
          colors[(i + k) * 3 + 2] = b;
        }
      }
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, vcMaterial(mat));
    mesh.name = "MergedStatic";
    mesh.castShadow = cast;
    mesh.receiveShadow = false;
    for (const m of meshes) group.remove(m);
    group.add(mesh);
  }
}

/** Funde as partes estáticas de cada grupo do monstro. `owner` = entidade/objeto cujas propriedades apontam para partes animadas. */
export function finalizeMonster(root, owner) {
  const protectedSet = collectProtected(owner);
  const groups = [];
  root.traverse((o) => { if (o === root || o.isGroup) groups.push(o); });
  for (const g of groups) mergeGroup(g, protectedSet);
}
