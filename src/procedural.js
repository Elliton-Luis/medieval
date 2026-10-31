import * as THREE from "three";
import { distanceToRoad, VILLAGES } from "./kingdom.js";
import { NPC } from "./npc.js?v=18";
import { buildHumanoid, bendJoints } from "./humanoid.js";
import { makeSkinnedMaterial } from "./skins.js";
import { meleeThink, releaseToken } from "./melee.js";

// ============================================================================
// 1. Sistema de Seed (PRNG Mulberry32) e Texturas Procedurais de Baixo Custo
// ============================================================================

// Cache e vetores globais (Zero-GC no loop principal)
const _spawnPos = new THREE.Vector3();
const _cityCenter = new THREE.Vector3();
const _tempVec = new THREE.Vector3();
const _dummy = new THREE.Object3D();

const CHANCE_WEREWOLF = 0.05;
const SPAWN_DISTANCE = 45; // Distância cega do jogador

let _sharedHouseMaterial = null;
let _wildernessTimer = 0;

// Referências compartilhadas para geração regional em malha (chunks de 500x500m)
const _procEnv = {
  scene: null,
  world: null,
  npcs: null,
  activeCities: null,
};

export function initProceduralEnv(env = {}) {
  Object.assign(_procEnv, env);
}

/**
 * Gerador pseudoaleatório determinístico (Mulberry32).
 * Garante que a cidade seja idêntica na mesma seed.
 * @param {number} seed
 */
export function createSeededRandom(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Gera textura de ruído estilizada via Canvas para consistência das casas.
 * Chamado apenas na inicialização e compartilhado globalmente.
 */
export function createSharedHouseMaterial() {
  if (_sharedHouseMaterial) return _sharedHouseMaterial;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const rand = createSeededRandom(1337);

  // Fundo base e ruído procedural simples
  ctx.fillStyle = "#8b7355"; // Cor de madeira/barro
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = rand() > 0.5 ? "#735b3e" : "#a08665";
    ctx.fillRect(rand() * 256, rand() * 256, 4, 4);
  }
  // Faixas sutis de vigas/tábuas para enriquecer o relevo visual sem adicionar polígonos
  ctx.fillStyle = "rgba(58, 42, 28, 0.28)";
  for (let y = 0; y < 256; y += 32) {
    ctx.fillRect(0, y, 256, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter; // Estilo low-poly/pixel art
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  _sharedHouseMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    flatShading: true,
  });
  return _sharedHouseMaterial;
}

// ============================================================================
// 2. Geração da Cidade, Muralhas e Âncoras de Rotina
// ============================================================================

function _isAreaClearForBuilding(x, z, existingRects, world, center) {
  // Evita estradas reais e centro da praça da cidade
  if (distanceToRoad(x, z) < 7.5) return false;
  if (center && Math.abs(x) < 10 && Math.abs(z) < 10) {
    if (x > -38 && x < 34 && z > -52 && z < 12) return false;
  } else if (center) {
    const cdx = x - center.x;
    const cdz = z - center.z;
    if (cdx * cdx + cdz * cdz < 18 * 18) return false;
  }
  if (world && world.isBlockedAt(x, z, 4.8)) return false;
  for (let i = 0; i < existingRects.length; i++) {
    const b = existingRects[i];
    const dx = x - b.x;
    const dz = z - b.z;
    if (dx * dx + dz * dz < 11.5 * 11.5) return false;
  }
  return true;
}

/**
 * Gera layout da cidade, muralha circular instanciada e retorna as âncoras para os NPCs.
 * Aceita tanto `generateCity(seed, cityCenter, houseMaterial)` (grade regional de chunks)
 * quanto `generateCity(seed, scene, houseMaterial, world, settlement, cityCenter)`.
 * @param {number} seed
 * @param {THREE.Vector3|THREE.Scene} sceneOrCenter
 * @param {THREE.Material} [houseMaterial]
 * @param {object} [world]
 * @param {object} [settlement]
 * @param {THREE.Vector3} [customCenter]
 */
