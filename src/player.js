import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeSkinnedMaterial } from "./skins.js";
import { buildHumanoid, bendJoints } from "./humanoid.js";
import { PlayerStats } from "./rpg.js?v=14";

const ROLL_DURATION = 0.55;
const ROLL_SPEED = 9.5;
const LAND_TIME = 0.24;

// Vetores e estruturas auxiliares pré-alocados no escopo do módulo (Zero-GC no loop de jogo)
const _v1 = new THREE.Vector3();
const _moveResult = { x: 0, z: 0, hitX: false, hitZ: false };

function makePart(geometry, material, parent, x, y, z, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

export class Player {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.root.add(this.model);
    this.userData = this.root.userData;
    this.userData.isRiding = false;
    this.userData.mount = null;
    this.userData.state = "IDLE";
    this.position = this.root.position;
    this.children = this.model.children;
    this.x = CONFIG.player.startX;
    this.z = CONFIG.player.startZ;
    this.verticalOffset = 0;
    this.verticalSpeed = 0;
    this.vx = 0;
    this.vz = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.moveX = 0;
    this.moveZ = 0;
    this.speedRatio = 0;
    this.health = 5;
    this.maxHealth = 5;
    this.coins = 0;
    this.potions = 1;
    this.armorLevel = 0;
    this.attackTimer = 0;
    this.attackKind = 0;
    this.faceTimer = 0;
    this.faceYaw = 0;
    this.firePoseTimer = 0;
    this.aimPose = 0;
    this.aimStyle = "melee";
    this.weaponId = "fists";
    this.weaponGrip = "none";
    this.twoHanded = false;
    this.weaponWeight = 1;
    this.canBlock = true;
    this.chargePose = 0;
    this.attackLen = 0.36;
    this.recoil = 0;
    this.knockedOut = false;
    this.rolling = false;
    this.rollTimer = 0;
    this.rollCooldown = 0;
    this.rollX = 0;
    this.rollZ = 0;
    this.jumpBuffer = 0;
    this.landTimer = 0;
    this.dustTimer = 0;
    this.idleTime = 0;
    this.mounted = null;
    this.crouching = false;
    this.sitting = false;
    this.praying = false;
    this.sittingInChurch = false;
    this.sitPose = 0;
    this.prayPose = 0;
    this.seatYaw = 0;
    this.prayHealTimer = 0;
    this.invuln = 0;
    this.staggerTimer = 0;
    this.crouchPose = 0;
    this.hitHeight = 1.85;
    this.stamina = 100;
    this.inHouse = null;
    this.dead = false;
    this.deathTime = 0;
    this.deathSide = 1;
    this.effects = null;
    this.audio = null;
    this._stepIndex = 0;
    this.radius = CONFIG.player.radius;
    this._move = { x: 0, z: 0, run: false };

    const cloth = makeSkinnedMaterial("fabric", "#455b50", 0, 0.92);
    const pants = makeSkinnedMaterial("fabric", "#3a3a36", 0, 0.95);
    const leather = makeSkinnedMaterial("leather", "#513b2b", 0, 1);
    const steel = makeSkinnedMaterial("metal", "#9a9b8d", 0.42, 0.54);
    const darkSteel = makeSkinnedMaterial("metal", "#626c68", 0.35, 0.64);
    const brightSteel = makeSkinnedMaterial("metal", "#c0c2b5", 0.58, 0.42);
    const heraldry = makeSkinnedMaterial("fabric", "#8b3d35", 0, 0.9);
    const skin = makeSkinnedMaterial("skin", "#c28e68", 0, 1);
    const hair = makeSkinnedMaterial("leather", "#3a281c", 0, 1);
    const gold = makeSkinnedMaterial("metal", "#b99352", 0.55, 0.5);

    const body = buildHumanoid(this.model, {
      skin,
      shirt: cloth,
      sleeve: cloth,
      pants,
      boots: leather,
      hair,
      forearm: darkSteel,
    });
    Object.assign(this, body);

    // Armadura do Jogador: Peitoral detalhado, espaldar, cinto com fivela, grevas e túnica
    const plate = new THREE.LatheGeometry(
      [[0.01, 0.12], [0.16, 0.14], [0.18, 0.3], [0.22, 0.46], [0.225, 0.54], [0.16, 0.62], [0.01, 0.62]].map(([r, y]) => new THREE.Vector2(r, y)),
      12,
    ).scale(1.04, 1.0, 0.76);
    this.chestArmor = makePart(plate, steel, this.model, 0, 0.82, 0.015);
    makePart(new THREE.BoxGeometry(0.08, 0.32, 0.025), gold, this.model, 0, 1.3, 0.175, false);
    makePart(new THREE.BoxGeometry(0.22, 0.07, 0.025), gold, this.model, 0, 1.38, 0.17, false);

    // Ombreiras sólidas anatômicas
    for (const arm of [this.leftArm, this.rightArm]) {
      const pauldron = makePart(new THREE.SphereGeometry(0.1, 10, 8), darkSteel, arm, 0, 0.02, 0);
      pauldron.scale.set(1.22, 0.9, 1.1);
      makePart(new THREE.BoxGeometry(0.16, 0.04, 0.14), steel, arm, 0, -0.04, 0);
    }
    const belt = makePart(new THREE.CylinderGeometry(0.21, 0.21, 0.07, 12), leather, this.model, 0, 0.84, 0);
    belt.scale.z = 0.78;
    makePart(new THREE.BoxGeometry(0.08, 0.07, 0.035), gold, this.model, 0, 0.84, 0.17, false);
    // Túnica e saia de placas integrada
    const skirt = makePart(new THREE.CylinderGeometry(0.2, 0.28, 0.32, 12), cloth, this.model, 0, 0.66, 0);
    skirt.scale.z = 0.76;
    makePart(new THREE.BoxGeometry(0.22, 0.44, 0.03), heraldry, this.model, 0, 0.6, 0.19, false);

    // Placas de perna / grevas
    for (const knee of [this.leftKnee, this.rightKnee]) {
      makePart(new THREE.BoxGeometry(0.11, 0.26, 0.03), steel, knee, 0, -0.19, 0.06, false);
      makePart(new THREE.SphereGeometry(0.068, 8, 6), darkSteel, knee, 0, 0, 0.035);
    }
    // Braçadeiras protetoras contínuas
    for (const fore of [this.leftForearm, this.rightForearm]) {
      makePart(new THREE.CylinderGeometry(0.055, 0.048, 0.18, 9), darkSteel, fore, 0, -0.15, 0);
    }

    // Elmo Cavaleiresco medieval com cota de malha / camal no pescoço
    const head = this.head;
    makePart(new THREE.CylinderGeometry(0.12, 0.15, 0.18, 10), darkSteel, head, 0, -0.1, 0); // Camal cobrindo o pescoço
    makePart(new THREE.SphereGeometry(0.142, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), steel, head, 0, 0.035, -0.005);
    makePart(new THREE.CylinderGeometry(0.146, 0.146, 0.035, 12), darkSteel, head, 0, 0.075, 0);
    makePart(new THREE.BoxGeometry(0.024, 0.11, 0.025), steel, head, 0, -0.01, 0.132, false); // Nasal bar
    makePart(new THREE.ConeGeometry(0.035, 0.22, 4), heraldry, head, 0, 0.2, -0.06, false); // Penacho de crista

    // Escudo no antebraço esquerdo: o grupo contra-gira o braço para a face ficar sempre para a frente.
    this.shield = new THREE.Group();
    this.shield.position.set(0, -0.13, 0.06);
    this.leftForearm.add(this.shield);
    const shieldBody = makePart(new THREE.CylinderGeometry(0.24, 0.22, 0.05, 12), leather, this.shield, 0, 0, 0.04);
    shieldBody.rotation.x = Math.PI / 2;
    shieldBody.scale.set(0.82, 1, 1.2);
    const shieldFace = makePart(new THREE.CylinderGeometry(0.21, 0.19, 0.02, 12), heraldry, this.shield, 0, 0, 0.075, false);
    shieldFace.rotation.x = Math.PI / 2;
    shieldFace.scale.set(0.82, 1, 1.2);
    makePart(new THREE.SphereGeometry(0.05, 7, 5), gold, this.shield, 0, 0, 0.1, false);
    makePart(new THREE.BoxGeometry(0.03, 0.4, 0.01), gold, this.shield, 0, 0, 0.088, false);
    this.blocking = false;
    this.blockLocked = false;
    this.blockPose = 0;

    const cape = makePart(new THREE.BoxGeometry(0.4, 0.82, 0.03), leather, this.model, 0, 1.06, -0.18, false);
    cape.rotation.x = -0.08;
    this.cape = cape;

    // Encaixe na mão direita: as armas ficam seguras pela mão, para fora do corpo.
    this.handSocket = new THREE.Group();
    this.handSocket.position.set(0, -0.27, 0.02);
    this.rightForearm.add(this.handSocket);
    this.sword = new THREE.Group();
    this.handSocket.add(this.sword);
    makePart(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6), leather, this.sword, 0, 0.02, 0, false);
    makePart(new THREE.BoxGeometry(0.3, 0.05, 0.07), gold, this.sword, 0, 0.14, 0, false);
    makePart(new THREE.BoxGeometry(0.075, 0.78, 0.028), brightSteel, this.sword, 0, 0.55, 0, false);
    makePart(new THREE.ConeGeometry(0.0525, 0.18, 4), brightSteel, this.sword, 0, 1.03, 0, false);
    makePart(new THREE.SphereGeometry(0.04, 6, 5), gold, this.sword, 0, -0.1, 0, false);

    // Yaw primeiro, inclinação depois: a postura acompanha o rumo do personagem.
    this.model.rotation.order = "YXZ";
    this.model.rotation.y = Math.PI;
    // Espelha o modelo: a mão da arma fica do lado direito, como no GTA.
    this.model.scale.x = -1;
    this.root.position.set(this.x, world.heightAt(this.x, this.z), this.z);
    this.scene.add(this.root);
  }

  update(dt, input, world, cameraYaw, aim = null) {
    if (this.dead) {
      this._updateDead(dt, world);
      return;
    }
    if (this.mounted) {
      this._updateMounted(dt, input, aim);
      return;
    }
    if (input.consumeCrouchPressed() && !this.rolling && !this.knockedOut) this.crouching = !this.crouching;
    const rmbBlock = Boolean(input.aimHeld) && this.aimStyle === "melee" && this.weaponId !== "spear";
    const guardKey = input.isDown("KeyQ") || rmbBlock;
    if (!guardKey) this.blockLocked = false;
    this.blocking = guardKey && this.canBlock && !input.modalOpen && !this.blockLocked && !this.rolling && !this.knockedOut && this.attackTimer <= 0;
    const aiming = Boolean(aim && aim.active) && !this.knockedOut && !this.blocking;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.faceTimer > 0) this.faceTimer = Math.max(0, this.faceTimer - dt);
    if (this.firePoseTimer > 0) this.firePoseTimer = Math.max(0, this.firePoseTimer - dt);
    if (this.rollCooldown > 0) this.rollCooldown = Math.max(0, this.rollCooldown - dt);
    if (this.landTimer > 0) this.landTimer = Math.max(0, this.landTimer - dt);
    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.idleTime += dt;

    input.readMovement(this._move);
    const forward = this._move.z;
    const strafe = this._move.x;
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    this.moveX = strafe * cos - forward * sin;
    this.moveZ = -strafe * sin - forward * cos;
    // tropeço após um golpe: por um instante os controles não vencem a repulsão
    if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      this.moveX = 0;
      this.moveZ = 0;
    }
    const inputLength = Math.hypot(this.moveX, this.moveZ);
    if (inputLength > 1) { this.moveX /= inputLength; this.moveZ /= inputLength; }
    const hasInput = inputLength > 0.05;

    // Se estiver sentado ou ajoelhado rezando, mover-se (WASD), pular ou rolar levanta o personagem suavemente
    if (this.sitting || this.praying) {
      if (hasInput || input.jumpPressed || input.dodgePressed || this.staggerTimer > 0) {
        this.standUp();
      } else {
        this.vx = 0;
        this.vz = 0;
        const diffYaw = Math.atan2(Math.sin(this.seatYaw - this.model.rotation.y), Math.cos(this.seatYaw - this.model.rotation.y));
        this.model.rotation.y += diffYaw * (1 - Math.exp(-14 * dt));
        if (this.praying) {
          this.prayHealTimer += dt;
          if (this.prayHealTimer >= 2.2) {
            this.prayHealTimer = 0;
            if (this.health < this.maxHealth) {
              this.health = Math.min(this.maxHealth, this.health + 1);
            }
            this.effects?.play("star", this.x, this.root.position.y + 1.85, this.z, "#ffe48f", 0.9);
          }
        }
      }
    }

    // Rolamento de esquiva: impulso curto, sem controle, com invulnerabilidade.
    if (input.consumeDodgePressed() && !this.blocking && !this.rolling && this.rollCooldown <= 0 && this.grounded && !this.knockedOut) {
      const facing = this.model.rotation.y;
      this.rollX = hasInput ? this.moveX / inputLength : Math.sin(facing);
      this.rollZ = hasInput ? this.moveZ / inputLength : Math.cos(facing);
      this.rolling = true;
      this.crouching = false;
      this.rollTimer = ROLL_DURATION;
      this.model.rotation.y = Math.atan2(this.rollX, this.rollZ);
      this.effects?.play("dust", this.x, this.root.position.y + 0.15, this.z, "#cdbb97", 0.9);
    }

    // Tentar correr (Shift) enquanto agachado faz o personagem se levantar e correr normalmente (mesmo efeito de apertar U)
    if (this.crouching && this._move.run && !this.rolling && !this.knockedOut) {
      this.crouching = false;
    }

    const running = this._move.run && !aiming && !this.blocking && !this.crouching;
    const carryRelief = Math.max(0, (PlayerStats.str - 10) * 0.03);
    const effectiveWeight = Math.min(1.0, this.weaponWeight + (1 - this.weaponWeight) * carryRelief);
    const speed = effectiveWeight * PlayerStats.getSpeedMult() * (this.crouching ? CONFIG.player.walkSpeed * 0.45 : this.blocking ? CONFIG.player.walkSpeed * 0.4 : aiming ? CONFIG.player.walkSpeed * 0.62 : running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed);
    if (this.rolling) {
      this.rollTimer -= dt;
      const left = Math.max(0, this.rollTimer / ROLL_DURATION);
      this.vx = this.rollX * ROLL_SPEED * (0.55 + 0.45 * left);
      this.vz = this.rollZ * ROLL_SPEED * (0.55 + 0.45 * left);
      if (this.rollTimer <= 0) {
        this.rolling = false;
        this.rollCooldown = 0.45;
        this.vx *= 0.5;
        this.vz *= 0.5;
        this.effects?.play("dust", this.x, this.root.position.y + 0.15, this.z, "#cdbb97", 0.8);
      }
    } else {
      const control = this.grounded ? 1 : 0.45;
      const rate = (hasInput ? CONFIG.player.acceleration : CONFIG.player.acceleration * 1.45) * control * dt;
      const targetVX = this.moveX * speed;
      const targetVZ = this.moveZ * speed;
      this.vx += Math.max(-rate, Math.min(rate, targetVX - this.vx));
      this.vz += Math.max(-rate, Math.min(rate, targetVZ - this.vz));
    }

    // Pulo com "buffer": apertar um instante antes de pousar ainda vale.
    if (input.consumeJumpPressed()) this.jumpBuffer = 0.14;
    if (this.jumpBuffer > 0 && this.grounded && !this.rolling && !this.knockedOut) {
      this.verticalSpeed = CONFIG.player.jumpSpeed;
      this.grounded = false;
      this.jumpBuffer = 0;
      this.effects?.play("dust", this.x, this.root.position.y + 0.12, this.z, "#cdbb97", 0.6);
    }
    let landed = false;
    if (!this.grounded) {
      this.verticalOffset += this.verticalSpeed * dt;
      this.verticalSpeed -= CONFIG.player.gravity * dt;
    }

    const nextX = this.x + this.vx * dt;
    const nextZ = this.z + this.vz * dt;
    world.resolveSphereMove(this.x, this.z, nextX, nextZ, this.radius, _moveResult);
    this.x = _moveResult.x;
    this.z = _moveResult.z;
    if (_moveResult.hitX) this.vx = 0;
    if (_moveResult.hitZ) this.vz = 0;

    // Raycast vertical descendente partindo do jogador para encaixar perfeitamente na malha do chão gerado
    const ground = world.raycastGround(this.x, this.root.position.y, this.z);
    if (this.verticalOffset <= 0) {
      if (!this.grounded) landed = true;
      this.verticalOffset = 0;
      this.verticalSpeed = 0;
      this.grounded = true;
    }
    this.root.position.set(this.x, ground + this.verticalOffset, this.z);
    if (landed) {
      this.audio?.land();
      this.landTimer = LAND_TIME;
      this.effects?.play("dust", this.x, ground + 0.15, this.z, "#cdbb97", 0.85);
    }

    const horizontalSpeed = Math.hypot(this.vx, this.vz);
    this.speedRatio = Math.min(1, horizontalSpeed / CONFIG.player.runSpeed);
    if (aiming || this.blocking) this.faceYaw = cameraYaw + Math.PI;
    let turnRate = 0;
    if (!this.rolling) {
      const before = this.model.rotation.y;
      if (aiming || this.blocking || this.faceTimer > 0) {
        const difference = Math.atan2(Math.sin(this.faceYaw - before), Math.cos(this.faceYaw - before));
        this.model.rotation.y += difference * (1 - Math.exp(-24 * dt));
        this.walkPhase += dt * 9 * this.speedRatio;
      } else if (horizontalSpeed > 0.12) {
        // giro suave em direção ao movimento, em vez de estalar
        const target = Math.atan2(this.vx, this.vz);
        const difference = Math.atan2(Math.sin(target - before), Math.cos(target - before));
        this.model.rotation.y += difference * (1 - Math.exp(-20 * dt));
        this.walkPhase += dt * (running ? 12 : 9) * this.speedRatio;
      }
      turnRate = Math.atan2(Math.sin(this.model.rotation.y - before), Math.cos(this.model.rotation.y - before)) / Math.max(dt, 0.001);
    }

    if (this.grounded && running && this.speedRatio > 0.7 && !this.rolling) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.2;
        this.effects?.play("dust", this.x - this.vx * 0.06, ground + 0.12, this.z - this.vz * 0.06, "#cdbb97", 0.5);
      }
    }

    // Um passo a cada meio ciclo da passada.
    const stepIndex = Math.floor(this.walkPhase / Math.PI);
    if (this.grounded && !this.rolling && this.speedRatio > 0.12) {
      if (stepIndex !== this._stepIndex) this.audio?.step(running, this.crouching ? 0.2 : this.blocking ? 0.7 : 1);
    }
    this._stepIndex = stepIndex;

    this.hitHeight = this.rolling ? 0.9 : this.crouching ? 1.25 : 1.85;
    this._animate(dt, aim, aiming, running, turnRate);
  }

  _animate(dt, aim, aiming, running, turnRate) {
    const s = this.speedRatio;
    const air = !this.grounded;
    this.crouchPose += ((this.crouching ? 1 : 0) - this.crouchPose) * (1 - Math.exp(-12 * dt));
    const cp = this.crouchPose;
    const stride = Math.sin(this.walkPhase) * s * (running ? 0.82 : 0.6);
    const idle = 1 - Math.min(1, s * 4);
    const breath = Math.sin(this.idleTime * 1.9);
    const sway = Math.sin(this.idleTime * 0.7);

    // Reseta explicitamente Y e Z das pernas a cada frame fora da montaria para nunca travar na pose RIDING
    this.leftLeg.rotation.set(stride, 0, 0);
    this.rightLeg.rotation.set(-stride, 0, 0);
    this.leftArm.rotation.x = -stride * 0.8 + (running ? 0.3 : 0);
    this.rightArm.rotation.x = stride * 0.8 - (running ? 0.2 : 0);
    this.leftArm.rotation.y = 0;
    this.rightArm.rotation.y = 0;
    this.leftArm.rotation.z = -0.03 * breath * idle;
    this.rightArm.rotation.z = 0.03 * breath * idle;

    // Postura: inclinação para a frente com a velocidade e balanço nas curvas.
    let lean = s * (running ? 0.2 : 0.09);
    let bank = Math.max(-0.16, Math.min(0.16, -turnRate * 0.014 * s));
    let squash = 1;
    let drop = -0.22 * cp;
    lean += 0.3 * cp;
    if (air) {
      const rising = this.verticalSpeed > 0;
      this.leftLeg.rotation.x = rising ? -0.7 : -0.25;
      this.rightLeg.rotation.x = rising ? 0.3 : 0.45;
      this.leftArm.rotation.z = -0.55;
      this.rightArm.rotation.z = 0.55;
      this.leftArm.rotation.x = -0.4;
      this.rightArm.rotation.x = -0.4;
      lean = rising ? 0.1 : 0.04;
      squash = rising ? 1.05 : 1.02;
    } else if (this.landTimer > 0) {
      const k = Math.sin((this.landTimer / LAND_TIME) * Math.PI);
      squash = 1 - 0.1 * k;
      drop = -0.1 * k;
      this.leftLeg.rotation.x = -0.45 * k;
      this.rightLeg.rotation.x = 0.45 * k;
      lean += 0.14 * k;
    }
    // Guarda: escudo erguido à frente do peito.
    this.blockPose += ((this.blocking ? 1 : 0) - this.blockPose) * (1 - Math.exp(-18 * dt));
    if (this.blockPose > 0.015) {
      const bp = this.blockPose;
      this.leftArm.rotation.x += (-0.85 - this.leftArm.rotation.x) * bp;
      this.leftArm.rotation.z += (0.62 - this.leftArm.rotation.z) * bp;
      lean += 0.06 * bp;
    }
    // Respiração e troca de apoio quando parado.
    this.head.position.y = 1.66 + breath * 0.012 * idle + Math.abs(Math.sin(this.walkPhase * 2)) * 0.02 * s;
    this.head.rotation.x = -lean * 0.6;
    bank += sway * 0.018 * idle;

    this.cape.rotation.x = -0.08 - s * 0.38 - (air ? 0.25 : 0) - Math.sin(this.idleTime * 7.5) * 0.05 * s;
    this.cape.rotation.z = Math.sin(this.idleTime * 4.5) * 0.04 * s + bank * 0.5;

    const poseTarget = aiming || this.firePoseTimer > 0 ? 1 : 0;
    this.aimPose += (poseTarget - this.aimPose) * (1 - Math.exp(-16 * dt));
    const posing = this.aimPose > 0.015;
    if (posing) {
      const pose = this.aimPose;
      const elevation = aim ? aim.elevation : 0;
      if (this.aimStyle === "throw") {
        this.rightArm.rotation.x += (-2.35 - this.rightArm.rotation.x) * pose;
        this.rightArm.rotation.z += (-0.35 - this.rightArm.rotation.z) * pose;
        lean += 0.08 * pose;
      } else if (this.aimStyle === "long") {
        this.rightArm.rotation.x += (-Math.PI / 2 - elevation - this.rightArm.rotation.x) * pose;
        this.rightArm.rotation.z += (0 - this.rightArm.rotation.z) * pose;
        this.leftArm.rotation.x += (-Math.PI / 2 - elevation + 0.12 - this.leftArm.rotation.x) * pose;
        this.leftArm.rotation.z += (0.5 - this.leftArm.rotation.z) * pose;
        lean += 0.05 * pose;
        this.head.rotation.x = -elevation * 0.5 * pose;
      }
    }

    const melee = this.aimStyle === "melee";
    const carrying = !posing && this.attackTimer <= 0 && !air;
    bendJoints(this, stride, stride, air ? 0.35 : 0);
    if (cp > 0.015) {
      // agachado: coxas para a frente e joelhos dobrados
      this.leftLeg.rotation.x -= 0.85 * cp;
      this.rightLeg.rotation.x -= 0.85 * cp;
      this.leftKnee.rotation.x += 1.5 * cp;
      this.rightKnee.rotation.x += 1.5 * cp;
    }
    // Postura de descanso: braço adiantado e cotovelo dobrado, arma à frente do corpo.
    if (carrying) {
      this.rightArm.rotation.x += melee ? -0.55 : -0.5;
      this.rightArm.rotation.z += 0.08;
      this.rightForearm.rotation.x += melee ? -0.7 : -0.5;
    } else if (posing && this.aimStyle === "long") {
      this.rightForearm.rotation.x *= 1 - this.aimPose;
      this.leftForearm.rotation.x *= 1 - this.aimPose;
    }

    if (this.recoil > 0) {
      this.recoil *= Math.exp(-9 * dt);
      if (this.recoil < 0.01) this.recoil = 0;
      this.rightArm.rotation.x -= this.recoil * 0.2;
      this.leftArm.rotation.x -= this.recoil * 0.12;
      lean -= this.recoil * 0.07;
    }

    // ataque carregado: a arma pesada sobe sobre a cabeça enquanto o botão é segurado
    if (this.chargePose > 0.01 && this.attackTimer <= 0) {
      const cp2 = this.chargePose;
      this.rightArm.rotation.x += (-0.6 - 2.0 * cp2 - this.rightArm.rotation.x) * Math.min(1, cp2 * 2);
      this.rightArm.rotation.z += (-0.15 - this.rightArm.rotation.z) * Math.min(1, cp2 * 2);
      this.rightForearm.rotation.x = -0.4 * cp2;
      lean -= 0.14 * cp2;
    }
    // braço de apoio nas armas de duas mãos
    if (this.twoHanded && this.blockPose < 0.015 && !(posing && this.aimStyle === "long")) {
      if (this.weaponGrip === "pole") {
        this.leftArm.rotation.x = -0.95;
        this.leftArm.rotation.z = 0.5;
        this.leftForearm.rotation.x = -0.6;
      } else if (this.weaponGrip === "heavy") {
        this.leftArm.rotation.x += (this.rightArm.rotation.x * 0.85 - this.leftArm.rotation.x) * 0.8;
        this.leftArm.rotation.z = 0.45;
        this.leftForearm.rotation.x = this.rightForearm.rotation.x;
      }
    }
    // punhos: guarda de boxeador
    if (this.weaponGrip === "none" && carrying) {
      this.rightArm.rotation.x = -0.75 + stride * 0.2;
      this.rightForearm.rotation.x = -1.35;
      this.leftArm.rotation.x = -0.85;
      this.leftArm.rotation.z = 0.2;
      this.leftForearm.rotation.x = -1.4;
    }

    if (this.attackTimer > 0) {
      const phase = 1 - this.attackTimer / this.attackLen;
      const swing = Math.sin(phase * Math.PI);
      this.rightForearm.rotation.x = -0.2;
      if (this.attackKind === 1) {
        this.rightArm.rotation.x = -1.25 * swing;
        this.rightArm.rotation.z = 0.2 + swing * 0.9;
        bank += 0.12 * swing;
      } else if (this.attackKind === 2) {
        this.rightArm.rotation.x = -2.9 * swing;
        this.rightArm.rotation.z = -0.1;
        lean += 0.32 * swing;
      } else if (this.attackKind === 3) {
        // arremesso por cima: o braço sobe e desce rápido
        this.rightArm.rotation.x = -2.5 + 2.2 * phase;
        this.rightArm.rotation.z = -0.15;
        lean += 0.16 * swing;
      } else if (this.attackKind === 4) {
        // estocada: o braço dispara para a frente
        this.rightArm.rotation.x = -0.55 - 0.95 * swing;
        this.rightArm.rotation.z = 0.05;
        this.rightForearm.rotation.x = -0.1;
        lean += 0.24 * swing;
      } else if (this.attackKind === 5) {
        // soco direto com a mão da arma
        this.rightArm.rotation.x = -1.65 * swing;
        this.rightForearm.rotation.x = -0.05;
        this.leftArm.rotation.x = -0.6 + 0.4 * swing;
        lean += 0.16 * swing;
        bank -= 0.1 * swing;
      } else if (this.attackKind === 6) {
        // soco com a mão livre
        this.leftArm.rotation.x = -1.65 * swing;
        this.leftForearm.rotation.x = -0.05;
        this.rightArm.rotation.x = -0.75;
        lean += 0.14 * swing;
        bank += 0.1 * swing;
      } else {
        this.rightArm.rotation.x = -1.55 * swing;
        this.rightArm.rotation.z = -0.25 - swing * 0.8;
        bank -= 0.1 * swing;
      }
    }

    if (this.blockPose > 0.015) {
      this.leftForearm.rotation.x += (-1.05 - this.leftForearm.rotation.x) * this.blockPose;
    }
    this.shield.rotation.x = -(this.leftArm.rotation.x + this.leftForearm.rotation.x);

    // Orientação da arma na mão: a espada acompanha o braço; as demais ficam
    // apontadas para a frente (ou para a mira), sempre para fora do corpo.
    let socket;
    const elbowTotal = this.rightArm.rotation.x + this.rightForearm.rotation.x;
    const elevation = aim ? aim.elevation : 0;
    const grip = this.weaponGrip;
    if (grip === "blade") {
      socket = this.attackTimer > 0 ? 1.2 : 0.85 - elbowTotal;
    } else if (grip === "pole") {
      socket = this.attackTimer > 0 ? Math.PI / 2 - 0.12 - elbowTotal : 0.78 - elbowTotal;
    } else if (grip === "heavy") {
      socket = this.attackTimer > 0 ? 1.05 : this.chargePose > 0.01 ? 0.15 - elbowTotal : 0.35 - elbowTotal;
    } else if (grip === "bow") {
      socket = 0.05 - elevation * 0.4 * this.aimPose - elbowTotal;
    } else if (grip === "throw") {
      socket = 0.6 - elbowTotal;
    } else {
      const ready = Math.PI / 2 + 0.4;
      socket = ready + (Math.PI / 2 - elevation - ready) * this.aimPose - elbowTotal;
    }
    this.handSocket.rotation.x += (socket - this.handSocket.rotation.x) * (1 - Math.exp(-22 * dt));

    this.model.rotation.x = lean;
    this.model.rotation.z = bank;
    this.model.scale.y = squash;
    this.model.position.set(0, (this.grounded ? Math.abs(Math.sin(this.walkPhase * 2)) * s * 0.04 : 0) + drop, 0);

    // Animações de Sentar no Banco (sitPose) e Ajoelhar / Rezar (prayPose)
    this.sitPose += ((this.sitting ? 1 : 0) - this.sitPose) * (1 - Math.exp(-12 * dt));
    this.prayPose += ((this.praying ? 1 : 0) - this.prayPose) * (1 - Math.exp(-12 * dt));

    if (this.sitPose > 0.01) {
      const sp = this.sitPose;
      this.leftLeg.rotation.set(-1.45 * sp, 0, -0.08 * sp);
      this.rightLeg.rotation.set(-1.45 * sp, 0, 0.08 * sp);
      this.leftKnee.rotation.x = 1.48 * sp;
      this.rightKnee.rotation.x = 1.48 * sp;
      this.leftArm.rotation.set(-0.52 * sp, 0, 0.14 * sp);
      this.rightArm.rotation.set(-0.52 * sp, 0, -0.14 * sp);
      this.leftForearm.rotation.x = -0.68 * sp;
      this.rightForearm.rotation.x = -0.68 * sp;
      this.model.position.y = -0.34 * sp;
      this.model.rotation.x = -0.04 * sp;
      this.cape.rotation.x = -0.03 * sp;
    }

    if (this.prayPose > 0.01) {
      const pp = this.prayPose;
      const prayBreath = Math.sin(this.idleTime * 2.4) * 0.04;
      if (!this.sitting) {
        // Ajoelhado diante do altar
        this.leftLeg.rotation.set(-0.52 * pp, 0, -0.06 * pp);
        this.rightLeg.rotation.set(-0.52 * pp, 0, 0.06 * pp);
        this.leftKnee.rotation.x = 2.05 * pp;
        this.rightKnee.rotation.x = 2.05 * pp;
        this.model.position.y = -0.44 * pp;
      }
      // Mãos unidas em oração à frente do peito e cabeça inclinada em reverência
      this.leftArm.rotation.set((-0.95 + prayBreath) * pp, 0.42 * pp, 0.38 * pp);
      this.rightArm.rotation.set((-0.95 + prayBreath) * pp, -0.42 * pp, -0.38 * pp);
      this.leftForearm.rotation.x = -1.18 * pp;
      this.rightForearm.rotation.x = -1.18 * pp;
      this.head.rotation.x = (0.38 + prayBreath * 0.5) * pp;
      this.model.rotation.x = 0.12 * pp;
    }

    if (this.handSocket) {
      this.handSocket.visible = this.prayPose < 0.35 && this.sitPose < 0.65;
    }

    if (this.mounted) {
      // sentado na sela: pernas abertas, tronco inclinado com a velocidade
      this.leftLeg.rotation.set(-1.0, 0, -0.5);
      this.rightLeg.rotation.set(-1.0, 0, 0.5);
      this.leftKnee.rotation.x = 1.1;
      this.rightKnee.rotation.x = 1.1;
      this.model.position.set(0, 0, 0);
      this.model.scale.y = 1;
      this.model.rotation.x = 0.06 + this.speedRatio * 0.16;
      this.model.rotation.z = 0;
      if (this.blockPose < 0.015 && !(this.aimPose > 0.015) && this.attackTimer <= 0) {
        this.leftArm.rotation.set(-0.7, 0, 0.25);
        this.leftForearm.rotation.x = -0.5;
      }
      this.cape.rotation.x = -0.1 - this.speedRatio * 0.7;
    }

    if (this.rolling) {
      const progress = 1 - this.rollTimer / ROLL_DURATION;
      const angle = progress * Math.PI * 2;
      const yaw = this.model.rotation.y;
      this.model.rotation.x = angle;
      this.model.rotation.z = 0;
      this.model.scale.y = 0.92;
      // gira em torno do centro do corpo, não dos pés
      this.model.position.set(-Math.sin(angle) * 0.85 * Math.sin(yaw), 0.85 - 0.85 * Math.cos(angle), -Math.sin(angle) * 0.85 * Math.cos(yaw));
      this.leftLeg.rotation.x = -1.3;
      this.rightLeg.rotation.x = -1.3;
      this.leftArm.rotation.x = -1.5;
      this.rightArm.rotation.x = -1.5;
      this.leftArm.rotation.z = 0.4;
      this.rightArm.rotation.z = -0.4;
    }
  }

  // Montado: a posição vem do sistema de montaria; aqui só a pose e o combate da sela.
  _updateMounted(dt, input, aim) {
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.firePoseTimer > 0) this.firePoseTimer = Math.max(0, this.firePoseTimer - dt);
    if (this.faceTimer > 0) this.faceTimer = Math.max(0, this.faceTimer - dt);
    if (this.landTimer > 0) this.landTimer = 0;
    if (this.jumpBuffer > 0) this.jumpBuffer = 0;
    this.blocking = false;
    this.rolling = false;
    this.crouching = false;
    this.hitHeight = 1.85;
    input.consumeCrouchPressed();
    input.consumeDodgePressed();
    this.idleTime += dt;
    const aiming = Boolean(aim && aim.active) && !this.knockedOut;
    this._animate(dt, aim, aiming, false, 0);
  }

  // Corpo caindo sem vida: desaba para o lado, membros soltos, deslizando pelo impulso do golpe.
  die(awayX, awayZ) {
    this.dead = true;
    this.deathTime = 0;
    this.deathSide = awayX >= 0 ? 1 : -1;
    this.vx = awayX * 4.5;
    this.vz = awayZ * 4.5;
    this.blocking = false;
    this.rolling = false;
    this.attackTimer = 0;
    this.weaponHidden = true;
  }

  revive() {
    this.dead = false;
    this.deathTime = 0;
    this.blockLocked = false;
    this.model.rotation.x = 0;
    this.model.rotation.z = 0;
    this.model.position.set(0, 0, 0);
    this.model.scale.y = 1;
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
  }

  _updateDead(dt, world) {
    this.deathTime += dt;
    const p = Math.min(1, this.deathTime / 0.75);
    const decay = Math.exp(-4 * dt);
    this.vx *= decay;
    this.vz *= decay;
    const nextX = this.x + this.vx * dt;
    const nextZ = this.z + this.vz * dt;
    world.resolveSphereMove(this.x, this.z, nextX, nextZ, this.radius, _moveResult);
    this.x = _moveResult.x;
    this.z = _moveResult.z;
    this.root.position.set(this.x, world.raycastGround(this.x, this.root.position.y, this.z), this.z);
    this.verticalOffset = 0;
    this.grounded = true;
    this.speedRatio = 0;
    const bounce = Math.sin(Math.min(1, this.deathTime / 0.75) * Math.PI) * 0.18;
    this.model.rotation.x = -0.35 * p;
    this.model.rotation.z = this.deathSide * 1.45 * p;
    this.model.position.y = 0.3 * p + bounce * (1 - p);
    this.model.scale.y = 1;
    this.leftArm.rotation.set(-0.9 * p, 0, -0.7 * p);
    this.rightArm.rotation.set(0.6 * p, 0, 0.8 * p);
    this.leftForearm.rotation.x = -0.4 * p;
    this.rightForearm.rotation.x = -0.2 * p;
    this.leftLeg.rotation.set(0.6 * p, 0, -0.3 * p);
    this.rightLeg.rotation.set(-0.4 * p, 0, 0.3 * p);
    this.leftKnee.rotation.x = 0.5 * p;
    this.rightKnee.rotation.x = 0.3 * p;
    this.head.rotation.x = -0.35 * p;
    this.cape.rotation.x = -0.9 * p;
    this.shield.rotation.x = -(this.leftArm.rotation.x + this.leftForearm.rotation.x);
  }

  // Repulsão ao levar um golpe: empurra 1 a 2 m na direção oposta.
  knockBack(awayX, awayZ, knock = 3.4) {
    const speed = 6 + knock * 0.8;
    this.vx = awayX * speed;
    this.vz = awayZ * speed;
    this.staggerTimer = 0.25 * PlayerStats.getHitstunMult();
  }

  // Atacar baixa o escudo; só volta a erguer soltando e apertando a tecla de novo.
  cancelBlock() {
    if (!this.blocking && this.blockPose < 0.05) return;
    this.blocking = false;
    this.blockLocked = true;
  }

  kick(amount = 1) {
    this.recoil = Math.min(1.3, this.recoil + amount);
  }

  startAttack(kind = 0, length = 0.36) {
    this.attackTimer = length;
    this.attackLen = length;
    this.attackKind = kind;
  }

  reinforceArmor() {
    this.armorLevel = Math.min(1, this.armorLevel + 1);
    this.chestArmor.material.color.set("#bdad78");
    this.chestArmor.material.metalness = 0.68;
    this.chestArmor.material.needsUpdate = true;
  }

  sitAt(x, z, yaw = 0, isChurchPew = false) {
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.crouching = false;
    this.blocking = false;
    this.rolling = false;
    this.sitting = true;
    this.praying = false;
    this.sittingInChurch = Boolean(isChurchPew);
    this.seatYaw = yaw;
    this.model.rotation.y = yaw;
    this.userData.state = "SITTING";
    this.root.position.set(this.x, this.world.raycastGround(this.x, this.root.position.y, this.z), this.z);
  }

  startAltarPrayer(x, z, yaw = 0) {
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.crouching = false;
    this.blocking = false;
    this.rolling = false;
    this.sitting = false;
    this.praying = true;
    this.sittingInChurch = true;
    this.prayHealTimer = 0;
    this.seatYaw = yaw;
    this.model.rotation.y = yaw;
    this.userData.state = "PRAYING";
    this.root.position.set(this.x, this.world.raycastGround(this.x, this.root.position.y, this.z), this.z);
  }

  toggleSeatPrayer() {
    if (!this.sitting && !this.praying) return false;
    this.praying = !this.praying;
    this.prayHealTimer = 0;
    this.userData.state = this.praying ? "PRAYING" : "SITTING";
    return this.praying;
  }

  standUp() {
    if (!this.sitting && !this.praying) return;
    this.sitting = false;
    this.praying = false;
    this.sittingInChurch = false;
    this.userData.state = "IDLE";
    if (this.handSocket) this.handSocket.visible = true;
  }
}
