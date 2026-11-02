import * as THREE from "three";
import { createSeededRandom } from "./procedural.js";
import { PlayerInventory, PlayerStats } from "./rpg.js";
import { createIrregularBloodGeometry } from "./farmAnimals.js";

// ============================================================================
// Cidades Fantasma Procedurais: Ruínas de Guerra, Escombros e Sangue Seco
// ============================================================================

const GHOST_TOWN_NAMES = [
  "Ruínas de Norvânia",
  "Aldeia Devastada de Cairn",
  "Fortaleza Caída de Valdor",
  "Povoado Silencioso de Oakhaven",
  "Bastião Sangrento de Kren",
  "Vila Arruinada de Corvos",
  "Necrópole Deserta de Morvath",
];

// Cidades Fantasma distribuídas em anéis intermediários e distantes (150m a 350m)
export const FIXED_GHOST_TOWNS = [
  // Cidades intermediárias (mais fáceis de achar durante exploração dos ermos)
  { name: GHOST_TOWN_NAMES[4], x: -165, z: 125, seed: 55102, radius: 46 },
  { name: GHOST_TOWN_NAMES[5], x: 175, z: -140, seed: 44208, radius: 48 },
  { name: GHOST_TOWN_NAMES[6], x: -120, z: -180, seed: 33405, radius: 45 },
  // Cidades distantes nos confins do mapa
  { name: GHOST_TOWN_NAMES[0], x: -280, z: -310, seed: 77101, radius: 52 },
  { name: GHOST_TOWN_NAMES[1], x: 320, z: -270, seed: 88203, radius: 50 },
  { name: GHOST_TOWN_NAMES[2], x: -330, z: 290, seed: 99307, radius: 55 },
  { name: GHOST_TOWN_NAMES[3], x: 290, z: 350, seed: 66409, radius: 52 },
];

export const ActiveGhostTowns = [];
export const ActiveGhostHouses = [];

let _ghostMaterials = null;
function getGhostTownMaterials() {
  if (_ghostMaterials) return _ghostMaterials;

  _ghostMaterials = {
    // Alvenaria de pedra envelhecida, manchada de fuligem e poeira
    stone: new THREE.MeshStandardMaterial({
      color: 0x585650,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    }),
    stoneDark: new THREE.MeshStandardMaterial({
      color: 0x3e3c38,
      roughness: 0.98,
      metalness: 0.05,
      flatShading: true,
    }),
    // Madeira carcomida, ressequida e queimada
    timberBurned: new THREE.MeshStandardMaterial({
      color: 0x241a12,
      roughness: 0.96,
      flatShading: true,
    }),
    timberWeathered: new THREE.MeshStandardMaterial({
      color: 0x3d3024,
      roughness: 0.92,
      flatShading: true,
    }),
    // Telhas quebradas e musgo seco
    roofRuin: new THREE.MeshStandardMaterial({
      color: 0x42261c,
      roughness: 0.94,
      flatShading: true,
    }),
    // Reboco descascado e manchado
    plasterOld: new THREE.MeshStandardMaterial({
      color: 0x9e937d,
      roughness: 0.95,
      flatShading: true,
    }),
    // Marcas de sangue seco coagulado e espirrado
    bloodDried: new THREE.MeshStandardMaterial({
      color: 0x5e080e,
      roughness: 0.82,
      metalness: 0.1,
      flatShading: true,
    }),
    bloodSplatter: new THREE.MeshBasicMaterial({
      color: 0x4a050a,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
    // Crânios e ossadas antigas
    bone: new THREE.MeshStandardMaterial({
      color: 0xd2c6a5,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    }),
    // Lâminas de ferro quebradas e enferrujadas
    rustedIron: new THREE.MeshStandardMaterial({
      color: 0x4a3c36,
      roughness: 0.75,
      metalness: 0.45,
      flatShading: true,
    }),
    // Flechas: haste de freixo e penas pretas
    arrowWood: new THREE.MeshStandardMaterial({
      color: 0x6e5238,
      roughness: 0.9,
    }),
    arrowFletching: new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
    }),
  };
  return _ghostMaterials;
}

// ----------------------------------------------------------------------------
// Modelos de Detritos de Guerra: Crânios, Flechas, Espadas Quebradas e Sangue
// ----------------------------------------------------------------------------

/**
 * Constrói um crânio humano estilizado e ossos cruzados no solo.
 */
