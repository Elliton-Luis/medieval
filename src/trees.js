import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Árvores low-poly com várias espécies, troncos irregulares com raízes, copas em blocos
// sobrepostos com variação de tom e balanço pelo vento (vertex shader). Tudo instanciado.

const windTime = { value: 0 };
const _color = new THREE.Color();

function paint(geometry, colorAt) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = g.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    colorAt(_color, position.getX(i), position.getY(i), position.getZ(i));
    colors[i * 3] = _color.r;
    colors[i * 3 + 1] = _color.g;
    colors[i * 3 + 2] = _color.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function rng(seed) {
  let state = seed | 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

// tronco irregular em segmentos deslocados + raízes aparentes
function trunk(parts, random, height, radius, bark, lowAo = true, opts = {}) {
  const segments = opts.segments ?? 4;
  const radial = opts.radial ?? 6;
  const rootCount = opts.roots ?? 5;
  let x = 0;
  let z = 0;
  for (let i = 0; i < segments; i++) {
    const h = height / segments;
    const r0 = radius * (1 - (i / segments) * 0.45);
    const r1 = radius * (1 - ((i + 1) / segments) * 0.45);
    const g = new THREE.CylinderGeometry(r1, r0, h * 1.08, radial, 1);
    const dx = (random() - 0.5) * radius * 0.7;
    const dz = (random() - 0.5) * radius * 0.7;
    g.translate(x + dx / 2, h * i + h / 2, z + dz / 2);
    x += dx;
    z += dz;
    parts.push(paint(g, (c, vx, vy) => {
      c.set(bark);
      c.multiplyScalar((lowAo ? 0.65 + 0.35 * Math.min(1, vy / 1.4) : 1) * (0.9 + random() * 0.0));
    }));
  }
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * Math.PI * 2 + random();
    const root = new THREE.ConeGeometry(radius * 0.5, radius * 3.2, 4);
    root.rotateZ(Math.PI / 2 + 0.5);
    root.rotateY(angle);
    root.translate(Math.cos(angle) * radius * 1.4, radius * 0.5, -Math.sin(angle) * radius * 1.4);
    parts.push(paint(root, (c) => c.set(bark).multiplyScalar(0.62)));
  }
  return { x, z, top: height };
}

function blob(parts, random, radius, x, y, z, color, squash = 0.85, detail = 1) {
  const g = detail < 0 ? new THREE.OctahedronGeometry(radius, 0) : new THREE.IcosahedronGeometry(radius, detail);
  g.scale(1, squash, 1);
  g.translate(x, y, z);
  const base = new THREE.Color(color);
  const tone = 0.85 + random() * 0.3;
  parts.push(paint(g, (c, vx, vy) => {
    // topo mais claro, parte de baixo mais escura (AO barato)
    const f = tone * (0.72 + 0.4 * THREE.MathUtils.clamp((vy - (y - radius)) / (2 * radius), 0, 1));
    c.copy(base).multiplyScalar(f);
  }));
}

