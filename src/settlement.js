import { isCanonicalWorld, worldRand, getWorldChaos } from "./worldgen.js";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let _villageScale = 1; // CAOS: escala de largura/profundidade das casas da vila corrente
import * as THREE from "three";
import { ROADS, VILLAGES } from "./kingdom.js";
import { makeRandom } from "./utils.js";
import { createHouse, createChurchBuilding, setHouseStyle } from "./house.js";
import { createHay } from "./fire.js";
import { createSeededRandom, createSharedHouseMaterial, generateCity } from "./procedural.js";
import { addCityBeacon } from "./beacons.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { resetPlacement, reserve, findSpot, canPlace, BUILDING_GAP, nearestFreePoint } from "./placement.js";
import { weatheredStoneTexture, weatheredWallTexture, tileTexture, woodTexture } from "./textures.js";

const sharedHouseMat = createSharedHouseMaterial();
const wallMat = sharedHouseMat;
const timberMat = new THREE.MeshStandardMaterial({ color: "#563e2b", roughness: 1, flatShading: true });
const darkTimberMat = new THREE.MeshStandardMaterial({ color: "#392e25", roughness: 1, flatShading: true });
const roofMat = new THREE.MeshStandardMaterial({ color: "#654a3a", roughness: 1, flatShading: true });
const stoneMat = new THREE.MeshStandardMaterial({ color: "#77796d", roughness: 1, flatShading: true });
const ironMat = new THREE.MeshStandardMaterial({ color: "#454d49", metalness: 0.42, roughness: 0.66, flatShading: true });
const warmLightMat = new THREE.MeshStandardMaterial({ color: "#e88a3c", emissive: "#bd4918", emissiveIntensity: 1.2, roughness: 0.6, flatShading: true });
const cropMat = new THREE.MeshStandardMaterial({ color: "#88a349", roughness: 1, flatShading: true });
const clothRedMat = new THREE.MeshStandardMaterial({ color: "#8c4035", roughness: 1, flatShading: true });
const clothCreamMat = new THREE.MeshStandardMaterial({ color: "#d0bd91", roughness: 1, flatShading: true });
const paleWallMat = new THREE.MeshStandardMaterial({ color: "#c6b894", roughness: 1, flatShading: true });
const fadedWallMat = new THREE.MeshStandardMaterial({ color: "#a88c70", roughness: 1, flatShading: true });

function addMesh(parent, geometry, material, x, y, z, castShadow = false) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, material, x, y, z, sx, sy, sz, castShadow = false) {
  return addMesh(parent, new THREE.BoxGeometry(sx, sy, sz), material, x, y, z, castShadow);
}

function createGableRoof() {
  const width = 5.4;
  const depth = 4.4;
  const height = 2.25;
  const x = width / 2;
  const z = depth / 2;
  const points = [
    -x, 0, z, 0, height, z, 0, height, -z,
    -x, 0, z, 0, height, -z, -x, 0, -z,
    0, height, z, x, 0, z, x, 0, -z,
    0, height, z, x, 0, -z, 0, height, -z,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function toWorld(x, z, ry, ox, oz) {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  return { x: x + ox * cos + oz * sin, z: z - ox * sin + oz * cos };
}

function sampleFoundation(world, x, z, ry, width, depth) {
  let maxY = -Infinity;
  let minY = Infinity;
  const hw = width * 0.5;
  const hd = depth * 0.5;
  for (const lx of [-hw, 0, hw]) {
    for (const lz of [-hd, 0, hd]) {
      const p = toWorld(x, z, ry, lx, lz);
      const h = world.heightAt(p.x, p.z);
      if (h > maxY) maxY = h;
      if (h < minY) minY = h;
    }
  }
  const baseY = maxY + 0.04;
  const depthY = Math.max(2.6, baseY - minY + 2.0);
  return { baseY, depthY };
}

// ---------------------------------------------------------------------------
// Construtor de malhas mescladas: tudo que for do mesmo material vira UM mesh (poucos draw calls).
// ---------------------------------------------------------------------------
const _bm = new THREE.Matrix4();
const _bq = new THREE.Quaternion();
const _be = new THREE.Euler();
const _bp = new THREE.Vector3();
const _bs = new THREE.Vector3(1, 1, 1);

class MeshBuilder {
  constructor() {
    this.parts = new Map();
  }

  _add(mat, geo, x, y, z, rx, ry, rz) {
    _be.set(rx, ry, rz);
    _bq.setFromEuler(_be);
    _bp.set(x, y, z);
    _bm.compose(_bp, _bq, _bs);
    geo.applyMatrix4(_bm);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
  }

  // caixa com UV proporcional ao tamanho (a textura repete em vez de esticar)
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * sizes[f][0] * 0.5, uv.getY(i) * sizes[f][1] * 0.5);
      }
    }
    this._add(mat, g, x, y, z, rx, ry, rz);
  }

  cyl(mat, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0) {
    this._add(mat, new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz);
  }

  cone(mat, r, h, seg, x, y, z, rx = 0, ry = 0, rz = 0) {
    this._add(mat, new THREE.ConeGeometry(r, h, seg), x, y, z, rx, ry, rz);
  }

  // triângulo (empena): vértices em ordem anti-horária vista de fora; UV em metros/2
  tri(mat, a, b, c) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([a[0] * 0.5, a[1] * 0.5, b[0] * 0.5, b[1] * 0.5, c[0] * 0.5, c[1] * 0.5], 2));
    g.computeVertexNormals();
    this._add(mat, g, 0, 0, 0, 0, 0, 0);
  }

  build(parent, castShadow = true) {
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.parts.clear();
  }
}

const smithStoneMat = new THREE.MeshStandardMaterial({ map: weatheredStoneTexture(), color: "#aaa497", roughness: 1, flatShading: true });
const smithPlasterMat = new THREE.MeshStandardMaterial({ map: weatheredWallTexture(), color: "#c9b48c", roughness: 1, flatShading: true });
const smithRoofMat = new THREE.MeshStandardMaterial({ map: tileTexture(), color: "#8a452f", roughness: 1, flatShading: true });
const smithWoodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), color: "#7a5a3c", roughness: 1, flatShading: true });
const smithDarkWoodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), color: "#3f2d1f", roughness: 1, flatShading: true });
const smithIronMat = new THREE.MeshStandardMaterial({ color: "#3d4244", metalness: 0.55, roughness: 0.5, flatShading: true });
const smithGlassMat = new THREE.MeshStandardMaterial({ color: "#2c3a44", emissive: "#e8a24c", emissiveIntensity: 0.55, roughness: 0.4, flatShading: true });
const smithEmberMat = new THREE.MeshStandardMaterial({ color: "#ff7b1c", emissive: "#dd4511", emissiveIntensity: 1.6, roughness: 0.5, flatShading: true });
const smithWaterMat = new THREE.MeshStandardMaterial({ color: "#10181c", metalness: 0.2, roughness: 0.2, flatShading: true });

