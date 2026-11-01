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

// Olhos amarelos brilhantes do Gulur (Bicho Altão)
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
// 1. Gulur: O Colosso dos Ermos (Quadrúpede Gigante de Pernas Finas - Olhos Amarelos)
// ============================================================================
export class Gulur {
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
    this.heading = 0;
    this.state = "idle";
    this.fleeTimer = 0;
    this.stepPhase = 0;
    this.alive = true;
    this.health = 35;
    this.maxHealth = 35;
    this.hitRadius = 2.4;
    this.name = "Gulur";
    this.roleKey = "gulur";
    this.deadTime = 0;
    this._inGrid = false;

    this.root = new THREE.Group();
    this.root.name = "Gulur";
    this.root.visible = false; // Começa invisível de dia
    this.root.userData = { entity: this, type: "MONSTER" };

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

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.5);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);

    if (this.effects) {
      this.effects.play("star", this.x, this.root.position.y + 2.8, this.z, "#ffea00", 2.2);
      this.effects.play("slash", this.x, this.root.position.y + 3.2, this.z, "#ff2222", 1.8);
    }

    // Levar dano assusta o colosso e dispara fuga imediata
    this.fleeTimer = 7.0;
    this.speed = 17.0;

    if (this.health <= 0) {
      this.alive = false;
      this.state = "dead";
      this.root.userData.isDead = true;

      if (this.npcs?.spatialGrid && this._inGrid) {
        this.npcs.spatialGrid.remove(this);
        this._inGrid = false;
      }
      if (this.effects) {
        this.effects.play("dust", this.x, this.root.position.y + 1.2, this.z, "#1c1917", 4.8);
        this.effects.play("star", this.x, this.root.position.y + 3.5, this.z, "#ffea00", 2.8);
      }
      spawnLoot(this.root.position, 40);
      addGood(6, "Gulur, o colosso dos ermos, foi abatido");
      return true;
    }
    return false;
  }

  update(dt, isNight = false) {
    // Só aparece e existe estritamente à noite
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

    // Animação de Colapso e Queda Monumental na Morte
    if (!this.alive) {
      this.deadTime += dt;
      if (this.deadTime < 3.2) {
        this.bodyGroup.position.y = THREE.MathUtils.lerp(this.bodyGroup.position.y, 1.0, dt * 2.5);
        this.bodyGroup.rotation.z = THREE.MathUtils.lerp(this.bodyGroup.rotation.z, 0.42, dt * 2.2);
        this.bodyGroup.rotation.x = THREE.MathUtils.lerp(this.bodyGroup.rotation.x, -0.35, dt * 2.2);
        for (let i = 0; i < 4; i++) {
          this.legs[i].legRoot.rotation.z = THREE.MathUtils.lerp(this.legs[i].legRoot.rotation.z, (i % 2 === 0 ? 0.8 : -0.8), dt * 3);
          this.legs[i].kneeGroup.rotation.x = THREE.MathUtils.lerp(this.legs[i].kneeGroup.rotation.x, 1.2, dt * 3);
        }
      } else if (this.deadTime > 5.0) {
        this.root.visible = false;
      }
      return;
    }

    if (!this.root.visible) this.root.visible = true;

    // Garante presença na Spatial Grid de combate à noite para ser focado pela mira e levar golpes
    if (this.npcs?.spatialGrid && !this._inGrid) {
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
    }

    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);

    // Se o jogador estiver longe (> 36m): o Gulur fica parado ou dando passos lentos e ENCARA fixamente com olhos amarelos
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
      // Jogador chegou perto (<= 36m): o Gulur se assusta e FOGE COM PASSADAS GIGANTESCAS na direção oposta!
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

// Alias de retrocompatibilidade
export { Gulur as TallWalker };

// ============================================================================
// 2. Necron: O Humanoide Cego (Sem topo da cabeça, dentes expostos, fica esperando)
// ============================================================================
export class Necron {
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
    this.state = "waiting"; // Fica esperando imóvel no escuro
    this.attackCooldown = 0;
    this.alive = true;
    this.health = 6;
    this.maxHealth = 6;
    this.hitRadius = 0.65;
    this.roleKey = "necron";
    this.name = "Necron";
    this.deadTime = 0;

