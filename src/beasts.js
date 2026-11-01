import * as THREE from "three";
import { spawnLoot, addGood } from "./rpg.js";

// ============================================================================
// Materiais Otimizados para as Criaturas Sobrenaturais (Zero-GC)
// ============================================================================
const _shadowBodyMat = new THREE.MeshStandardMaterial({
  color: 0x18171c,
  roughness: 0.9,
  metalness: 0.1,
  flatShading: true,
});

const _thinLegMat = new THREE.MeshStandardMaterial({
  color: 0x111014,
  roughness: 0.85,
  metalness: 0.15,
  flatShading: true,
});

// Olhos amarelos brilhantes do Bicho Altão (Zancudo Sombrio)
const _glowingYellowEyeMat = new THREE.MeshBasicMaterial({
  color: 0xffea00,
  toneMapped: false,
});

const _paleSkinMat = new THREE.MeshStandardMaterial({
  color: 0x9e988f,
  roughness: 0.82,
  metalness: 0.05,
  flatShading: true,
});

const _teethMat = new THREE.MeshStandardMaterial({
  color: 0xf5f0e6,
  roughness: 0.3,
  metalness: 0.1,
  flatShading: true,
});

const _mouthInteriorMat = new THREE.MeshBasicMaterial({
  color: 0x4a0a0e,
});

const _tornClothMat = new THREE.MeshStandardMaterial({
  color: 0x2b221d,
  roughness: 0.95,
  flatShading: true,
});

// ============================================================================
// 1. O Zancudo Sombrio (Quadrúpede Gigante de Pernas Finas - Olhos Amarelos)
// ============================================================================
export class TallWalker {
  constructor(scene, world, effects, player, x, z) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.player = player;
    this.x = x;
    this.z = z;
    this.speed = 0;
    this.heading = 0;
    this.state = "idle";
    this.fleeTimer = 0;
    this.stepPhase = 0;
    this.alive = true;
    this.name = "Zancudo Sombrio";
    this.roleKey = "tall_walker";

    this.root = new THREE.Group();
    this.root.name = "TallWalker";
    this.root.visible = false; // Começa invisível até ser noite

    // Torso quadrúpede no topo (a 16m de altura, acima das copas das árvores)
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.set(0, 16.2, 0);
    this.root.add(this.bodyGroup);