export function generateCity(
  seed,
  sceneOrCenter,
  houseMaterial = createSharedHouseMaterial(),
  world = null,
  settlement = null,
  customCenter = null,
) {
  const random = createSeededRandom(seed);
  const cityRadius = 80;

  let scene = null;
  if (sceneOrCenter && sceneOrCenter.isScene) {
    scene = sceneOrCenter;
    _procEnv.scene = scene;
    if (world) _procEnv.world = world;
    if (customCenter) {
      _cityCenter.set(customCenter.x ?? 0, customCenter.y ?? 0, customCenter.z ?? 0);
    } else {
      _cityCenter.set(0, 0, 0);
    }
  } else if (sceneOrCenter && typeof sceneOrCenter.x === "number") {
    _cityCenter.set(sceneOrCenter.x, sceneOrCenter.y ?? 0, sceneOrCenter.z);
    scene = _procEnv.scene;
    world = world || _procEnv.world;
  } else {
    scene = _procEnv.scene;
    world = world || _procEnv.world;
    _cityCenter.set(0, 0, 0);
  }

  if (!houseMaterial || !houseMaterial.isMaterial) {
    houseMaterial = createSharedHouseMaterial();
  }

  const anchors = {
    taverns: [],
    blacksmiths: [],
    houses: [],
    farms: [],
    gates: [],
  };

  // --- 2.1 Geração de Muralhas (InstancedMesh circular com portões nas estradas) ---
  const wallCount = 36;
  const angleStep = (Math.PI * 2) / wallCount;
  const wallSegments = [];

  for (let i = 0; i < wallCount; i++) {
    const angle = i * angleStep;
    const wx = _cityCenter.x + Math.cos(angle) * cityRadius;
    const wz = _cityCenter.z + Math.sin(angle) * cityRadius;

    // Deixa abertura nos 2 portões principais da seed e nos cruzamentos das estradas reais
    const isMainGate = i === 0 || i === Math.floor(wallCount / 2);
    const onRoad = distanceToRoad(wx, wz) < 8.5;

    if (isMainGate || onRoad) {
      const groundY = world ? world.heightAt(wx, wz) : 0;
      anchors.gates.push(new THREE.Vector3(wx, groundY, wz));
      continue;
    }

    wallSegments.push({ x: wx, z: wz, angle });
  }

  if (scene && wallSegments.length > 0) {
    const segLen = (2 * Math.PI * cityRadius) / wallCount + 0.55;
    const wallHeight = 6.2;
    const foundationDepth = 4.0;
    const wallGeo = new THREE.BoxGeometry(1.8, wallHeight + foundationDepth, segLen);
    const wallMesh = new THREE.InstancedMesh(wallGeo, houseMaterial, wallSegments.length);
    wallMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    for (let i = 0; i < wallSegments.length; i++) {
      const seg = wallSegments[i];
      const groundY = world ? world.heightAt(seg.x, seg.z) : 0;
      const centerY = groundY + (wallHeight - foundationDepth) * 0.5;
      const ry = -seg.angle;

      _dummy.position.set(seg.x, centerY, seg.z);
      _dummy.rotation.set(0, ry, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      wallMesh.setMatrixAt(i, _dummy.matrix);

      if (world) {
        world.addOrientedBox(
          seg.x,
          seg.z,
          1.8,
          segLen,
          ry,
          groundY - foundationDepth,
          groundY + wallHeight,
          { move: true, shot: true, cam: true },
        );
      }
    }
    wallMesh.instanceMatrix.needsUpdate = true;
    scene.add(wallMesh);
  }

  // --- 2.2 Geração de Construções Procedurais com Âncoras e Material Único ---
  const placedBuildings = [];
  for (let i = 0; i < 20; i++) {
    let bx = 0;
    let bz = 0;
    let r = 0;
    let theta = 0;
    let foundSpot = false;

    for (let attempt = 0; attempt < 14; attempt++) {
      // Sorteia raio determinístico na faixa residencial dentro da muralha
      r = 38 + random() * (cityRadius - 53);
      theta = random() * Math.PI * 2;
      bx = _cityCenter.x + Math.cos(theta) * r;
      bz = _cityCenter.z + Math.sin(theta) * r;
      if (_isAreaClearForBuilding(bx, bz, placedBuildings, world, _cityCenter)) {
        foundSpot = true;
        break;
      }
    }

    if (!foundSpot) {
      r = random() * (cityRadius - 15);
      theta = random() * Math.PI * 2;
      bx = _cityCenter.x + Math.cos(theta) * r;
      bz = _cityCenter.z + Math.sin(theta) * r;
    }

    const groundY = world ? world.heightAt(bx, bz) : 0;
    const faceCenterYaw = Math.atan2(_cityCenter.x - bx, _cityCenter.z - bz);
    // Porta da construção voltada para o centro: âncora fica 3.8m à frente da fachada
    const anchorX = bx + Math.sin(faceCenterYaw) * 3.8;
    const anchorZ = bz + Math.cos(faceCenterYaw) * 3.8;
    const anchorY = world ? world.heightAt(anchorX, anchorZ) : 0;
    const bPos = new THREE.Vector3(anchorX, anchorY, anchorZ);

    // Define ofícios (10% ferreiro, 15% taverna, resto casas)
    const typeRoll = random();
    let bType = "house";
    if (typeRoll < 0.10) {
      bType = "blacksmith";
      anchors.blacksmiths.push(bPos.clone());
    } else if (typeRoll < 0.25) {
      bType = "tavern";
      anchors.taverns.push(bPos.clone());
    } else {
      anchors.houses.push(bPos.clone());
    }

    if (foundSpot) {
      placedBuildings.push({ x: bx, z: bz, y: groundY, ry: faceCenterYaw, type: bType });
    }
  }

  // Instancia todos os prédios procedurais em um único InstancedMesh usando `houseMaterial`
  if (scene && placedBuildings.length > 0) {
    const bWidth = 5.6;
    const bDepth = 4.8;
    const bHeight = 3.8;
    const bFound = 3.2;
    const bGeo = new THREE.BoxGeometry(bWidth, bHeight + bFound, bDepth);
    const bMesh = new THREE.InstancedMesh(bGeo, houseMaterial, placedBuildings.length);
    bMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;

    // Telhados em prisma também compartilhando `houseMaterial` (apenas +1 draw call para todos os telhados!)
    const roofGeo = new THREE.ConeGeometry(4.1, 2.1, 4);
    const roofMesh = new THREE.InstancedMesh(roofGeo, houseMaterial, placedBuildings.length);
    roofMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;

    for (let i = 0; i < placedBuildings.length; i++) {
      const b = placedBuildings[i];
      let maxH = b.y;
      let minH = b.y;
      if (world) {
        for (const ox of [-2.6, 2.6]) {
          for (const oz of [-2.2, 2.2]) {
            const h = world.heightAt(b.x + ox, b.z + oz);
            if (h > maxH) maxH = h;
            if (h < minH) minH = h;
          }
        }
      }
      const baseY = maxH + 0.05;
      const scaleW = b.type === "tavern" ? 1.18 : b.type === "blacksmith" ? 1.1 : 1.0;

      _dummy.position.set(b.x, baseY + (bHeight - bFound) * 0.5, b.z);
      _dummy.rotation.set(0, b.ry, 0);
      _dummy.scale.set(scaleW, 1, scaleW);
      _dummy.updateMatrix();
      bMesh.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(b.x, baseY + bHeight + 0.95, b.z);
      _dummy.rotation.set(0, b.ry + Math.PI / 4, 0);
      _dummy.scale.set(scaleW, 1, scaleW);
      _dummy.updateMatrix();
      roofMesh.setMatrixAt(i, _dummy.matrix);

      if (world) {
        world.addOrientedBox(
          b.x,
          b.z,
          bWidth * scaleW,
          bDepth * scaleW,
          b.ry,
          baseY - bFound,
          baseY + bHeight + 1.6,
          { move: true, shot: true, cam: true },
        );
      }
    }
    bMesh.instanceMatrix.needsUpdate = true;
    roofMesh.instanceMatrix.needsUpdate = true;
    scene.add(bMesh);
    scene.add(roofMesh);
  }

  // Integra também as construções interativas de Caldera nas listas de âncoras
  if (settlement) {
    if (settlement.blacksmith) {
      anchors.blacksmiths.push(new THREE.Vector3(settlement.blacksmith.x, 0, settlement.blacksmith.z));
    }
    if (settlement.market) {
      anchors.taverns.push(new THREE.Vector3(settlement.market.x, 0, settlement.market.z));
    }
    if (settlement.gate) {
      anchors.gates.unshift(new THREE.Vector3(settlement.gate.x, 0, settlement.gate.z));
    }
    if (Array.isArray(settlement.houses)) {
      for (let i = 0; i < settlement.houses.length; i++) {
        const h = settlement.houses[i];
        const doorX = h.door ? h.door.x : h.x;
        const doorZ = h.door ? h.door.z : h.z;
        const vec = new THREE.Vector3(doorX, h.floorY || 0, doorZ);
        if (h.type === "inn") anchors.taverns.unshift(vec);
        else anchors.houses.push(vec);
      }
    }
    anchors.farms.push(new THREE.Vector3(-31, 0, 0));
  }

  const cx = _cityCenter.x;
  const cz = _cityCenter.z;
  if (anchors.taverns.length === 0) anchors.taverns.push(new THREE.Vector3(cx + 25, 0, cz - 14));
  if (anchors.blacksmiths.length === 0) anchors.blacksmiths.push(new THREE.Vector3(cx + 15, 0, cz - 27));
  if (anchors.farms.length === 0) anchors.farms.push(new THREE.Vector3(cx - 31, 0, cz));
  if (anchors.houses.length === 0) anchors.houses.push(new THREE.Vector3(cx + 26, 0, cz - 31));
  if (anchors.gates.length === 0) anchors.gates.push(new THREE.Vector3(cx, 0, cz - 48));

  const cityObj = { radius: cityRadius, center: _cityCenter.clone(), anchors, material: houseMaterial, assignNpcAnchors };

  // Se for uma cidade regional gerada dinamicamente fora de (0,0) e o sistema de NPCs estiver ativo, popula com moradores e comerciantes
  if (!settlement && _procEnv.npcs && (Math.abs(cx) > 50 || Math.abs(cz) > 50)) {
    _spawnRegionalCityNPCs(cityObj, _procEnv.npcs);
  }

  return cityObj;
}

function _spawnRegionalCityNPCs(cityObj, npcSystem) {
  if (!npcSystem || typeof npcSystem._add !== "function") return;
  const c = cityObj.center;
  const anchors = cityObj.anchors;
  const smithPos = anchors.blacksmiths[0] || c;
  const tavernPos = anchors.taverns[0] || c;
  const farmPos = anchors.farms[0] || c;
  const gatePos = anchors.gates[0] || c;

  const smith = npcSystem._add("smith", [
    { x: smithPos.x, z: smithPos.z },
    { x: c.x + 4, z: c.z + 4 },
  ]);
  assignNpcAnchors(smith, anchors, "blacksmiths");

  const farmer = npcSystem._add("farmer", [
    { x: farmPos.x, z: farmPos.z },
    { x: c.x - 6, z: c.z + 5 },
  ]);
  assignNpcAnchors(farmer, anchors, "farms");

  const merchant = npcSystem._add("merchant", [
    { x: tavernPos.x, z: tavernPos.z },
    { x: c.x, z: c.z },
  ]);
  assignNpcAnchors(merchant, anchors, "taverns");

  const guard = npcSystem._add("guard", [
    { x: gatePos.x, z: gatePos.z },
    { x: c.x, z: c.z },
  ]);
  assignNpcAnchors(guard, anchors, "gates");
}

/**
 * CORREÇÃO: Gerador de Múltiplas Cidades.
 * Verifica regiões de 500x500m. Se a seed regional permitir, gera uma vila/cidade.
 * @param {THREE.Vector3|{x:number,z:number}} playerPos
 * @param {Map<string, object|null>} activeCities
 * @param {THREE.Material} [houseMaterial]
 */
export function updateWorldChunks(playerPos, activeCities, houseMaterial = createSharedHouseMaterial()) {
  if (!playerPos || !activeCities) return;
  _procEnv.activeCities = activeCities;

  const regionX = Math.floor(playerPos.x / 500);
  const regionZ = Math.floor(playerPos.z / 500);

  // Checa 9 regiões em volta do jogador
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      const rx = regionX + x;
      const rz = regionZ + z;
      const regionId = `${rx}_${rz}`;

      if (!activeCities.has(regionId)) {
        // Seed baseada nas coordenadas para ser sempre no mesmo lugar
        const regionSeed = 12345 + rx * 1000 + rz;
        const random = createSeededRandom(regionSeed);

        // 30% de chance de ter uma vila/cidade naquela região
        if (random() < 0.3) {
          const offsetX = (random() - 0.5) * 200;
          const offsetZ = (random() - 0.5) * 200;
          const cityCenter = new THREE.Vector3(rx * 500 + offsetX, 0, rz * 500 + offsetZ);

          activeCities.set(regionId, generateCity(regionSeed, cityCenter, houseMaterial));
        } else {
          activeCities.set(regionId, null); // Marca como vazio para não checar de novo
        }
      }
    }
  }
}