    this.root = new THREE.Group();
    this.root.name = "Necron";
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

    // Braços esguios
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

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0, launch = 0) {
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
      addGood(2, "Necron abatido");
      return true;
    }
    return false;
  }

  update(dt, isNight = false) {
    // SÓ APARECE E ATUA ESTRITAMENTE À NOITE - NUNCA DE DIA!
    if (!isNight) {
      if (this.root.visible) {
        this.root.visible = false;
        if (this.npcs?.spatialGrid && this._inGrid) {
          this.npcs.spatialGrid.remove(this);
          this._inGrid = false;
        }
      }
      this.speed = 0;
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

    // Garante presença na Spatial Grid de combate à noite para ser atingido e focado
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

    // O Necron fica esperando; SÓ ATACA QUANDO O PLAYER ESTÁ MUITO PERTO (<= 7.5m)
    if (dist <= 7.5) {
      this.state = "charging";
      const targetYaw = Math.atan2(dx, dz);
      this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 8.0);
      this.model.rotation.y = this.heading;

      // Dispara em investida feroz com os braços esticados para frente
      this.speed = THREE.MathUtils.lerp(this.speed, 9.5, dt * 6.0);

      for (let i = 0; i < this.arms.length; i++) {
        this.arms[i].rotation.x = -1.45 + Math.sin(performance.now() * 0.02) * 0.15;
      }
      this.model.rotation.x = 0.32;

      // Ataque de mordida feroz corpo a corpo (<= 2.2m)
      if (dist <= 2.2) {
        this.speed = 1.8; // Desacelera para infligir a mordida sem atravessar o corpo
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 0.95;
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
      // Quando o jogador está afastado (> 7.5m): O Necron FICA ESPERANDO
      this.state = "waiting";
      this.speed = 0; // Imóvel esperando a presa
      this.model.rotation.x = 0.08;

      // Movimentos sutis de respiração e postura atenta ouvindo a noite
      const breath = Math.sin(performance.now() * 0.0035) * 0.06;
      this.headGroup.rotation.x = breath;
      for (let i = 0; i < this.arms.length; i++) {
        this.arms[i].rotation.x = -0.15 + breath * 0.5;
      }
    }

    // Deslocamento quando em investida
    if (this.speed > 0.05) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;

      const legCycle = performance.now() * 0.022;
      this.legs[0].rotation.x = Math.sin(legCycle) * 0.7;
      this.legs[1].rotation.x = -Math.sin(legCycle) * 0.7;
    } else {
      this.legs[0].rotation.x = 0;
      this.legs[1].rotation.x = 0;
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

// Alias de retrocompatibilidade
export { Necron as BlindBiter };

// ============================================================================
// 3. Hexoculus: O Observador dos Seis Olhos (Bípede Magro, Esquelético, 6 Olhos Amarelos)
// ============================================================================
export class Hexoculus {
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
    this.state = "stalking";
    this.attackCooldown = 0;
    this.alive = true;
    this.health = 22;
    this.maxHealth = 22;
    this.hitRadius = 0.95;
    this.roleKey = "hexoculus";
    this.name = "Hexoculus (Observador dos 6 Olhos)";
    this.deadTime = 0;
    this._auraTimer = 0;

    this.root = new THREE.Group();
    this.root.name = "Hexoculus";
    this.root.visible = false;
    this.root.userData = { entity: this, type: "MONSTER" };

    this.model = new THREE.Group();
    this.root.add(this.model);

    // Torso esquelético alto e magro (3.4m total)
    const spineGeo = new THREE.BoxGeometry(0.32, 1.4, 0.22);
    this.torso = new THREE.Mesh(spineGeo, _shadowBodyMat);
    this.torso.position.set(0, 1.9, 0);
    this.torso.castShadow = true;
    this.model.add(this.torso);

    // Costelas e espinhos ósseos projetando-se da coluna
    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.24), _paleSkinMat);
      rib.position.set(0, 1.45 + r * 0.22, 0.02);
      this.model.add(rib);

      const spineSpike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.35, 4), _shadowBodyMat);
      spineSpike.position.set(0, 1.45 + r * 0.22, -0.22);
      spineSpike.rotation.x = -Math.PI / 2.4;
      this.model.add(spineSpike);
    }

    // Cabeça angular alongada e sem boca
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.75, 0.05);
    this.model.add(this.headGroup);

    const headMesh = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 5), _shadowBodyMat);
    headMesh.rotation.x = Math.PI;
    this.headGroup.add(headMesh);

    // 6 OLHOS AMARELOS INCANDESCENTES alinhados em duas colunas verticais
    this.eyes = [];
    const eyeGeo = new THREE.SphereGeometry(0.055, 6, 5);
    const eyePositions = [
      { x: -0.09, y: 0.18, z: 0.12 },
      { x: 0.09, y: 0.18, z: 0.12 },
      { x: -0.11, y: 0.02, z: 0.14 },
      { x: 0.11, y: 0.02, z: 0.14 },
      { x: -0.08, y: -0.14, z: 0.13 },
      { x: 0.08, y: -0.14, z: 0.13 },
    ];

    for (let e = 0; e < 6; e++) {
      const eye = new THREE.Mesh(eyeGeo, _glowingYellowEyeMat);
      eye.position.set(eyePositions[e].x, eyePositions[e].y, eyePositions[e].z);
      this.headGroup.add(eye);
      this.eyes.push(eye);
    }

    // Luz mística que emana dos 6 olhos
    this.eyeLight = new THREE.PointLight(0xffea00, 3.2, 14, 1.6);
    this.eyeLight.position.set(0, 0.05, 0.2);
    this.headGroup.add(this.eyeLight);

    // Braços esguios e longos com garras afiadas
    this.arms = [];
    for (const side of [-1, 1]) {
      const armRoot = new THREE.Group();
      armRoot.position.set(side * 0.28, 2.45, 0);
      this.model.add(armRoot);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.95, 5), _thinLegMat);
      upperArm.position.set(0, -0.45, 0);
      armRoot.add(upperArm);

      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.95, 5), _paleSkinMat);
      forearm.position.set(0, -1.25, 0.1);
      armRoot.add(forearm);

      // Garras
      for (let g = 0; g < 3; g++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.22, 4), _shadowBodyMat);
        claw.position.set((g - 1) * 0.03, -1.78, 0.14);
        claw.rotation.x = Math.PI * 0.9;
        armRoot.add(claw);
      }
      this.arms.push(armRoot);
    }

    // Pernas finíssimas e longas
    this.legs = [];
    for (const side of [-1, 1]) {
      const legRoot = new THREE.Group();
      legRoot.position.set(side * 0.16, 1.25, 0);
      this.model.add(legRoot);

      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 1.35, 5), _thinLegMat);
      legMesh.position.set(0, -0.65, 0);
      legRoot.add(legMesh);

      this.legs.push(legRoot);
    }

    const groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);

    this._inGrid = false;
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.5);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);

    if (this.effects) {
      this.effects.play("star", this.x, this.root.position.y + 2.2, this.z, "#ffea00", 2.0);
      this.effects.play("star", this.x, this.root.position.y + 1.8, this.z, "#aa22ff", 2.2);
      this.effects.play("slash", this.x, this.root.position.y + 2.0, this.z, "#ff2233", 1.8);
    }

    const mag = Math.hypot(dirX, dirZ);
    if (mag > 0.01) {
      this.x += (dirX / mag) * (0.35 * force);
      this.z += (dirZ / mag) * (0.35 * force);
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
        this.effects.play("dust", this.x, this.root.position.y + 1.5, this.z, "#14101c", 3.8);
        this.effects.play("star", this.x, this.root.position.y + 2.5, this.z, "#ffea00", 2.6);
      }
      spawnLoot(this.root.position, 22);
      addGood(4, "Hexoculus, o observador dos seis olhos, foi abatido");
      return true;
    }
    return false;
  }

  update(dt, isNight = false) {
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
      if (this.deadTime < 1.2) {
        this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, -Math.PI / 2, dt * 5);
        this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, -0.6, dt * 5);
      } else if (this.deadTime > 3.0) {
        this.root.visible = false;
      }
      return;
    }

    if (!this.root.visible) this.root.visible = true;

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

    // Efeito pulsante e cintilante dos 6 olhos
    const pulse = 1.0 + Math.sin(performance.now() * 0.008) * 0.25;
    if (this.eyeLight) this.eyeLight.intensity = 2.8 * pulse;

    // Se estiver a <= 18m, encara o jogador e persegue em passos espectrais
    if (dist <= 18) {
      const targetYaw = Math.atan2(dx, dz);
      this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 6.0);
      this.model.rotation.y = this.heading;

      this.speed = THREE.MathUtils.lerp(this.speed, 6.8, dt * 4.0);

      // Aura cósmica sutil quando próximo
      this._auraTimer += dt;
      if (this._auraTimer > 1.4 && this.effects) {
        this._auraTimer = 0;
        this.effects.play("star", this.x, this.root.position.y + 2.6, this.z, "#aa22ff", 1.4);
      }

      // Golpe com as garras afiadas (<= 2.4m)
      if (dist <= 2.4) {
        this.speed = 1.2;
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 1.1;
          if (this.combat?.hurtPlayer) {
            this.combat.hurtPlayer(2.5, this.x, this.z, { weapon: "void_claws", knock: 3.5 });
          }
          if (this.effects) {
            this.effects.play("slash", px, py + 1.2, pz, "#aa22ff", 1.8);
            this.effects.play("star", px, py + 1.2, pz, "#ffea00", 1.4);
          }
        }
      }
    } else {
      // Vagando lentamente na névoa noturna
      this.speed = THREE.MathUtils.lerp(this.speed, 1.8, dt * 2.0);
      this.heading += (Math.sin(performance.now() * 0.0006) * 0.04);
      this.model.rotation.y = this.heading;
    }

    if (this.speed > 0.05) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;

      const legCycle = performance.now() * 0.008 * this.speed;
      this.legs[0].rotation.x = Math.sin(legCycle) * 0.55;
      this.legs[1].rotation.x = -Math.sin(legCycle) * 0.55;
      this.arms[0].rotation.x = -Math.sin(legCycle) * 0.45;
      this.arms[1].rotation.x = Math.sin(legCycle) * 0.45;
    }

    const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    this.root.position.set(this.x, groundY, this.z);

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
// 4. Polyphonia: A Anomalia de Yaldabaoth (Múltiplas Bocas, Serpentiforme, Sem Olhos)
// ============================================================================
export class Polyphonia {
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
    this.state = "slithering";
    this.attackCooldown = 0;
    this.alive = true;
    this.health = 18;
    this.maxHealth = 18;
    this.hitRadius = 0.85;
    this.roleKey = "polyphonia";
    this.name = "Polyphonia (Fauce Múltipla)";
    this.deadTime = 0;
    this.slitherPhase = Math.random() * Math.PI * 2;