function buildSkullMesh(mats, random) {
  const group = new THREE.Group();
  group.name = "WarSkull";

  // Calota craniana
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mats.bone);
  cranium.scale.set(1.0, 0.95, 1.15);
  cranium.position.y = 0.18;
  cranium.castShadow = true;
  group.add(cranium);

  // Maxilar / mandíbula
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), mats.bone);
  jaw.position.set(0, 0.08, 0.12);
  group.add(jaw);

  // Órbitas oculares vazias
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x050403 });
  for (const ex of [-0.06, 0.06]) {
    const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.03), eyeMat);
    eyeSocket.position.set(ex, 0.17, 0.2);
    group.add(eyeSocket);
  }

  // Fêmur / osso quebrado ao lado
  if (random() < 0.65) {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 5), mats.bone);
    bone.rotation.z = Math.PI / 2 + (random() - 0.5) * 0.4;
    bone.rotation.y = random() * Math.PI;
    bone.position.set((random() - 0.5) * 0.35, 0.03, (random() - 0.5) * 0.35);
    group.add(bone);
  }

  return group;
}

/**
 * Constrói uma espada de ferro quebrada fincada no chão ou caída.
 */
function buildBrokenSwordMesh(mats, random) {
  const group = new THREE.Group();
  group.name = "BrokenSword";

  const isStuck = random() < 0.55; // 55% de chance de estar fincada no solo

  // Cabo e guarda de ferro forjado
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mats.rustedIron);
  pommel.position.y = 0.55;
  group.add(pommel);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.18, 5), mats.timberBurned);
  grip.position.y = 0.45;
  group.add(grip);

  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.04), mats.rustedIron);
  crossguard.position.y = 0.35;
  group.add(crossguard);

  // Lâmina quebrada com ponta chanfrada
  const bladeLen = 0.32 + random() * 0.28;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.065, bladeLen, 0.018), mats.rustedIron);
  blade.position.y = 0.35 - bladeLen * 0.5;
  blade.castShadow = true;
  group.add(blade);

  if (isStuck) {
    // Fincada com inclinação de 15 a 30 graus
    group.rotation.x = (random() - 0.5) * 0.45;
    group.rotation.z = (random() - 0.5) * 0.45;
    group.position.y -= 0.15;
  } else {
    // Caída no chão
    group.rotation.x = Math.PI * 0.48;
    group.rotation.z = random() * Math.PI * 2;
    group.position.y += 0.04;
  }

  return group;
}

/**
 * Constrói flechas cravadas (em paredes ou chão).
 */
function buildStuckArrowsGroup(mats, count = 3, random) {
  const group = new THREE.Group();
  group.name = "StuckArrows";

  for (let i = 0; i < count; i++) {
    const arrow = new THREE.Group();
    const shaftLen = 0.75 + random() * 0.2;

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, shaftLen, 4), mats.arrowWood);
    shaft.position.y = shaftLen * 0.5;
    arrow.add(shaft);

    // Penas traseiras da flecha
    for (let p = 0; p < 3; p++) {
      const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.005), mats.arrowFletching);
      fletch.position.set(0, shaftLen - 0.08, 0);
      fletch.rotation.y = (p / 3) * Math.PI * 2;
      arrow.add(fletch);
    }

    arrow.position.set((random() - 0.5) * 0.8, (random() - 0.5) * 0.4, (random() - 0.5) * 0.2);
    // Inclinação variada como cravada em combate
    arrow.rotation.x = Math.PI * 0.35 + (random() - 0.5) * 0.35;
    arrow.rotation.y = random() * Math.PI * 2;
    arrow.rotation.z = (random() - 0.5) * 0.25;

    group.add(arrow);
  }
  return group;
}

/**
 * Constrói decalque de poça de sangue seco orgânico irregular ou respingo na parede.
 */