/**
 * Vincula âncoras fixas ao NPC no spawn (evitando sobreposição via .pop()).
 * @param {THREE.Object3D|object} npc
 * @param {object} cityAnchors
 * @param {string} profession - 'blacksmiths' | 'taverns' | 'farms' | 'houses' | 'gates'
 */
export function assignNpcAnchors(npc, cityAnchors, profession = "houses") {
  if (!npc || !cityAnchors) return null;
  const obj = npc.isObject3D ? npc : npc.root || npc;
  const houses = cityAnchors.houses || [];
  const profList = cityAnchors[profession] || houses;
  const taverns = cityAnchors.taverns || houses;
  const gates = cityAnchors.gates || [];

  const homeVec = houses.length > 1 ? houses.pop() : houses[0] ? houses[0].clone() : new THREE.Vector3(0, 0, -20);
  const workVec = profList.length > 1 ? profList.pop() : profList[0] ? profList[0].clone() : homeVec.clone();
  const tavernVec = taverns[0] ? taverns[0].clone() : homeVec.clone();
  const gateVec = gates[0] ? gates[0].clone() : new THREE.Vector3(0, 0, -48);

  const anchors = {
    home: homeVec,
    work: workVec,
    tavern: tavernVec,
    gates: gates.slice(),
    gate: gateVec,
  };

  obj.userData = obj.userData || {};
  obj.userData.anchors = anchors;
  if (npc !== obj) {
    npc.userData = obj.userData;
    npc.anchors = anchors;
  }
  return anchors;
}