    this.root = new THREE.Group();
    this.root.name = "Polyphonia";
    this.root.visible = false;
    this.root.userData = { entity: this, type: "MONSTER" };

    this.model = new THREE.Group();
    this.root.add(this.model);

    // Segmentos do corpo serpentiforme magro
    this.segments = [];
    for (let s = 0; s < 4; s++) {
      const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24 - s * 0.04, 0.28 - s * 0.04, 0.65, 6), _shadowBodyMat);
      segMesh.position.set(0, 0.35 + (3 - s) * 0.25, -s * 0.55);
      segMesh.rotation.x = Math.PI / 4;
      segMesh.castShadow = true;
      this.model.add(segMesh);
      this.segments.push(segMesh);
    }

    // Braços emaciados de rastejamento anterior
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), _paleSkinMat);
      arm.position.set(side * 0.32, 0.5, 0.15);
      arm.rotation.z = -side * 0.35;
      this.model.add(arm);
      this.arms.push(arm);
    }

    // TRÊS CABEÇAS / FAUCES DENTADAS CANIBAIS (SEM OLHOS)
    this.mouths = [];
    const mouthConfigs = [
      { x: 0, y: 1.55, z: 0.15, scale: 1.0, rx: 0 }, // Central
      { x: -0.25, y: 1.35, z: 0.05, scale: 0.75, rx: 0.25, rz: 0.35 }, // Lateral esquerda
      { x: 0.25, y: 1.35, z: 0.05, scale: 0.75, rx: 0.25, rz: -0.35 }, // Lateral direita
    ];

    for (let m = 0; m < mouthConfigs.length; m++) {
      const cfg = mouthConfigs[m];
      const mGroup = new THREE.Group();
      mGroup.position.set(cfg.x, cfg.y, cfg.z);
      mGroup.scale.set(cfg.scale, cfg.scale, cfg.scale);
      if (cfg.rz) mGroup.rotation.z = cfg.rz;
      if (cfg.rx) mGroup.rotation.x = cfg.rx;
      this.model.add(mGroup);

      // Cavidade bucal carmesim escancarada
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.32), _paleSkinMat);
      mGroup.add(jaw);

      const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 0.24), _mouthInteriorMat);
      cavity.position.set(0, 0.02, 0.04);
      mGroup.add(cavity);

      // Dentes afiados triangulares
      for (let t = 0; t < 8; t++) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.10, 4), _teethMat);
        const tang = (t / 8) * Math.PI * 2;
        tooth.position.set(Math.cos(tang) * 0.11, 0.08, Math.sin(tang) * 0.11 + 0.04);
        tooth.rotation.x = Math.PI;
        mGroup.add(tooth);
      }

      this.mouths.push(mGroup);
    }

    const groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);

    this._inGrid = false;
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.5);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);

    if (this.effects) {
      this.effects.play("slash", this.x, this.root.position.y + 1.2, this.z, "#cc1122", 1.8);
      this.effects.play("star", this.x, this.root.position.y + 1.4, this.z, "#ff2233", 1.5);
    }

    const mag = Math.hypot(dirX, dirZ);
    if (mag > 0.01) {
      this.x += (dirX / mag) * (0.4 * force);
      this.z += (dirZ / mag) * (0.4 * force);
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
        this.effects.play("dust", this.x, this.root.position.y + 0.6, this.z, "#261a1e", 2.8);
        this.effects.play("star", this.x, this.root.position.y + 1.0, this.z, "#aa1122", 2.0);
      }
      spawnLoot(this.root.position, 18);
      addGood(3, "Polyphonia abatida na escuridão");
      return true;
    }
    return false;
  }

  update(dt, isNight = false) {
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
      if (this.deadTime < 0.9) {
        this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, Math.PI / 2, dt * 5);
        this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, -0.35, dt * 5);
      } else if (this.deadTime > 2.6) {
        this.root.visible = false;
      }
      return;
    }

    if (!this.root.visible) this.root.visible = true;

    if (this.npcs?.spatialGrid && !this._inGrid) {
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    this.slitherPhase += dt * 4.5;
    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    const py = (this.player.root?.position?.y || 0);
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);

    // Movimentação das múltiplas mandíbulas canibais
    for (let m = 0; m < this.mouths.length; m++) {
      this.mouths[m].rotation.x = Math.sin(performance.now() * 0.01 + m * 1.5) * 0.22;
    }

    // Ondulação dos segmentos serpentiformes
    for (let s = 0; s < this.segments.length; s++) {
      this.segments[s].position.x = Math.sin(this.slitherPhase + s * 0.8) * 0.14;
    }

    if (dist <= 14) {
      const targetYaw = Math.atan2(dx, dz);
      this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 7.5);
      this.model.rotation.y = this.heading;

      // Dispara em bote rápido
      this.speed = THREE.MathUtils.lerp(this.speed, 8.2, dt * 5.0);

      if (dist <= 2.2) {
        this.speed = 1.4;
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 0.85;
          if (this.combat?.hurtPlayer) {
            this.combat.hurtPlayer(1.8, this.x, this.z, { weapon: "multi_jaws", knock: 2.8 });
          }
          if (this.effects) {
            this.effects.play("slash", px, py + 1.0, pz, "#cc1122", 1.5);
            this.effects.play("star", px, py + 1.0, pz, "#aa1122", 1.2);
          }
        }
      }
    } else {
      // Rastejamento suave
      this.speed = THREE.MathUtils.lerp(this.speed, 2.2, dt * 2.0);
      this.heading += Math.sin(performance.now() * 0.0008) * 0.05;
      this.model.rotation.y = this.heading;
    }

    if (this.speed > 0.05) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;
    }

    const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    this.root.position.set(this.x, groundY, this.z);

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
// 5. BeastManager: Gerencia Spawns de Feras e Criaturas Noturnas
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
    this.hexoculusList = [];
    this.polyphoniaList = [];
    this.respawnTimer = 0;
  }

  spawnInitialBeasts(cityCenter) {
    const cx = cityCenter.x ?? 0;
    const cz = cityCenter.z ?? 0;

    // 1. Gulurs (Bichos Altões): 3 criaturas imponentes nos ermos com olhos amarelos
    const walkerSpots = [
      { x: cx - 210, z: cz + 175 },
      { x: cx + 220, z: cz - 165 },
      { x: cx - 110, z: cz - 240 },
    ];
    for (const s of walkerSpots) {
      const g = new Gulur(
        this.scene,
        this.world,
        this.effects,
        this.combat,
        this.player,
        this.npcs,
        s.x,
        s.z
      );
      this.walkers.push(g);
      if (this.npcs?.npcs && !this.npcs.npcs.includes(g)) {
        this.npcs.npcs.push(g);
      }
    }

    // 2. Necrons (Cegos): Spawns completamente aleatórios nos ermos
    this.spawnRandomBiters(cx, cz, 5);

    // 3. Hexoculus (O Observador dos 6 Olhos): 3 criaturas esguias nos ermos noturnos
    const hexSpots = [
      { x: cx + 130, z: cz + 140 },
      { x: cx - 150, z: cz - 120 },
      { x: cx + 170, z: cz - 130 },
    ];
    for (const h of hexSpots) {
      const hex = new Hexoculus(
        this.scene,
        this.world,
        this.effects,
        this.combat,
        this.player,
        this.npcs,
        h.x,
        h.z
      );
      this.hexoculusList.push(hex);
      if (this.npcs?.npcs && !this.npcs.npcs.includes(hex)) {
        this.npcs.npcs.push(hex);
      }
    }

    // 4. Polyphonia (Fauce Múltipla): 3 serpentes de várias bocas rastejando na escuridão
    const polySpots = [
      { x: cx - 130, z: cz + 150 },
      { x: cx + 140, z: cz - 160 },
      { x: cx - 80, z: cz - 160 },
    ];
    for (const p of polySpots) {
      const poly = new Polyphonia(
        this.scene,
        this.world,
        this.effects,
        this.combat,
        this.player,
        this.npcs,
        p.x,
        p.z
      );
      this.polyphoniaList.push(poly);
      if (this.npcs?.npcs && !this.npcs.npcs.includes(poly)) {
        this.npcs.npcs.push(poly);
      }
    }
  }

  spawnRandomBiters(cx, cz, count = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 75 + Math.random() * 140;
      const bx = cx + Math.cos(angle) * radius;
      const bz = cz + Math.sin(angle) * radius;

      const necron = new Necron(
        this.scene,
        this.world,
        this.effects,
        this.combat,
        this.player,
        this.npcs,
        bx,
        bz
      );
      this.biters.push(necron);
      if (this.npcs?.npcs && !this.npcs.npcs.includes(necron)) {
        this.npcs.npcs.push(necron);
      }
    }
  }

  update(dt, isNight = false) {
    // Atualiza todos os Gulurs
    for (let i = 0; i < this.walkers.length; i++) {
      this.walkers[i].update(dt, isNight);
    }

    // Atualiza todos os Necrons
    for (let i = 0; i < this.biters.length; i++) {
      this.biters[i].update(dt, isNight);
    }

    // Atualiza todos os Hexoculus (6 olhos)
    for (let i = 0; i < this.hexoculusList.length; i++) {
      this.hexoculusList[i].update(dt, isNight);
    }

    // Atualiza todas as Polyphonias (fauces múltiplas)
    for (let i = 0; i < this.polyphoniaList.length; i++) {
      this.polyphoniaList[i].update(dt, isNight);
    }

    // À noite, repõe criaturas mortas periodicamente de forma randômica
    if (isNight) {
      this.respawnTimer += dt;
      if (this.respawnTimer > 28.0) {
        this.respawnTimer = 0;
        const activeBiters = this.biters.filter((b) => b.alive && b.root.visible).length;
        if (activeBiters < 4) {
          const px = this.player.x ?? 0;
          const pz = this.player.z ?? 0;
          this.spawnRandomBiters(px, pz, 2);
        }
      }
    }
  }
}