/** Pegada da ferraria no espaço local: construção + abrigo da forja à direita. */
export const BLACKSMITH_FOOTPRINT = { hw: 5.1, hd: 3.45, cx: 1.5, cz: 0.1 };

function createBlacksmith(scene, world, x = 15, z = -27, ry = 0) {
  const W = 7.2;
  const D = 5.8;
  const H = 3.5;
  const pitch = 2.3;
  const LX = W / 2; // face externa da parede direita
  // chão: o ponto mais alto sob a construção E sob o abrigo da forja (nada flutua nem afunda)
  const sA = sampleFoundation(world, x, z, ry, W + 0.6, D + 1.2);
  const hearthC = toWorld(x, z, ry, LX + 1.7, 0);
  const sB = sampleFoundation(world, hearthC.x, hearthC.z, ry, 3.6, 5.8);
  const y = Math.max(sA.baseY, sB.baseY);
  const depthY = Math.max(sA.depthY, sB.depthY, y - Math.min(sA.baseY - sA.depthY, sB.baseY - sB.depthY) + 0.4);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);

  const b = new MeshBuilder();
  const stone = smithStoneMat;
  const plaster = smithPlasterMat;
  const wood = smithWoodMat;
  const dark = smithDarkWoodMat;
  const iron = smithIronMat;

  // --- fundação de pedra até o chão (construção + plataforma da forja) ---
  b.box(stone, W + 0.5, depthY + 0.04, D + 0.5, 0, -depthY / 2 + 0.02, 0);
  b.box(stone, 3.7, depthY + 0.04, 5.9, LX + 1.85, -depthY / 2 + 0.02, 0.0);
  b.box(stone, 2.2, depthY - 0.06, 0.8, 0, -depthY / 2 - 0.03, D / 2 + 0.45); // degrau da porta
  b.box(stone, 2.5, 0.16, 0.7, 0, 0.04, D / 2 + 0.4);

  // --- paredes: soco de pedra + reboco texturizado + enxaimel ---
  const wt = 0.34;
  b.box(stone, W, 0.9, wt, 0, 0.45, D / 2 - wt / 2); // frente
  b.box(stone, W, 0.9, wt, 0, 0.45, -D / 2 + wt / 2);
  b.box(stone, wt, 0.9, D - 2 * wt, -W / 2 + wt / 2, 0.45, 0);
  b.box(stone, wt, 0.9, D - 2 * wt, W / 2 - wt / 2, 0.45, 0);
  b.box(plaster, W, H - 0.9, wt, 0, 0.9 + (H - 0.9) / 2, D / 2 - wt / 2);
  b.box(plaster, W, H - 0.9, wt, 0, 0.9 + (H - 0.9) / 2, -D / 2 + wt / 2);
  b.box(plaster, wt, H - 0.9, D - 2 * wt, -W / 2 + wt / 2, 0.9 + (H - 0.9) / 2, 0);
  b.box(plaster, wt, H - 0.9, D - 2 * wt, W / 2 - wt / 2, 0.9 + (H - 0.9) / 2, 0);
  // vigas de enxaimel: cantos, travessas e contraventos
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.box(dark, 0.32, H + 0.1, 0.32, sx * (W / 2 - 0.06), (H + 0.1) / 2, sz * (D / 2 - 0.06));
  }
  for (const sz of [-1, 1]) {
    b.box(dark, W + 0.1, 0.26, 0.3, 0, H - 0.06, sz * (D / 2 - 0.04));
    b.box(dark, W - 0.2, 0.2, 0.28, 0, 1.95, sz * (D / 2 - 0.04));
    for (const sx of [-1, 1]) b.box(dark, 0.22, 1.5, 0.26, sx * 1.5, 2.2, sz * (D / 2 - 0.04), 0, 0, sx * sz * 0.55);
  }
  for (const sx of [-1, 1]) {
    b.box(dark, 0.3, 0.26, D + 0.1, sx * (W / 2 - 0.04), H - 0.06, 0);
    b.box(dark, 0.28, 0.2, D - 0.2, sx * (W / 2 - 0.04), 1.95, 0);
    for (const sz of [-1, 1]) b.box(dark, 0.22, 1.5, 0.26, sx * (W / 2 - 0.04), 2.2, sz * 1.3, sx * sz * 0.55, 0, 0);
  }

  // --- porta dupla de madeira com ferragens, soleira e verga de pedra ---
  const fz = D / 2;
  b.box(dark, 1.36, 2.35, 0.12, 0, 1.2, fz + 0.02);
  b.box(wood, 0.62, 2.2, 0.08, -0.33, 1.2, fz + 0.1);
  b.box(wood, 0.62, 2.2, 0.08, 0.33, 1.2, fz + 0.1);
  for (const yy of [0.55, 1.15, 1.8]) b.box(iron, 1.3, 0.1, 0.05, 0, yy, fz + 0.16);
  b.box(iron, 0.1, 0.16, 0.06, -0.14, 1.15, fz + 0.18);
  b.box(iron, 0.1, 0.16, 0.06, 0.14, 1.15, fz + 0.18);
  b.box(stone, 0.26, 2.5, 0.4, -0.78, 1.25, fz + 0.05);
  b.box(stone, 0.26, 2.5, 0.4, 0.78, 1.25, fz + 0.05);
  b.box(stone, 1.9, 0.3, 0.44, 0, 2.55, fz + 0.05);
  // --- janelas com moldura, vidro quente e venezianas abertas ---
  const win = (wx, wy, wz, rot) => {
    // rot = 0: janela na frente/fundo; rot = π/2: janela lateral
    const c = Math.cos(rot), s = Math.sin(rot);
    const at = (lx, lz) => [wx + lx * c + lz * s, wz - lx * s + lz * c];
    const [gx, gz] = at(0, 0);
    b.box(smithGlassMat, 0.8, 0.8, 0.06, gx, wy, gz, 0, rot, 0);
    b.box(dark, 1.04, 0.12, 0.14, gx, wy + 0.46, gz, 0, rot, 0);
    b.box(dark, 1.04, 0.12, 0.14, gx, wy - 0.46, gz, 0, rot, 0);
    b.box(dark, 0.12, 0.92, 0.14, gx - 0.46 * c, wy, gz + 0.46 * s, 0, rot, 0);
    b.box(dark, 0.12, 0.92, 0.14, gx + 0.46 * c, wy, gz - 0.46 * s, 0, rot, 0);
    b.box(dark, 0.06, 0.8, 0.1, gx, wy, gz, 0, rot, 0);
    const [lx1, lz1] = at(-0.78, 0.2);
    const [lx2, lz2] = at(0.78, 0.2);
    b.box(wood, 0.5, 0.95, 0.06, lx1, wy, lz1, 0, rot + 0.5, 0);
    b.box(wood, 0.5, 0.95, 0.06, lx2, wy, lz2, 0, rot - 0.5, 0);
  };
  win(-2.3, 1.75, fz + 0.04, 0);
  win(2.3, 1.75, fz + 0.04, 0);
  win(-W / 2 + 0.04, 1.75, -0.9, -Math.PI / 2);
  win(-W / 2 + 0.04, 1.75, 1.0, -Math.PI / 2);
  // placa pendurada: suporte de ferro + tábua com bigorna entalhada
  b.box(iron, 0.08, 0.08, 1.0, 1.85, 2.9, fz + 0.5);
  b.box(wood, 0.06, 0.62, 0.78, 1.85, 2.5, fz + 0.52);
  b.box(iron, 0.05, 0.16, 0.5, 1.9, 2.52, fz + 0.52);
  b.box(iron, 0.05, 0.08, 0.28, 1.9, 2.64, fz + 0.52);

  // --- telhado de duas águas com empenas, beiral e cumeeira ---
  const ovS = 0.55;
  const ovF = 0.5;
  const run = W / 2 + ovS;
  const rise = pitch + 0.12;
  const slopeLen = Math.hypot(run, rise);
  const ang = Math.atan2(rise, run);
  for (const sd of [-1, 1]) {
    b.box(smithRoofMat, slopeLen + 0.06, 0.2, D + 2 * ovF, sd * (run / 2), H - 0.1 + rise / 2 + 0.02, 0, 0, 0, -sd * ang);
    b.box(dark, 0.2, 0.18, D + 2 * ovF, sd * (W / 2 - 0.05), H - 0.2, 0); // barrote sob o beiral
  }
  b.box(dark, 0.4, 0.22, D + 2 * ovF + 0.1, 0, H + pitch + 0.1, 0);
  // empenas (triângulos de reboco) frente e fundo, com viga central
  for (const sz of [-1, 1]) {
    const zz = sz * (D / 2 - 0.08);
    if (sz > 0) b.tri(plaster, [-W / 2, H, zz], [W / 2, H, zz], [0, H + pitch, zz]);
    else b.tri(plaster, [W / 2, H, zz], [-W / 2, H, zz], [0, H + pitch, zz]);
    b.box(dark, 0.22, pitch, 0.26, 0, H + pitch / 2, zz + sz * 0.05);
    b.box(dark, 0.24, pitch * 0.95, 0.24, -W / 4, H + pitch * 0.36, zz + sz * 0.05, 0, 0, 0.52);
    b.box(dark, 0.24, pitch * 0.95, 0.24, W / 4, H + pitch * 0.36, zz + sz * 0.05, 0, 0, -0.52);
  }

  // --- abrigo da forja à direita: telhado inclinado + 2 postes ---
  const shedX0 = LX + 0.1;
  const shedX1 = LX + 3.5;
  const shedTop = H - 0.45;
  const shedLow = 2.45;
  const shedLen = Math.hypot(shedX1 - shedX0, shedTop - shedLow);
  const shedAng = Math.atan2(shedTop - shedLow, shedX1 - shedX0);
  b.box(smithRoofMat, shedLen + 0.3, 0.16, 5.6, (shedX0 + shedX1) / 2, (shedTop + shedLow) / 2, 0, 0, 0, shedAng);
  for (const sz of [-1, 1]) {
    b.box(dark, 0.22, shedLow, 0.22, shedX1 - 0.15, shedLow / 2, sz * 2.6);
    b.box(dark, 0.14, 0.14, 5.5, shedX1 - 0.15, shedLow - 0.1, 0);
  }

  // --- forja: lareira de pedra, brasas, coifa e chaminé que sobe além do beiral ---
  const hx = LX + 1.0;
  const hz = -1.2;
  b.box(stone, 1.7, 0.95, 1.5, hx, 0.475, hz);
  b.box(stone, 1.9, 0.12, 1.7, hx, 0.98, hz);
  b.box(smithEmberMat, 1.0, 0.1, 0.9, hx + 0.05, 1.0, hz + 0.1);
  b.box(smithEmberMat, 0.5, 0.45, 0.06, hx + 0.05, 0.45, hz + 0.78); // boca de brasa
  b.box(stone, 1.5, 0.8, 0.14, hx - 0.05, 1.5, hz - 0.62); // fundo da coifa
  b.box(stone, 0.14, 0.8, 1.2, hx - 0.78, 1.5, hz - 0.05);
  b.box(stone, 0.14, 0.8, 1.2, hx + 0.68, 1.5, hz - 0.05);
  b.box(stone, 1.7, 0.2, 1.4, hx, 1.95, hz - 0.1);
  const stackTop = H + pitch + 1.0;
  b.box(stone, 0.95, stackTop - 1.9, 0.95, hx, 1.9 + (stackTop - 1.9) / 2, hz - 0.2);
  b.box(stone, 1.2, 0.22, 1.2, hx, stackTop + 0.1, hz - 0.2);
  b.box(dark, 0.8, 0.12, 0.8, hx, stackTop + 0.28, hz - 0.2);
  // fole de couro com bico
  b.box(wood, 0.9, 0.12, 0.5, hx - 1.05, 0.62, hz + 0.5, 0, 0, -0.2);
  b.box(dark, 0.9, 0.12, 0.5, hx - 1.05, 0.9, hz + 0.5, 0, 0, -0.2);
  b.cyl(iron, 0.04, 0.06, 0.8, 5, hx - 0.6, 0.8, hz + 0.45, 0, 0, Math.PI / 2 + 0.2);
  // bigorna sobre toco, tina de têmpera, bancada e cremalheira de ferramentas
  const ax = LX + 2.35;
  const az = 0.9;
  b.cyl(dark, 0.34, 0.4, 0.6, 7, ax, 0.3, az);
  b.box(iron, 0.42, 0.22, 0.62, ax, 0.71, az);
  b.box(iron, 0.62, 0.14, 0.26, ax, 0.89, az);
  b.cone(iron, 0.12, 0.42, 5, ax + 0.5, 0.88, az, 0, 0, -Math.PI / 2);
  b.cyl(dark, 0.4, 0.44, 0.9, 8, LX + 2.95, 0.45, -1.8);
  b.cyl(smithWaterMat, 0.34, 0.34, 0.04, 8, LX + 2.95, 0.88, -1.8);
  for (const yy of [0.25, 0.7]) b.cyl(iron, 0.425, 0.425, 0.05, 8, LX + 2.95, yy, -1.8);
  const bx = LX + 2.55;
  const bz = 2.05;
  b.box(wood, 1.7, 0.1, 0.7, bx, 0.95, bz);
  for (const lx of [-0.75, 0.75]) for (const lz of [-0.28, 0.28]) b.box(dark, 0.12, 0.92, 0.12, bx + lx, 0.46, bz + lz);
  b.box(iron, 0.3, 0.07, 0.12, bx - 0.4, 1.03, bz); // martelo
  b.box(dark, 0.05, 0.05, 0.5, bx - 0.4, 1.03, bz + 0.1);
  b.box(iron, 0.07, 0.04, 0.45, bx + 0.2, 1.01, bz - 0.1, 0, 0.3, 0); // tenaz
  b.box(iron, 0.18, 0.12, 0.18, bx + 0.6, 1.06, bz + 0.1); // bloco de ferro
  b.box(wood, 0.06, 0.7, 1.6, LX + 0.1, 1.7, 1.55); // cremalheira na parede
  for (let i = 0; i < 4; i++) {
    b.box(iron, 0.05, 0.5 - i * 0.04, 0.07, LX + 0.17, 1.65, 0.95 + i * 0.36);
    b.box(dark, 0.05, 0.22, 0.09, LX + 0.17, 1.35 - i * 0.02, 0.95 + i * 0.36);
  }
  // barras de ferro encostadas e sacos de carvão
  for (let i = 0; i < 4; i++) b.box(iron, 0.07, 1.5, 0.07, -W / 2 + 0.5 + i * 0.12, 0.78, D / 2 + 0.2, 0.18, 0, 0.04 * i);
  b.box(dark, 0.55, 0.45, 0.4, -W / 2 + 1.6, 0.23, D / 2 + 0.35, 0, 0.3, 0);
  b.box(dark, 0.5, 0.4, 0.38, -W / 2 + 2.1, 0.2, D / 2 + 0.3, 0, -0.2, 0);

  // --- pilha de lenha encostada na parede esquerda (toras empilhadas em fileiras) ---
  const wx0 = -W / 2 - 0.45;
  for (let row = 0; row < 3; row++) {
    const n = 5 - row;
    for (let k = 0; k < n; k++) {
      const zz = (k - (n - 1) / 2) * 0.32;
      b.cyl(wood, 0.14, 0.14, 0.9, 6, wx0 + (k % 2) * 0.03, 0.15 + row * 0.27, zz, Math.PI / 2, 0, 0);
    }
  }
  b.box(dark, 0.9, 0.08, 1.8, wx0, 0.82 + 0.3, 0, 0, 0, 0.08);

  b.build(group, true);

  // colisores: corpo da construção, lareira, bigorna, tina e bancada (o resto fica livre)
  world.addOrientedBox(x, z, W, D, ry, y - depthY, y + H + pitch, { move: true, shot: true, cam: true });
  const hp = toWorld(x, z, ry, hx, hz);
  world.addOrientedBox(hp.x, hp.z, 1.8, 1.6, ry, y - depthY, y + 1.1, { move: true, shot: true, cam: false });
  const ap = toWorld(x, z, ry, ax, az);
  world.addOrientedBox(ap.x, ap.z, 0.7, 0.7, ry, y, y + 0.95, { move: true, shot: true, cam: false });
  const bp = toWorld(x, z, ry, bx, bz);
  world.addOrientedBox(bp.x, bp.z, 1.7, 0.7, ry, y, y + 1.05, { move: true, shot: true, cam: false });
  const tp = toWorld(x, z, ry, LX + 2.95, -1.8);
  world.addOrientedBox(tp.x, tp.z, 0.85, 0.85, ry, y, y + 0.95, { move: true, shot: true, cam: false });
  // plataforma da forja caminhável (o terreno ao redor pode estar mais baixo: degraus virtuais evitam o salto)
  const platC = toWorld(x, z, ry, LX + 1.85, 0);
  world.addOrientedFloor?.(platC.x, platC.z, 3.7, 5.9, ry, y - 0.02);
  return { ...toWorld(x, z, ry, -4.5, 5.6), name: "Forja de Bracken", footprint: BLACKSMITH_FOOTPRINT, ry, buildingX: x, buildingZ: z };
}

