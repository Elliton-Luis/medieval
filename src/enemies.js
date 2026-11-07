import * as THREE from "three";
import { NPC } from "./npc.js";
import { Horse } from "./horse.js";
import { buildHumanoid, bendJoints } from "./humanoid.js";
import { makeSkinnedMaterial } from "./skins.js";
import { meleeThink, separation, pruneTokens, requestToken, releaseToken } from "./melee.js";
import { setupGuardTorch, releaseGuardTorch, updateGuardTracking, GUARD_SPEED, TORCH_VISION_RANGE_SQ } from "./torches.js";
import { createArrowGeometry, createArrowBundleGeometry, getArrowMaterial, createBowGeometry, createStringGeometry, setStringNock, getBowMaterial, getStringMaterial, BOW_TIP_Z } from "./arrowKit.js";

const _playerPosVec = new THREE.Vector3();

const DEFS = {
  footman: { name: "Guarda Real", title: "Infantaria", behavior: "melee", health: 3, speed: 3.9, skin: "#bb815f", cloth: "#7a2a2a", leather: "#2e2a28", metal: "#9aa1a0", accent: "#c5a45e", hair: "#2f2420", meleeRange: 1.9, meleeDamage: 1, meleeCooldown: 1.4 },
  archer: { name: "Arqueiro Real", title: "Arqueiro", behavior: "archer", health: 2, speed: 3.3, skin: "#c68e69", cloth: "#5b2a28", leather: "#4a3626", metal: "#7f8c83", accent: "#a98a4a", hair: "#4a3526", minRange: 11, maxRange: 24, cooldown: 2.5, windup: 0.55 },
  crossbow: { name: "Besteiro Real", title: "Atirador de besta", behavior: "crossbow", health: 3, speed: 3, skin: "#a96f54", cloth: "#4f2626", leather: "#3a3028", metal: "#8c948f", accent: "#c5a45e", hair: "#1c1714", minRange: 9, maxRange: 20, cooldown: 3.1, windup: 0.75 },
  knight: { name: "Cavaleiro Real", title: "Cavaleiro", behavior: "knight", health: 5, speed: 3.2, skin: "#bb815f", cloth: "#4a1d1d", leather: "#2a2422", metal: "#c3c7c4", accent: "#d6b765", hair: "#2f2420", meleeRange: 2.1, meleeDamage: 2, meleeCooldown: 1.5 },
  cannoneer: { name: "Canhoneiro Real", title: "Canhoneiro", behavior: "cannon", health: 4, speed: 2.3, skin: "#d19a70", cloth: "#2c2622", leather: "#1f1a17", metal: "#44464a", accent: "#b8955a", hair: "#7a5a34", minRange: 0, maxRange: 38, cooldown: 4.6, windup: 1.1 },
};

// Quantos de cada tipo o reino manda a cada nível de procurado.
const WAVES = [
  null,
  { footman: 2 },
  { footman: 3, archer: 2 },
  { footman: 3, archer: 3, crossbow: 3 },
  { footman: 3, archer: 3, crossbow: 3, knight: 2 },
  { footman: 4, archer: 4, crossbow: 4, knight: 3, cannoneer: 2 },
];
const MAX_ACTIVE = 10;
const FLASH_COLOR = new THREE.Color("#85764a");
const ZERO_COLOR = new THREE.Color("#000000");
const _lookTarget = new THREE.Vector3();
const _bowHand = new THREE.Vector3();

function addPart(parent, geometry, material, x, y, z, castShadow = false) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (castShadow) mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

const G = {
  tunic: new THREE.CylinderGeometry(0.185, 0.27, 0.42, 10).scale(1, 1, 0.74),
  belt: new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10).scale(1, 1, 0.74),
  helmet: new THREE.SphereGeometry(0.139, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58),
  cap: new THREE.SphereGeometry(0.133, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.56),
  pauldron: new THREE.SphereGeometry(0.085, 8, 6).scale(1.15, 0.8, 1),
  shaft: new THREE.CylinderGeometry(0.024, 0.03, 1, 6),
};

export class Soldier extends NPC {
  constructor(scene, world, roleKey, effects) {
    const d = DEFS[roleKey];
    super(scene, world, roleKey, [{ x: 0, z: 0 }], null, {
      name: d.name, title: d.title, skin: d.skin, cloth: d.cloth, leather: d.leather, metal: d.metal, accent: d.accent, hair: d.hair, speed: d.speed, wait: 0.4,
    }, effects);
    this.def = d;
    this.behavior = d.behavior;
    this.hostile = true;
    this.temporary = true;
    this.removed = true;
    this.alive = false;
    this.maxHealth = d.health;
    this.health = d.health;
    this.meleeRange = d.meleeRange || 0;
    this.meleeDamage = d.meleeDamage || 0;
    this.meleeCooldown = d.meleeCooldown || 1.4;
    this.mounted = false;
    this.horse = null;
    this.shootTimer = 2;
    this.windup = 0;
    this.aimBlend = 0;
    this.strafe = 1;
    this.strafeTimer = 0;
    this.dismissing = 0;
    this.onShoot = null;
    this.root.visible = false;
    if (this.cannon) this.cannon.visible = false;
  }

