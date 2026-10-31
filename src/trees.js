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
function trunk(parts, random, height, radius, bark, lowAo = true) {
  const segments = 4;
  let x = 0;
  let z = 0;
  for (let i = 0; i < segments; i++) {
    const h = height / segments;
    const r0 = radius * (1 - (i / segments) * 0.45);
    const r1 = radius * (1 - ((i + 1) / segments) * 0.45);
    const g = new THREE.CylinderGeometry(r1, r0, h * 1.08, 6, 1);
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
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + random();
    const root = new THREE.ConeGeometry(radius * 0.5, radius * 3.2, 4);
    root.rotateZ(Math.PI / 2 + 0.5);
    root.rotateY(angle);
    root.translate(Math.cos(angle) * radius * 1.4, radius * 0.5, -Math.sin(angle) * radius * 1.4);
    parts.push(paint(root, (c) => c.set(bark).multiplyScalar(0.62)));
  }
  return { x, z, top: height };
}

function blob(parts, random, radius, x, y, z, color, squash = 0.85) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
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
  merged.computeBoundingSphere();
  return merged;
}

function makeOak() {
  const random = rng(11);
  const parts = [];
  trunk(parts, random, 4.6, 0.36, "#5b4331");
  const greens = ["#4f7a3a", "#5e8c42", "#477036", "#6a9a4a", "#55823d"];
  const blobs = [[0, 5.9, 0, 2.2], [1.8, 5.1, 0.7, 1.7], [-1.7, 5.2, -0.8, 1.75], [0.6, 5.0, 1.8, 1.55], [-0.7, 7.1, -0.4, 1.6], [1.5, 6.5, -1.5, 1.4], [-1.9, 6.0, 1.3, 1.35], [0.2, 4.6, -1.9, 1.3]];
  for (const [bx, by, bz, br] of blobs) blob(parts, random, br, bx, by, bz, greens[Math.floor(random() * greens.length)]);
  return build(parts);
}

function makePine() {
  const random = rng(23);
  const parts = [];
  trunk(parts, random, 3.6, 0.27, "#4d3a2a");
  const greens = ["#2f5a3a", "#386645", "#2a5035", "#3f7048"];
  for (let i = 0; i < 6; i++) {
    const r = 2.25 - i * 0.34;
    const cone = new THREE.ConeGeometry(r, 1.9, 7);
    const baseY = 3.3 + i * 1.25;
    cone.translate(0, baseY, 0);
    const base = new THREE.Color(greens[Math.floor(random() * greens.length)]);
    parts.push(paint(cone, (c, vx, vy) => c.copy(base).multiplyScalar(0.72 + 0.35 * ((vy - baseY) / 1.9 + 0.5))));
  }
  return build(parts);
}

function makeBirch() {
  const random = rng(37);
  const parts = [];
  // tronco claro com marcas escuras
  const height = 5.3;
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
  const greens = ["#8ab85a", "#9bc766", "#7aa850", "#a8d070"];
  for (const [bx, by, bz, br] of [[0, 5.9, 0, 1.5], [1.0, 5.2, 0.5, 1.15], [-1.0, 5.5, -0.5, 1.2], [0.2, 6.8, -0.3, 1.05], [-0.4, 5.0, 1.0, 1.0], [0.8, 6.3, -0.8, 0.9]]) {
    blob(parts, random, br, bx, by, bz, greens[Math.floor(random() * greens.length)], 1.1);
  }
  return build(parts);
}

function makeBush() {
  const random = rng(53);
  const parts = [];
  const greens = ["#4d7a38", "#5a8a3f", "#476f33"];
  for (const [bx, by, bz, br] of [[0, 0.45, 0, 0.6], [0.5, 0.35, 0.2, 0.45], [-0.45, 0.35, -0.1, 0.5], [0.1, 0.4, -0.5, 0.42]]) {
    blob(parts, random, br, bx, by, bz, greens[Math.floor(random() * greens.length)], 0.8);
  }
  return build(parts);
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
  const baseColor = new THREE.Color("#4f7438");
  const tipColor = new THREE.Color("#88ab58");
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

export class TreeKit {
  constructor() {
    this.species = {
      oak: { geometry: makeOak(), material: windMaterial(1), height: 8, collider: true },
      pine: { geometry: makePine(), material: windMaterial(0.8), height: 9.5, collider: true },
      birch: { geometry: makeBirch(), material: windMaterial(1.2), height: 7.5, collider: true },
      bush: { geometry: makeBush(), material: windMaterial(0), height: 1, collider: false },
    };
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