function createMarket(scene, world, x = -15, z = -22, ry = 0) {
  const { baseY: y, depthY } = sampleFoundation(world, x, z, ry, 5.8, 4.6);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);
  // Base de pedra sólida até o chão sob o mercado
  addBox(group, stoneMat, 0, -depthY / 2 + 0.02, 0, 5.8, depthY + 0.04, 4.6, true);
  const postGeometry = new THREE.CylinderGeometry(0.13, 0.17, 3.1, 5);
  for (const px of [-2.2, 2.2]) {
    for (const pz of [-1.65, 1.65]) {
      addMesh(group, postGeometry, timberMat, px, 1.55, pz);
      const postWorld = toWorld(x, z, ry, px, pz);
      world.addOrientedBox(postWorld.x, postWorld.z, 0.34, 0.34, ry, y, y + 3.05, { move: true, shot: true, cam: false });
    }
  }
  addBox(group, timberMat, 0, 2.98, 0, 5.2, 0.22, 4.2);
  addBox(group, clothRedMat, -1.31, 3.18, 0, 2.6, 0.16, 4.3);
  addBox(group, clothCreamMat, 1.31, 3.18, 0, 2.6, 0.16, 4.3);
  // Toldo superior só bloqueia tiros na altura do telhado (2.88m..3.32m), deixando o interior livre!
  world.addOrientedBox(x, z, 5.2, 4.3, ry, y + 2.88, y + 3.32, { move: false, shot: true, cam: false });

  addBox(group, timberMat, 0, 1.2, 1.45, 4.5, 0.25, 0.8);
  addBox(group, timberMat, 0, 0.7, 1.45, 4.7, 0.18, 0.9);
  const counterWorld = toWorld(x, z, ry, 0, 1.45);
  world.addOrientedBox(counterWorld.x, counterWorld.z, 4.65, 0.88, ry, y, y + 1.34, { move: true, shot: true, cam: false });

  for (let i = 0; i < 3; i++) {
    const cx = -1.6 + i * 1.5;
    const crate = addMesh(group, new THREE.BoxGeometry(0.7, 0.65, 0.7), i === 1 ? clothCreamMat : timberMat, cx, 0.35, -0.5);
    crate.rotation.y = (i - 1) * 0.16;
    const crateWorld = toWorld(x, z, ry, cx, -0.5);
    world.addOrientedBox(crateWorld.x, crateWorld.z, 0.72, 0.72, ry, y, y + 0.72, { move: true, shot: true, cam: false });
  }
  addMesh(group, new THREE.CylinderGeometry(0.38, 0.42, 0.9, 7), timberMat, 2.8, 0.45, 1.7);
  const barrelWorld = toWorld(x, z, ry, 2.8, 1.7);
  world.addOrientedBox(barrelWorld.x, barrelWorld.z, 0.8, 0.8, ry, y, y + 0.9, { move: true, shot: true, cam: false });
  return { ...toWorld(x, z, ry, 3.5, 3.6), name: "Mercado da Estrada" };
}