  _buildModel() {
    const d = DEFS[this.roleKey];
    const mat = (kind, color, metalness = 0, roughness = 0.9) => makeSkinnedMaterial(kind, color, metalness, roughness);
    const skin = mat("skin", d.skin, 0, 1);
    const cloth = mat("fabric", d.cloth);
    const leather = mat("leather", d.leather, 0, 0.95);
    const metal = mat("metal", d.metal, 0.55, 0.55);
    const accent = mat("metal", d.accent, 0.3, 0.6);
    const dark = mat("leather", "#2b2622", 0, 0.95);
    const hair = mat("leather", d.hair || "#2f2420", 0, 1);
    this.flashMaterials = [skin, cloth, leather, metal, accent, dark, hair];
    const heavy = this.roleKey === "footman" || this.roleKey === "knight";
    const body = buildHumanoid(this.model, { skin, shirt: cloth, sleeve: cloth, pants: dark, boots: dark, hair, forearm: heavy ? metal : skin });
    Object.assign(this, body);
    const face = body.head;

    addPart(this.model, G.tunic, cloth, 0, 0.62, 0);
    addPart(this.model, G.belt, accent, 0, 0.83, 0);
    addPart(this.model, new THREE.BoxGeometry(0.3, 0.5, 0.03), cloth, 0, 0.62, 0.17);
    addPart(this.model, new THREE.BoxGeometry(0.1, 0.1, 0.035), accent, 0, 0.74, 0.185);

    this.weapon = new THREE.Group();
    this.weapon.position.set(0, -0.27, 0.02);
    this.rightForearm.add(this.weapon);

    if (this.roleKey === "footman" || this.roleKey === "knight") {
      addPart(this.model, new THREE.BoxGeometry(0.36, 0.3, 0.08), metal, 0, 1.28, 0.1);
      addPart(this.model, new THREE.BoxGeometry(0.36, 0.3, 0.08), metal, 0, 1.28, -0.1);
      for (const arm of [this.leftArm, this.rightArm]) addPart(arm, G.pauldron, metal, 0, 0.02, 0);
      // escudo redondo no antebraço (face para fora), com aro e botão; a mão fica atrás dele
      const shield = new THREE.Group();
      shield.position.set(-0.085, -0.15, 0);
      shield.rotation.y = -Math.PI / 2;
      this.leftForearm.add(shield);
      const sBody = addPart(shield, new THREE.CylinderGeometry(0.2, 0.19, 0.04, 12), cloth, 0, 0, 0);
      sBody.rotation.x = Math.PI / 2;
      sBody.scale.set(0.9, 1, 1.18);
      const sRim = addPart(shield, new THREE.TorusGeometry(0.195, 0.014, 5, 14), metal, 0, 0, 0.02);
      sRim.scale.set(0.9, 1.18, 1);
      addPart(shield, new THREE.SphereGeometry(0.05, 7, 5), accent, 0, 0, 0.045);
    }
    if (this.roleKey === "footman") {
      addPart(face, G.helmet, metal, 0, 0.035, 0);
      addPart(face, new THREE.BoxGeometry(0.022, 0.1, 0.02), metal, 0, -0.02, 0.128);
      addPart(face, new THREE.ConeGeometry(0.03, 0.14, 4), accent, 0, 0.17, -0.02);
      addPart(this.weapon, G.shaft, leather, 0, 0.25, 0).scale.y = 1.9;
      addPart(this.weapon, new THREE.ConeGeometry(0.05, 0.3, 5), metal, 0, 1.28, 0);
    } else if (this.roleKey === "knight") {
      // elmo fechado com viseira e penacho
      addPart(face, new THREE.SphereGeometry(0.145, 10, 8), metal, 0, 0.02, 0);
      addPart(face, new THREE.BoxGeometry(0.2, 0.025, 0.03), dark, 0, 0.02, 0.138);
      addPart(face, new THREE.ConeGeometry(0.04, 0.26, 5), cloth, 0, 0.22, -0.04);
      addPart(this.weapon, G.shaft, leather, 0, 0.7, 0).scale.y = 2.9;
      addPart(this.weapon, new THREE.ConeGeometry(0.055, 0.34, 5), metal, 0, 2.3, 0);
      addPart(this.weapon, new THREE.BoxGeometry(0.02, 0.2, 0.22), cloth, 0, 1.9, 0);
    } else if (this.roleKey === "archer") {
      // capuz arredondado com aba curta e pena, gibão de couro por cima do pano, bracelete e aljava com flechas
      addPart(face, G.cap, leather, 0, 0.04, 0);
      addPart(face, new THREE.SphereGeometry(0.146, 10, 7, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.32), leather, 0, 0.0, -0.012); // capuz caindo na nuca
      addPart(face, new THREE.CylinderGeometry(0.15, 0.15, 0.018, 9), leather, 0, 0.065, 0.02);
      const feather = addPart(face, new THREE.ConeGeometry(0.018, 0.16, 5), accent, 0.1, 0.13, -0.03);
      feather.rotation.z = -0.9;
      const vest = addPart(this.model, new THREE.CylinderGeometry(0.205, 0.225, 0.46, 10), leather, 0, 1.13, 0);
      vest.scale.z = 0.78;
      addPart(this.leftForearm, new THREE.CylinderGeometry(0.056, 0.05, 0.16, 8), leather, 0, -0.17, 0); // bracelete do braço do arco
      // aljava nas costas, inclinada, com as flechas saindo pelo topo (uma malha só para o feixe)
      const quiver = new THREE.Group();
      quiver.position.set(0.13, 1.2, -0.22);
      quiver.rotation.z = -0.28;
      this.model.add(quiver);
      addPart(quiver, new THREE.CylinderGeometry(0.075, 0.06, 0.56, 8), leather, 0, 0, 0);
      const bundle = new THREE.Mesh(createArrowBundleGeometry(), getArrowMaterial());
      bundle.position.y = 0.21;
      quiver.add(bundle);
      addPart(this.model, new THREE.BoxGeometry(0.05, 0.7, 0.02), dark, -0.04, 1.18, -0.01).rotation.z = 0.7; // correia
      // ARCO na mão ESQUERDA: no plano Y/Z, barriga para a frente; a orientação é travada no mundo (ver _bowPose)
      const bowHolder = new THREE.Group();
      bowHolder.position.set(0, -0.3, 0.0);
      this.leftForearm.add(bowHolder);
      this.bowHolder = bowHolder;
      bowHolder.add(new THREE.Mesh(createBowGeometry(), getBowMaterial()));
      this.bowStringGeo = createStringGeometry();
      bowHolder.add(new THREE.Mesh(this.bowStringGeo, getStringMaterial()));
      this.bowArrow = new THREE.Mesh(createArrowGeometry(), getArrowMaterial());
      this.bowArrow.visible = false;
      bowHolder.add(this.bowArrow);
      this.bowDraw = 0;
    } else if (this.roleKey === "crossbow") {
      addPart(face, G.helmet, metal, 0, 0.035, 0);
      addPart(face, new THREE.CylinderGeometry(0.19, 0.19, 0.02, 9), metal, 0, 0.07, 0);
      addPart(this.model, new THREE.BoxGeometry(0.34, 0.3, 0.07), metal, 0, 1.28, 0.1);
      addPart(this.model, new THREE.BoxGeometry(0.17, 0.2, 0.11), leather, -0.28, 0.82, 0.02);
      addPart(this.weapon, new THREE.BoxGeometry(0.07, 0.7, 0.08), leather, 0, 0.1, 0);
      addPart(this.weapon, new THREE.BoxGeometry(0.62, 0.05, 0.07), metal, 0, 0.42, 0);
      addPart(this.weapon, new THREE.BoxGeometry(0.5, 0.012, 0.012), accent, 0, 0.37, 0);
    } else {
      // canhoneiro: chapéu, avental e o canhão ao lado
      addPart(face, new THREE.ConeGeometry(0.14, 0.2, 7), dark, 0, 0.15, 0);
      addPart(face, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 9), dark, 0, 0.075, 0);
      addPart(this.model, new THREE.BoxGeometry(0.34, 0.62, 0.03), leather, 0, 0.98, 0.15);
      addPart(this.weapon, G.shaft, leather, 0, 0.3, 0).scale.y = 1.4;
      addPart(this.weapon, new THREE.SphereGeometry(0.06, 6, 5), dark, 0, 1.0, 0);
      this.cannon = new THREE.Group();
      this.root.add(this.cannon);
      const barrel = addPart(this.cannon, new THREE.CylinderGeometry(0.15, 0.22, 1.3, 10), metal, 0, 0.62, 0.1);
      barrel.rotation.x = Math.PI / 2;
      addPart(this.cannon, new THREE.BoxGeometry(0.5, 0.18, 0.9), leather, 0, 0.36, 0);
      for (const side of [-1, 1]) {
        const wheel = addPart(this.cannon, new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10), leather, side * 0.3, 0.34, -0.05);
        wheel.rotation.z = Math.PI / 2;
      }
    }
  }

  activate(x, z) {
    this.spawnX = x;
    this.spawnZ = z;
    this.respawn();
    this.removed = false;
    this.mode = "hunt";
    this.alerted = true;
    this.dismissing = 0;
    this.lostTimer = 0;
    this.shootTimer = 1.2 + Math.random() * 2.2;
    this.windup = 0;
    this.aimBlend = 0;
    this.attackCooldown = 1;
    this.mounted = false;
    this.horse = null;
    if (this.cannon) this.cannon.visible = true;
    if (this.roleKey === "footman" && this.npcSystem?.torches) {
      this.npcSystem.torches.attachGuardTorchProp(this.root, this.leftForearm);
      setupGuardTorch(this.root, Boolean(this.npcSystem.isNight), this.npcSystem.torches.guardTorchPool);
    }
  }

  remove() {
    releaseToken(this);
    releaseGuardTorch(this.root);
    this.alive = false;
    this.removed = true;
    this.root.visible = false;
    if (this.cannon) this.cannon.visible = false;
    if (this.mounted && this.horse) this.horse.dismiss();
    this.mounted = false;
    this.horse = null;
  }

  dismiss() {
    if (!this.removed && this.alive && this.dismissing <= 0) this.dismissing = 1;
  }

  dismount(horse) {
    if (!this.mounted) return;
    this.mounted = false;
    this.horse = null;
    if (horse) {
      this.x = horse.x + Math.cos(horse.heading) * 0.9;
      this.z = horse.z - Math.sin(horse.heading) * 0.9;
    }
    this.root.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);
    this._hitStun = 1.3;
    this._knockX = Math.sin(horse ? horse.heading : 0);
    this._knockZ = Math.cos(horse ? horse.heading : 0);
    this._knockPower = 4;
    this.model.rotation.x = 0;
    this.effects?.play("dust", this.x, this.root.position.y + 0.2, this.z, "#cdbb97", 1.1);
  }

  takeHit(amount, directionX, directionZ, force = 1.8, launch = 0) {
    const dead = super.takeHit(amount, directionX, directionZ, force, launch);
    if (dead && this.mounted) {
      this.mounted = false;
      if (this.horse) this.horse.rider = null;
      this.horse = null;
      this._launch = Math.max(this._launch, 0.8);
      this._ragdollDuration = 0.8;
    }
    return dead;
  }

  _tickFlash(dt) {
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const c = this._flashTimer > 0 ? FLASH_COLOR : ZERO_COLOR;
      const intensity = this._flashTimer > 0 ? 0.65 : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.copy(c);
        this.flashMaterials[i].emissiveIntensity = intensity;
      }
    }
  }

  _faceToward(dirX, dirZ, rate, dt) {
    const target = Math.atan2(dirX, dirZ);
    const difference = Math.atan2(Math.sin(target - this.model.rotation.y), Math.cos(target - this.model.rotation.y));
    this.model.rotation.y += difference * (1 - Math.exp(-rate * dt));
  }

  // Arco do arqueiro: sempre na vertical e de frente no MUNDO (compensa o pitch do braço esquerdo), com a barriga para
  // o alvo e o plano da corda perpendicular ao olhar. Ao mirar, o encaixe da corda acompanha a mão que puxa e
  // a flecha fica encaixada; ao soltar, o aimBlend cai e a corda volta sozinha.
  _bowPose(ab) {
    const holder = this.bowHolder;
    if (!holder) return;
    holder.rotation.x = -(this.leftArm.rotation.x + this.leftForearm.rotation.x);
    holder.rotation.z = -this.leftArm.rotation.z;
    let nockZ = BOW_TIP_Z;
    const drawn = ab > 0.15;
    if (drawn) {
      this.rightForearm.localToWorld(_bowHand.set(0, -0.3, 0));
      holder.worldToLocal(_bowHand);
      nockZ = Math.max(-0.62, Math.min(BOW_TIP_Z, _bowHand.z));
    }
    setStringNock(this.bowStringGeo, nockZ);
    if (this.bowArrow.visible !== drawn) this.bowArrow.visible = drawn;
    if (drawn) this.bowArrow.position.z = nockZ + 0.42;
  }

  _weaponPose(alpha, free = false) {
    const total = this.rightArm.rotation.x + this.rightForearm.rotation.x;
    this.weapon.rotation.x = free ? alpha : alpha - total;
  }

  _updateMounted(dt) {
    const horse = this.horse;
    if (!horse || !horse.alive) {
      this.dismount(horse);
      return;
    }
    this.x = horse.x;
    this.z = horse.z;
    this.root.position.set(this.x, horse.root.position.y + 0.62 + horse.bob, this.z);
    this.model.rotation.y = horse.heading;
    this.model.rotation.x = 0.08 + Math.min(1, horse.speed / 9) * 0.14;
    this.leftLeg.rotation.set(-1.0, 0, -0.5);
    this.rightLeg.rotation.set(-1.0, 0, 0.5);
    this.leftKnee.rotation.x = 1.1;
    this.rightKnee.rotation.x = 1.1;
    this.leftArm.rotation.set(-0.6, 0, 0.3);
    this.leftForearm.rotation.x = -0.6;
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const strikeNorm = 1 - this.swingTimer / 0.35;
      const k = strikeNorm < 0.28
        ? Math.pow(strikeNorm / 0.28, 1.8)
        : 1 - Math.pow((strikeNorm - 0.28) / 0.72, 1.4);
      this.rightArm.rotation.set(-1.15 - 0.55 * k, 0, 0);
    } else {
      // preparação: a lança sobe antes da investida
      this.rightArm.rotation.set(-1.15 - 0.8 * this.meleeWind, 0, 0);
    }
    this.rightForearm.rotation.x = -0.3;
    this._weaponPose(Math.PI / 2 - 0.12);
    this._tickFlash(dt);
  }

  _updateAlert(dt, px, pz) {
    if (this.removed) return;
    this.animTime += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.dismissing > 0) {
      this.dismissing -= dt * 1.2;
      this.root.scale.setScalar(Math.max(0.001, this.dismissing));
      if (this.dismissing <= 0) {
        this.effects?.play("smoke", this.x, this.root.position.y + 1, this.z, "#e6dcc0", 1.3);
        this.remove();
      }
      return;
    }
    if (this.mounted) {
      this._updateMounted(dt);
      return;
    }
    this._tickFlash(dt);
    if (this._hitStun > 0) {
      const stun = this._hitStun / 0.82;
      this._hitStun = Math.max(0, this._hitStun - dt);
      this._knockMove(dt, Math.min(1, stun));
      this.model.rotation.x = -0.25;
      this.leftArm.rotation.x = -1.05;
      this.rightArm.rotation.x = 0.78;
      this.root.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);
      return;
    }

    const d = this.def;
    const dx = px - this.x;
    const dz = pz - this.z;
    const distSq = dx * dx + dz * dz;
    const distance = Math.sqrt(distSq);
    const nx = dx / Math.max(distance, 0.001);
    const nz = dz / Math.max(distance, 0.001);
    let moveX = 0;
    let moveZ = 0;
    let speed = 0;
    let aiming = false;

    const isNight = Boolean(this.npcSystem?.isNight);
    const isPlayerLit = Boolean(this.npcSystem ? this.npcSystem.isPlayerLit : true);
    const hasTorch = Boolean(this.root.userData.hasTorch);
    // Mesmo o soldado com tocha só enxerga o jogador no escuro dentro do raio de alcance da tocha (< 16m)
    const torchReachesPlayer = hasTorch && distSq < TORCH_VISION_RANGE_SQ;
    const hasDirectVision = !isNight || torchReachesPlayer || isPlayerLit || distSq < 9.0;

    // Se o jogador se afastar o suficiente além do alcance da tocha/visão, o soldado também perde o rastro
    const loseDistSq = isNight ? (hasTorch ? 24 * 24 : 15 * 15) : 46 * 46;
    if (!hasDirectVision && distSq > TORCH_VISION_RANGE_SQ) {
      this.lostTimer = (this.lostTimer || 0) + dt * (distSq > 30 * 30 ? 1.8 : 1.0);
    } else if (distSq > loseDistSq) {
      this.lostTimer = (this.lostTimer || 0) + dt;
    } else {
      this.lostTimer = Math.max(0, (this.lostTimer || 0) - dt * 2);
    }
    if (this.lostTimer > 6.5 || (isNight && !hasDirectVision && distSq > 38 * 38)) {
      this.lostTimer = 0;
      this.dismiss();
      return;
    }

    if (!hasDirectVision && (this.behavior === "melee" || this.behavior === "knight")) {
      // Fora do alcance da tocha no breu: desvio angular aleatório de ±60° a ±75° (Zero-GC)
      _playerPosVec.set(px, 0, pz);
      const drift = updateGuardTracking(this.root, _playerPosVec, isPlayerLit, isNight, dt, false);
      moveX = drift.x;
      moveZ = drift.z;
      speed = distSq > 24 * 24 ? GUARD_SPEED * 0.78 : GUARD_SPEED;
    } else if (this.behavior === "melee" || this.behavior === "knight") {
      this.root.userData.driftAngle = 0;
      const think = meleeThink(this, dt, px, pz);
      moveX = think.mx;
      moveZ = think.mz;
      speed = think.speed * (d.speed + 0.6);
    } else {
      let approachX = nx;
      let approachZ = nz;
      if (!hasDirectVision) {
        _playerPosVec.set(px, 0, pz);
        const drift = updateGuardTracking(this.root, _playerPosVec, isPlayerLit, isNight, dt, false);
        approachX = drift.x;
        approachZ = drift.z;
      }
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeTimer = 2.2 + Math.random() * 2;
        this.strafe = Math.random() < 0.5 ? -1 : 1;
      }
      if (distance > d.maxRange) {
        moveX = approachX;
        moveZ = approachZ;
        speed = d.speed;
      } else if (distance < d.minRange) {
        moveX = -approachX;
        moveZ = -approachZ;
        speed = d.speed;
      } else if (this.behavior !== "cannon") {
        moveX = -approachZ * this.strafe;
        moveZ = approachX * this.strafe;
        speed = d.speed * 0.4;
      }
      this.shootTimer -= dt;
      if (this.windup > 0) {
        this.windup -= dt;
        aiming = true;
        if (this.windup <= 0) {
          this.onShoot?.(this);
          this.shootTimer = d.cooldown * (0.8 + Math.random() * 0.5);
        }
      } else if (this.shootTimer <= 0 && distance <= (hasDirectVision ? d.maxRange + 6 : d.maxRange * 0.65)) {
        this.windup = d.windup;
      }
    }

    if (this.behavior !== "melee" && this.behavior !== "knight") {
      // atiradores também mantêm distância dos aliados e do jogador
      const push = separation(this, px, pz);
      moveX += push.x * 0.9;
      moveZ += push.z * 0.9;
      const len = Math.hypot(moveX, moveZ);
      if (len > 1) {
        moveX /= len;
        moveZ /= len;
      }
      if (speed === 0 && len > 0.05) speed = d.speed * 0.5;
    }
    const moving = speed > 0;
    if (moving) this._stepTowards(moveX, moveZ, speed * dt);
    this.vx = moveX * speed;
    this.vz = moveZ * speed;
    if (!hasDirectVision && moving) {
      this._faceToward(moveX, moveZ, 4.5, dt);
    } else {
      if (aiming || !moving || this.behavior !== "melee") this._faceToward(nx, nz, 12, dt);
      else this._faceToward(moveX, moveZ, 12, dt);
      if (this.behavior === "melee" || this.behavior === "knight") this._faceToward(nx, nz, 14, dt);
    }
    this.root.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);

    if (moving) this.walkPhase += dt * (6 + speed * 1.7);
    if (!this._stride) this._stride = 0;
    const targetStride = moving ? Math.sin(this.walkPhase) * 0.58 : 0;
    this._stride += (targetStride - this._stride) * (1 - Math.exp(-20 * dt));
    const stride = this._stride;
    this.leftLeg.rotation.x = stride;
    this.rightLeg.rotation.x = -stride;
    bendJoints(this, stride, stride);
    const targetBob = moving ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.035 : 0;
    this.model.position.y += (targetBob - this.model.position.y) * (1 - Math.exp(-18 * dt));
    const targetPitch = moving ? 0.09 : 0;
    this.model.rotation.x += (targetPitch - this.model.rotation.x) * (1 - Math.exp(-14 * dt));

    this.aimBlend += ((aiming ? 1 : 0) - this.aimBlend) * (1 - Math.exp(-14 * dt));
    const ab = this.aimBlend;
    this.leftArm.rotation.x = -stride * 0.8;
    this.rightArm.rotation.x = stride * 0.8 - 0.35;
    this.leftArm.rotation.z = 0;
    this.rightArm.rotation.z = 0;
    let weaponFree = false;
    if (this.meleeWind > 0) {
      // preparação do golpe: braço e arma sobem, com a arma brilhando (sprite no início)
      this.rightArm.rotation.x = -0.4 - 1.9 * this.meleeWind;
      this.rightForearm.rotation.x = -0.3 - 0.5 * this.meleeWind;
      weaponFree = true;
    }
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const strikeNorm = 1 - this.swingTimer / 0.3;
      const strikeArc = strikeNorm < 0.28
        ? Math.pow(strikeNorm / 0.28, 1.8)
        : 1 - Math.pow((strikeNorm - 0.28) / 0.72, 1.4);
      this.rightArm.rotation.x = -0.3 - 1.9 * strikeArc;
      this.rightArm.rotation.z = -0.2 * strikeArc;
      this.rightForearm.rotation.x = -0.25 - 0.3 * strikeArc;
      weaponFree = true;
    }
    if (this.behavior === "archer") {
      // braço do arco (esquerdo) estendido para o alvo; braço de puxar (direito) leva a corda até a face
      this.leftArm.rotation.x += (-1.5 - this.leftArm.rotation.x) * ab;
      this.leftArm.rotation.z += 0.1 * ab;
      this.leftForearm.rotation.x *= 1 - ab;
      this.rightArm.rotation.x += (-1.3 - this.rightArm.rotation.x) * ab;
      this.rightArm.rotation.z += (-0.5 - this.rightArm.rotation.z) * ab;
      this.rightForearm.rotation.x += (-2.05 - this.rightForearm.rotation.x) * ab;
    } else if (this.behavior === "crossbow") {
      this.rightArm.rotation.x += (-1.5 - this.rightArm.rotation.x) * ab;
      this.leftArm.rotation.x += (-1.4 - this.leftArm.rotation.x) * ab;
      this.leftArm.rotation.z += 0.4 * ab;
      this.rightForearm.rotation.x *= 1 - ab;
      this.leftForearm.rotation.x *= 1 - ab;
    } else if (this.behavior === "cannon" && ab > 0.05) {
      this.rightArm.rotation.x += (-0.8 - this.rightArm.rotation.x) * ab;
    }
    if (weaponFree) {
      this._weaponPose(this.meleeWind > 0 ? 0.3 + 0.4 * this.meleeWind : 1.2, true);
    } else if (this.behavior === "archer") {
      this._bowPose(ab);
    } else if (this.behavior === "crossbow") {
      this._weaponPose(Math.PI / 2 + 0.4 - 0.4 * ab);
    } else {
      this._weaponPose(0.25);
    }

    if (this.cannon) {
      const f = this.model.rotation.y;
      this.cannon.position.set(Math.sin(f) * 1.6, 0, Math.cos(f) * 1.6);
      this.cannon.rotation.y = f;
    }
  }
}