function build(parts) {
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// ---------------------------------------------------------------------------
// Triângulos 2D (impostores) usados nos 2 níveis mais distantes de LOD
// ---------------------------------------------------------------------------

/** Triângulo isósceles com face frontal (e traseira opcional), base em yBottom. */
export function createIsoscelesTriangleGeometry(baseWidth, height, yBottom = 0, doubleSided = true) {
  const hw = baseWidth / 2;
  const yTop = yBottom + height;
  const pos = [-hw, yBottom, 0, hw, yBottom, 0, 0, yTop, 0];
  const nor = [0, 0, 1, 0, 0, 1, 0, 0, 1];
  const uv = [0, 0, 1, 0, 0.5, 1];
  if (doubleSided) {
    pos.push(hw, yBottom, 0, -hw, yBottom, 0, 0, yTop, 0);
    nor.push(0, 0, -1, 0, 0, -1, 0, 0, -1);
    uv.push(1, 0, 0, 0, 0.5, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nor), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  return geo;
}

/** Dois triângulos cruzados em X (visíveis de qualquer ângulo). */
export function createCrossedTriangles(baseWidth, height, yBottom = 0) {
  // face única: o material dos impostores é DoubleSide
  const a = createIsoscelesTriangleGeometry(baseWidth, height, yBottom, false);
  const b = createIsoscelesTriangleGeometry(baseWidth, height, yBottom, false);
  b.rotateY(Math.PI / 2);
  const merged = mergeGeometries([a, b], false);
  a.dispose();
  b.dispose();
  return merged;
}

function colorize(geometry, base, tip, bottomY, topY) {
  const g = geometry;
  const position = g.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const cb = new THREE.Color(base);
  const ct = new THREE.Color(tip);
  for (let i = 0; i < position.count; i++) {
    const t = THREE.MathUtils.clamp((position.getY(i) - bottomY) / Math.max(0.001, topY - bottomY), 0, 1);
    _color.copy(cb).lerp(ct, t).multiplyScalar(0.8 + 0.25 * t);
    colors[i * 3] = _color.r;
    colors[i * 3 + 1] = _color.g;
    colors[i * 3 + 2] = _color.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

// LOD 4: copa em 2 triângulos cruzados + tronco em 2 quads cruzados
function makeImpostorCrossed(spec) {
  const canopy = colorize(createCrossedTriangles(spec.w, spec.h, spec.y), spec.base, spec.tip, spec.y, spec.y + spec.h);
  const parts = [canopy];
  if (spec.trunkH > 0) {
    const t1 = new THREE.PlaneGeometry(spec.trunkW, spec.trunkH);
    t1.translate(0, spec.trunkH / 2, 0);
    const t2 = t1.clone();
    t2.rotateY(Math.PI / 2);
    for (const t of [t1, t2]) {
      const ni = t.index ? t.toNonIndexed() : t;
      colorize(ni, spec.bark, spec.bark, 0, spec.trunkH);
      parts.push(ni);
    }
    t1.dispose();
    t2.dispose();
  }
  return build(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

// LOD 5: UM único triângulo 2D (billboard cilíndrico no vertex shader)
function makeImpostorSingle(spec) {
  const total = spec.y + spec.h;
  const g = createIsoscelesTriangleGeometry(spec.w * 0.95, total, 0, false);
  colorize(g, spec.bark, spec.tip, 0, total);
  // sem build(): geometria já não-indexada; só calcula volumes
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const IMPOSTOR_SPECS = {
  oak:   { w: 5.2, h: 5.2, y: 3.4, trunkW: 0.6, trunkH: 3.6, base: "#5c5a26", tip: "#8c8a3c", bark: "#5b4331" },
  pine:  { w: 4.6, h: 8.4, y: 2.2, trunkW: 0.4, trunkH: 2.4, base: "#34422a", tip: "#4a5530", bark: "#4d3a2a" },
  birch: { w: 3.4, h: 5.0, y: 3.6, trunkW: 0.3, trunkH: 4.0, base: "#98903f", tip: "#c0b660", bark: "#dcd7ca" },
  bush:  { w: 1.9, h: 1.0, y: 0.0, trunkW: 0,   trunkH: 0,   base: "#5f5a28", tip: "#7e7834", bark: "#476f33" },
};

// ---------------------------------------------------------------------------
// Espécies: lod 0 (máximo detalhe) → lod 3 (blocos mínimos). lod 4/5 = impostores.
// ---------------------------------------------------------------------------

function makeOak(lod = 0) {
  const random = rng(11);
  const parts = [];
  const tr = [
    { segments: 4, radial: 6, roots: 5 },
    { segments: 3, radial: 6, roots: 0 },
    { segments: 2, radial: 5, roots: 0 },
    { segments: 1, radial: 4, roots: 0 },
  ][lod];
  trunk(parts, random, 4.6, 0.36, "#5b4331", true, tr);
  const greens = ["#7a7a34", "#8c8a3c", "#6a6a2c", "#9a9440", "#5e5a28"]; // folhagem seca e amarelada
  const all = [[0, 5.9, 0, 2.2], [1.8, 5.1, 0.7, 1.7], [-1.7, 5.2, -0.8, 1.75], [0.6, 5.0, 1.8, 1.55], [-0.7, 7.1, -0.4, 1.6], [1.5, 6.5, -1.5, 1.4], [-1.9, 6.0, 1.3, 1.35], [0.2, 4.6, -1.9, 1.3]];
  const count = [8, 8, 5, 3][lod];
  const detail = [1, 0, 0, -1][lod];
  const grow = [1, 1, 1.12, 1.35][lod]; // blobs maiores compensam a quantidade menor
  for (let i = 0; i < count; i++) {
    const [bx, by, bz, br] = all[i];
    blob(parts, random, br * grow, bx, by, bz, greens[Math.floor(random() * greens.length)], 0.85, detail);
  }
  return build(parts);
}

function makePine(lod = 0) {
  const random = rng(23);
  const parts = [];
  const tr = [
    { segments: 4, radial: 6, roots: 5 },
    { segments: 2, radial: 5, roots: 0 },
    { segments: 1, radial: 5, roots: 0 },
    { segments: 1, radial: 4, roots: 0 },
  ][lod];
  trunk(parts, random, 3.6, 0.27, "#4d3a2a", true, tr);
  const greens = ["#3a4a2c", "#43502e", "#34422a", "#4a5530"];
  const cones = [6, 6, 4, 2][lod];
  const radial = [7, 5, 5, 4][lod];
  for (let i = 0; i < cones; i++) {
    // menos cones => cada um mais alto, cobrindo a mesma silhueta
    const span = 6 / cones;
    const r = (2.25 - i * span * 0.34) * (cones < 6 ? 1.06 : 1);
    const height = 1.9 * span * (cones < 6 ? 0.85 : 1);
    const cone = new THREE.ConeGeometry(r, height, radial);
    const baseY = 3.3 + i * 1.25 * span;
    cone.translate(0, baseY, 0);
    const base = new THREE.Color(greens[Math.floor(random() * greens.length)]);
    parts.push(paint(cone, (c, vx, vy) => c.copy(base).multiplyScalar(0.72 + 0.35 * ((vy - baseY) / height + 0.5))));
  }
  return build(parts);
}

function makeBirch(lod = 0) {
  const random = rng(37);
  const parts = [];
  const height = 5.3;
  if (lod === 0) {
    const segments = 7;
    for (let i = 0; i < segments; i++) {
      const g = new THREE.CylinderGeometry(0.15 - i * 0.009, 0.17 - i * 0.009, height / segments * 1.04, 6);
      g.translate((random() - 0.5) * 0.09, (height / segments) * i + height / segments / 2, (random() - 0.5) * 0.09);
      parts.push(paint(g, (c) => c.set(i % 2 ? "#e6e2d6" : "#cfcabc")));
      const mark = new THREE.BoxGeometry(0.22, 0.055, 0.22);
      mark.translate(0, (height / segments) * i + 0.35, 0);
      parts.push(paint(mark, (c) => c.set("#2a2622")));
    }
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + random();
      const root = new THREE.ConeGeometry(0.09, 0.55, 4);
      root.rotateZ(Math.PI / 2 + 0.6);
      root.rotateY(angle);
      root.translate(Math.cos(angle) * 0.2, 0.1, -Math.sin(angle) * 0.2);
      parts.push(paint(root, (c) => c.set("#bdb7a8")));
    }
  } else {
    // tronco único e liso, cada vez mais simples
    const radial = [6, 5, 4][lod - 1];
    const segs = [3, 1, 1][lod - 1];
    for (let i = 0; i < segs; i++) {
      const h = height / segs;
      const g = new THREE.CylinderGeometry(0.15 - i * 0.03, 0.17 - i * 0.03, h * 1.04, radial);
      g.translate(0, h * i + h / 2, 0);
      parts.push(paint(g, (c) => c.set(i % 2 ? "#e6e2d6" : "#cfcabc")));
    }
  }
  const greens = ["#a8a34a", "#b5ac55", "#98903f", "#c0b660"];
  const all = [[0, 5.9, 0, 1.5], [1.0, 5.2, 0.5, 1.15], [-1.0, 5.5, -0.5, 1.2], [0.2, 6.8, -0.3, 1.05], [-0.4, 5.0, 1.0, 1.0], [0.8, 6.3, -0.8, 0.9]];
  const count = [6, 5, 3, 1][lod];
  const detail = [1, 0, 0, -1][lod];
  const grow = [1, 1, 1.15, 1.55][lod];
  for (let i = 0; i < count; i++) {
    const [bx, by, bz, br] = all[i];
    blob(parts, random, br * grow, bx, by, bz, greens[Math.floor(random() * greens.length)], 1.1, detail);
  }
  return build(parts);
}

function makeBush(lod = 0) {
  const random = rng(53);
  const parts = [];
  const greens = ["#6f6a2e", "#7e7834", "#5f5a28"];
  const all = [[0, 0.45, 0, 0.6], [0.5, 0.35, 0.2, 0.45], [-0.45, 0.35, -0.1, 0.5], [0.1, 0.4, -0.5, 0.42]];
  const count = [4, 4, 2, 1][lod];
  const detail = [1, 0, 0, -1][lod];
  const grow = [1, 1, 1.2, 1.7][lod];
  for (let i = 0; i < count; i++) {
    const [bx, by, bz, br] = all[i];
    blob(parts, random, br * grow, bx, by, bz, greens[Math.floor(random() * greens.length)], 0.8, detail);
  }
  return build(parts);
}

const SPECIES_BUILDERS = { oak: makeOak, pine: makePine, birch: makeBirch, bush: makeBush };

/** 6 geometrias de LOD de uma espécie (0 = detalhada ... 5 = um triângulo). */
function buildLodGeometries(kind) {
  const make = SPECIES_BUILDERS[kind];
  return [
    make(0), make(1), make(2), make(3),
    makeImpostorCrossed(IMPOSTOR_SPECS[kind]),
    makeImpostorSingle(IMPOSTOR_SPECS[kind]),
  ];
}

// Tufo de grama low-poly (5 lâminas agrupadas em uma única geometria leve para InstancedMesh)
function makeGrass() {
  const random = rng(71);
  const parts = [];
  const blades = [
    [0, 0, 0.46, 0.08, 0.08, 0],
    [0.14, 0.08, 0.38, 0.07, -0.22, 0.18],
    [-0.13, 0.06, 0.41, 0.07, 0.2, -0.15],
    [0.07, -0.13, 0.35, 0.065, 0.14, 0.24],
    [-0.09, -0.11, 0.37, 0.065, -0.18, -0.2],
  ];
  const baseColor = new THREE.Color("#6b6a30");
  const tipColor = new THREE.Color("#b8ac58");
  for (const [bx, bz, h, r, rx, rz] of blades) {
    const cone = new THREE.ConeGeometry(r, h, 3, 1, true);
    cone.translate(0, h * 0.5, 0);
    cone.rotateX(rx);
    cone.rotateZ(rz);
    cone.translate(bx, 0, bz);
    const tone = 0.9 + random() * 0.2;
    parts.push(paint(cone, (c, vx, vy) => {
      const t = THREE.MathUtils.clamp(vy / h, 0, 1);
      c.copy(baseColor).lerp(tipColor, t).multiplyScalar(tone * (0.72 + 0.35 * t));
    }));
  }
  return build(parts);
}

function windMaterial(sway, minY = 2.0, maxY = 8.0) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  if (sway <= 0) return material;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWindTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        float swayAmount = smoothstep(${minY.toFixed(2)}, ${maxY.toFixed(2)}, position.y) * ${sway.toFixed(3)};
        #ifdef USE_INSTANCING
          vec2 anchor = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 anchor = vec2(0.0);
        #endif
        float phase = uWindTime * 1.25 + anchor.x * 0.21 + anchor.y * 0.17;
        transformed.x += (sin(phase) * 0.1 + sin(phase * 2.3 + 1.0) * 0.035) * swayAmount;
        transformed.z += cos(phase * 0.9) * 0.075 * swayAmount;`);
  };
  return material;
}

// Material do LOD 5: o triângulo vira billboard cilíndrico (sempre de frente para a câmera)
export function makeBillboardMaterial(color = null) {
  const material = new THREE.MeshStandardMaterial(
    color ? { color, roughness: 1, metalness: 0, flatShading: true } : { vertexColors: true, roughness: 1, metalness: 0, flatShading: true }
  );
  material.side = THREE.DoubleSide;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `
      vec4 bbCenter = vec4(0.0, 0.0, 0.0, 1.0);
      float bbSx = 1.0;
      float bbSy = 1.0;
      #ifdef USE_INSTANCING
        bbCenter = instanceMatrix * bbCenter;
        bbSx = length(instanceMatrix[0].xyz);
        bbSy = length(instanceMatrix[1].xyz);
      #endif
      vec4 mvPosition = modelViewMatrix * bbCenter;
      vec3 bbUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      vec3 bbRight = normalize(cross(bbUp, vec3(0.0, 0.0, 1.0)));
      mvPosition.xyz += bbRight * (transformed.x * bbSx) + bbUp * (transformed.y * bbSy);
      gl_Position = projectionMatrix * mvPosition;
      `
    );
  };
  material.customProgramCacheKey = () => "billboard-triangle";
  return material;
}

export function makeImpostorMaterial(color = null) {
  const m = new THREE.MeshStandardMaterial(
    color ? { color, roughness: 1, metalness: 0, flatShading: true } : { vertexColors: true, roughness: 1, metalness: 0, flatShading: true }
  );
  m.side = THREE.DoubleSide;
  return m;
}

function plainMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
}

export const LOD_LEVELS = 6;

export class TreeKit {
  constructor() {
    const swayOf = { oak: 1, pine: 0.8, birch: 1.2, bush: 0 };
    const heights = { oak: 8, pine: 9.5, birch: 7.5, bush: 1 };
    this.species = {};
    const plain = plainMaterial();
    const billboard = makeBillboardMaterial();
    const impostor = makeImpostorMaterial();
    for (const kind of Object.keys(SPECIES_BUILDERS)) {
      const geoms = buildLodGeometries(kind);
      const wind = windMaterial(swayOf[kind]);
      // lods[i] = { geometry, material }: vento só nos 3 níveis mais próximos
      const lods = [
        { geometry: geoms[0], material: wind },
        { geometry: geoms[1], material: wind },
        { geometry: geoms[2], material: wind },
        { geometry: geoms[3], material: plain },
        { geometry: geoms[4], material: impostor },
        { geometry: geoms[5], material: billboard },
      ];
      this.species[kind] = { geometry: geoms[0], material: wind, lods, height: heights[kind], collider: kind !== "bush" };
    }
    this.grass = {
      geometry: makeGrass(),
      material: windMaterial(0.55, 0.02, 0.46),
    };
  }

  update(dt) {
    windTime.value += dt;
  }

  // escolhe a espécie de uma árvore a partir de um número aleatório
  pick(r) {
    if (r < 0.3) return "oak";
    if (r < 0.66) return "pine";
    if (r < 0.84) return "birch";
    return "bush";
  }
}