function createGate(scene, world) {
  const x = 0;
  const z = -48;
  const { baseY: y, depthY } = sampleFoundation(world, x, z, 0, 10.6, 2.0);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  for (const px of [-4.6, 4.6]) {
    addBox(group, stoneMat, px, -depthY / 2 + 0.05, 0, 1.5, depthY + 0.1, 1.6, true);
    addMesh(group, new THREE.BoxGeometry(1.15, 6.4, 1.25), stoneMat, px, 3.2, 0, true);
    addMesh(group, new THREE.ConeGeometry(0.9, 1.4, 4), darkTimberMat, px, 7, 0);
    addBox(group, timberMat, px, 2.25, 0.8, 0.28, 3.4, 0.3);
    addBox(group, timberMat, px, 2.1, -0.8, 0.28, 3.1, 0.3);
    world.addBox(px - 0.62, px + 0.62, z - 0.68, z + 0.68, y - depthY, y + 7.5, { move: true, shot: true, cam: true });
  }
  addBox(group, timberMat, 0, 5.5, 0, 10.4, 0.7, 1.4, true);
  addBox(group, darkTimberMat, 0, 4.85, 0, 8.2, 0.35, 1.5);
  addMesh(group, new THREE.ConeGeometry(0.72, 1.4, 5), clothRedMat, 0, 7.3, 0.15).rotation.z = Math.PI;
  addBox(group, clothCreamMat, 0, 7.25, 0.22, 0.1, 0.9, 0.08, false);
  // Viga superior do portão: bloqueia tiros no alto, mas deixa a passagem livre embaixo
  world.addBox(-5.2, 5.2, z - 0.75, z + 0.75, y + 4.68, y + 5.88, { move: false, shot: true, cam: true });
  return { x: 0, z: -40.5, name: "Portão de Caldera" };
}