// Projéteis dos inimigos: flechas, virotes e balas de canhão.
class EnemyFire {
  constructor(scene, world, director) {
    this.world = world;
    this.director = director;
    this.items = [];
    const arrowMat = getArrowMaterial();
    const ballMat = new THREE.MeshStandardMaterial({ color: "#1c1c1e", metalness: 0.5, roughness: 0.5, flatShading: true });
    const arrow = createArrowGeometry(); // haste + ponta de aço + 3 penas, uma malha (~44 triângulos), +Z para frente
    const ball = new THREE.SphereGeometry(0.2, 8, 6);
    for (let i = 0; i < 36; i++) {
      const root = new THREE.Group();
      const variants = {
        arrow: new THREE.Mesh(arrow, arrowMat),
        bolt: new THREE.Mesh(arrow, arrowMat), // virote: a mesma malha, mais curta e grossa
        ball: new THREE.Mesh(ball, ballMat),
      };
      variants.arrow.scale.set(1.25, 1.25, 1.15); // legível a 720p
      variants.bolt.scale.set(1.5, 1.5, 0.62);
      for (const mesh of Object.values(variants)) {
        mesh.visible = false;
        root.add(mesh);
      }
      root.visible = false;
      scene.add(root);
      this.items.push({ root, variants, active: false, type: "arrow", x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, damage: 1, life: 0, trail: 0 });
    }
    this.cursor = 0;
  }