    // Tronco e costelas do quadrúpede
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 3.8), _shadowBodyMat);
    torsoMesh.castShadow = true;
    this.bodyGroup.add(torsoMesh);

    // Caixa torácica esguia / flancos
    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.8), _shadowBodyMat);
    chestMesh.position.set(0, -0.1, -0.9);
    this.bodyGroup.add(chestMesh);

    // Pescoço e Cabeça canina estilizada no topo
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.4, -1.9);
    this.bodyGroup.add(this.neck);

    const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 1.2), _shadowBodyMat);
    neckMesh.position.set(0, 0.4, -0.4);
    neckMesh.rotation.x = -0.35;
    this.neck.add(neckMesh);

    // Cabeça alongada com focinho canino
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 1.4), _shadowBodyMat);
    headMesh.position.set(0, 0.95, -0.95);
    this.neck.add(headMesh);

    // Focinho esguio
    const snoutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.9), _shadowBodyMat);
    snoutMesh.position.set(0, 0.85, -1.7);
    this.neck.add(snoutMesh);

    // Olhos Amarelos Brilhantes e Penetrantes no topo da cabeça
    const eyeGeo = new THREE.SphereGeometry(0.12, 6, 5);
    const leftEye = new THREE.Mesh(eyeGeo, _glowingYellowEyeMat);
    leftEye.position.set(0.38, 1.15, -1.35);
    this.neck.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, _glowingYellowEyeMat);
    rightEye.position.set(-0.38, 1.15, -1.35);
    this.neck.add(rightEye);

    // Pequena luz pontual amarela etérea que emana dos olhos no alto
    this.eyeLight = new THREE.PointLight(0xffea00, 2.5, 18.0, 1.6);
    this.eyeLight.position.set(0, 1.2, -1.5);
    this.neck.add(this.eyeLight);

    // 4 Pernas Finas Colossais (16 metros de altura cada)
    this.legs = [];
    const legOffsets = [
      { x: 0.75, z: -1.3 }, // Dianteira Direita
      { x: -0.75, z: -1.3 }, // Dianteira Esquerda
      { x: 0.75, z: 1.3 }, // Traseira Direita
      { x: -0.75, z: 1.3 }, // Traseira Esquerda
    ];

    for (let i = 0; i < 4; i++) {
      const legRoot = new THREE.Group();
      legRoot.position.set(legOffsets[i].x, 0, legOffsets[i].z);
      this.bodyGroup.add(legRoot);

      // Coxa superior finíssima
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 8.2, 5), _thinLegMat);
      upper.position.set(0, -4.1, 0);
      legRoot.add(upper);

      // Articulação do joelho alto
      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(0, -8.2, 0);
      legRoot.add(kneeGroup);

      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.11, 5, 4), _thinLegMat);
      kneeGroup.add(kneeJoint);

      // Canela inferior finíssima até o solo
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 8.2, 5), _thinLegMat);
      lower.position.set(0, -4.1, 0);
      kneeGroup.add(lower);

      this.legs.push({ legRoot, kneeGroup, upper, lower });
    }

    const groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);
  }

  update(dt, isNight = false) {
    // Só aparece estritamente à noite
    if (!isNight) {
      if (this.root.visible) this.root.visible = false;
      return;
    }
    if (!this.root.visible) this.root.visible = true;

    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);

    // Se o jogador estiver longe (> 36m): o Zancudo fica parado ou dando passos lentos e ENCARA fixamente com olhos amarelos
    if (dist > 36) {
      if (this.fleeTimer > 0) {
        this.fleeTimer -= dt;
      } else {
        this.state = "staring";
        const targetYaw = Math.atan2(dx, dz);
        this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 1.8);
        this.root.rotation.y = this.heading;
        this.speed = Math.max(0, this.speed - dt * 6.0);
      }
    } else {
      // Jogador chegou perto (<= 36m): o Zancudo se assusta e FOGE COM PASSADAS GIGANTESCAS na direção oposta!
      this.state = "fleeing";
      this.fleeTimer = 6.0;

      const fleeYaw = Math.atan2(-dx, -dz);
      this.heading = THREE.MathUtils.lerp(this.heading, fleeYaw, dt * 3.5);
      this.root.rotation.y = this.heading;
      this.speed = THREE.MathUtils.lerp(this.speed, 14.5, dt * 4.0);
    }

    // Movimentação e Animação das Pernas Gigantes
    if (this.speed > 0.1) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;

      this.stepPhase += dt * (this.speed * 0.45);
      const phases = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

      for (let i = 0; i < 4; i++) {
        const s = Math.sin(this.stepPhase + phases[i]);
        this.legs[i].legRoot.rotation.x = s * 0.38;
      }
      this.bodyGroup.position.y = 16.2 + Math.abs(Math.sin(this.stepPhase * 2)) * 0.45;
    } else {
      this.bodyGroup.position.y = 16.2 + Math.sin(performance.now() * 0.002) * 0.15;
      this.neck.rotation.x = Math.sin(performance.now() * 0.0015) * 0.08;
      for (let i = 0; i < 4; i++) {
        this.legs[i].legRoot.rotation.x = 0;
      }
    }

    const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    this.root.position.set(this.x, groundY, this.z);
  }
}

// ============================================================================
// 2. O Voraz Cego (Humanoide sem a parte de cima da cabeça, dentes à mostra)
// ============================================================================
export class BlindBiter {
  constructor(scene, world, effects, combat, player, npcs, x, z) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = combat;
    this.player = player;
    this.npcs = npcs;
    this.x = x;
    this.z = z;
    this.speed = 0;
    this.heading = Math.random() * Math.PI * 2;
    this.state = "wandering";
    this.wanderTimer = 2.0;
    this.attackCooldown = 0;
    this.alive = true;
    this.health = 5;
    this.maxHealth = 5;
    this.hitRadius = 0.6;
    this.roleKey = "blind_biter";
    this.name = "Voraz Cego";
    this.deadTime = 0;

    this.root = new THREE.Group();
    this.root.name = "BlindBiter";
    this.root.visible = false; // Começa invisível de dia
    this.root.userData = { entity: this, type: "MONSTER" };

    this.model = new THREE.Group();
    this.root.add(this.model);