function buildBloodStainMesh(mats, width = 1.4, length = 1.6, isWall = false) {
  let geom;
  if (isWall) {
    geom = new THREE.PlaneGeometry(width, length);
  } else {
    // Poça orgânica irregular no solo (sem círculos nem planos perfeitos)
    const baseRadius = (width + length) * 0.28;
    geom = createIrregularBloodGeometry(baseRadius, Math.random() * 200);
  }
  const mesh = new THREE.Mesh(geom, mats.bloodSplatter);
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * Desenha a Marca Herética do Demiurgo (Olho Minimalista em Sangue na Parede).
 */
function buildHereticBloodEyeMesh(mats, size = 1.35) {
  const group = new THREE.Group();
  group.name = "HereticBloodEye";
  const eyeMat = mats.bloodDried;

  // 1. Arco superior da amêndoa do olho
  const arcTopGeo = new THREE.CylinderGeometry(0.04, 0.04, size * 0.75, 4);
  arcTopGeo.rotateZ(Math.PI / 4.5);
  const arcTopLeft = new THREE.Mesh(arcTopGeo, eyeMat);
  arcTopLeft.position.set(-size * 0.24, size * 0.16, 0);
  group.add(arcTopLeft);

  const arcTopRight = new THREE.Mesh(arcTopGeo.clone(), eyeMat);
  arcTopRight.rotation.z = -Math.PI / 4.5;
  arcTopRight.position.set(size * 0.24, size * 0.16, 0);
  group.add(arcTopRight);

  // 2. Arco inferior da amêndoa do olho
  const arcBotGeo = new THREE.CylinderGeometry(0.04, 0.04, size * 0.75, 4);
  arcBotGeo.rotateZ(-Math.PI / 4.5);
  const arcBotLeft = new THREE.Mesh(arcBotGeo, eyeMat);
  arcBotLeft.position.set(-size * 0.24, -size * 0.16, 0);
  group.add(arcBotLeft);

  const arcBotRight = new THREE.Mesh(arcBotGeo.clone(), eyeMat);
  arcBotRight.rotation.z = Math.PI / 4.5;
  arcBotRight.position.set(size * 0.24, -size * 0.16, 0);
  group.add(arcBotRight);

  // 3. Fenda / pupila vertical mística central
  const pupilGeo = new THREE.BoxGeometry(0.07, size * 0.58, 0.04);
  const pupil = new THREE.Mesh(pupilGeo, eyeMat);
  pupil.position.set(0, 0, 0.02);
  group.add(pupil);

  // 4. Filetes e gotas de sangue escorrendo da pálpebra inferior
  const drip1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, size * 0.7, 0.03), eyeMat);
  drip1.position.set(0, -size * 0.52, 0.015);
  group.add(drip1);

  const drip2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, size * 0.38, 0.03), eyeMat);
  drip2.position.set(size * 0.2, -size * 0.36, 0.015);
  group.add(drip2);

  return group;
}

// ----------------------------------------------------------------------------
// Modelos de Casas Fantasma em Ruínas
// ----------------------------------------------------------------------------

/**
 * Constrói uma casa medieval arruinada: vazia, sem tochas, com telhado partido,
 * vigas queimadas expostas, flechas cravadas e marcas de sangue.
 */