  launch(type, x, y, z, vx, vy, vz, g, damage) {
    let item = null;
    for (let i = 0; i < this.items.length; i++) {
      const candidate = this.items[(this.cursor + i) % this.items.length];
      if (!candidate.active) {
        item = candidate;
        this.cursor = (this.cursor + i + 1) % this.items.length;
        break;
      }
    }
    if (!item) return;
    item.active = true;
    item.stuck = 0;
    item.root.scale.setScalar(1);
    item.type = type;
    item.x = x; item.y = y; item.z = z;
    item.vx = vx; item.vy = vy; item.vz = vz;
    item.g = g;
    item.damage = damage;
    item.life = 6;
    item.trail = 0;
    for (const key of Object.keys(item.variants)) item.variants[key].visible = key === type;
    item.root.visible = true;
    item.root.position.set(x, y, z);
  }

  clear() {
    for (const item of this.items) {
      item.active = false;
      item.stuck = 0;
      item.root.visible = false;
      item.root.scale.setScalar(1);
    }
  }

  update(dt, player) {
    const d = this.director;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      if (!p.active) {
        // flecha/virote cravado: fica parado alguns segundos e some encolhendo (último segundo)
        if (p.stuck > 0) {
          p.stuck -= dt;
          if (p.stuck <= 0) {
            p.root.visible = false;
            p.root.scale.setScalar(1);
          } else if (p.stuck < 1) {
            p.root.scale.setScalar(Math.max(0.01, p.stuck));
          }
        }
        continue;
      }
      p.life -= dt;
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.45));
      const sub = dt / steps;
      let ended = p.life <= 0;
      let stick = false;
      for (let s = 0; s < steps && !ended; s++) {
        p.vy -= p.g * sub;
        p.x += p.vx * sub;
        p.y += p.vy * sub;
        p.z += p.vz * sub;
        const ground = this.world.heightAt(p.x, p.z);
        const dx = p.x - player.x;
        const dz = p.z - player.z;
        const local = p.y - player.root.position.y;
        const hitPlayer = !player.knockedOut && dx * dx + dz * dz < (p.type === "ball" ? 0.8 : 0.42) ** 2 && local > -0.1 && local < player.hitHeight;
        if (hitPlayer && p.type !== "ball") {
          d.combat.hurtPlayer(p.damage, p.x - p.vx * 0.05, p.z - p.vz * 0.05, { ranged: true, weapon: p.type === "arrow" ? "arrow" : "bolt" });
          ended = true;
        } else if (hitPlayer || p.y <= ground + 0.1 || this.world.isBlockedAtHeight(p.x, p.y, p.z, 0.1)) {
          if (p.type === "ball") d.explodeBall(p);
          else {
            d.effects.play("star", p.x, Math.max(p.y, ground + 0.3), p.z, "#d6b57a", 0.45);
            stick = true;
            p.y = Math.max(p.y, ground + 0.05); // a ponta fica cravada rente ao chão
          }
          ended = true;
        }
      }
      if (ended) {
        if (p.life <= 0 && p.type === "ball") d.explodeBall(p);
        p.active = false;
        if (stick) {
          p.stuck = 6; // cravada: continua visível, parada, com a mesma orientação do voo
          p.root.position.set(p.x, p.y, p.z);
        } else {
          p.root.visible = false;
        }
        continue;
      }
      if (p.type === "ball") {
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = 0.05;
          d.effects.play("smoke", p.x, p.y, p.z, "#8a847a", 0.55);
        }
      }
      p.root.position.set(p.x, p.y, p.z);
      _lookTarget.set(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      p.root.lookAt(_lookTarget);
    }
  }
}

