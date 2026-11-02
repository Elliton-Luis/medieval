import * as THREE from "three";

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
  head: new THREE.SphereGeometry(0.126, 12, 10).scale(0.92, 1.12, 0.98),
  hair: new THREE.SphereGeometry(0.134, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.64),
  nose: new THREE.ConeGeometry(0.022, 0.048, 4),
  eye: new THREE.SphereGeometry(0.015, 6, 5),
  shoulder: new THREE.SphereGeometry(0.072, 10, 8),
  upperArm: new THREE.CapsuleGeometry(0.054, 0.22, 4, 10),
  foreArm: new THREE.CapsuleGeometry(0.046, 0.2, 4, 10),
  hand: new THREE.SphereGeometry(0.05, 8, 8).scale(0.85, 1.15, 0.7),
  thigh: new THREE.CapsuleGeometry(0.078, 0.28, 4, 10),
  kneeJoint: new THREE.SphereGeometry(0.065, 8, 6),
  shin: new THREE.CapsuleGeometry(0.062, 0.3, 4, 10),
  boot: new THREE.BoxGeometry(0.118, 0.095, 0.28),
};

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
    part(BODY.boot, m.boots, knee, 0, -0.39, 0.05);
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
  const backLeft = Math.max(0, -stride);
  const backRight = Math.max(0, stride);
  const frontLeft = Math.max(0, stride);
  const frontRight = Math.max(0, -stride);

  body.leftKnee.rotation.x = backLeft * kneeMult + frontLeft * 0.12 + 0.04 + extra;
  body.rightKnee.rotation.x = backRight * kneeMult + frontRight * 0.12 + 0.04 + extra;

  const elbowBase = isRunning ? -0.45 : -0.18;
  const elbowSwing = Math.abs(armSwing) * (isRunning ? 0.55 : 0.35);
  body.leftForearm.rotation.x = elbowBase - elbowSwing;
  body.rightForearm.rotation.x = elbowBase - elbowSwing;
}