function buildRuinedHouseMesh(mats, random, isDestroyed = false, hasBloodEye = false) {
  const group = new THREE.Group();
  group.name = isDestroyed ? "DestroyedHouseRuin" : "AbandonedHouse";

  const w = 5.2;
  const d = 4.4;
  const h = 3.2;

  // 1. Fundação de pedra arruinada profunda (desce 2.4m na terra para nunca flutuar em relevo inclinado)
  const foundationDepth = 2.4;
  const found = new THREE.Mesh(new THREE.BoxGeometry(w + 0.45, foundationDepth, d + 0.45), mats.stoneDark);
  found.position.y = -foundationDepth * 0.5 + 0.35;
  found.castShadow = true;
  found.receiveShadow = true;
  group.add(found);

  // Piso interno de madeira carcomida / fuligem
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.14, d - 0.1), mats.timberBurned);
  floor.position.y = 0.38;
  floor.receiveShadow = true;
  group.add(floor);

  // 2. Paredes de enxaimel descascadas e enegrecidas
  // Parede Traseira (-Z)
  const backH = isDestroyed ? h * 0.6 : h;
  const backW = new THREE.Mesh(new THREE.BoxGeometry(w, backH, 0.24), mats.plasterOld);
  backW.position.set(0, 0.5 + backH * 0.5, -d * 0.5);
  backW.castShadow = true;
  group.add(backW);

  // Parede Esquerda (-X)
  const leftH = isDestroyed ? h * 0.45 : h;
  const leftW = new THREE.Mesh(new THREE.BoxGeometry(0.24, leftH, d), mats.plasterOld);
  leftW.position.set(-w * 0.5, 0.5 + leftH * 0.5, 0);
  leftW.castShadow = true;
  group.add(leftW);

  // Parede Direita (+X)
  const rightH = isDestroyed ? h * 0.75 : h;
  const rightW = new THREE.Mesh(new THREE.BoxGeometry(0.24, rightH, d), mats.plasterOld);
  rightW.position.set(w * 0.5, 0.5 + rightH * 0.5, 0);
  rightW.castShadow = true;
  group.add(rightW);

  // Fachada Frontal com vão de porta arrombada (+Z)
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, h, 0.24), mats.plasterOld);
  frontL.position.set(-w * 0.34, 0.5 + h * 0.5, d * 0.5);
  frontL.castShadow = true;
  group.add(frontL);

  const frontR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, h, 0.24), mats.plasterOld);
  frontR.position.set(w * 0.34, 0.5 + h * 0.5, d * 0.5);
  frontR.castShadow = true;
  group.add(frontR);

  // Dintel da porta arrombada
  const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(w * 0.36, 0.6, 0.26), mats.timberBurned);
  doorHeader.position.set(0, h + 0.2, d * 0.5);
  group.add(doorHeader);

  // 3. Vigamento de canto queimado
  for (const cx of [-w * 0.5, w * 0.5]) {
    for (const cz of [-d * 0.5, d * 0.5]) {
      const postH = isDestroyed ? h * (0.5 + random() * 0.4) : h + 0.3;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, postH, 0.28), mats.timberBurned);
      post.position.set(cx, 0.5 + postH * 0.5, cz);
      group.add(post);
    }
  }

  // 4. Telhado de Duas Águas Partido / Desabado
  if (!isDestroyed) {
    // Telhado com buracos e tábuas queimadas
    const roofHalfL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.58, 0.16, d + 0.5), mats.roofRuin);
    roofHalfL.position.set(-w * 0.26, h + 1.25, 0);
    roofHalfL.rotation.z = 0.52;
    roofHalfL.castShadow = true;
    group.add(roofHalfL);

    // Lado direito parcialmente desabado
    const roofHalfR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.36, 0.16, d * 0.65), mats.roofRuin);
    roofHalfR.position.set(w * 0.22, h + 1.0, -d * 0.15);
    roofHalfR.rotation.z = -0.52;
    roofHalfR.castShadow = true;
    group.add(roofHalfR);
  } else {
    // Casa destruída: vigas caídas atravessadas no interior
    for (let b = 0; b < 3; b++) {
      const fallenBeam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, d * 0.8), mats.timberBurned);
      fallenBeam.position.set((b - 1) * 1.3, 0.6 + b * 0.25, 0);
      fallenBeam.rotation.set((random() - 0.5) * 0.4, (random() - 0.5) * 0.8, (random() - 0.5) * 0.5);
      fallenBeam.castShadow = true;
      group.add(fallenBeam);
    }
  }

  // 5. Marcas de Sangue e Flechas na Fachada Frontal e Paredes
  // Mancha de sangue na parede ou Olho Minimalista do Demiurgo
  if (hasBloodEye) {
    const hereticEye = buildHereticBloodEyeMesh(mats, 1.4);
    hereticEye.position.set(-w * 0.34, 1.85, d * 0.5 + 0.15);
    group.add(hereticEye);
  } else {
    const bloodWall = buildBloodStainMesh(mats, 1.1, 1.4, true);
    bloodWall.position.set(-w * 0.34, 1.8, d * 0.5 + 0.14);
    group.add(bloodWall);
  }

  // Flechas cravadas na fachada da casa
  const stuckWallArrows = buildStuckArrowsGroup(mats, 2 + Math.floor(random() * 3), random);
  stuckWallArrows.position.set(w * 0.32, 1.7, d * 0.5 + 0.12);
  group.add(stuckWallArrows);

  // Sangue orgânico irregular no chão da entrada
  const bloodFloor = buildBloodStainMesh(mats, 1.5, 1.8, false);
  bloodFloor.position.set(0, 0.52, d * 0.5 + 0.7);
  group.add(bloodFloor);

  // Crânio caído na porta
  if (random() < 0.75) {
    const skull = buildSkullMesh(mats, random);
    skull.position.set(0.6 + (random() - 0.5) * 0.5, 0.5, d * 0.5 + 0.8);
    skull.rotation.y = random() * Math.PI * 2;
    group.add(skull);
  }

  // Espada quebrada na soleira
  if (random() < 0.6) {
    const brokenSword = buildBrokenSwordMesh(mats, random);
    brokenSword.position.set(-0.7, 0.5, d * 0.5 + 0.6);
    group.add(brokenSword);
  }

  // 6. Baú de Despojos no interior da casa abandonada (explorável)
  const chestGroup = new THREE.Group();
  chestGroup.name = "AbandonedHouseChest";
  const chestBase = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.44, 0.55), mats.timberBurned);
  chestBase.position.y = 0.22;
  chestBase.castShadow = true;
  chestGroup.add(chestBase);

  const chestLid = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.12, 0.58), mats.rustedIron);
  chestLid.position.set(0, 0.46, -0.12);
  chestLid.rotation.x = -0.52; // tampa entreaberta
  chestGroup.add(chestLid);

  chestGroup.position.set(-w * 0.26, 0.38, -d * 0.22);
  group.add(chestGroup);

  group.userData = {
    isGhostHouse: true,
    isDestroyed,
    hasBloodEye,
    width: w,
    depth: d,
    height: h,
  };

  return group;
}

