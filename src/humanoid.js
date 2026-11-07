import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Corpo humano simples e esguio (~1,8 m), compartilhado por jogador e NPCs.
// Origem nos pés, de frente para +Z. Juntas: ombro, cotovelo, quadril e joelho.

const torsoProfile = [
  [0.01, 0], [0.14, 0.02], [0.16, 0.12], [0.18, 0.28], [0.21, 0.44],
  [0.215, 0.56], [0.155, 0.65], [0.07, 0.68], [0.01, 0.68],
].map(([r, y]) => new THREE.Vector2(r, y));

export const BODY = {
  torso: new THREE.LatheGeometry(torsoProfile, 12).scale(1.05, 1.0, 0.72),
  pelvis: new THREE.SphereGeometry(0.165, 12, 10).scale(1.22, 0.85, 0.95),
  neck: new THREE.CylinderGeometry(0.052, 0.058, 0.16, 10),
  head: new THREE.SphereGeometry(0.126, 14, 12).scale(0.92, 1.12, 0.98),
  hair: new THREE.SphereGeometry(0.134, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.64),
  nose: new THREE.ConeGeometry(0.022, 0.048, 4),
  eye: new THREE.SphereGeometry(0.015, 6, 5),
  shoulder: new THREE.SphereGeometry(0.072, 10, 8),
  upperArm: new THREE.CapsuleGeometry(0.054, 0.22, 4, 8),
  foreArm: new THREE.CapsuleGeometry(0.046, 0.2, 4, 10),
  hand: new THREE.SphereGeometry(0.05, 8, 8).scale(0.85, 1.15, 0.7),
  thigh: new THREE.CapsuleGeometry(0.078, 0.28, 4, 10),
  kneeJoint: new THREE.SphereGeometry(0.065, 8, 6),
  shin: new THREE.CapsuleGeometry(0.062, 0.3, 4, 10),
  boot: new THREE.BoxGeometry(0.118, 0.095, 0.28),
};

// ---------------------------------------------------------------------------
// Barbas: uma única geometria fundida por estilo (1 draw call, cache compartilhado).
// Origem no centro da cabeça (mesmo referencial de `face`), rosto para +Z.
// ---------------------------------------------------------------------------
const _beardCache = new Map();