/**
 * Retorna o ponto de fuga determinístico mais seguro para um NPC (sua casa ou o portão mais próximo).
 * Evita que o NPC corra a esmo à noite e fique preso em geometria.
 */
export function getDeterministicFleeTarget(npc) {
  const obj = npc.isObject3D ? npc : npc.root || npc;
  const anchors = obj?.userData?.anchors;
  if (!anchors) return null;

  const nx = npc.x !== undefined ? npc.x : obj.position.x;
  const nz = npc.z !== undefined ? npc.z : obj.position.z;

  let bestTarget = anchors.home || null;
  let bestDistSq = bestTarget ? (bestTarget.x - nx) ** 2 + (bestTarget.z - nz) ** 2 : Infinity;

  if (Array.isArray(anchors.gates)) {
    for (let i = 0; i < anchors.gates.length; i++) {
      const g = anchors.gates[i];
      const dSq = (g.x - nx) ** 2 + (g.z - nz) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestTarget = g;
      }
    }
  }
  return bestTarget;
}

// ============================================================================
// 3. Spawn de Monstros em Áreas Ermas (O Lobisomem)
// ============================================================================

const WEREWOLF_FLASH = new THREE.Color("#9e3a2b");
const WEREWOLF_ZERO = new THREE.Color("#000000");

