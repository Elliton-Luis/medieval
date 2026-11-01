import * as THREE from "three";
import { spawnLoot } from "./rpg.js";

// ============================================================================
// Materiais Otimizados para as Novas Criaturas (Zero-GC)
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

const _glowingEyeMat = new THREE.MeshBasicMaterial({
  color: 0xff4433,
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
// 1. O Zancudo Sombrio (Quadrúpede Gigante de Pernas Finas - Maior que as Árvores)
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
    this.state = "idle"; // "idle" | "staring" | "fleeing"
    this.fleeTimer = 0;
    this.stepPhase = 0;
    this.alive = true;
    this.name = "Zancudo Sombrio";
    this.roleKey = "tall_walker";

    this.root = new THREE.Group();
    this.root.name = "TallWalker";

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

    const snoutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.0), _shadowBodyMat);
    snoutMesh.position.set(0, 0.8, -1.9);
    this.neck.add(snoutMesh);

    // Orelhas eretas e pontiagudas
    for (const side of [-0.25, 0.25]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 4), _shadowBodyMat);
      ear.position.set(side, 1.45, -0.7);
      ear.rotation.x = -0.15;
      this.neck.add(ear);

      // Olhos vermelhos brilhantes encarando
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), _glowingEyeMat);
      eye.position.set(side * 1.1, 1.0, -1.35);
      this.neck.add(eye);
    }

    // Cauda fina e longa caindo no vazio
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.2, 5), _thinLegMat);
    tailMesh.position.set(0, -1.8, 2.1);
    tailMesh.rotation.x = 0.25;
    this.bodyGroup.add(tailMesh);

    // 4 Pernas Finíssimas e Colossais (16 metros de altura cada)
    this.legs = [];
    const legOffsets = [
      { x: -0.85, z: -1.4 }, // Dianteira Esquerda
      { x: 0.85, z: -1.4 },  // Dianteira Direita
      { x: -0.75, z: 1.5 },  // Traseira Esquerda
      { x: 0.75, z: 1.5 },   // Traseira Direita
    ];

    for (let i = 0; i < 4; i++) {
      const off = legOffsets[i];
      const legRoot = new THREE.Group();
      legRoot.position.set(off.x, 16.2, off.z);
      this.root.add(legRoot);

      // Parte superior da perna fina (haste longa)
      const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 8.5, 6), _thinLegMat);
      upperLeg.position.set(0, -4.2, 0);
      legRoot.add(upperLeg);

      // Joelho / Articulação fina
      const joint = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), _shadowBodyMat);
      joint.position.set(0, -8.4, 0);
      legRoot.add(joint);

      // Parte inferior da perna descendo até o solo
      const lowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 8.2, 5), _thinLegMat);
      lowerLeg.position.set(0, -12.4, 0);
      legRoot.add(lowerLeg);

      // Pata fina pontiaguda no solo
      const hoof = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 5), _shadowBodyMat);
      hoof.position.set(0, -16.4, 0);
      legRoot.add(hoof);

      this.legs.push({ legRoot, upperLeg, lowerLeg });
    }

    const groundY = world ? world.heightAt(x, z) : 0;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);
  }

  update(dt) {
    if (!this.alive || !this.player) return;

    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    const dx = px - this.x;
    const dz = pz - this.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);

    // 1. Reação ao Jogador:
    // Se o jogador estiver longe (> 38m): o Zancudo fica parado ou dando passos lentos e ENCARA fixamente o jogador
    if (dist > 36) {
      if (this.fleeTimer > 0) {
        this.fleeTimer -= dt;
      } else {
        this.state = "staring";
        // Encarar o jogador suavemente lá do alto
        const targetYaw = Math.atan2(dx, dz);
        this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 1.8);
        this.root.rotation.y = this.heading;
        this.speed = Math.max(0, this.speed - dt * 6.0);
      }
    } else {
      // Jogador chegou perto (<= 36m): o Zancudo se assusta e FOGE COM PASSADAS GIGANTESCAS na direção oposta!
      this.state = "fleeing";
      this.fleeTimer = 6.0;

      // Direção oposta ao jogador
      const fleeYaw = Math.atan2(-dx, -dz);
      this.heading = THREE.MathUtils.lerp(this.heading, fleeYaw, dt * 3.5);
      this.root.rotation.y = this.heading;

      // Velocidade altíssima de fuga por cima das árvores (~14 m/s)
      this.speed = THREE.MathUtils.lerp(this.speed, 14.5, dt * 4.0);
    }

    // 2. Movimentação e Animação das Pernas Gigantes
    if (this.speed > 0.1) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;

      // Ciclo de passada elegante das 4 pernas longas
      this.stepPhase += dt * (this.speed * 0.45);
      const phases = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

      for (let i = 0; i < 4; i++) {
        const s = Math.sin(this.stepPhase + phases[i]);
        this.legs[i].legRoot.rotation.x = s * 0.38;
      }
      this.bodyGroup.position.y = 16.2 + Math.abs(Math.sin(this.stepPhase * 2)) * 0.45;
    } else {
      // Parado encarando: sutil respiração e olhar
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
    this.state = "wandering"; // "wandering" | "charging" | "attacking" | "dead"
    this.wanderTimer = 2.0;
    this.attackTimer = 0;
    this.alive = true;
    this.health = 5;
    this.maxHealth = 5;
    this.hitRadius = 0.5;
    this.roleKey = "blind_biter";
    this.name = "Voraz Cego";
    this.deadTime = 0;

    this.root = new THREE.Group();
    this.root.name = "BlindBiter";
    this.root.userData = { entity: this, type: "MONSTER" };

    this.model = new THREE.Group();
    this.root.add(this.model);

    // Torso cadavérico esguio e curvado
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.72, 0.24), _paleSkinMat);
    torso.position.set(0, 0.95, 0);
    torso.rotation.x = 0.22; // Curvado para frente
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
    // Dentes inferiores proeminentes
    for (let d = 0; d < 8; d++) {
      const toothLow = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.11, 4), _teethMat);
      const angle = (d / 8) * Math.PI * 2;
      toothLow.position.set(Math.cos(angle) * 0.13, -0.02, Math.sin(angle) * 0.13 - 0.02);
      this.headGroup.add(toothLow);
    }

    // Braços com mãos em garras
    this.arms = [];
    for (const side of [-1, 1]) {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 0.26, 1.25, 0);
      this.model.add(armGroup);

      const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.75, 0.12), _paleSkinMat);
      armMesh.position.set(0, -0.32, 0);
      armGroup.add(armMesh);

      // Garras pontiagudas
      const claws = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), _teethMat);
      claws.position.set(0, -0.76, 0);
      claws.rotation.x = Math.PI;
      armGroup.add(claws);

      this.arms.push(armGroup);
    }

    // Pernas finas humanas
    this.legs = [];
    for (const side of [-1, 1]) {
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.72, 0.14), _paleSkinMat);
      legMesh.position.set(side * 0.14, 0.36, 0);
      this.model.add(legMesh);
      this.legs.push(legMesh);
    }

    const groundY = world ? world.heightAt(x, z) : 0;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);

    // Registra na Spatial Grid de NPCs para receber dano de armas
    if (this.npcs?.spatialGrid) {
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
    }
  }

  takeHit(amount, dirX, dirZ, force = 1.8) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);

    if (this.effects) {
      this.effects.play("star", this.x, this.root.position.y + 1.1, this.z, "#ff2233", 1.4);
    }

    this.x += dirX * 0.45;
    this.z += dirZ * 0.45;

    if (this.health <= 0) {
      this.alive = false;
      this.state = "dead";
      if (this.npcs?.spatialGrid) {
        this.npcs.spatialGrid.remove(this);
      }
      if (this.effects) {
        this.effects.play("dust", this.x, this.root.position.y + 0.6, this.z, "#2e2b26", 2.2);
      }
      spawnLoot(this.root.position, 8);
      return true;
    }
    return false;
  }

  update(dt) {
    if (!this.alive) {
      this.deadTime += dt;
      if (this.deadTime < 0.6) {
        this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, -Math.PI / 2, dt * 6);
        this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, -0.4, dt * 6);
      }
      return;
    }

    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    const dx = px - this.x;
    const dz = pz - this.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);

    // Comportamento:
    // Cego: só ataca quando está perto (<= 9 metros)
    if (dist <= 9.0) {
      this.state = "charging";
      // Encarar a presa
      const targetYaw = Math.atan2(dx, dz);
      this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 8.0);
      this.model.rotation.y = this.heading;

      // "ele corre com os braços pra frente, muito rapido"
      this.speed = THREE.MathUtils.lerp(this.speed, 12.0, dt * 6.0);

      // Postura aterrorizante: braços totalmente esticados para frente
      for (let i = 0; i < this.arms.length; i++) {
        this.arms[i].rotation.x = -1.45 + Math.sin(performance.now() * 0.02) * 0.15;
      }
      this.model.rotation.x = 0.32; // Inclinado para frente na corrida veloz

      // Ataque de mordida feroz quando bem perto (<= 1.8m)
      if (dist <= 1.8) {
        this.attackTimer += dt;
        if (this.attackTimer > 0.65) {
          this.attackTimer = 0;
          if (this.combat?.hurtPlayer) {
            this.combat.hurtPlayer(2.0, this.x, this.z, { weapon: "teeth_bite", knock: 2.8 });
          }
          if (this.effects) {
            this.effects.play("slash", px, (this.player.root?.position?.y || 0) + 1.1, pz, "#cc1122", 1.5);
          }
        }
      }
    } else {
      // Quando longe: caminha errante e trêmulo sem olhos
      this.state = "wandering";
      this.speed = THREE.MathUtils.lerp(this.speed, 1.8, dt * 3.0);
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.5 + Math.random() * 3.5;
        this.heading += (Math.random() - 0.5) * 2.2;
      }
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, this.heading, dt * 3.0);
      this.model.rotation.x = 0.12;

      // Braços balançando tateando o ar
      for (let i = 0; i < this.arms.length; i++) {
        this.arms[i].rotation.x = Math.sin(performance.now() * 0.003 + i) * 0.4 - 0.3;
      }
    }

    // Deslocamento no mundo
    if (this.speed > 0.05) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;

      // Animação das pernas correndo
      const legCycle = performance.now() * (this.state === "charging" ? 0.022 : 0.007);
      this.legs[0].rotation.x = Math.sin(legCycle) * 0.7;
      this.legs[1].rotation.x = -Math.sin(legCycle) * 0.7;
    }

    const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    this.root.position.set(this.x, groundY, this.z);

    // Atualiza célula na Spatial Grid
    if (this.npcs?.spatialGrid) {
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
// 3. BeastManager: Gerencia Spawns de Feras e Criaturas
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
  }

  spawnInitialBeasts(cityCenter) {
    const cx = cityCenter.x ?? 0;
    const cz = cityCenter.z ?? 0;

    // 1. Zancudos Sombrios: 2 gigantes colocados no horizonte visível
    const walkerSpots = [
      { x: cx - 180, z: cz + 160 },
      { x: cx + 190, z: cz - 150 },
    ];
    for (const s of walkerSpots) {
      const w = new TallWalker(this.scene, this.world, this.effects, this.player, s.x, s.z);
      this.walkers.push(w);
    }

    // 2. Vorazes Cegos: 4 criaturas espalhadas em matas e ruínas fora da vila
    const biterSpots = [
      { x: cx + 95, z: cz + 85 },
      { x: cx - 110, z: cz - 90 },
      { x: cx + 130, z: cz - 80 },
      { x: cx - 85, z: cz + 135 },
    ];
    for (const b of biterSpots) {
      const biter = new BlindBiter(
        this.scene,
        this.world,
        this.effects,
        this.combat,
        this.player,
        this.npcs,
        b.x,
        b.z
      );
      this.biters.push(biter);
      // Adiciona também na lista de NPCs para permitir detecção com projéteis e mira
      if (this.npcs?.npcs) {
        this.npcs.npcs.push(biter);
      }
    }
  }

  update(dt) {
    for (let i = 0; i < this.walkers.length; i++) {
      this.walkers[i].update(dt);
    }
    for (let i = 0; i < this.biters.length; i++) {
      this.biters[i].update(dt);
    }
  }
}
