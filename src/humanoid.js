import * as THREE from "three";

// Corpo humano simples e esguio (~1,8 m), compartilhado por jogador e NPCs.
// Origem nos pés, de frente para +Z. Juntas: ombro, cotovelo, quadril e joelho.

const torsoProfile = [
  [0.01, 0], [0.13, 0.02], [0.14, 0.12], [0.165, 0.3], [0.2, 0.46],
  [0.205, 0.55], [0.14, 0.63], [0.06, 0.67], [0.01, 0.67],
].map(([r, y]) => new THREE.Vector2(r, y));

export const BODY = {
  torso: new THREE.LatheGeometry(torsoProfile, 10).scale(1, 1, 0.66),
  pelvis: new THREE.SphereGeometry(0.15, 10, 8).scale(1.28, 0.8, 0.9),
  neck: new THREE.CylinderGeometry(0.045, 0.052, 0.12, 8),
  head: new THREE.SphereGeometry(0.122, 10, 8).scale(0.9, 1.1, 0.97),
  hair: new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62),
  nose: new THREE.ConeGeometry(0.02, 0.045, 4),
  eye: new THREE.SphereGeometry(0.014, 5, 4),
  shoulder: new THREE.SphereGeometry(0.062, 8, 6),
  upperArm: new THREE.CapsuleGeometry(0.048, 0.2, 3, 8),
  foreArm: new THREE.CapsuleGeometry(0.041, 0.18, 3, 8),
  hand: new THREE.SphereGeometry(0.046, 7, 6),
  thigh: new THREE.CapsuleGeometry(0.068, 0.25, 3, 8),
  shin: new THREE.CapsuleGeometry(0.052, 0.27, 3, 8),
  boot: new THREE.BoxGeometry(0.105, 0.085, 0.25),
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
  body.torso = part(BODY.torso, m.shirt, model, 0, 0.8, 0, true);
  part(BODY.neck, m.skin, model, 0, 1.5, 0);

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
    arm.position.set(side * 0.255, 1.43, 0);
    model.add(arm);
    part(BODY.shoulder, m.sleeve, arm, 0, 0, 0);
    part(BODY.upperArm, m.sleeve, arm, 0, -0.17, 0, true);
    const fore = new THREE.Group();
    fore.position.set(0, -0.35, 0);
    fore.rotation.x = -0.12;
    arm.add(fore);
    part(BODY.foreArm, m.forearm || m.skin, fore, 0, -0.14, 0, true);
    part(BODY.hand, m.skin, fore, 0, -0.29, 0);
    body[side < 0 ? "leftArm" : "rightArm"] = arm;
    body[side < 0 ? "leftForearm" : "rightForearm"] = fore;
    arm.name = side < 0 ? "ArmL" : "ArmR";

    const leg = new THREE.Group();
    leg.name = side < 0 ? "LegL" : "LegR";
    leg.position.set(side * 0.1, 0.8, 0);
    model.add(leg);
    part(BODY.thigh, m.pants, leg, 0, -0.2, 0, true);
    const knee = new THREE.Group();
    knee.name = side < 0 ? "KneeL" : "KneeR";
    knee.position.set(0, -0.4, 0);
    leg.add(knee);
    part(BODY.shin, m.pants, knee, 0, -0.2, 0, true);
    part(BODY.boot, m.boots, knee, 0, -0.38, 0.05);
    body[side < 0 ? "leftLeg" : "rightLeg"] = leg;
    body[side < 0 ? "leftKnee" : "rightKnee"] = knee;
  }
  return body;
}

// Dobra joelhos e cotovelos a partir do balanço de passo.
export function bendJoints(body, stride, armSwing, extra = 0) {
  body.leftKnee.rotation.x = Math.max(0, stride) * 1.15 + 0.04 + extra;
  body.rightKnee.rotation.x = Math.max(0, -stride) * 1.15 + 0.04 + extra;
  const elbow = Math.abs(armSwing) * 0.45;
  body.leftForearm.rotation.x = -0.12 - elbow;
  body.rightForearm.rotation.x = -0.12 - elbow;
}