export class Werewolf extends NPC {
  constructor(scene, world, effects, combat = null) {
    super(
      scene,
      world,
      "guard",
      [{ x: 0, z: 0 }],
      null,
      {
        name: "Lobisomem da Bruma",
        title: "Fera Noturna",
        skin: "#2b2421",
        cloth: "#1f1916",
        leather: "#1a1512",
        metal: "#3d3530",
        accent: "#d93829",
        hair: "#171210",
        speed: 4.8,
        wait: 0.1,
      },
      effects,
    );
    this.roleKey = "werewolf";
    this.combat = combat;
    this.hostile = true;
    this.temporary = true;
    this.removed = true;
    this.alive = false;
    this.maxHealth = 7;
    this.health = 7;
    this.hitRadius = 0.62;
    this.meleeRange = 2.25;
    this.meleeDamage = 2;
    this.meleeCooldown = 1.05;
    this.attackCooldown = 0;

    // Compatibilidade direta com a interface Three.js do pool (werewolf.visible, werewolf.position, werewolf.userData)
    this.userData = this.root.userData;
    this.position = this.root.position;
    this.userData.isWerewolf = true;
    this.userData.state = "IDLE";
    this.userData.speedMult = 1.35;
    this.root.visible = false;
    this.model.scale.set(-1.26, 1.32, 1.26);
  }

