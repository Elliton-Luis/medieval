import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ============================================================================
// Kit de flecha e arco (baixo-poli, uma malha fundida por peça, cor por vértice).
//  - Flecha: haste de madeira, ponta metálica em losango e 3 penas cruzadas na cauda. Aponta para +Z
//    (Object3D.lookAt aponta o +Z para o alvo), então basta orientar pela velocidade.
//  - Arco: haste curva (tubo) com empunhadura, pontas com nock; o plano do arco é Y (altura) x Z
//    (profundidade): a barriga aponta para +Z (alvo) e a corda fica atrás, no lado do arqueiro.
//  - Corda: duas faixas em cruz cujo ponto de encaixe (nock) se move para trás ao puxar.
// ============================================================================

const WOOD = "#a47a45";
const WOOD_DARK = "#6e4f2c";
const STEEL = "#b8bdb4";
const FEATHER = "#ece4cf";
const FEATHER_RED = "#a8322a";
const LEATHER = "#3b2a1c";
const STRING = "#ddd3b4";

function paint(geometry, hex, ao = 0) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.deleteAttribute("uv");
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(hex);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = base.r;
    colors[i * 3 + 1] = base.g;
    colors[i * 3 + 2] = base.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function place(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

// Pena: faixa dupla face (4 triângulos) saindo da haste, afinando para a ponta da cauda.
function vane(angle, z0, z1, h, hex) {
  const g = new THREE.BufferGeometry();
  const t = 0.012; // raiz na haste
  // plano XZ local (altura em +Y); depois gira em torno de Z (eixo da flecha)
  const v = [
    0, t, z0, 0, t + h, z0 + 0.025, 0, t + h, z1,
    0, t, z0, 0, t + h, z1, 0, t, z1 + 0.03,
  ];
  const tris = [];
  for (let i = 0; i < v.length; i += 9) {
    tris.push(v[i], v[i + 1], v[i + 2], v[i + 3], v[i + 4], v[i + 5], v[i + 6], v[i + 7], v[i + 8]);
    // verso (ordem invertida): visível dos dois lados sem DoubleSide
    tris.push(v[i], v[i + 1], v[i + 2], v[i + 6], v[i + 7], v[i + 8], v[i + 3], v[i + 4], v[i + 5]);
  }
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tris), 3));
  g.computeVertexNormals();
  g.rotateZ(angle);
  return paint(g, hex);
}

let _arrowGeo = null;
/** Flecha completa (~1 m): haste + ponta + penas. ~44 triângulos. */
export function createArrowGeometry() {
  if (_arrowGeo) return _arrowGeo;
  const parts = [];
  parts.push(paint(place(new THREE.CylinderGeometry(0.013, 0.013, 0.84, 5), 0, 0, 0.0, Math.PI / 2), WOOD)); // haste
  parts.push(paint(place(new THREE.ConeGeometry(0.034, 0.13, 4), 0, 0, 0.485, Math.PI / 2), STEEL)); // ponta
  parts.push(paint(place(new THREE.ConeGeometry(0.02, 0.04, 4), 0, 0, 0.405, -Math.PI / 2), STEEL)); // base da ponta (losango)
  parts.push(paint(place(new THREE.CylinderGeometry(0.018, 0.013, 0.04, 5), 0, 0, -0.41, Math.PI / 2), WOOD_DARK)); // nock
  for (let i = 0; i < 3; i++) {
    parts.push(vane((i / 3) * Math.PI * 2, -0.4, -0.24, 0.055, i === 0 ? FEATHER_RED : FEATHER));
  }
  _arrowGeo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  _arrowGeo.computeBoundingSphere();
  return _arrowGeo;
}

let _bundleGeo = null;
/** Feixe de 4 flechas para a aljava (só a parte que sai pelo topo: haste curta + penas). 1 malha. */
export function createArrowBundleGeometry() {
  if (_bundleGeo) return _bundleGeo;
  const arrow = createArrowGeometry();
  const parts = [];
  const offsets = [[-0.025, 0.0, 0.05], [0.03, 0.01, -0.06], [0.0, -0.03, 0.1], [0.04, 0.03, 0.14]];
  for (const [x, z, tilt] of offsets) {
    const g = arrow.clone();
    g.scale(0.6, 0.6, 0.6);
    g.rotateX(Math.PI / 2); // a ponta (+Z) vira -Y (dentro da aljava) e a cauda com penas (-Z) fica para cima
    g.rotateZ(tilt);
    g.translate(x, 0, z);
    parts.push(g);
  }
  _bundleGeo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return _bundleGeo;
}

