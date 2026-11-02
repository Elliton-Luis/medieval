import * as THREE from "three";
import { ObjectPool, SCRATCH } from "./MemoryPools.js";
import { EventBus, GAME_EVENTS } from "./EventBus.js";
import { addEvil, checkWitnesses } from "./rpg.js";

// ============================================================================
// farmAnimals.js — Fauna Dinâmica das Vilas (Galinhas e Porcos)
// Habitats Híbridos (Curral Acoplado, Curral Solto, Free-Roam Limitado),
// Agro System com consequência social ao atacar animais e poças de sangue orgânicas.
// ============================================================================

// Materiais reutilizados das Galinhas
const _chickenFeatherMat = new THREE.MeshStandardMaterial({ color: "#f5f0e1", roughness: 0.85, flatShading: true });
const _chickenCombMat = new THREE.MeshStandardMaterial({ color: "#d62828", roughness: 0.7, flatShading: true });
const _chickenBeakMat = new THREE.MeshStandardMaterial({ color: "#f4a261", roughness: 0.6, flatShading: true });
const _chickenLegMat = new THREE.MeshStandardMaterial({ color: "#e76f51", roughness: 0.8, flatShading: true });

// Materiais reutilizados dos Porcos
const _pigSkinMat = new THREE.MeshStandardMaterial({ color: "#f4a69d", roughness: 0.75, flatShading: true });
const _pigSnoutMat = new THREE.MeshStandardMaterial({ color: "#e07a6f", roughness: 0.65, flatShading: true });
const _pigHoofMat = new THREE.MeshStandardMaterial({ color: "#543834", roughness: 0.9, flatShading: true });

// Decalque de Sangue para o evento do Sacrifício
const _bloodDecalMat = new THREE.MeshBasicMaterial({
  color: "#5c080d",
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
});

/**
 * Cria geometria de poça de sangue orgânica irregular (sem círculos perfeitos).
 */
export function createIrregularBloodGeometry(baseRadius = 0.9, seed = 1) {
  const shape = new THREE.Shape();
  const points = 14;
  const angleStep = (Math.PI * 2) / points;
  for (let i = 0; i <= points; i++) {
    const a = i * angleStep;
    const noise = Math.sin(a * 3 + seed) * 0.28 + Math.cos(a * 5 + seed * 2.1) * 0.2 + Math.sin(a * 2 + seed) * 0.14;
    const r = Math.max(0.3, baseRadius * (1.0 + noise));
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Cria a malha procedural da Galinha.
 */
function buildChickenMesh() {
  const root = new THREE.Group();
  root.name = "ChickenRoot";

  // Corpo oval
  const bodyGeo = new THREE.SphereGeometry(0.24, 7, 6);
  bodyGeo.scale(0.85, 1.1, 1.3);
  const body = new THREE.Mesh(bodyGeo, _chickenFeatherMat);
  body.position.set(0, 0.32, 0);
  body.castShadow = true;
  root.add(body);

  // Asinhas
  for (const sx of [-1, 1]) {
    const wingGeo = new THREE.BoxGeometry(0.04, 0.16, 0.26);
    const wing = new THREE.Mesh(wingGeo, _chickenFeatherMat);
    wing.position.set(sx * 0.22, 0.34, 0.02);
    root.add(wing);
  }

  // Cabeça e Pescoço
  const headGeo = new THREE.SphereGeometry(0.12, 6, 6);
  const head = new THREE.Mesh(headGeo, _chickenFeatherMat);
  head.position.set(0, 0.52, 0.24);
  root.add(head);

  // Crista vermelha
  const combGeo = new THREE.BoxGeometry(0.04, 0.1, 0.16);
  const comb = new THREE.Mesh(combGeo, _chickenCombMat);
  comb.position.set(0, 0.63, 0.22);
  root.add(comb);

  // Bico amarelo pontudo
  const beakGeo = new THREE.ConeGeometry(0.06, 0.14, 5);
  beakGeo.rotateX(Math.PI / 2);
  const beak = new THREE.Mesh(beakGeo, _chickenBeakMat);
  beak.position.set(0, 0.5, 0.36);
  root.add(beak);

  // Barbelas vermelhas sob o bico
  const wattleGeo = new THREE.SphereGeometry(0.04, 4, 4);
  const wattle = new THREE.Mesh(wattleGeo, _chickenCombMat);
  wattle.position.set(0, 0.43, 0.3);
  root.add(wattle);

  // Pernas
  for (const sx of [-0.09, 0.09]) {
    const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4);
    const leg = new THREE.Mesh(legGeo, _chickenLegMat);
    leg.position.set(sx, 0.1, 0);
    root.add(leg);
  }

  return root;
}

/**
 * Cria a malha procedural do Porco.
 */
function buildPigMesh() {
  const root = new THREE.Group();
  root.name = "PigRoot";

  // Tronco roliço
  const bodyGeo = new THREE.BoxGeometry(0.56, 0.52, 0.94);
  const body = new THREE.Mesh(bodyGeo, _pigSkinMat);
  body.position.set(0, 0.46, 0);
  body.castShadow = true;
  root.add(body);

  // Cabeça
  const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.44);
  const head = new THREE.Mesh(headGeo, _pigSkinMat);
  head.position.set(0, 0.52, 0.58);
  root.add(head);

  // Focinho característico (Snout)
  const snoutGeo = new THREE.BoxGeometry(0.24, 0.18, 0.14);
  const snout = new THREE.Mesh(snoutGeo, _pigSnoutMat);
  snout.position.set(0, 0.46, 0.84);
  root.add(snout);

  // Narinas
  for (const sx of [-0.05, 0.05]) {
    const nostrilGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
    const nostril = new THREE.Mesh(nostrilGeo, _pigHoofMat);
    nostril.position.set(sx, 0.46, 0.92);
    root.add(nostril);
  }

  // Orelhas caídas
  for (const sx of [-0.22, 0.22]) {
    const earGeo = new THREE.BoxGeometry(0.12, 0.16, 0.06);
    earGeo.rotateZ(sx * 0.4);
    const ear = new THREE.Mesh(earGeo, _pigSnoutMat);
    ear.position.set(sx, 0.72, 0.6);
    root.add(ear);
  }

  // Pernas curtas
  for (const sx of [-0.2, 0.2]) {
    for (const sz of [-0.34, 0.34]) {
      const legGeo = new THREE.BoxGeometry(0.14, 0.28, 0.14);
      const leg = new THREE.Mesh(legGeo, _pigSkinMat);
      leg.position.set(sx, 0.14, sz);
      root.add(leg);

      const hoofGeo = new THREE.BoxGeometry(0.14, 0.06, 0.14);
      const hoof = new THREE.Mesh(hoofGeo, _pigHoofMat);
      hoof.position.set(sx, 0.03, sz);
      root.add(hoof);
    }
  }

  // Rabinho encaracolado
  const tailGeo = new THREE.BoxGeometry(0.06, 0.06, 0.18);
  const tail = new THREE.Mesh(tailGeo, _pigSnoutMat);
  tail.position.set(0, 0.58, -0.52);
  tail.rotation.x = 0.6;
  root.add(tail);

  return root;
}