  get visible() {
    return this.root.visible;
  }

  set visible(val) {
    this.root.visible = Boolean(val);
    if (val) {
      this.removed = false;
      this.alive = true;
      this.health = this.maxHealth;
      this.x = this.root.position.x;
      this.z = this.root.position.z;
      this.spawnX = this.x;
      this.spawnZ = this.z;
      this.mode = "hunt";
      this.alerted = true;
      this._hitStun = 0;
      this.deadTime = 0;
      this.root.scale.setScalar(1);
      this.userData.isDead = false;
    } else {
      releaseToken(this);
      this.alive = false;
      this.removed = true;
      this.userData.state = "IDLE";
    }
  }

  _buildModel() {
    const fur = makeSkinnedMaterial("leather", "#221c18", 0, 0.98);
    const darkFur = makeSkinnedMaterial("leather", "#120e0b", 0, 1.0);
    const chestFur = makeSkinnedMaterial("leather", "#362a22", 0, 0.95);
    const clawMat = makeSkinnedMaterial("metal", "#dfd8c8", 0.45, 0.4);
    // Olhos brancos brilhantes, místicos e sobrenaturais
    const eyeMat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
    });
    this.flashMaterials = [fur, darkFur, chestFur, clawMat];

    const body = buildHumanoid(this.model, {
      skin: fur,
      shirt: darkFur,
      sleeve: fur,
      pants: darkFur,
      boots: darkFur,
      hair: darkFur,
      forearm: fur,
    });
    Object.assign(this, body);

    // Crânio lupino esculpido e angular (substitui a cabeça humana e remove a bola gigante)
    while (this.head.children.length > 0) {
      this.head.remove(this.head.children[0]);
    }

    // Crânio canino angular com fronte reforçada
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.28), darkFur);
    skull.position.set(0, 0.04, 0.02);
    this.head.add(skull);

    // Dorso e ombros fortes sem corcunda arredondada desproporcional
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.26, 0.32), darkFur);
    shoulders.position.set(0, 1.38, -0.02);
    this.model.add(shoulders);

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.34), chestFur);
    chestPlate.position.set(0, 1.2, 0.06);
    this.model.add(chestPlate);

    // Focinho afilado lupino
    const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 5), darkFur);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, -0.01, 0.26);
    this.head.add(muzzle);

    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.22), fur);
    lowerJaw.position.set(0, -0.07, 0.22);
    this.head.add(lowerJaw);

    // Presas brancas pontiagudas
    for (const sx of [-0.038, 0.038]) {
      const topFang = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.07, 4), clawMat);
      topFang.position.set(sx, -0.04, 0.29);
      topFang.rotation.x = Math.PI;
      this.head.add(topFang);

      const botFang = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.07, 4), clawMat);
      botFang.position.set(sx, -0.03, 0.31);
      this.head.add(botFang);
    }

    // Orelhas lupinas eretas e pontiagudas
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.19, 4), darkFur);
      ear.position.set(side * 0.09, 0.21, -0.02);
      ear.rotation.z = -side * 0.18;
      ear.rotation.x = -0.15;
      this.head.add(ear);

      // Olhos brancos místicos com brilho etéreo
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), eyeMat);
      eye.position.set(side * 0.055, 0.05, 0.15);
      this.head.add(eye);
    }

    // Garras afiadas nas duas mãos
    for (const forearm of [this.leftForearm, this.rightForearm]) {
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.18, 4), clawMat);
        claw.rotation.x = Math.PI * 0.78;
        claw.position.set(c * 0.038, -0.32, 0.07);
        forearm.add(claw);
      }
    }

    // Cauda lupina espessa
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.65, 5), darkFur);
    tail.position.set(0, 0.78, -0.24);
    tail.rotation.x = -2.25;
    this.model.add(tail);
  }

  update(dt, playerX = 0, playerZ = 0) {
    if (this.removed || !this.root.visible) return;
    if (!this.alive) {
      this._updateDead(dt, playerX, playerZ);
      return;
    }

    this.animTime += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const c = this._flashTimer > 0 ? WEREWOLF_FLASH : WEREWOLF_ZERO;
      const intensity = this._flashTimer > 0 ? 0.7 : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.copy(c);
        this.flashMaterials[i].emissiveIntensity = intensity;
      }
    }

    if (this._hitStun > 0) {
      const stun = this._hitStun / 0.82;
      this._hitStun = Math.max(0, this._hitStun - dt);
      this._knockMove(dt, stun);
      this.root.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);
      return;
    }

    const dx = playerX - this.x;
    const dz = playerZ - this.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);
    const speedMult = this.userData.speedMult || 1.35;
    const baseSpeed = 4.2 * speedMult; // ~5.67 m/s (mais rápido que lobos e guardas)

    // Barreira Mística da Cidade: O lobisomem é banido pelo solo sagrado e muralhas da cidade
    let repulseX = 0;
    let repulseZ = 0;
    let repulseForce = 0;
    if (_procEnv.activeCities) {
      for (const city of _procEnv.activeCities.values()) {
        if (!city || !city.center) continue;
        const cdx = this.x - city.center.x;
        const cdz = this.z - city.center.z;
        const cDist = Math.hypot(cdx, cdz);
        const barrierDist = city.radius + 18.0;
        if (cDist < barrierDist) {
          const push = Math.max(0, (barrierDist - cDist) / 18.0);
          repulseX += (cdx / Math.max(0.001, cDist)) * push;
          repulseZ += (cdz / Math.max(0.001, cDist)) * push;
          repulseForce += push;
        }
      }
    }

    // Calcula direção de perseguição/cerco
    const think = meleeThink(this, dt, playerX, playerZ);
    let moveDirX = 0;
    let moveDirZ = 0;
    let moveSpeed = 0;

    if (repulseForce > 0.05) {
      // Repelido pela fronteira da cidade: não entra de forma alguma
      const rLen = Math.hypot(repulseX, repulseZ);
      moveDirX = repulseX / Math.max(0.001, rLen);
      moveDirZ = repulseZ / Math.max(0.001, rLen);
      moveSpeed = baseSpeed * 0.95;
    } else {
      moveDirX = dist > 2.0 ? dx / Math.max(dist, 0.001) : think.mx;
      moveDirZ = dist > 2.0 ? dz / Math.max(dist, 0.001) : think.mz;
      moveSpeed = (dist > 2.0 ? 1.0 : think.speed) * baseSpeed;
    }

    const mLen = Math.hypot(moveDirX, moveDirZ);
    if (mLen > 0.001 && moveSpeed > 0.05) {
      const stepX = moveDirX / mLen;
      const stepZ = moveDirZ / mLen;
      this._stepTowards(stepX, stepZ, moveSpeed * dt);
      this.walkPhase += dt * (moveSpeed * 2.8);

      // Orientação corporal correta: vira o corpo para a DIREÇÃO DO MOVIMENTO (evita deslizar de lado)
      const moveYaw = Math.atan2(stepX, stepZ);
      const diffYaw = Math.atan2(Math.sin(moveYaw - this.model.rotation.y), Math.cos(moveYaw - this.model.rotation.y));
      this.model.rotation.y += diffYaw * (1 - Math.exp(-18 * dt));
    } else {
      // Quando parado perto do alvo, encara o jogador de frente
      const targetYaw = Math.atan2(dx, dz);
      const diffYaw = Math.atan2(Math.sin(targetYaw - this.model.rotation.y), Math.cos(targetYaw - this.model.rotation.y));
      this.model.rotation.y += diffYaw * (1 - Math.exp(-14 * dt));
    }

    const ground = this.world.heightAt(this.x, this.z);
    this.root.position.set(this.x, ground, this.z);

    const isMoving = mLen > 0.001 && moveSpeed > 0.1;
    const stride = isMoving ? Math.sin(this.walkPhase) * 0.92 : 0;
    this.leftLeg.rotation.x = stride;
    this.rightLeg.rotation.x = -stride;
    bendJoints(this, stride, stride);
    this.model.rotation.x = 0.32; // Postura predadora curvada para a frente
    this.leftArm.rotation.x = -0.75 - stride * 0.55;
    this.rightArm.rotation.x = -0.75 + stride * 0.55;

    if (this.meleeWind > 0) {
      this.rightArm.rotation.x = -2.1 * this.meleeWind;
      this.leftArm.rotation.x = -1.9 * this.meleeWind;
    }
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const slash = Math.sin((1 - this.swingTimer / 0.3) * Math.PI);
      this.rightArm.rotation.x = -2.2 + slash * 2.6;
      this.leftArm.rotation.x = -2.0 + slash * 2.4;
    }
    this.task = repulseForce > 0.05 ? "Banido pela proteção da cidade" : "Caçando na escuridão";
  }
}