let _arrowMat = null;
export function getArrowMaterial() {
  if (!_arrowMat) _arrowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1, flatShading: true });
  return _arrowMat;
}

// ---------------------------------------------------------------------------
// Arco
// ---------------------------------------------------------------------------
const BOW_HALF = 0.62; // meia altura do arco
const BOW_BELLY = 0.13; // quanto as pontas recuam em relação ao centro (barriga para +Z)
export const BOW_TIP_Z = -BOW_BELLY;

let _bowGeo = null;
/** Haste do arco: tubo curvo + empunhadura de couro + nocks. Barriga para +Z, pontas voltadas para o arqueiro. */
export function createBowGeometry() {
  if (_bowGeo) return _bowGeo;
  const pts = [];
  for (let i = -3; i <= 3; i++) {
    const y = (i / 3) * BOW_HALF;
    pts.push(new THREE.Vector3(0, y, -BOW_BELLY * (y / BOW_HALF) * (y / BOW_HALF)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const parts = [];
  parts.push(paint(new THREE.TubeGeometry(curve, 10, 0.024, 5, false), WOOD));
  parts.push(paint(place(new THREE.CylinderGeometry(0.034, 0.034, 0.17, 6), 0, 0, 0.0), LEATHER)); // empunhadura
  for (const s of [-1, 1]) {
    parts.push(paint(place(new THREE.SphereGeometry(0.03, 5, 4), 0, s * BOW_HALF, BOW_TIP_Z), WOOD_DARK)); // ponta
  }
  _bowGeo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  _bowGeo.computeBoundingSphere();
  return _bowGeo;
}

/**
 * Corda: 2 segmentos (ponta de cima -> nock -> ponta de baixo), cada um com duas faixas em cruz
 * (uma larga em X, outra em Z) para ser visível de qualquer ângulo. Posições atualizadas por setStringNock().
 */
export function createStringGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2 * 2 * 6 * 3), 3));
  const colors = new Float32Array(2 * 2 * 6 * 3);
  const c = new THREE.Color(STRING);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.userData.nockZ = 99;
  setStringNock(g, BOW_TIP_Z);
  return g;
}

const W = 0.008;
/** Move o ponto de encaixe da corda ao longo de Z (BOW_TIP_Z = corda solta; mais negativo = puxada). */
export function setStringNock(geometry, nockZ) {
  if (Math.abs(geometry.userData.nockZ - nockZ) < 0.003) return;
  geometry.userData.nockZ = nockZ;
  const p = geometry.attributes.position.array;
  let o = 0;
  const seg = (y0, z0, y1, z1) => {
    // faixa larga em X
    p[o++] = -W; p[o++] = y0; p[o++] = z0; p[o++] = W; p[o++] = y0; p[o++] = z0; p[o++] = W; p[o++] = y1; p[o++] = z1;
    p[o++] = -W; p[o++] = y0; p[o++] = z0; p[o++] = W; p[o++] = y1; p[o++] = z1; p[o++] = -W; p[o++] = y1; p[o++] = z1;
    // faixa larga em Z
    p[o++] = 0; p[o++] = y0; p[o++] = z0 - W; p[o++] = 0; p[o++] = y0; p[o++] = z0 + W; p[o++] = 0; p[o++] = y1; p[o++] = z1 + W;
    p[o++] = 0; p[o++] = y0; p[o++] = z0 - W; p[o++] = 0; p[o++] = y1; p[o++] = z1 + W; p[o++] = 0; p[o++] = y1; p[o++] = z1 - W;
  };
  seg(BOW_HALF, BOW_TIP_Z, 0, nockZ);
  seg(0, nockZ, -BOW_HALF, BOW_TIP_Z);
  geometry.attributes.position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

let _bowMat = null;
export function getBowMaterial() {
  if (!_bowMat) _bowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05, flatShading: true });
  return _bowMat;
}

let _stringMat = null;
export function getStringMaterial() {
  // faixas sem verso próprio (cruzadas): DoubleSide barato, sem sombra
  if (!_stringMat) _stringMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return _stringMat;
}