/**
 * Entidade Base de Animal de Curral.
 */
export class BaseFarmAnimal {
  constructor(kind, root, manager) {
    this.kind = kind; // 'chicken' | 'pig'
    this.root = root;
    this.manager = manager;
    this.active = false;
    this.health = kind === "chicken" ? 2 : 5;
    this.maxHealth = this.health;
    this.hitRadius = kind === "chicken" ? 0.35 : 0.55;
    this.x = 0;
    this.z = 0;
    this.y = 0;
    this.homeX = 0;
    this.homeZ = 0;
    this.roamRadius = 4.5;
    this.habitatType = "coupled_pen"; // 'coupled_pen' | 'village_pen' | 'free_roam'
    this.bounds = null; // { minX, maxX, minZ, maxZ } para curral acoplado
    this.ownerId = null;
    this.angle = Math.random() * Math.PI * 2;
    this.timer = Math.random() * 2;
    this.state = "idle"; // 'idle' | 'walk' | 'dead'
    this.peckTimer = 0;
    this.speed = kind === "chicken" ? 1.6 : 1.1;
  }

  spawn(x, z, homeX, homeZ, radius = 4.5, habitatType = "coupled_pen", bounds = null, ownerId = null) {
    this.active = true;
    this.homeX = homeX;
    this.homeZ = homeZ;
    this.roamRadius = Math.min(15.0, radius);
    this.habitatType = habitatType;
    this.bounds = bounds;
    this.ownerId = ownerId;
    this.x = x;
    this.z = z;
    this.y = this.manager.world.heightAt(x, z);
    this.health = this.maxHealth;
    this.state = "idle";
    this.timer = 1.0 + Math.random() * 2.5;
    this.root.visible = true;
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.set(0, this.angle, 0);
  }