// ----------------------------------------------------------------------------
// Geração Completa de uma Cidade Fantasma (Ghost Town)
// ----------------------------------------------------------------------------

/**
 * Gera uma Cidade Fantasma completa com muralhas arruinadas, brechas, casas destruídas,
 * crânios, espadas quebradas, marcas de sangue e flechas cravadas.
 * @param {object} townConfig - { name, x, z, seed, radius }
 * @param {THREE.Scene} scene
 * @param {object} world
 */
export function generateGhostTown(townConfig, scene, world) {
  if (!scene) return null;

  const { name, x: cx, z: cz, seed, radius = 52 } = townConfig;
  const random = createSeededRandom(seed);
  const mats = getGhostTownMaterials();

  const townRoot = new THREE.Group();
  townRoot.name = `GhostTown_${name.replace(/\s+/g, "_")}`;

  const centerY = world ? world.heightAt(cx, cz) : 0;
  // townRoot fica em (0, 0, 0) para que todas as coordenadas (wx, groundY, wz) fiquem rigorosamente
  // alinhadas com o relevo global onde heightAt foi avaliado, eliminando flutuações e objetos enterrados.
  townRoot.position.set(0, 0, 0);

  const placedBounds = [];

  // --------------------------------------------------------------------------
  // 1. Muralha Arruinada com Brechas de Guerra
  // --------------------------------------------------------------------------
  const wallCount = 28;
  const angleStep = (Math.PI * 2) / wallCount;
  const segLen = (2 * Math.PI * radius) / wallCount + 0.45;

  for (let i = 0; i < wallCount; i++) {
    const angle = i * angleStep;
    const wx = cx + Math.cos(angle) * radius;
    const wz = cz + Math.sin(angle) * radius;
    const groundY = world ? world.heightAt(wx, wz) : 0;

    // 25% dos segmentos de muralha foram arrombados/explodidos na guerra
    const isBreach = random() < 0.28;
    const isLowRuin = random() < 0.35;

    const wallH = isBreach ? 0.9 : isLowRuin ? 2.8 + random() * 1.2 : 5.8;
    const wallThick = 2.0;
    const wallSubDepth = 2.4; // Afunda 2.4m na terra para nunca flutuar em encostas

    if (!isBreach) {
      const segMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wallThick, wallH + wallSubDepth, segLen),
        random() < 0.5 ? mats.stone : mats.stoneDark,
      );
      segMesh.position.set(wx, groundY + wallH * 0.5 - wallSubDepth * 0.5, wz);
      segMesh.rotation.y = -angle;
      segMesh.castShadow = true;
      segMesh.receiveShadow = true;
      townRoot.add(segMesh);

      // Flechas cravadas na muralha
      if (random() < 0.45) {
        const wallArrows = buildStuckArrowsGroup(mats, 2 + Math.floor(random() * 3), random);
        wallArrows.position.set(wx, groundY + 1.8 + random() * 1.5, wz);
        wallArrows.rotation.y = -angle;
        townRoot.add(wallArrows);
      }

      // Marcas de sangue na muralha
      if (random() < 0.4) {
        const blood = buildBloodStainMesh(mats, 1.2, 1.6, true);
        blood.position.set(wx, groundY + 1.6, wz);
        blood.rotation.y = -angle;
        townRoot.add(blood);
      }

      // Colisão no mundo físico
      if (world?.addOrientedBox) {
        world.addOrientedBox(wx, wz, wallThick, segLen, -angle, groundY - 1.0, groundY + wallH, {
          move: true,
          shot: true,
          cam: true,
        });
      }
    } else {
      // Brecha com pedregulhos caídos no chão
      for (let r = 0; r < 4; r++) {
        const rubble = new THREE.Mesh(
          new THREE.BoxGeometry(0.8 + random() * 0.6, 0.6 + random() * 0.4, 0.7 + random() * 0.5),
          mats.stoneDark,
        );
        rubble.position.set(
          wx + (random() - 0.5) * 2.2,
          groundY + 0.3,
          wz + (random() - 0.5) * 2.2,
        );
        rubble.rotation.set(random() * 0.4, random() * Math.PI, random() * 0.4);
        rubble.castShadow = true;
        townRoot.add(rubble);
      }

      // Crânio caído entre os escombros da brecha
      if (random() < 0.7) {
        const skull = buildSkullMesh(mats, random);
        skull.position.set(wx + (random() - 0.5) * 1.8, groundY, wz + (random() - 0.5) * 1.8);
        townRoot.add(skull);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Casas Fantasma e Construções Destruídas no Interior
  // --------------------------------------------------------------------------
  const houseCount = 9 + Math.floor(random() * 5); // 9 a 13 casas por vila fantasma
  for (let h = 0; h < houseCount; h++) {
    let bx = 0, bz = 0;
    let found = false;

    for (let attempt = 0; attempt < 18; attempt++) {
      const dist = 12 + random() * (radius - 24);
      const ang = random() * Math.PI * 2;
      bx = cx + Math.cos(ang) * dist;
      bz = cz + Math.sin(ang) * dist;

      // Evita sobrepor construções
      let collides = false;
      for (let p = 0; p < placedBounds.length; p++) {
        const pb = placedBounds[p];
        const dSq = (bx - pb.x) ** 2 + (bz - pb.z) ** 2;
        if (dSq < (pb.r + 3.8) ** 2) {
          collides = true;
          break;
        }
      }
      if (!collides) {
        found = true;
        break;
      }
    }

    if (!found) continue;

    placedBounds.push({ x: bx, z: bz, r: 3.5 });

    const by = world ? world.heightAt(bx, bz) : centerY;
    const isDestroyed = random() < 0.42; // ~42% das casas estão completamente arruinadas
    const hasBloodEye = (h === 0); // Casa de destaque porta a Marca Herética do Olho Sangrento do Demiurgo
    const house = buildRuinedHouseMesh(mats, random, isDestroyed, hasBloodEye);

    const houseYaw = random() * Math.PI * 2;
    house.position.set(bx, by, bz);
    house.rotation.y = houseYaw;
    townRoot.add(house);

    // Registra colisão no mundo físico:
    // Decompõe as paredes individuais mantendo o vão da porta arrombada completamente livre para o jogador entrar
    if (world?.addOrientedBox) {
      const top = by + (isDestroyed ? 2.4 : 3.6);
      const bottom = by - 0.5;
      const cosY = Math.cos(houseYaw);
      const sinY = Math.sin(houseYaw);

      // Parede Traseira (z = -2.2)
      world.addOrientedBox(bx + sinY * 2.2, bz + cosY * 2.2, 5.2, 0.35, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: true,
      });
      // Parede Esquerda (x = -2.6)
      world.addOrientedBox(bx - cosY * 2.6, bz + sinY * 2.6, 0.35, 4.4, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: true,
      });
      // Parede Direita (x = 2.6)
      world.addOrientedBox(bx + cosY * 2.6, bz - sinY * 2.6, 0.35, 4.4, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: true,
      });
      // Fachada Frontal Esquerda (x = -1.77, z = 2.2)
      world.addOrientedBox(bx - cosY * 1.77 - sinY * 2.2, bz + sinY * 1.77 - cosY * 2.2, 1.66, 0.35, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: true,
      });
      // Fachada Frontal Direita (x = 1.77, z = 2.2)
      world.addOrientedBox(bx + cosY * 1.77 - sinY * 2.2, bz - sinY * 1.77 - cosY * 2.2, 1.66, 0.35, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: true,
      });
      // O vão frontal central de 1.88m fica livre para permitir acesso ao interior da casa
    }

    if (world?.addFloor) {
      world.addFloor(bx, by + 0.38, bz, 5.0, 4.2, houseYaw);
    }

    // Registra a casa na lista de locais exploráveis com despojos
    const houseLoot = {
      townName: name,
      id: `gh_${name.replace(/\s+/g, "_")}_${h}`,
      x: bx,
      y: by,
      z: bz,
      hasBloodEye,
      isDestroyed,
      looted: false,
    };
    ActiveGhostHouses.push(houseLoot);
  }

  // --------------------------------------------------------------------------
  // 3. Praça Central Arruinada: Espadas Quebradas, Crânios e Poças de Sangue
  // --------------------------------------------------------------------------
  const plazaCount = 8;
  for (let s = 0; s < plazaCount; s++) {
    const ang = (s / plazaCount) * Math.PI * 2 + (random() - 0.5) * 0.4;
    const dist = 3.5 + random() * 10;
    const px = cx + Math.cos(ang) * dist;
    const pz = cz + Math.sin(ang) * dist;
    const py = world ? world.heightAt(px, pz) : centerY;

    // Poça de sangue seco no chão da praça
    if (random() < 0.75) {
      const blood = buildBloodStainMesh(mats, 1.8 + random() * 1.2, 1.8 + random() * 1.2, false);
      blood.position.set(px, py + 0.03, pz);
      blood.rotation.z = random() * Math.PI * 2;
      townRoot.add(blood);
    }

    // Crânio humano no chão
    if (random() < 0.7) {
      const skull = buildSkullMesh(mats, random);
      skull.position.set(px + (random() - 0.5) * 1.2, py, pz + (random() - 0.5) * 1.2);
      skull.rotation.y = random() * Math.PI * 2;
      townRoot.add(skull);
    }

    // Espada quebrada fincada ou caída
    if (random() < 0.65) {
      const sword = buildBrokenSwordMesh(mats, random);
      sword.position.set(px + (random() - 0.5) * 1.4, py, pz + (random() - 0.5) * 1.4);
      townRoot.add(sword);
    }

    // Flechas caídas no chão da praça
    if (random() < 0.5) {
      const groundArrows = buildStuckArrowsGroup(mats, 2 + Math.floor(random() * 2), random);
      groundArrows.position.set(px + (random() - 0.5) * 1.5, py + 0.05, pz + (random() - 0.5) * 1.5);
      townRoot.add(groundArrows);
    }
  }

  scene.add(townRoot);

  const townData = {
    name,
    center: new THREE.Vector3(cx, centerY, cz),
    radius,
    root: townRoot,
    visited: false,
  };

  ActiveGhostTowns.push(townData);
  return townData;
}