function createWell(scene, world, x = 5, z = -14) {
  const { baseY: y, depthY } = sampleFoundation(world, x, z, 0, 2.8, 2.8);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  // Base de pedra do poço indo até o chão
  addMesh(group, new THREE.CylinderGeometry(1.36, 1.52, depthY, 8), stoneMat, 0, -depthY / 2 + 0.02, 0, true);
  addMesh(group, new THREE.CylinderGeometry(1.18, 1.35, 0.9, 8), stoneMat, 0, 0.45, 0);
  addMesh(group, new THREE.CylinderGeometry(0.82, 0.92, 0.14, 8), darkTimberMat, 0, 0.93, 0, false);
  for (const px of [-1.12, 1.12]) {
    addMesh(group, new THREE.CylinderGeometry(0.1, 0.14, 2.5, 5), timberMat, px, 1.85, 0);
    // Colisor apenas nas duas hastes de madeira laterais (o vão central fica 100% livre para flechas!)
    world.addBox(x + px - 0.14, x + px + 0.14, z - 0.14, z + 0.14, y + 0.9, y + 3.1, { move: false, shot: true, cam: false });
  }
  addBox(group, timberMat, 0, 3.08, 0, 2.8, 0.18, 0.2);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.16, 1.8, 5), darkTimberMat, 0.75, 2.3, 0).rotation.z = Math.PI / 2;
  addMesh(group, new THREE.ConeGeometry(1.55, 1.05, 4), roofMat, 0, 3.62, 0).rotation.y = Math.PI / 4;
  // Mureta circular de pedra na base (altura até 1.0m): bloqueia andar e tiros baixos, sem bloquear o vão aberto acima!
  world.addStaticCollider(x, z, 1.28, 1.0);
  // Telhado do poço no alto (3.0m a 4.1m)
  world.addBox(x - 1.15, x + 1.15, z - 1.15, z + 1.15, y + 3.0, y + 4.1, { move: false, shot: true, cam: false });
  return { x, z };
}

function createFarm(scene, world, centerX = -58, centerZ = -14) {
  if (world && world.farming) {
    world.farming.createFarmlandField(centerX, centerZ, 4, 8, 1.8, 1.5);
  }
  return { x: centerX, z: centerZ };
}

function createRoad(scene, world) {
  const stoneGeometry = new THREE.DodecahedronGeometry(0.38, 0);
  const roadMaterial = new THREE.MeshStandardMaterial({ color: "#88806c", roughness: 1, flatShading: true });
  const stones = new THREE.InstancedMesh(stoneGeometry, roadMaterial, 128);
  stones.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  let index = 0;
  let state = 94821;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  for (let z = -7; z >= -48; z -= 1.2) {
    const x = (random() - 0.5) * 3.1;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.18, (random() - 0.5) * 0.8, random() * 0.18);
    dummy.scale.set(0.8 + random() * 0.45, 0.42 + random() * 0.28, 0.8 + random() * 0.45);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  for (let x = -14; x <= 14; x += 1.1) {
    const z = -21 + (random() - 0.5) * 3;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.2, (random() - 0.5) * 0.9, random() * 0.2);
    dummy.scale.set(0.78 + random() * 0.42, 0.42 + random() * 0.28, 0.78 + random() * 0.42);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  for (let x = -10; x >= -28; x -= 1.15) {
    const z = (random() - 0.5) * 2.4;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.2, (random() - 0.5) * 0.9, random() * 0.2);
    dummy.scale.set(0.76 + random() * 0.44, 0.42 + random() * 0.28, 0.78 + random() * 0.42);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  for (let x = 9; x <= 30; x += 1.15) {
    const z = -26 + (random() - 0.5) * 1.8;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.2, (random() - 0.5) * 0.9, random() * 0.2);
    dummy.scale.set(0.76 + random() * 0.44, 0.42 + random() * 0.28, 0.78 + random() * 0.42);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  for (let x = -14; x >= -25; x -= 1.15) {
    const z = -26 + (random() - 0.5) * 1.8;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.2, (random() - 0.5) * 0.9, random() * 0.2);
    dummy.scale.set(0.76 + random() * 0.44, 0.42 + random() * 0.28, 0.78 + random() * 0.42);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  stones.count = index;
  stones.instanceMatrix.needsUpdate = true;
  stones.computeBoundingBox();
  stones.computeBoundingSphere();
  stones.castShadow = false;
  stones.receiveShadow = true;
  scene.add(stones);
}

function createCottage(scene, world, x, z, variant = 0, ry = 0) {
  const width = variant === 2 ? 8 : 6.4;
  const depth = variant === 2 ? 6.2 : 5.4;
  const { baseY, depthY } = sampleFoundation(world, x, z, ry, width + 0.5, depth + 0.5);
  const group = new THREE.Group();
  group.position.set(x, baseY, z);
  group.rotation.y = ry;
  scene.add(group);
  const wall = variant === 0 ? wallMat : variant === 1 ? paleWallMat : fadedWallMat;
  const roofMaterial = variant === 1 ? darkTimberMat : roofMat;
  addBox(group, stoneMat, 0, -depthY / 2 + 0.18, 0, width + 0.45, depthY + 0.36, depth + 0.45, true);
  addBox(group, wall, 0, 1.9, 0, width, 3.7, depth, true);
  const roof = addMesh(group, createGableRoof(), roofMaterial, 0, 3.68, 0, true);
  roof.scale.set(width / 5.4, 1, depth / 4.4);
  addBox(group, darkTimberMat, 0, 1.02, depth / 2 + 0.11, 0.95, 2.04, 0.18);
  for (const px of [-width * 0.3, width * 0.3]) {
    addBox(group, timberMat, px, 2.05, depth / 2 + 0.1, 0.15, 4.05, 0.2);
    addMesh(group, new THREE.BoxGeometry(0.72, 0.82, 0.12), clothCreamMat, px * 0.72, 2.15, depth / 2 + 0.14, false);
  }
  const chimney = addMesh(group, new THREE.CylinderGeometry(0.34, 0.42, 2.1, 5), darkTimberMat, width * 0.31, 5.0, -depth * 0.18);
  chimney.rotation.z = -0.12;
  if (variant === 2) {
    addBox(group, timberMat, 0, 2.85, depth / 2 + 0.24, 2.4, 0.72, 0.16);
    addBox(group, clothRedMat, 0, 2.86, depth / 2 + 0.34, 1.75, 0.42, 0.07, false);
    addMesh(group, new THREE.CylinderGeometry(0.38, 0.42, 0.8, 7), timberMat, -2.4, 0.42, depth / 2 + 0.6);
    addMesh(group, new THREE.CylinderGeometry(0.38, 0.42, 0.8, 7), timberMat, 2.4, 0.42, depth / 2 + 0.6);
  }
  world.addOrientedBox(x, z, width, depth, ry, baseY - depthY, baseY + 5.6, { move: true, shot: true, cam: true });
}