    // Torso cadavérico esguio e curvado
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.72, 0.24), _paleSkinMat);
    torso.position.set(0, 0.95, 0);
    torso.rotation.x = 0.22;
    torso.castShadow = true;
    this.model.add(torso);

    // Farrapos rasgados no tronco e cintura
    const rag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.28), _tornClothMat);
    rag.position.set(0, 0.75, 0.02);
    this.model.add(rag);

    // CABEÇA ASSUSTADORA: SEM TOPO, SEM OLHOS, APENAS A BOCA COM DENTES EXPOSTOS
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.38, -0.12);
    this.model.add(this.headGroup);

    // Mandíbula inferior e base do queixo
    const jawBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.38), _paleSkinMat);
    jawBase.position.set(0, 0, 0);
    this.headGroup.add(jawBase);

    // Interior vermelho-escuro da boca escancarada
    const mouthCavity = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.30), _mouthInteriorMat);
    mouthCavity.position.set(0, 0.04, -0.02);
    this.headGroup.add(mouthCavity);

    // Dentes triangulares afiados brancos visíveis ao redor de toda a boca
    for (let d = 0; d < 10; d++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.12, 4), _teethMat);
      const angle = (d / 10) * Math.PI * 2;
      tooth.position.set(Math.cos(angle) * 0.14, 0.10, Math.sin(angle) * 0.14 - 0.02);
      tooth.rotation.x = Math.PI;
      this.headGroup.add(tooth);
    }

    // Braços esguios esticados para frente
    this.arms = [];
    const armGeo = new THREE.BoxGeometry(0.12, 0.75, 0.12);

    const leftArm = new THREE.Mesh(armGeo, _paleSkinMat);
    leftArm.position.set(0.28, 1.25, -0.1);
    this.model.add(leftArm);
    this.arms.push(leftArm);

    const rightArm = new THREE.Mesh(armGeo, _paleSkinMat);
    rightArm.position.set(-0.28, 1.25, -0.1);
    this.model.add(rightArm);
    this.arms.push(rightArm);

    // Pernas trêmulas
    this.legs = [];
    const legGeo = new THREE.BoxGeometry(0.14, 0.75, 0.14);

    const leftLeg = new THREE.Mesh(legGeo, _paleSkinMat);
    leftLeg.position.set(0.14, 0.4, 0.05);
    this.model.add(leftLeg);
    this.legs.push(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, _paleSkinMat);
    rightLeg.position.set(-0.14, 0.4, 0.05);
    this.model.add(rightLeg);
    this.legs.push(rightLeg);

    const groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);

    this._inGrid = false;
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.5);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);

    if (this.effects) {
      this.effects.play("star", this.x, this.root.position.y + 1.1, this.z, "#ff2233", 1.4);
      this.effects.play("slash", this.x, this.root.position.y + 1.2, this.z, "#cc1122", 1.2);
    }

    // Recuo de impacto
    const mag = Math.hypot(dirX, dirZ);
    if (mag > 0.01) {
      this.x += (dirX / mag) * (0.45 * force);
      this.z += (dirZ / mag) * (0.45 * force);
    }

    if (this.health <= 0) {
      this.alive = false;
      this.state = "dead";
      this.root.userData.isDead = true;

      if (this.npcs?.spatialGrid && this._inGrid) {
        this.npcs.spatialGrid.remove(this);
        this._inGrid = false;
      }
      if (this.effects) {
        this.effects.play("dust", this.x, this.root.position.y + 0.6, this.z, "#2e2b26", 2.4);
        this.effects.play("star", this.x, this.root.position.y + 1.0, this.z, "#ff4444", 1.8);
      }
      spawnLoot(this.root.position, 14);
      addGood(2, "Voraz Cego abatido");
      return true;
    }
    return false;
  }

  update(dt, isNight = false) {
    // Só aparece e atua estritamente à noite
    if (!isNight) {
      if (this.root.visible) {
        this.root.visible = false;
        if (this.npcs?.spatialGrid && this._inGrid) {
          this.npcs.spatialGrid.remove(this);
          this._inGrid = false;
        }
      }
      return;
    }

    if (!this.alive) {
      this.deadTime += dt;
      if (this.deadTime < 0.8) {
        this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, -Math.PI / 2, dt * 6);
        this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, -0.4, dt * 6);
      } else if (this.deadTime > 2.5) {
        this.root.visible = false;
      }
      return;
    }

    if (!this.root.visible) this.root.visible = true;

    // Garante presença na Spatial Grid de combate à noite
    if (this.npcs?.spatialGrid && !this._inGrid) {
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    const py = (this.player.root?.position?.y || 0);
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);

    // Cego: só ataca quando detecta a presa por perto (<= 9.5 metros)
    if (dist <= 9.5) {
      this.state = "charging";
      const targetYaw = Math.atan2(dx, dz);
      this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 8.0);
      this.model.rotation.y = this.heading;

      // Corre com os braços esticados para frente
      this.speed = THREE.MathUtils.lerp(this.speed, 10.5, dt * 6.0);

      for (let i = 0; i < this.arms.length; i++) {
        this.arms[i].rotation.x = -1.45 + Math.sin(performance.now() * 0.02) * 0.15;
      }
      this.model.rotation.x = 0.32;

      // Ataque de mordida feroz corpo a corpo (<= 2.2m)
      if (dist <= 2.2) {
        this.speed = 2.0; // Freia o avanço para desferir a mordida sem atravessar o corpo
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 0.85;
          if (this.combat?.hurtPlayer) {
            this.combat.hurtPlayer(2.0, this.x, this.z, { weapon: "teeth_bite", knock: 3.2 });
          }
          if (this.effects) {
            this.effects.play("slash", px, py + 1.1, pz, "#cc1122", 1.6);
            this.effects.play("star", px, py + 1.0, pz, "#ff2222", 1.2);
          }
        }
      }
    } else {
      // Quando longe: caminha errante e trêmulo tateando a névoa
      this.state = "wandering";
      this.speed = THREE.MathUtils.lerp(this.speed, 1.8, dt * 3.0);
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.5 + Math.random() * 3.5;
        this.heading += (Math.random() - 0.5) * 2.2;
      }
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, this.heading, dt * 3.0);
      this.model.rotation.x = 0.12;

      for (let i = 0; i < this.arms.length; i++) {
        this.arms[i].rotation.x = Math.sin(performance.now() * 0.003 + i) * 0.4 - 0.3;
      }
    }

    // Deslocamento no terreno
    if (this.speed > 0.05) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;

      const legCycle = performance.now() * (this.state === "charging" ? 0.022 : 0.007);
      this.legs[0].rotation.x = Math.sin(legCycle) * 0.7;
      this.legs[1].rotation.x = -Math.sin(legCycle) * 0.7;
    }

    const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    this.root.position.set(this.x, groundY, this.z);

    // Atualização celular na Spatial Hash Grid
    if (this.npcs?.spatialGrid && this._inGrid) {
      const curCX = Math.floor(this.x * 0.0625);
      const curCZ = Math.floor(this.z * 0.0625);
      if (curCX !== this._spatialCX || curCZ !== this._spatialCZ) {
        this.npcs.spatialGrid.remove(this);
        this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
        this._spatialCX = curCX;
        this._spatialCZ = curCZ;
      }
    }
  }
}