/**
 * Inicializa todas as Cidades Fantasma fixas nos arredores da vila principal.
 */
export function initFixedGhostTowns(scene, world) {
  if (!scene || ActiveGhostTowns.length > 0) return ActiveGhostTowns;

  for (let i = 0; i < FIXED_GHOST_TOWNS.length; i++) {
    const config = FIXED_GHOST_TOWNS[i];
    generateGhostTown(config, scene, world);
  }

  return ActiveGhostTowns;
}

let _atmosphereTimer = 0;

/**
 * Atualiza checagem de proximidade e atmosfera de Cidades Fantasma para o jogador.
 * Otimizado com throttle de 0.25s para aliviar o loop de renderização a 60 FPS.
 */
export function updateGhostTownAtmosphere(playerPos, ui, dt = 0.5) {
  if (!playerPos || ActiveGhostTowns.length === 0) return;

  _atmosphereTimer += dt;
  if (_atmosphereTimer < 0.25) return;
  _atmosphereTimer = 0;

  const px = playerPos.x ?? 0;
  const pz = playerPos.z ?? 0;

  for (let i = 0; i < ActiveGhostTowns.length; i++) {
    const town = ActiveGhostTowns[i];
    const dSq = (px - town.center.x) ** 2 + (pz - town.center.z) ** 2;

    if (dSq < town.radius * town.radius) {
      if (!town.visited) {
        town.visited = true;
        ui?.showToast?.(`✦ Entraste nas ${town.name} · Uma cidade fantasma devastada pela guerra.`);
      }
    } else if (dSq > (town.radius + 40) ** 2) {
      // Saiu da cidade fantasma
      if (town.visited) {
        town.visited = false;
      }
    }
  }
}