export function createMonstersPool(scene, world, npcSystem, effects, combat, count = 2) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    const ww = new Werewolf(scene, world, effects, combat);
    ww.npcSystem = npcSystem;
    pool.push(ww);
    if (npcSystem && Array.isArray(npcSystem.npcs)) {
      npcSystem.npcs.push(ww);
    }
  }
  return pool;
}

/**
 * Avalia spawn e despawn de ameaças (Lobisomem) fora das cidades.
 * @param {THREE.Vector3|{x:number,y?:number,z:number}} playerPos
 * @param {object} cityData - { center: THREE.Vector3, radius: number }
 * @param {boolean} isNight
 * @param {Array} monstersPool
 * @param {number} [dt=0.016]
 */
export function updateWildernessSpawns(playerPos, cityData, isNight, monstersPool, dt = 0.016) {
  if (!playerPos || !cityData || !Array.isArray(monstersPool)) return;
  _tempVec.set(playerPos.x ?? 0, playerPos.y ?? 0, playerPos.z ?? 0);

  // Distância ao quadrado do jogador até o centro da cidade principal ou de qualquer cidade regional ativa
  let minDistToCitySq = _tempVec.distanceToSquared(cityData.center);
  let wallDistSq = cityData.radius * cityData.radius;
  if (_procEnv.activeCities) {
    for (const c of _procEnv.activeCities.values()) {
      if (!c || !c.center) continue;
      const dSq = (_tempVec.x - c.center.x) ** 2 + (_tempVec.z - c.center.z) ** 2;
      if (dSq < minDistToCitySq) {
        minDistToCitySq = dSq;
        wallDistSq = c.radius * c.radius;
      }
    }
  }
  const insideSafeZone = minDistToCitySq < wallDistSq + 400;

  // Edge Case: Despawn imediato do Lobisomem no amanhecer (!isNight) ou se o jogador cruzar os portões da muralha
  if (!isNight || minDistToCitySq < wallDistSq) {
    for (let i = 0; i < monstersPool.length; i++) {
      const m = monstersPool[i];
      if (m.visible) {
        m.visible = false;
      }
    }
    return;
  }

  // Se estiver dentro da cidade ou perto da luz da muralha, não spawna novos monstros
  if (insideSafeZone) return;

  // Também evita spawnar dentro do perímetro iluminado das vilas secundárias
  for (let i = 0; i < VILLAGES.length; i++) {
    const v = VILLAGES[i];
    const vdx = _tempVec.x - v.x;
    const vdz = _tempVec.z - v.z;
    if (vdx * vdx + vdz * vdz < 38 * 38) return;
  }

  // Rate-limiting do trigger (~1 avaliação por segundo ou gatilho probabilístico do frame)
  _wildernessTimer += dt;
  if (_wildernessTimer < 0.85 && Math.random() >= 0.02) return;
  _wildernessTimer = 0;

  if (Math.random() < CHANCE_WEREWOLF) {
    const werewolf = monstersPool.find((m) => !m.visible);
    if (werewolf) {
      // Spawna na distância cega (45m) ao redor do jogador
      const angle = Math.random() * Math.PI * 2;
      const sx = _tempVec.x + Math.cos(angle) * SPAWN_DISTANCE;
      const sz = _tempVec.z + Math.sin(angle) * SPAWN_DISTANCE;
      const sy = werewolf.world ? werewolf.world.heightAt(sx, sz) : _tempVec.y;

      _spawnPos.set(sx, sy, sz);
      werewolf.position.copy(_spawnPos);
      werewolf.visible = true;
      werewolf.userData.state = "HUNTING_PLAYER";
      werewolf.userData.speedMult = 1.35; // Mais rápido que lobos/guardas
      werewolf.npcSystem?.onAlert?.("Um uivo ecoa na escuridão… um Lobisomem farejou seu rastro!");
    }
  }
}