// ============================================================================
// 3. BeastManager: Gerencia Spawns de Feras e Criaturas Noturnas
// ============================================================================
export class BeastManager {
  constructor({ scene, world, effects, combat, player, npcs, audio }) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = combat;
    this.player = player;
    this.npcs = npcs;
    this.audio = audio;
    this.walkers = [];
    this.biters = [];
    this.respawnTimer = 0;
  }

  spawnInitialBeasts(cityCenter) {
    const cx = cityCenter.x ?? 0;
    const cz = cityCenter.z ?? 0;

    // 1. Zancudos Sombrios (Bichos Altões): 3 criaturas imponentes nos ermos com olhos amarelos
    const walkerSpots = [
      { x: cx - 210, z: cz + 175 },
      { x: cx + 220, z: cz - 165 },
      { x: cx - 110, z: cz - 240 },
    ];
    for (const s of walkerSpots) {
      const w = new TallWalker(this.scene, this.world, this.effects, this.player, s.x, s.z);
      this.walkers.push(w);
    }

    // 2. Vorazes Cegos: Spawns completamente aleatórios nos ermos
    this.spawnRandomBiters(cx, cz, 5);
  }

  spawnRandomBiters(cx, cz, count = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 75 + Math.random() * 140;
      const bx = cx + Math.cos(angle) * radius;
      const bz = cz + Math.sin(angle) * radius;

      const biter = new BlindBiter(
        this.scene,
        this.world,
        this.effects,
        this.combat,
        this.player,
        this.npcs,
        bx,
        bz
      );
      this.biters.push(biter);
      if (this.npcs?.npcs && !this.npcs.npcs.includes(biter)) {
        this.npcs.npcs.push(biter);
      }
    }
  }

  update(dt, isNight = false) {
    // Atualiza todos os Zancudos Sombrios
    for (let i = 0; i < this.walkers.length; i++) {
      this.walkers[i].update(dt, isNight);
    }

    // Atualiza todos os Vorazes Cegos
    for (let i = 0; i < this.biters.length; i++) {
      this.biters[i].update(dt, isNight);
    }

    // À noite, repõe criaturas mortas periodicamente de forma randômica
    if (isNight) {
      this.respawnTimer += dt;
      if (this.respawnTimer > 25.0) {
        this.respawnTimer = 0;
        const activeCount = this.biters.filter((b) => b.alive && b.root.visible).length;
        if (activeCount < 4) {
          const px = this.player.x ?? 0;
          const pz = this.player.z ?? 0;
          this.spawnRandomBiters(px, pz, 2);
        }
      }
    }
  }
}