/**
 * Checa se o jogador está na praça central de uma cidade fantasma para vasculhar os escombros.
 */
export function checkGhostTownRubbleNearby(playerPos) {
  if (!playerPos || ActiveGhostTowns.length === 0) return null;
  const px = playerPos.x ?? 0;
  const pz = playerPos.z ?? 0;
  for (let i = 0; i < ActiveGhostTowns.length; i++) {
    const town = ActiveGhostTowns[i];
    const dx = px - town.center.x;
    const dz = pz - town.center.z;
    if (dx * dx + dz * dz < 16.0 * 16.0) {
      return town;
    }
  }
  return null;
}

/**
 * Vasculha os escombros e lajes da praça da cidade fantasma em busca de códices e páginas perdidas.
 */
export function searchGhostTownRubble(town, ui, audio) {
  if (!town) return false;
  if (town.lastSearched && performance.now() - town.lastSearched < 25000) {
    ui?.showToast?.(`✦ Os escombros de ${town.name} já foram revirados recentemente.`);
    return true;
  }
  town.lastSearched = performance.now();
  if (audio?.bookPage) audio.bookPage();

  const missingPages = [7, 11, 16, 19, 21].filter((p) => !PlayerInventory.discoveredBookPages.includes(p));
  if (!PlayerInventory.hasDemiurgeDiary) {
    PlayerInventory.hasDemiurgeDiary = true;
    ui?.showToast?.(`✦ Encontraste o códice Tractatus de Carcere soterrado sob os escombros de ${town.name}! [L] para ler.`);
  } else if (missingPages.length > 0) {
    const gainedPage = missingPages[Math.floor(Math.random() * missingPages.length)];
    PlayerInventory.discoveredBookPages.push(gainedPage);
    const pageTitle = gainedPage === 21 ? "O Sacrifício Final" : `Página ${gainedPage}`;
    ui?.showToast?.(`✦ Vasculhaste ${town.name}: Fragmento recuperado! Adicionada ${pageTitle} ao códice ([L]).`);
  } else {
    const goldFound = 8 + Math.floor(Math.random() * 14);
    PlayerInventory.gold = (PlayerInventory.gold || 0) + goldFound;
    PlayerStats.gold = PlayerInventory.gold;
    ui?.showToast?.(`✦ Vasculhaste as ruínas de ${town.name} e recolheste ${goldFound} moedas antigas sob as pedras.`);
  }
  return true;
}