function createChurch(scene, world, x, z, ry, name, houses = null) {
  const church = createChurchBuilding(scene, world, {
    id: `church-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    x,
    z,
    ry,
    seed: Math.round(Math.abs(x * 31 + z * 17)) + 777,
  });
  if (houses) houses.push(church);
  return church;
}

function createTownBench(scene, world, x, z, ry = 0, label = "E · sentar no banco da praça") {
  const y = world.heightAt(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);
  addBox(group, darkTimberMat, 0, 0.44, 0, 1.55, 0.08, 0.42, true);
  addBox(group, timberMat, 0, 0.72, -0.18, 1.55, 0.48, 0.08, true);
  for (const lx of [-0.65, 0.65]) {
    addBox(group, darkTimberMat, lx, 0.22, 0, 0.1, 0.44, 0.38, true);
  }
  return {
    x,
    z,
    yaw: ry,
    isChurchPew: false,
    label,
  };
}

function createWatchTower(scene, world, x, z) {
  const { baseY: y, depthY } = sampleFoundation(world, x, z, 0, 7.0, 7.0);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  addMesh(group, new THREE.CylinderGeometry(3.55, 3.85, depthY, 8), stoneMat, 0, -depthY / 2 + 0.05, 0, true);
  addMesh(group, new THREE.CylinderGeometry(3.1, 3.5, 11, 8), stoneMat, 0, 5.5, 0, true);
  addMesh(group, new THREE.CylinderGeometry(3.7, 3.1, 1.2, 8), darkTimberMat, 0, 11.4, 0, true);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    addBox(group, stoneMat, Math.cos(angle) * 3.5, 12.4, Math.sin(angle) * 3.5, 0.9, 1, 0.9).rotation.y = -angle;
  }
  addMesh(group, new THREE.ConeGeometry(2.7, 3.4, 8), roofMat, 0, 14.2, 0);
  addBox(group, darkTimberMat, 0, 1.1, 3.35, 1.2, 2.2, 0.2);
  addMesh(group, new THREE.ConeGeometry(0.72, 1.5, 5), clothRedMat, 0, 17.6, 0).rotation.z = Math.PI;
  world.addStaticCollider(x, z, 3.38, 14);
}

// ---------------------------------------------------------------------------
// Colocação sem sobreposição: toda construção consulta o registro de pegadas (placement.js).
// Se o local sorteado estiver ocupado, usa o ponto livre mais próximo; se não houver, a construção é pulada.
// ---------------------------------------------------------------------------
const snapYaw = (r) => (((Math.round(r / (Math.PI / 2)) % 4) + 4) % 4) * (Math.PI / 2);

function houseDims(seed) {
  const r = makeRandom(seed * 40503 + 7);
  return { width: (5.4 + r() * 2.4) * _villageScale, depth: (4.8 + r() * 2.0) * _villageScale };
}

// Cria a casa no ponto livre mais próximo de base.x/z. center = (cx, cz) para manter a porta voltada ao centro.
function placeHouse(scene, world, houses, base, center = null, search = 16) {
  const dims = base.width && base.depth ? { width: base.width, depth: base.depth } : houseDims(base.seed);
  const hw = dims.width / 2 + 0.7;
  const hd = dims.depth / 2 + 1.0;
  let ry = snapYaw(base.ry);
  const spot = findSpot(base.x, base.z, hw, hd, ry, { world, maxRadius: search, maxSlope: 3.0 });
  if (!spot) return null;
  if (center) {
    const ry2 = snapYaw(Math.atan2(center.x - spot.x, center.z - spot.z));
    if (ry2 !== ry && canPlace(spot.x, spot.z, hw, hd, ry2)) ry = ry2;
  }
  const house = createHouse(scene, world, { ...base, x: spot.x, z: spot.z, ry, width: dims.width, depth: dims.depth });
  reserve(spot.x, spot.z, hw, hd, ry, "house", base.id);
  houses.push(house);
  return house;
}

// Igreja: pegada do prédio + corredor da escadaria de acesso à frente da porta
function reserveChurch(x, z, ry, id) {
  const r = snapYaw(ry);
  const c = Math.cos(r);
  const s = Math.sin(r);
  reserve(x, z, 3.4 + 0.7, 4.9 + 0.7, r, "church", id);
  const sd = 4.9 + 3.6; // centro do corredor da escadaria, à frente da porta
  reserve(x + sd * s, z + sd * c, 1.7, 3.6, r, "stairs", id + "-stairs", null, id);
}

function reserveBlacksmith(x, z, ry, id) {
  const fp = BLACKSMITH_FOOTPRINT;
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  reserve(x + fp.cx * c + fp.cz * s, z - fp.cx * s + fp.cz * c, fp.hw, fp.hd, ry, "blacksmith", id);
}

const MARKET_FOOTPRINT = { hw: 3.2, hd: 2.9 };

function createVillage(scene, world, village, houses) {
  const random = makeRandom(village.seed * 7919);
  const cx = village.x;
  const cz = village.z;
  const center = { x: cx, z: cz };
  const well = createWell(scene, world, cx, cz);
  reserve(cx, cz, 1.8, 1.8, 0, "well", `${village.id}-well`);
  const faceCenter = (x, z) => Math.atan2(cx - x, cz - z);

  // Chalés em anel, com a porta voltada para o poço.
  // CAOS: nº de casas do anel varia (4..7), o anel pode ser mais largo/solto e cada vila ganha um estilo próprio.
  // worldRand (e não `random`) mantém o sorteio do mundo canônico intacto quando o caos é 0.
  const chaos = getWorldChaos();
  const count = village.kind === "watch" ? 2 : clamp(5 + Math.round((worldRand(village.seed, 31) - 0.5) * 3.2 * chaos), 4, 7);
  setHouseStyle(
    chaos > 0
      ? {
          r: 1 + (worldRand(village.seed, 20) - 0.5) * 0.34 * chaos,
          g: 1 + (worldRand(village.seed, 21) - 0.5) * 0.3 * chaos,
          b: 1 + (worldRand(village.seed, 22) - 0.5) * 0.34 * chaos,
          h: 1 + (worldRand(village.seed, 23) - 0.5) * 0.5 * chaos,
          pitch: 1 + (worldRand(village.seed, 24) - 0.5) * 0.8 * chaos,
        }
      : null,
  );
  _villageScale = 1 + (worldRand(village.seed, 25) - 0.5) * 0.4 * chaos;
  const startAngle = random() * Math.PI * 2;
  const slots = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (i / count) * Math.PI * 2 + (random() - 0.5) * 0.25;
    const radius = 15 + random() * 3.5 + worldRand(village.seed, 50 + i) * 4.5 * chaos;
    slots.push({ angle, x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius });
  }

  const points = { well, home: [], work: null, patrol: [] };
  let workSlot = null;
  if (village.kind === "forge") workSlot = slots.pop();
  else if (village.kind === "market") workSlot = slots.pop();
  else if (village.kind === "farm") workSlot = slots.pop();

  // 1) pontos FIXOS primeiro (igreja no eixo cardeal e torre de vigia): as casas se acomodam ao redor deles.
  // A igreja só gira em passos de 90° (colisores alinhados aos eixos). Para a porta ficar EXATAMENTE
  // voltada para o poço, a capela é posta sobre o eixo cardeal mais próximo do ângulo sorteado.
  const rawChurchAngle = startAngle + Math.PI / count;
  const cardinal = Math.round(rawChurchAngle / (Math.PI / 2)) * (Math.PI / 2);
  const dirX = Math.round(Math.cos(cardinal));
  const dirZ = Math.round(Math.sin(cardinal));
  const churchRy = Math.atan2(-dirX, -dirZ);
  let churchDist = 28;
  for (let d = 28; d <= 40; d += 2) {
    const px = cx + dirX * d;
    const pz = cz + dirZ * d;
    if (canPlace(px, pz, 4.1, 5.6, churchRy)) { churchDist = d; break; }
  }
  const churchX = cx + dirX * churchDist;
  const churchZ = cz + dirZ * churchDist;
  reserveChurch(churchX, churchZ, churchRy, `${village.id}-church`);

  let tower = null;
  if (village.kind === "watch") {
    tower = findSpot(cx + 7, cz - 8, 4.1, 4.1, 0, { world, maxRadius: 10, step: 1.0, maxSlope: 3.5 }) || { x: cx + 7, z: cz - 8 };
    reserve(tower.x, tower.z, 4.1, 4.1, 0, "tower", `${village.id}-tower`);
  }

  // 2) chalés do anel
  for (const slot of slots) {
    const house = placeHouse(scene, world, houses, {
      id: `${village.id}-${houses.length}`,
      name: `Casa de ${village.name}`,
      x: slot.x,
      z: slot.z,
      ry: faceCenter(slot.x, slot.z),
      seed: village.seed * 31 + houses.length,
    }, center);
    if (house) points.home.push({ x: cx + Math.cos(slot.angle) * 9, z: cz + Math.sin(slot.angle) * 9 });
  }
  if (points.home.length === 0) points.home.push({ x: cx + 9, z: cz });

  // 3) construção de trabalho da vila
  const fp = BLACKSMITH_FOOTPRINT;
  if (village.kind === "forge") {
    const ry = faceCenter(workSlot.x, workSlot.z);
    const spot = findSpot(workSlot.x, workSlot.z, fp.hw, fp.hd, ry, { world, maxRadius: 18, maxSlope: 1.4, offset: { lx: fp.cx, lz: fp.cz } })
      || findSpot(workSlot.x, workSlot.z, fp.hw, fp.hd, ry, { world, maxRadius: 24, maxSlope: 2.4, offset: { lx: fp.cx, lz: fp.cz } });
    if (spot) {
      reserveBlacksmith(spot.x, spot.z, ry, `${village.id}-forge`);
      points.work = createBlacksmith(scene, world, spot.x, spot.z, ry);
    }
  } else if (village.kind === "market") {
    const ry = faceCenter(workSlot.x, workSlot.z);
    const spot = findSpot(workSlot.x, workSlot.z, MARKET_FOOTPRINT.hw, MARKET_FOOTPRINT.hd, ry, { world, maxRadius: 18, maxSlope: 1.6 });
    if (spot) {
      reserve(spot.x, spot.z, MARKET_FOOTPRINT.hw, MARKET_FOOTPRINT.hd, ry, "market", `${village.id}-market`);
      points.work = createMarket(scene, world, spot.x, spot.z, ry);
    }
  } else if (village.kind === "farm") {
    const fx0 = cx + Math.cos(workSlot.angle) * 38;
    const fz0 = cz + Math.sin(workSlot.angle) * 38;
    const spot = findSpot(fx0, fz0, 4.9, 7.6, 0, { world, maxRadius: 16, margin: 2.4, maxSlope: 2.6 });
    const fx = spot ? spot.x : fx0;
    const fz = spot ? spot.z : fz0;
    if (spot) {
      reserve(fx, fz, 4.9, 7.6, 0, "field", `${village.id}-field`);
      createFarm(scene, world, fx, fz);
    }
    points.work = { x: fx, z: fz };
    points.farmPath = [
      { x: fx - 4.4, z: fz + 7.1 }, { x: fx + 4.4, z: fz + 7.1 },
      { x: fx + 4.4, z: fz - 6.1 }, { x: fx - 4.4, z: fz - 6.1 },
    ];
  } else if (tower) {
    createWatchTower(scene, world, tower.x, tower.z);
    const tx = tower.x;
    const tz = tower.z;
    points.patrol = [
      { x: tx - 5.4, z: tz + 5.4 }, { x: tx + 5.4, z: tz + 5.4 },
      { x: tx + 5.4, z: tz - 5.4 }, { x: tx - 5.4, z: tz - 5.4 },
    ];
  }

  points.church = createChurch(scene, world, churchX, churchZ, churchRy, `Igreja de ${village.name}`, houses);

  setHouseStyle(null); // o estilo é da vila: não vaza para as demais construções
  _villageScale = 1;
  return { village, ...points };
}

function createKingdomRoads(scene, world) {
  const stones = [];
  let state = 5527;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  for (let r = 0; r < ROADS.length; r++) {
    const [ax, az, bx, bz] = ROADS[r];
    const length = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / length;
    const dz = (bz - az) / length;
    for (let d = 0; d < length; d += 1.15) {
      const lateral = (random() - 0.5) * 3.1;
      const x = ax + dx * d - dz * lateral;
      const z = az + dz * d + dx * lateral;
      stones.push({ x, z, ry: (random() - 0.5) * 0.8, tilt: random() * 0.18, sx: 0.8 + random() * 0.45, sy: 0.42 + random() * 0.28 });
    }
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.38, 0),
    new THREE.MeshStandardMaterial({ color: "#88806c", roughness: 1, flatShading: true }),
    stones.length,
  );
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < stones.length; i++) {
    const stone = stones[i];
    dummy.position.set(stone.x, world.heightAt(stone.x, stone.z) + 0.12, stone.z);
    dummy.rotation.set(stone.tilt, stone.ry, stone.tilt);
    dummy.scale.set(stone.sx, stone.sy, stone.sx);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// Campos de cultivo criados em main.js: reservados aqui para nenhuma construção nascer em cima deles
const CAPITAL_FIELDS = [
  [-58, -14, 4, 8], [-74, 38, 3, 7], [88, -48, 3, 7], [-126, -42, 4, 8], [-92, -144, 4, 8],
];

export function createSettlement(scene, world) {
  resetPlacement();
  for (let i = 0; i < CAPITAL_FIELDS.length; i++) {
    // só os 2 primeiros campos existem em qualquer mundo; os outros 3 só no mundo canônico (main.js). Reservar os
    // inexistentes deixava pegadas "fantasma" no meio do caminho de vilas/igrejas geradas por seed.
    if (i >= 2 && !isCanonicalWorld()) continue;
    const [fx, fz, rows, cols] = CAPITAL_FIELDS[i];
    reserve(fx, fz, (rows * 1.8) / 2 + 1.8, (cols * 1.5) / 2 + 1.8, 0, "field", `field-${fx}-${fz}`);
  }
  createRoad(scene, world);
  const well = createWell(scene, world);
  reserve(5, -14, 1.8, 1.8, 0, "well", "caldera-well");
  const blacksmith = createBlacksmith(scene, world);
  reserveBlacksmith(15, -27, 0, "caldera-forge");
  const market = createMarket(scene, world);
  reserve(-15, -22, MARKET_FOOTPRINT.hw, MARKET_FOOTPRINT.hd, 0, "market", "caldera-market");
  const gate = createGate(scene, world);
  reserve(0, -48, 5.6, 1.4, 0, "gate", "caldera-gate");
  reserveChurch(-14, -8, 0, "caldera-church");

  const houses = [];
  const house = (x, z, ry, seed, extra = {}) => placeHouse(scene, world, houses, { id: `caldera-${houses.length}`, x, z, ry, seed, ...extra }, null, 14);
  house(25, -14, -Math.PI / 2, 101, { type: "inn", name: "Pousada de Caldera", price: 5, width: 7.4, depth: 6.4 });
  house(26, -31, -Math.PI / 2, 102, { name: "Casa de Caldera" });
  house(-24, -28, Math.PI / 2, 103, { name: "Casa de Caldera" });
  house(-25, -43, Math.PI / 2, 104, { name: "Casa de Caldera" });
  house(30, -45, -Math.PI / 2, 105, { name: "Casa de Caldera" });

  createKingdomRoads(scene, world);
  const villages = VILLAGES.map((village) => createVillage(scene, world, village, houses));

  // Beacon de Caldera (centro da capital) e de cada vila para orientação noturna a longa distância
  addCityBeacon(scene, 0, -20, 0xffa834, 70, world);
  for (let i = 0; i < VILLAGES.length; i++) {
    const v = VILLAGES[i];
    addCityBeacon(scene, v.x, v.z, 0xffaa40, 55, world);
  }

  const hay = [];
  const torchSpots = [];
  const post = (x0, z0) => {
    // validação "existe algo perto?": o poste nunca nasce dentro/colado em uma construção; se cair em uma,
    // vai para o ponto livre mais próximo (até 8 m) ou é descartado
    const free = nearestFreePoint(x0, z0, 0.9, 8);
    if (!free) return;
    const { x, z } = free;
    // reserva a pegada do poste: construções criadas DEPOIS (cidade procedural, vilas) passam a evitá-lo
    reserve(x, z, 0.3, 0.3, 0, "prop", `post-${Math.round(x * 10)}-${Math.round(z * 10)}`);
    world.addStaticCollider(x, z, 0.2, 2.4);
    torchSpots.push({ x, y: world.heightAt(x, z) + 2.3, z, nx: 0, nz: 0, post: true });
  };
  const capitalChurch = createChurch(scene, world, -14, -8, 0, "Igreja de Caldera", houses);
  const churches = [capitalChurch, ...villages.map((v) => v.church)];
  const wells = [well, ...villages.map((v) => v.well)];
  const townBenches = [
    createTownBench(scene, world, 8.2, -14.0, -Math.PI / 2, "E · sentar no banco da praça"),
    createTownBench(scene, world, 1.8, -14.0, Math.PI / 2, "E · sentar no banco da praça"),
    createTownBench(scene, world, -9.2, -2.5, 0, "E · sentar no banco do pátio da igreja"),
    createTownBench(scene, world, -9.5, -21.0, Math.PI / 2, "E · sentar no banco do mercado"),
  ];
  for (const house of houses) {
    for (const spot of house.torchSpots) torchSpots.push({ ...spot, post: false });
  }
  // postes na estrada principal, pontos centrais de Caldera e em volta dos poços das vilas
  for (const z of [-14, -28, -42]) {
    post(-3.8, z);
    post(3.8, z);
  }
  post(-4.2, -56); // Portão norte de Caldera
  post(4.2, -56);
  post(-12.0, -21.0); // Praça do Mercado de Caldera
  post(-7.5, -21.0);
  post(-9.0, -4.5);  // Pátio da Igreja de Caldera
  post(-14.0, -4.5);
  post(17.0, -4.0);  // Área externa do Ferreiro
  post(23.0, -4.0);
  for (const place of villages) {
    for (const [dx, dz] of [[3.6, 3.6], [-3.6, 3.6], [3.6, -3.6], [-3.6, -3.6]]) post(place.village.x + dx, place.village.z + dz);
  }
  // feno: na horta da capital, nas hortas das vilas e junto de casas de palha
  const bale = (x, z, ry = 0) => {
    if (!world.isBlockedAt(x, z, 0.8)) hay.push(createHay(scene, world, x, z, ry));
  };
  bale(-26, 5);
  bale(-25.8, 3.6, 0.4);
  for (const place of villages) if (place.farmPath) {
    bale(place.work.x + 7, place.work.z + 8);
    bale(place.work.x + 7.4, place.work.z + 6.8, 0.5);
  }
  houses.forEach((house, i) => {
    if (house.thatch && i % 2 === 0) bale(house.outer.maxX + 1.0, house.outer.minZ + 1.3, i * 0.7);
  });
  const stands = churches.map((c) => c.stand);
  const settlementData = { blacksmith, market, gate, well, wells, townBenches, villages, churches, houses, hay, torchSpots, stands };
  settlementData.cityData = generateCity(isCanonicalWorld() ? 104729 : Math.floor(worldRand(104729) * 900000) + 1000, scene, sharedHouseMat, world, settlementData);

  return settlementData;
}