export class EnemyDirector {
  constructor(scene, world, npcSystem, effects, explosions, audio) {
    this.scene = scene;
    this.world = world;
    this.npcSystem = npcSystem;
    this.effects = effects;
    this.explosions = explosions;
    this.audio = audio;
    this.combat = null;
    this.player = null;
    this.cameraRig = null;
    this.soldiers = [];
    this.pairs = [];
    this.spawnTimer = 0;
    this.fire = new EnemyFire(scene, world, this);
    npcSystem.onClear = () => this.standDown();

    // Pre-aquecimento do pool de soldados para evitar stutter/GC durante a perseguição
    for (const r of ["footman", "footman", "archer", "crossbow"]) {
      this._soldier(r);
    }
  }

  _count(role) {
    let n = 0;
    for (const s of this.soldiers) if (s.roleKey === role && !s.removed && s.alive && s.dismissing <= 0) n++;
    return n;
  }

  _spot(player, minRadius, maxRadius) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const x = player.x + Math.sin(angle) * radius;
      const z = player.z + Math.cos(angle) * radius;
      if (!this.world.isBlockedAt(x, z, 1.1)) return { x, z };
    }
    return null;
  }

  _soldier(role) {
    let s = this.soldiers.find((c) => c.roleKey === role && c.removed);
    if (!s) {
      s = new Soldier(this.scene, this.world, role, this.effects);
      s.npcSystem = this.npcSystem;
      s.onShoot = (shooter) => this.shoot(shooter);
      this.soldiers.push(s);
      this.npcSystem.npcs.push(s);
    }
    return s;
  }

  _spawn(role, player) {
    const spot = this._spot(player, 38, 54);
    if (!spot) return;
    if (role === "knight") {
      let pair = this.pairs.find((p) => p.horse.removed && p.rider.removed);
      if (!pair) {
        const horse = new Horse(this.scene, this.world, this.effects, ["#4a3022", "#2f2a28", "#6a5a48", "#3b2418"][this.pairs.length % 4]);
        const rider = new Soldier(this.scene, this.world, "knight", this.effects);
        rider.npcSystem = this.npcSystem;
        rider.onShoot = (shooter) => this.shoot(shooter);
        pair = { horse, rider };
        this.pairs.push(pair);
        this.soldiers.push(rider);
        // o cavalo entra antes do cavaleiro: os tiros baixos acertam o cavalo primeiro
        this.npcSystem.npcs.push(horse, rider);
      }
      const heading = Math.atan2(player.x - spot.x, player.z - spot.z);
      pair.horse.activate(spot.x, spot.z, heading);
      pair.rider.activate(spot.x, spot.z);
      pair.rider.mounted = true;
      pair.rider.horse = pair.horse;
      pair.horse.rider = pair.rider;
      return;
    }
    this._soldier(role).activate(spot.x, spot.z);
  }

  standDown() {
    for (const s of this.soldiers) s.dismiss();
    for (const pair of this.pairs) pair.horse.dismiss();
    this.fire.clear();
  }

  update(dt, player) {
    this.player = player;
    const level = this.npcSystem.wanted;
    if (level > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(1.1, 2.6 - level * 0.3);
        const wave = WAVES[level];
        let active = 0;
        for (const s of this.soldiers) if (!s.removed && s.alive) active++;
        if (active < MAX_ACTIVE) {
          let pick = null;
          let deficit = 0;
          for (const role of Object.keys(wave)) {
            const lacking = wave[role] - this._count(role);
            if (lacking > deficit) {
              deficit = lacking;
              pick = role;
            }
          }
          if (pick) this._spawn(pick, player);
        }
      }
    }
    pruneTokens();
    this._updateKnights(dt, player);
    this.fire.update(dt, player);
  }

  // Lança do cavaleiro e pisoteio do cavalo.
  _updateKnights(dt, player) {
    for (const { horse, rider } of this.pairs) {
      if (horse.removed || !horse.alive || !rider.mounted || !rider.alive) continue;
      const dx = player.x - horse.x;
      const dz = player.z - horse.z;
      const distance = Math.hypot(dx, dz);
      const alignment = (Math.sin(horse.heading) * dx + Math.cos(horse.heading) * dz) / Math.max(distance, 0.001);
      // lança: precisa de ficha de ataque e tem preparação visível (~0,5 s) antes do golpe
      if (horse.lancePrep > 0) {
        horse.lancePrep -= dt;
        rider.meleeWind = 1 - Math.max(0, horse.lancePrep) / 0.5;
        if (horse.lancePrep <= 0) {
          rider.meleeWind = 0;
          rider.swingTimer = 0.35;
          horse.lanceCooldown = 2 + Math.random() * 1.5;
          releaseToken(rider);
          if (distance < 4.6 && alignment > 0.25) {
            this.effects.play("slash", horse.x + Math.sin(horse.heading) * 2, horse.root.position.y + 1.9, horse.z + Math.cos(horse.heading) * 2, "#ffe2a0", 1.5);
            this.combat.hurtPlayer(2, horse.x, horse.z, { knock: 8, weapon: "blade" });
          }
        }
      } else if (horse.state === "charge" && distance < 6 && alignment > 0.45 && horse.lanceCooldown <= 0 && requestToken(rider)) {
        horse.lancePrep = 0.5;
        this.effects.play("glint", horse.x + Math.sin(horse.heading) * 2.2, horse.root.position.y + 2.2, horse.z + Math.cos(horse.heading) * 2.2, "#fff0b0", 0.9);
      }
      if (distance < 1.3 && horse.speed > 4 && horse.trampleCooldown <= 0) {
        horse.trampleCooldown = 1.5;
        this.combat.hurtPlayer(1, horse.x, horse.z, { knock: 11, weapon: "trample" });
      }
    }
  }

  shoot(shooter) {
    const player = this.player;
    if (!player || !shooter.alive) return;
    const facing = shooter.model.rotation.y;
    const role = shooter.roleKey;
    const type = role === "archer" ? "arrow" : role === "crossbow" ? "bolt" : "ball";
    const ox = shooter.x + Math.sin(facing) * (role === "cannoneer" ? 2.4 : 0.7);
    const oz = shooter.z + Math.cos(facing) * (role === "cannoneer" ? 2.4 : 0.7);
    const oy = shooter.root.position.y + (role === "cannoneer" ? 0.9 : 1.45);
    const speed = type === "arrow" ? 30 : type === "bolt" ? 44 : 24;
    const gravity = type === "arrow" ? 8 : type === "bolt" ? 2.2 : 11;
    const flat0 = Math.hypot(player.x - ox, player.z - oz);
    const lead = Math.min(0.9, flat0 / speed);
    const tx = player.x + player.vx * lead * 0.7;
    const tz = player.z + player.vz * lead * 0.7;
    const ty = player.root.position.y + 1.15;
    const dx = tx - ox;
    const dz = tz - oz;
    const flat = Math.max(0.5, Math.hypot(dx, dz));
    const flight = flat / speed;
    const vy = (ty - oy + 0.5 * gravity * flight * flight) / flight;
    const inDark = Boolean(this.npcSystem?.isNight && !this.npcSystem?.isPlayerLit && !shooter.root.userData.hasTorch && flat > 4);
    const spread = (type === "ball" ? 0.012 : 0.035) + (inDark ? 0.22 : 0);
    const angle = Math.atan2(dx, dz) + (Math.random() + Math.random() - 1) * spread;
    this.fire.launch(type, ox, oy, oz, Math.sin(angle) * speed, vy, Math.cos(angle) * speed, gravity, type === "arrow" ? 1 : 2);
    const distance = Math.hypot(ox - player.x, oz - player.z);
    if (type === "ball") {
      this.effects.play("flame", ox, oy, oz, "#f59e4d", 1.2);
      this.effects.play("smoke", ox, oy, oz, "#b7aa8d", 1.2);
      this.audio.explosion(distance + 40);
      this.cameraRig?.shakeAt(ox, oz, 0.25, player.x, player.z);
    } else {
      this.audio.shot(type === "arrow" ? "bow" : "crossbow");
    }
  }

  explodeBall(ball) {
    const radius = 4.4;
    this.explosions.trigger(ball.x, ball.y, ball.z, radius);
    const player = this.player;
    this.audio.explosion(Math.hypot(ball.x - player.x, ball.z - player.z));
    const dx = player.x - ball.x;
    const dz = player.z - ball.z;
    const distance = Math.hypot(dx, dz);
    if (distance < radius) {
      const falloff = 1 - distance / radius;
      this.combat.hurtPlayer(Math.max(1, Math.ceil(2 * falloff)), ball.x, ball.z, { explosive: true, knock: 10, weapon: "blast" });
    }
  }
}