/**
 * Checa se o jogador está no interior ou muito perto do baú de uma casa da vila abandonada.
 */
export function checkGhostTownHouseNearby(playerPos) {
  if (!playerPos || ActiveGhostHouses.length === 0) return null;
  const px = playerPos.x ?? 0;
  const pz = playerPos.z ?? 0;
  for (let i = 0; i < ActiveGhostHouses.length; i++) {
    const gh = ActiveGhostHouses[i];
    if (gh.looted) continue;
    const dx = px - gh.x;
    const dz = pz - gh.z;
    if (dx * dx + dz * dz < 2.9 * 2.9) {
      return gh;
    }
  }
  return null;
}

/**
 * Saqueia os espólios e detritos do interior da casa da vila abandonada.
 */
export function lootGhostTownHouse(houseLoot, ui, audio, weapons = null) {
  if (!houseLoot || houseLoot.looted) return false;
  houseLoot.looted = true;

  if (audio?.bookPage) audio.bookPage();
  if (audio?.weaponSwing) audio.weaponSwing("blade", false);

  const missingPages = [7, 11, 16, 19, 21].filter((p) => !PlayerInventory.discoveredBookPages.includes(p));

  // 1. Chance alta de códice / fragmento do Demiurgo
  let lootedItemText = "";
  if (!PlayerInventory.hasDemiurgeDiary) {
    PlayerInventory.hasDemiurgeDiary = true;
    lootedItemText = "✦ Encontraste o códice Tractatus de Carcere escondido no assoalho! [L] para ler.";
  } else if (missingPages.length > 0 && Math.random() < 0.65) {
    const gainedPage = missingPages[Math.floor(Math.random() * missingPages.length)];
    PlayerInventory.discoveredBookPages.push(gainedPage);
    const pageTitle = gainedPage === 21 ? "O Sacrifício Final" : `Página ${gainedPage}`;
    lootedItemText = `✦ Códice recuperado no interior da casa: Adicionada ${pageTitle} ([L]).`;
  } else {
    // 2. Feixe de flechas e moedas antigas
    const arrowsFound = 8 + Math.floor(Math.random() * 8);
    if (weapons?.ammo) {
      weapons.ammo.arrows = (weapons.ammo.arrows || 0) + arrowsFound;
    }
    const goldFound = 18 + Math.floor(Math.random() * 26);
    PlayerInventory.gold = (PlayerInventory.gold || 0) + goldFound;
    PlayerStats.gold = PlayerInventory.gold;
    lootedItemText = `✦ Saqueaste a casa arruinada: +${arrowsFound} Flechas · +${goldFound} Moedas Antigas`;
  }

  if (houseLoot.hasBloodEye) {
    lootedItemText += " · Sob a Marca do Olho Sangrento, o arrepio do Culto é palpável!";
  }

  ui?.showToast?.(lootedItemText);
  return true;
}