  takeDamage(amount, attacker = null) {
    if (!this.active || this.state === "dead") return false;
    this.health -= amount;
    const isFatal = this.health <= 0;

    // Consequência Social & Agro System se o jogador for o agressor
    if (attacker) {
      this.manager.reportAnimalCrime(this, attacker, isFatal);
    }

    if (isFatal) {
      this.die(false, attacker);
      return true;
    } else {
      // Pânico e fuga curta
      this.state = "walk";
      this.timer = 2.5;
      this.angle += Math.PI + (Math.random() - 0.5) * 1.2;
      return false;
    }
  }

  die(isSacrifice = false, attacker = null) {
    if (this.state === "dead") return;
    this.state = "dead";
    this.health = 0;

    // Tombamento lateral
    this.root.rotation.z = Math.PI / 2;
    this.root.position.y = this.manager.world.heightAt(this.x, this.z) + 0.1;

    // Spawna poça de sangue permanente com formato orgânico irregular
    this.manager.spawnBloodPool(this.x, this.z);

    // Drop de recursos alimentícios
    if (this.manager.drops) {
      if (this.kind === "chicken") {
        this.manager.drops._spawn?.("feathers", this.x, this.z, 0, 0, 1);
      } else {
        this.manager.drops._spawn?.("pork", this.x, this.z, 0, 0, 1);
      }
    }

    EventBus.emit(GAME_EVENTS.NPC_DIED, { kind: this.kind, x: this.x, z: this.z, sacrifice: isSacrifice });
  }

  update(dt) {
    if (!this.active || this.state === "dead") return;

    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.state === "idle") {
        this.state = "walk";
        this.timer = 1.5 + Math.random() * 3.0;

        // Comportamento espacial conforme o Habitat
        if (this.habitatType === "free_roam") {
          // Raio máximo de 15m da âncora/bebedouro
          const dx = this.homeX - this.x;
          const dz = this.homeZ - this.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 14.0) {
            this.angle = Math.atan2(dx, dz);
          } else {
            this.angle += (Math.random() - 0.5) * 1.8;
          }
        } else if (this.bounds) {
          // Curral Acoplado: se aproximando do mourão, vira em direção ao centro
          const cx = (this.bounds.minX + this.bounds.maxX) * 0.5;
          const cz = (this.bounds.minZ + this.bounds.maxZ) * 0.5;
          const dx = cx - this.x;
          const dz = cz - this.z;
          this.angle = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.9;
        } else {
          const dx = this.homeX - this.x;
          const dz = this.homeZ - this.z;
          const distFromHome = Math.hypot(dx, dz);
          if (distFromHome > this.roamRadius) {
            this.angle = Math.atan2(dx, dz);
          } else {
            this.angle += (Math.random() - 0.5) * 1.8;
          }
        }
      } else {
        this.state = "idle";
        this.timer = 2.0 + Math.random() * 4.0;
      }
    }

    if (this.state === "walk") {
      const step = this.speed * dt;
      let nextX = this.x + Math.sin(this.angle) * step;
      let nextZ = this.z + Math.cos(this.angle) * step;

      // 1. Clamp rígido nos limites do curral acoplado
      if (this.habitatType === "coupled_pen" && this.bounds) {
        const margin = this.hitRadius + 0.15;
        if (nextX < this.bounds.minX + margin || nextX > this.bounds.maxX - margin ||
            nextZ < this.bounds.minZ + margin || nextZ > this.bounds.maxZ - margin) {
          nextX = Math.max(this.bounds.minX + margin, Math.min(this.bounds.maxX - margin, nextX));
          nextZ = Math.max(this.bounds.minZ + margin, Math.min(this.bounds.maxZ - margin, nextZ));
          this.angle += Math.PI * 0.75;
        }
      }

      // 2. Colisão contra estruturas sólidas
      if (!this.manager.world.isBlockedAt(nextX, nextZ, this.hitRadius)) {
        this.x = nextX;
        this.z = nextZ;
      } else {
        this.angle += Math.PI * 0.7;
      }
    }

    this.y = this.manager.world.heightAt(this.x, this.z);
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.angle;

    // Animação de ciscada/farejo
    if (this.kind === "chicken" && this.state === "idle") {
      this.peckTimer += dt * 5;
      this.root.rotation.x = Math.max(0, Math.sin(this.peckTimer) * 0.4);
    }
  }
}

/**
 * Gerenciador de Animais de Fazenda com ObjectPool (Zero-GC).
 */