function beardPiece(geometry, x, y, z, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.scale(sx, sy, sz);
  g.rotateX(rx);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

function makeBeardGeometry(style) {
  const parts = [];
  const shell = (thetaStart, thetaLength, radius, sx, sy, sz, y) => {
    const g = new THREE.SphereGeometry(radius, 14, 8, Math.PI * 0.04, Math.PI * 0.92, thetaStart, thetaLength);
    return beardPiece(g, 0, y, 0, 0, 0, sx, sy, sz);
  };
  // bigode (todos os estilos, menos "stubble")
  const mustache = () => {
    for (const side of [-1, 1]) {
      parts.push(beardPiece(new THREE.CapsuleGeometry(0.016, 0.06, 2, 5), side * 0.034, -0.047, 0.124, 0, Math.PI / 2 + side * 0.28));
    }
  };
  if (style === "mustache") {
    mustache();
    parts.push(beardPiece(new THREE.SphereGeometry(0.02, 6, 5), 0, -0.075, 0.118));
  } else if (style === "short") {
    parts.push(shell(Math.PI * 0.64, Math.PI * 0.26, 0.133, 0.97, 1.16, 1.03, 0));
    mustache();
  } else if (style === "long") {
    // barba longa e rala, caída sobre o peito
    parts.push(shell(Math.PI * 0.6, Math.PI * 0.3, 0.136, 0.98, 1.2, 1.08, 0));
    parts.push(beardPiece(new THREE.ConeGeometry(0.085, 0.3, 6), 0, -0.27, 0.08, Math.PI, 0, 1, 1, 0.8));
    mustache();
  } else if (style === "viking") {
    // Barba viking cheia e bem aparada: bochechas fartas, queixo largo, bigode caído e uma trança curta na ponta
    parts.push(shell(Math.PI * 0.58, Math.PI * 0.36, 0.14, 0.99, 1.24, 1.07, 0));
    for (const side of [-1, 1]) {
      parts.push(beardPiece(new THREE.BoxGeometry(0.03, 0.11, 0.065), side * 0.118, -0.008, 0.03)); // costeletas
      parts.push(beardPiece(new THREE.BoxGeometry(0.036, 0.095, 0.075), side * 0.113, -0.076, 0.06)); // bochechas
      // bigode caído nas pontas
      parts.push(beardPiece(new THREE.CapsuleGeometry(0.017, 0.062, 2, 5), side * 0.036, -0.048, 0.125, 0, Math.PI / 2 + side * 0.32));
      parts.push(beardPiece(new THREE.CapsuleGeometry(0.012, 0.05, 2, 5), side * 0.086, -0.078, 0.113, 0, side * 0.28));
    }
    parts.push(beardPiece(new THREE.SphereGeometry(0.045, 8, 6), 0, -0.165, 0.092, 0, 0, 1.15, 1, 0.9)); // queixo cheio
    // trança curta: segmentos que se afinam, levemente alternados
    const braid = [[-0.205, 0.03, 0.006], [-0.248, 0.026, -0.006], [-0.288, 0.022, 0.006], [-0.322, 0.018, -0.004]];
    for (const [y, r, dx] of braid) parts.push(beardPiece(new THREE.SphereGeometry(r, 7, 5), dx, y, 0.094, 0, 0, 1, 1.35, 1));
    parts.push(beardPiece(new THREE.ConeGeometry(0.014, 0.05, 5), 0, -0.36, 0.094, Math.PI, 0, 1, 1, 1));
  } else {
    // "full": barba cheia — costeletas, bochechas, queixo e ponta
    parts.push(shell(Math.PI * 0.6, Math.PI * 0.34, 0.139, 0.98, 1.22, 1.06, 0));
    for (const side of [-1, 1]) {
      parts.push(beardPiece(new THREE.BoxGeometry(0.03, 0.1, 0.06), side * 0.117, -0.012, 0.03));
      parts.push(beardPiece(new THREE.BoxGeometry(0.034, 0.09, 0.07), side * 0.112, -0.075, 0.06));
    }
    parts.push(beardPiece(new THREE.ConeGeometry(0.075, 0.17, 6), 0, -0.205, 0.088, Math.PI, 0, 1, 1, 0.85));
    mustache();
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}

/** Adiciona uma barba ao grupo da cabeça. style: "full" | "short" | "long" | "mustache". */
export function addBeard(face, material, style = "full") {
  if (!_beardCache.has(style)) _beardCache.set(style, makeBeardGeometry(style));
  const mesh = new THREE.Mesh(_beardCache.get(style), material);
  mesh.name = "Beard";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  face.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Suavização de pose: filtro exponencial sobre as juntas, aplicado depois que a lógica
// de animação escolheu a pose-alvo do frame. Custo: 8 juntas x 3 eixos, sem alocações.
// Troca de pose (andar -> atacar -> guarda) vira transição contínua em vez de salto.
// ---------------------------------------------------------------------------
const POSE_JOINTS = ["leftArm", "rightArm", "leftForearm", "rightForearm", "leftLeg", "rightLeg", "leftKnee", "rightKnee"];

export function createPoseState() {
  return { ready: false, v: new Float32Array(POSE_JOINTS.length * 3) };
}

/** rate = velocidade do filtro (1/s); rate <= 0 => sem suavização (apenas memoriza a pose). */
export function smoothPose(state, body, dt, rate) {
  const v = state.v;
  const k = state.ready && rate > 0 ? 1 - Math.exp(-rate * dt) : 1;
  for (let i = 0; i < POSE_JOINTS.length; i++) {
    const joint = body[POSE_JOINTS[i]];
    if (!joint) continue;
    const r = joint.rotation;
    const o = i * 3;
    if (k < 1) {
      v[o] += (r.x - v[o]) * k;
      v[o + 1] += (r.y - v[o + 1]) * k;
      v[o + 2] += (r.z - v[o + 2]) * k;
      r.set(v[o], v[o + 1], v[o + 2]);
    } else {
      v[o] = r.x;
      v[o + 1] = r.y;
      v[o + 2] = r.z;
    }
  }
  state.ready = true;
}

// ---------------------------------------------------------------------------
// Cabelo viking desgrenhado: mechas irregulares, franja caída, cabelo comprido atrás e duas tranças finas
// ao lado das têmporas. Uma única malha fundida (1 draw call).
// ---------------------------------------------------------------------------
let _vikingHairGeo = null;

function makeVikingHairGeometry() {
  const parts = [];
  let seed = 90210;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const tuft = (len, r, px, py, pz, rx, rz) => {
    const g = new THREE.ConeGeometry(r, len, 5).toNonIndexed();
    g.translate(0, len / 2, 0); // base na origem, ponta para +Y
    g.rotateX(rx);
    g.rotateZ(rz);
    g.translate(px, py, pz);
    parts.push(g);
  };
  // Mechas saindo do crânio, em direções variadas (raio ~0,13 em torno da cabeça)
  const dirs = [
    [0.0, 0.14, 0.02, -0.25, 0.1], [0.07, 0.13, -0.03, 0.15, -0.4], [-0.07, 0.13, -0.03, 0.15, 0.45],
    [0.1, 0.1, 0.05, -0.3, -0.7], [-0.1, 0.1, 0.05, -0.3, 0.75], [0.0, 0.12, -0.09, 0.5, 0.08],
    [0.11, 0.06, -0.06, 0.2, -1.0], [-0.11, 0.06, -0.06, 0.2, 1.05], [0.04, 0.135, 0.07, -0.6, -0.18],
  ];
  for (const [px, py, pz, rx, rz] of dirs) tuft(0.07 + rnd() * 0.05, 0.026 + rnd() * 0.012, px, py, pz, rx + (rnd() - 0.5) * 0.3, rz + (rnd() - 0.5) * 0.3);
  // Franja irregular caindo na testa
  for (let i = 0; i < 5; i++) {
    const x = -0.09 + i * 0.045 + (rnd() - 0.5) * 0.015;
    const g = new THREE.ConeGeometry(0.02 + rnd() * 0.01, 0.07 + rnd() * 0.04, 4).toNonIndexed();
    g.rotateX(Math.PI); // ponta para baixo
    g.rotateZ((rnd() - 0.5) * 0.5);
    g.translate(x, 0.098 - Math.abs(x) * 0.25, 0.1 + rnd() * 0.012);
    parts.push(g);
  }
  // Cabelo comprido caído atrás da nuca e nos ombros, em camadas irregulares
  for (let i = 0; i < 7; i++) {
    const x = -0.105 + i * 0.035;
    const len = 0.16 + rnd() * 0.1;
    const g = new THREE.CapsuleGeometry(0.026, len, 2, 5).toNonIndexed();
    g.rotateX((rnd() - 0.5) * 0.25);
    g.rotateZ((rnd() - 0.5) * 0.3);
    g.translate(x, -0.09 - len / 2 + rnd() * 0.02, -0.095 - rnd() * 0.02);
    parts.push(g);
  }
  // Duas tranças finas nas têmporas (3 segmentos cada)
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const g = new THREE.SphereGeometry(0.019 - k * 0.002, 6, 5).toNonIndexed();
      g.scale(1, 1.3, 1);
      g.translate(side * (0.128 + k * 0.003), 0.02 - k * 0.04, 0.045 - k * 0.006 + (k % 2 ? 0.006 : -0.006));
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}

/** Cabelo viking desgrenhado (adicione ao grupo da cabeça). */
export function addVikingHair(face, material) {
  if (!_vikingHairGeo) _vikingHairGeo = makeVikingHairGeometry();
  const mesh = new THREE.Mesh(_vikingHairGeo, material);
  mesh.name = "VikingHair";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  face.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Olhos cansados (sutis): olheiras suaves, pálpebras pesadas, sobrancelha franzida e um pouco de sujeira.
// 3 malhas fundidas por material; nada de animação extra.
// ---------------------------------------------------------------------------
let _tiredGeos = null;
let _tiredMats = null;

export function addTiredEyes(face, skinMat, hairMat) {
  if (!_tiredGeos) {
    const bags = [];
    const lids = [];
    const brows = [];
    for (const side of [-1, 1]) {
      const bag = new THREE.SphereGeometry(0.02, 8, 5).toNonIndexed();
      bag.scale(1.55, 0.5, 0.4);
      bag.translate(side * 0.043, -0.0125, 0.113);
      bags.push(bag);
      // sombra suave logo abaixo da olheira (cansaço fundo, sem exagero)
      const hollow = new THREE.SphereGeometry(0.02, 8, 5).toNonIndexed();
      hollow.scale(1.9, 0.4, 0.3);
      hollow.translate(side * 0.043, -0.03, 0.109);
      bags.push(hollow);
      const lid = new THREE.SphereGeometry(0.0205, 8, 6).toNonIndexed();
      lid.scale(1.45, 0.62, 0.92);
      lid.translate(side * 0.043, 0.0295, 0.1115);
      lids.push(lid);
      const brow = new THREE.BoxGeometry(0.056, 0.0125, 0.014).toNonIndexed();
      brow.rotateZ(-side * 0.2); // ponta interna mais baixa: franzida
      brow.translate(side * 0.047, 0.0555, 0.1155);
      brows.push(brow);
    }
    // marcas de sujeira: face e testa
    const dirt = [];
    for (const [x, y, z, sx, sy] of [[-0.075, -0.035, 0.1, 1.6, 0.9], [0.06, -0.045, 0.103, 1.2, 0.8], [0.02, 0.07, 0.118, 1.8, 0.6], [-0.03, -0.1, 0.095, 1.3, 0.7]]) {
      const d = new THREE.SphereGeometry(0.016, 6, 4).toNonIndexed();
      d.scale(sx, sy, 0.25);
      d.translate(x, y, z);
      dirt.push(d);
    }
    _tiredGeos = {
      shade: mergeGeometries([...bags, ...dirt], false),
      lids: mergeGeometries(lids, false),
      brows: mergeGeometries(brows, false),
    };
    for (const g of [...bags, ...lids, ...brows, ...dirt]) g.dispose();
  }
  if (!_tiredMats) {
    _tiredMats = {
      shade: new THREE.MeshLambertMaterial({ color: 0x4a2f3c, transparent: true, opacity: 0.34, depthWrite: false }),
    };
  }
  const shade = new THREE.Mesh(_tiredGeos.shade, _tiredMats.shade);
  const lids = new THREE.Mesh(_tiredGeos.lids, skinMat);
  const brows = new THREE.Mesh(_tiredGeos.brows, hairMat);
  for (const m of [shade, lids, brows]) {
    m.castShadow = false;
    m.receiveShadow = false;
    m.name = "TiredEyes";
    face.add(m);
  }
  return [shade, lids, brows];
}

function part(geometry, material, parent, x, y, z, castShadow = false) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

// m: { skin, shirt, sleeve, pants, boots, hair }
export function buildHumanoid(model, m) {
  const body = {};
  part(BODY.pelvis, m.pants, model, 0, 0.84, 0, true);
  body.torso = part(BODY.torso, m.shirt, model, 0, 0.82, 0, true);
  part(BODY.neck, m.skin, model, 0, 1.48, 0);

  const face = new THREE.Group();
  face.position.set(0, 1.66, 0);
  model.add(face);
  part(BODY.head, m.skin, face, 0, 0, 0, true);
  part(BODY.hair, m.hair, face, 0, 0.02, -0.012);
  part(BODY.nose, m.skin, face, 0, -0.012, 0.122).rotation.x = Math.PI / 2;
  part(BODY.eye, m.hair, face, -0.043, 0.02, 0.111);
  part(BODY.eye, m.hair, face, 0.043, 0.02, 0.111);
  body.head = face;

  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    // Encaixe anatômico perfeito no ombro do tronco
    arm.position.set(side * 0.22, 1.42, 0);
    model.add(arm);
    part(BODY.shoulder, m.sleeve, arm, 0, 0, 0);
    part(BODY.upperArm, m.sleeve, arm, 0, -0.15, 0, true);
    const fore = new THREE.Group();
    fore.position.set(0, -0.32, 0);
    fore.rotation.x = -0.12;
    arm.add(fore);
    part(BODY.shoulder, m.sleeve, fore, 0, 0, 0); // Cotoveleira / junta contínua
    part(BODY.foreArm, m.forearm || m.skin, fore, 0, -0.15, 0, true);
    part(BODY.hand, m.skin, fore, 0, -0.30, 0);
    body[side < 0 ? "leftArm" : "rightArm"] = arm;
    body[side < 0 ? "leftForearm" : "rightForearm"] = fore;
    arm.name = side < 0 ? "ArmL" : "ArmR";

    const leg = new THREE.Group();
    leg.name = side < 0 ? "LegL" : "LegR";
    // Encaixe anatômico perfeito na bacia
    leg.position.set(side * 0.11, 0.82, 0);
    model.add(leg);
    part(BODY.thigh, m.pants, leg, 0, -0.19, 0, true);
    const knee = new THREE.Group();
    knee.name = side < 0 ? "KneeL" : "KneeR";
    knee.position.set(0, -0.38, 0);
    leg.add(knee);
    part(BODY.kneeJoint, m.pants, knee, 0, 0, 0); // Joelheira / junta contínua sem quebras
    part(BODY.shin, m.pants, knee, 0, -0.19, 0, true);
    body[side < 0 ? "leftBoot" : "rightBoot"] = part(BODY.boot, m.boots, knee, 0, -0.39, 0.05);
    body[side < 0 ? "leftLeg" : "rightLeg"] = leg;
    body[side < 0 ? "leftKnee" : "rightKnee"] = knee;
  }
  return body;
}

// Dobra joelhos e cotovelos a partir do balanço anatômico natural de passo.
// A perna de impulso (traseira) flexiona o joelho para erguer a canela e permitir o avanço suave.
// A perna de contato (dianteira) estende amortecendo o impacto no solo.
export function bendJoints(body, stride, armSwing, extra = 0, isRunning = false) {
  const kneeMult = isRunning ? 1.45 : 1.1;
  // rotation.x > 0 na coxa = perna ATRÁS do corpo (o modelo olha para +Z). O joelho flexiona na perna de trás
  // (para a canela passar sem arrastar o pé) e estende levemente na da frente ao tocar o chão.
  const backLeft = Math.max(0, stride);
  const backRight = Math.max(0, -stride);
  const frontLeft = Math.max(0, -stride);
  const frontRight = Math.max(0, stride);

  body.leftKnee.rotation.x = backLeft * kneeMult + frontLeft * 0.12 + 0.04 + extra;
  body.rightKnee.rotation.x = backRight * kneeMult + frontRight * 0.12 + 0.04 + extra;

  const elbowBase = isRunning ? -0.45 : -0.18;
  const elbowSwing = Math.abs(armSwing) * (isRunning ? 0.55 : 0.35);
  body.leftForearm.rotation.x = elbowBase - elbowSwing;
  body.rightForearm.rotation.x = elbowBase - elbowSwing;
  flattenFeet(body, stride, isRunning);
}

// Mantém os pés paralelos ao chão: compensa a rotação da coxa + joelho (a bota gira na direção
// oposta) e levanta a ponta do pé na perna que está avançando (heel-strike) / empurra na que está atrás (toe-off).
export function flattenFeet(body, stride, isRunning = false) {
  const lb = body.leftBoot;
  const rb = body.rightBoot;
  if (!lb || !rb) return;
  const lift = isRunning ? 0.28 : 0.2;
  const lAngle = -(body.leftLeg.rotation.x + body.leftKnee.rotation.x) * 0.92;
  const rAngle = -(body.rightLeg.rotation.x + body.rightKnee.rotation.x) * 0.92;
  // perna da frente (rotação negativa em x) ergue a ponta; perna de trás empurra com a ponta
  lb.rotation.x = Math.max(-0.7, Math.min(0.7, lAngle + (stride < 0 ? -lift : 0.12) * Math.min(1, Math.abs(stride) * 3)));
  rb.rotation.x = Math.max(-0.7, Math.min(0.7, rAngle + (stride > 0 ? -lift : 0.12) * Math.min(1, Math.abs(stride) * 3)));
}