export class FarmAnimalManager {
  constructor({ scene, world, drops = null, npcs = null, ui = null, capacityChickens = 40, capacityPigs = 25 }) {
    this.scene = scene;
    this.world = world;
    this.drops = drops;
    this.npcs = npcs;
    this.ui = ui;

    this.animals = [];
    this.bloodPools = [];

    // 1. Pool de Galinhas
    this.chickenPool = new ObjectPool(
      () => {
        const mesh = buildChickenMesh();
        const animal = new BaseFarmAnimal("chicken", mesh, this);
        mesh.userData.animal = animal;
        return animal;
      },
      capacityChickens,
      this.scene,
    );

    // 2. Pool de Porcos
    this.pigPool = new ObjectPool(
      () => {
        const mesh = buildPigMesh();
        const animal = new BaseFarmAnimal("pig", mesh, this);
        mesh.userData.animal = animal;
        return animal;
      },
      capacityPigs,
      this.scene,
    );
  }

  /**
   * Registra a consequência social (Agro System) ao agredir/matar a fauna.
   */
  reportAnimalCrime(animal, attacker, isFatal = false) {
    addEvil(isFatal ? 2 : 1, isFatal ? "Abate de animal doméstico" : "Agressão a animal doméstico");

    const npcsManager = this.npcs || window.__game?.npcs;
    const ui = this.ui || window.__game?.ui;
    if (!npcsManager) return;

    // Checagem espacial de testemunhas num raio de 30m
    const witnesses = [];
    const npcList = npcsManager.npcs || [];
    for (let i = 0; i < npcList.length; i++) {
      const npc = npcList[i];
      if (!npc.alive) continue;
      const dx = npc.x - animal.x;
      const dz = npc.z - animal.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= 30.0 * 30.0) {
        witnesses.push(npc);
      }
    }

    if (witnesses.length > 0) {
      npcsManager.addWantedPoints?.(isFatal ? 0.4 : 0.2);
      const primeWitness = witnesses[0];
      npcsManager.notifyCrime?.(animal.x, animal.z, 28, primeWitness, 0.35);

      for (let i = 0; i < witnesses.length; i++) {
        const w = witnesses[i];
        if (w.roleKey === "guard") {
          w.startAlert?.("combat", 15.0, attacker.x, attacker.z);
        } else if (w.mode === "work" || w.mode === "idle") {
          w.startAlert?.("flee", 6.0, attacker.x, attacker.z);
        }
      }

      ui?.showToast?.(
        isFatal
          ? "✦ Crime testemunhado! Os moradores denunciaram o abate do animal aos guardas!"
          : "✦ Crime! Foste visto agredindo os animais da fazenda!",
      );
    }
  }

  /**
   * Consulta espacial de animais ativos próximos a um ponto.
   */
  getNearbyAnimals(x, z, radius = 2.5, out = []) {
    out.length = 0;
    const radSq = radius * radius;
    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      if (!a.active || a.state === "dead") continue;
      const dx = a.x - x;
      const dz = a.z - z;
      if (dx * dx + dz * dz <= radSq) {
        out.push(a);
      }
    }
    return out;
  }

  /**
   * Spawna galinhas e porcos atrelados a um curral/fazenda com suporte a habitats.
   */
  spawnPenAnimals(centerX, centerZ, chickenCount = 3, pigCount = 2, radius = 4.5, habitatType = "coupled_pen", bounds = null, ownerId = null) {
    for (let i = 0; i < chickenCount; i++) {
      const animal = this.chickenPool.acquire();
      const ox = (Math.random() - 0.5) * radius * 1.1;
      const oz = (Math.random() - 0.5) * radius * 1.1;
      animal.spawn(centerX + ox, centerZ + oz, centerX, centerZ, radius, habitatType, bounds, ownerId);
      this.animals.push(animal);
    }

    for (let i = 0; i < pigCount; i++) {
      const animal = this.pigPool.acquire();
      const ox = (Math.random() - 0.5) * radius * 1.1;
      const oz = (Math.random() - 0.5) * radius * 1.1;
      animal.spawn(centerX + ox, centerZ + oz, centerX, centerZ, radius, habitatType, bounds, ownerId);
      this.animals.push(animal);
    }
  }

  /**
   * Dispara o evento de suspense "O Sacrifício" em um animal aleatório.
   */
  triggerSacrificeEvent() {
    const living = this.animals.filter((a) => a.active && a.state !== "dead");
    if (living.length === 0) return null;
    const target = living[Math.floor(Math.random() * living.length)];
    target.die(true);
    return target;
  }

  spawnBloodPool(x, z) {
    const y = this.world.heightAt(x, z) + 0.03;
    const geo = createIrregularBloodGeometry(0.85 + Math.random() * 0.45, Math.random() * 100);
    const mesh = new THREE.Mesh(geo, _bloodDecalMat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.bloodPools.push(mesh);
  }

  update(dt) {
    for (let i = 0; i < this.animals.length; i++) {
      this.animals[i].update(dt);
    }
  }
}
