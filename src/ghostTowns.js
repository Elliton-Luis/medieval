import * as THREE from "three";
import { createSeededRandom } from "./procedural.js";
import { PlayerInventory, PlayerStats } from "./rpg.js";
import { createIrregularBloodGeometry } from "./farmAnimals.js";
import { addCityBeacon } from "./beacons.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

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
// ----------------------------------------------------------------------------
// Detalhes de ruína (mesclados por material: poucos draw calls) e marcador de item coletável
// ----------------------------------------------------------------------------
let _detailId = 0;
const _detailMats = {};
function getDetailMats() {
  if (_detailMats.soot) return _detailMats;
  _detailMats.soot = new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  _detailMats.web = new THREE.MeshBasicMaterial({ color: 0xd8d8d0, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  _detailMats.puddle = new THREE.MeshStandardMaterial({ color: 0x07090b, roughness: 0.12, metalness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  _detailMats.weed = new THREE.MeshStandardMaterial({ color: 0x59532a, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  _detailMats.wax = new THREE.MeshStandardMaterial({ color: 0xb8ab8a, roughness: 0.9, flatShading: true });
  _detailMats.cloth = new THREE.MeshStandardMaterial({ color: 0x4a2a2a, roughness: 1, flatShading: true });
  // marcador: material compartilhado entre todas as casas (animado uma vez por frame)
  _detailMats.glowGold = new THREE.MeshBasicMaterial({ color: 0xffc95a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  _detailMats.glowPale = new THREE.MeshBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  _detailMats.page = new THREE.MeshBasicMaterial({ color: 0xf2e4b2, side: THREE.DoubleSide });
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  _detailMats.spriteGold = new THREE.SpriteMaterial({ map: tex, color: 0xffd070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
  _detailMats.spritePale = new THREE.SpriteMaterial({ map: tex, color: 0xa8bce0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 });
  return _detailMats;
}

function _ni(geometry, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  g.rotateX(rx);
  g.rotateY(ry);
  g.rotateZ(rz);
  g.translate(x, y, z);
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
  return g;
}

function _addMerged(group, geos, material, castShadow = false) {
  if (geos.length === 0) return null;
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

/** Móveis tombados, escombros, teias, ervas daninhas, poças, velas e marcas de fuligem. Só visual (sem colisão). */
function buildRuinDetails(mats, w, d, h, isDestroyed) {
  const dm = getDetailMats();
  let seed = (++_detailId * 2654435761) >>> 0;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const group = new THREE.Group();
  group.name = "RuinDetails";
  const wood = [];
  const stone = [];
  const soot = [];
  const web = [];
  const puddle = [];
  const weed = [];
  const wax = [];
  const cloth = [];
  const FY = 0.45; // topo do piso interno

  // mesa tombada: tampo inclinado + pernas quebradas
  wood.push(_ni(new THREE.BoxGeometry(1.1, 0.07, 0.65), 0.9, FY + 0.32, 0.45, 0.1, 0.4, 1.05));
  wood.push(_ni(new THREE.BoxGeometry(0.07, 0.55, 0.07), 1.35, FY + 0.2, 0.15, 0.2, 0, 0.5));
  wood.push(_ni(new THREE.BoxGeometry(0.07, 0.4, 0.07), 0.45, FY + 0.12, 0.7, 1.3, 0.3, 0));
  // cadeira caída
  wood.push(_ni(new THREE.BoxGeometry(0.4, 0.05, 0.4), -0.5, FY + 0.18, 1.1, 0.2, 0.5, 1.2));
  wood.push(_ni(new THREE.BoxGeometry(0.4, 0.5, 0.05), -0.78, FY + 0.12, 1.0, 0.1, 0.5, 1.5));
  // tábua da porta arrombada encostada no batente
  wood.push(_ni(new THREE.BoxGeometry(0.9, 1.9, 0.06), 0.55, FY + 0.9, d / 2 - 0.15, 0.12, 0.2, 0.18));
  // venezianas penduradas em dobradiças tortas
  for (const sx of [-1, 1]) {
    wood.push(_ni(new THREE.BoxGeometry(0.06, 0.8, 0.5), sx * (w / 2 + 0.08), 1.9, -0.5 + sx * 0.4, 0, 0, sx * 0.25 * (rnd() < 0.5 ? 1 : -1)));
  }
  // vigas de piso quebradas e cinzeiro de brasas
  for (let i = 0; i < 3; i++) {
    wood.push(_ni(new THREE.BoxGeometry(0.14, 0.12, 1.1 + rnd() * 0.9), (rnd() - 0.5) * (w - 1), FY + 0.1, (rnd() - 0.5) * (d - 1), (rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.3));
  }
  // montes de entulho e pedras no interior e junto às paredes
  const rubbleCount = isDestroyed ? 14 : 8;
  for (let i = 0; i < rubbleCount; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = isDestroyed ? (rnd() - 0.5) * (w + 1.4) : side * (w / 2 - 0.2 + rnd() * 0.9);
    const z = (rnd() - 0.5) * (d + 0.8);
    const sz = 0.14 + rnd() * 0.3;
    stone.push(_ni(new THREE.DodecahedronGeometry(sz, 0), x, FY * 0.4 + sz * 0.4, z, rnd() * 3, rnd() * 3, rnd() * 3));
  }
  // marcas de queimado: manchas escuras no piso e subindo pelas paredes
  for (let i = 0; i < 4; i++) {
    const x = (rnd() - 0.5) * (w - 1);
    const z = (rnd() - 0.5) * (d - 1);
    soot.push(_ni(new THREE.CircleGeometry(0.5 + rnd() * 0.7, 9), x, FY + 0.012, z, -Math.PI / 2));
  }
  soot.push(_ni(new THREE.PlaneGeometry(1.6, 1.9), -w / 2 + 0.14, 1.9, 0.3 + rnd(), 0, Math.PI / 2));
  soot.push(_ni(new THREE.PlaneGeometry(2.0, 1.5), 0.5, 2.2, -d / 2 + 0.14, 0, 0));
  soot.push(_ni(new THREE.PlaneGeometry(1.2, 1.4), w / 2 + 0.14, 1.6, -0.6, 0, Math.PI / 2));
  // teias nos cantos (triângulos translúcidos)
  const cob = new THREE.BufferGeometry();
  cob.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.7, 0, 0, 0, -0.7, 0, 0, 0, 0, 0, -0.7, 0, 0.5, -0.5, 0]), 3));
  cob.computeVertexNormals();
  const cobUv = new Float32Array(12);
  cob.setAttribute("uv", new THREE.BufferAttribute(cobUv, 2));
  const webSpots = [
    [-w / 2 + 0.2, h + 0.35, -d / 2 + 0.2, 0.8],
    [w / 2 - 0.2, h + 0.35, -d / 2 + 0.2, -0.8],
    [-w / 2 + 0.2, h + 0.35, d / 2 - 0.2, 2.4],
  ];
  for (const [x, y, z, ry] of webSpots) web.push(_ni(cob.clone(), x, y, z, 0, ry, 0));
  cob.dispose();
  // poças escuras (água parada / piche) e ervas daninhas ao redor da casa
  puddle.push(_ni(new THREE.CircleGeometry(0.55 + rnd() * 0.3, 10), 0.8, 0.5, d / 2 + 0.7, -Math.PI / 2));
  puddle.push(_ni(new THREE.CircleGeometry(0.35, 9), -w / 2 - 0.5, 0.52, 0.8, -Math.PI / 2));
  const weeds = 16;
  for (let i = 0; i < weeds; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = 0.78 + rnd() * 0.3;
    const x = Math.cos(a) * (w / 2 + 0.6) * rr;
    const z = Math.sin(a) * (d / 2 + 0.6) * rr;
    const hgt = 0.35 + rnd() * 0.55;
    weed.push(_ni(new THREE.ConeGeometry(0.06, hgt, 3, 1, true), x, 0.35 + hgt / 2, z, (rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5));
  }
  // tocos de vela derretidos sobre a mesa e no chão
  for (const [x, z] of [[1.2, 0.35], [-1.9, 0.9], [-0.2, -1.5]]) {
    wax.push(_ni(new THREE.CylinderGeometry(0.035, 0.045, 0.1 + rnd() * 0.08, 6), x, FY + 0.06, z));
    wax.push(_ni(new THREE.CylinderGeometry(0.09, 0.1, 0.02, 7), x, FY + 0.012, z));
  }
  // trapos de roupa jogados
  cloth.push(_ni(new THREE.PlaneGeometry(0.55, 0.4), 1.7, FY + 0.03, -1.3, -Math.PI / 2, rnd() * 3, 0));
  cloth.push(_ni(new THREE.PlaneGeometry(0.4, 0.5), -1.6, FY + 0.03, 1.5, -Math.PI / 2, rnd() * 3, 0));

  _addMerged(group, wood, mats.timberBurned, true);
  _addMerged(group, stone, mats.stoneDark, false);
  _addMerged(group, soot, dm.soot);
  _addMerged(group, web, dm.web);
  _addMerged(group, puddle, dm.puddle);
  _addMerged(group, weed, dm.weed);
  _addMerged(group, wax, dm.wax);
  _addMerged(group, cloth, dm.cloth);
  return group;
}

/**
 * Marcador de item coletável: sprite pulsante + feixe fino + folha flutuante. Zero PointLights.
 * Material e textura compartilhados entre todas as casas.
 */
function buildPageMarker(hasPage) {
  const dm = getDetailMats();
  const group = new THREE.Group();
  group.name = "PageMarker";
  const glow = new THREE.Sprite(hasPage ? dm.spriteGold : dm.spritePale);
  glow.scale.set(1.5, 1.5, 1);
  glow.position.y = 0.55;
  group.add(glow);
  // feixe de luz que atravessa o telhado e se vê de longe
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.2, hasPage ? 5.4 : 3.2, 8, 1, true), hasPage ? dm.glowGold : dm.glowPale);
  beam.position.y = (hasPage ? 5.4 : 3.2) / 2;
  beam.renderOrder = 3;
  group.add(beam);
  let page = null;
  if (hasPage) {
    page = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34), dm.page);
    page.position.y = 0.95;
    page.rotation.x = -0.25;
    group.add(page);
  }
  group.userData = { glow, page, beam, hasPage, baseY: 0.95 };
  return group;
}

function buildRuinedHouseMesh(mats, random, isDestroyed = false, hasBloodEye = false, hasPage = true) {
  const group = new THREE.Group();
  group.name = isDestroyed ? "DestroyedHouseRuin" : "AbandonedHouse";

  const w = 5.2;
  const d = 4.4;
  const h = 3.2;

  // 1. Fundação de pedra arruinada profunda (desce 2.4m na terra para nunca flutuar em relevo inclinado)
  const foundationDepth = 2.4;
  const found = new THREE.Mesh(new THREE.BoxGeometry(w + 0.45, foundationDepth, d + 0.45), mats.stoneDark);
  found.position.y = -foundationDepth * 0.5 + 0.35;
  found.castShadow = false; // fundação rente ao solo: sem sombra do chão sobre o chão
  found.receiveShadow = false;
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

  // Detalhes de ruína (mesclados) e marcador do item a ser pego, sobre o baú
  group.add(buildRuinDetails(mats, w, d, h, isDestroyed));
  const marker = buildPageMarker(hasPage);
  marker.position.set(-w * 0.26, 0.85, -d * 0.22);
  group.add(marker);

  group.userData = {
    marker,
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
    // 80% das casas guardam uma página; a casa do Olho de Sangue sempre (hash estável: não altera a sequência aleatória do layout)
    const hasPage = hasBloodEye || ((seed * 31 + h * 17) >>> 0) % 10 < 8;
    const house = buildRuinedHouseMesh(mats, random, isDestroyed, hasBloodEye, hasPage);

    const houseYaw = random() * Math.PI * 2;
    house.position.set(bx, by, bz);
    house.rotation.y = houseYaw;
    townRoot.add(house);

    // Registra colisão no mundo físico:
    // Decompõe as paredes individuais mantendo o vão da porta arrombada completamente livre para o jogador entrar
    if (world?.addOrientedBox) {
      const top = by + (isDestroyed ? 2.4 : 3.6);
      const bottom = by - 1.2;
      const cosY = Math.cos(houseYaw);
      const sinY = Math.sin(houseYaw);
      const toW = (lx, lz) => ({
        x: bx + lx * cosY + lz * sinY,
        z: bz - lx * sinY + lz * cosY,
      });

      // 1. Parede Traseira (z = -2.2)
      const pBack = toW(0, -2.2);
      world.addOrientedBox(pBack.x, pBack.z, 5.2, 0.35, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: false,
      });

      // 2. Parede Esquerda (x = -2.6)
      const pLeft = toW(-2.6, 0);
      world.addOrientedBox(pLeft.x, pLeft.z, 0.35, 4.4, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: false,
      });

      // 3. Parede Direita (x = 2.6)
      const pRight = toW(2.6, 0);
      world.addOrientedBox(pRight.x, pRight.z, 0.35, 4.4, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: false,
      });

      // 4. Fachada Frontal Esquerda (x = -1.77, z = 2.2)
      const pFrontL = toW(-1.77, 2.2);
      world.addOrientedBox(pFrontL.x, pFrontL.z, 1.66, 0.35, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: false,
      });

      // 5. Fachada Frontal Direita (x = 1.77, z = 2.2)
      const pFrontR = toW(1.77, 2.2);
      world.addOrientedBox(pFrontR.x, pFrontR.z, 1.66, 0.35, houseYaw, bottom, top, {
        move: true,
        shot: true,
        cam: false,
      });

      // 6. Colisão do Baú / Mesa arruinada no interior
      const pChest = toW(-1.35, -0.97);
      world.addOrientedBox(pChest.x, pChest.z, 0.85, 0.55, houseYaw, by + 0.35, by + 0.95, {
        move: true,
        shot: true,
        cam: false,
      });
    }

    if (world?.addOrientedFloor) {
      // Piso interno de madeira elevado
      world.addOrientedFloor(bx, bz, 5.0, 4.2, houseYaw, by + 0.38);
      // Soleira / degrau na entrada frontal
      const sinY = Math.sin(houseYaw);
      const cosY = Math.cos(houseYaw);
      world.addOrientedFloor(bx + 2.35 * sinY, bz + 2.35 * cosY, 2.0, 0.8, houseYaw, by + 0.18);
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
      hasPage,
      marker: house.userData.marker,
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


  // --------------------------------------------------------------------------
  // 4. Mobiliário de rua arruinado (mesclado por material): carroças quebradas, poço seco,
  //    cercas caídas e postes de tocha apagados.
  // --------------------------------------------------------------------------
  {
    let rs = (seed * 2246822519) >>> 0;
    const rr = () => {
      rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0;
      return rs / 4294967296;
    };
    const woodG = [];
    const stoneG = [];
    const ironG = [];
    const dmats = getDetailMats();
    const clear = (x, z, r) => placedBounds.every((pb) => (x - pb.x) ** 2 + (z - pb.z) ** 2 > (pb.r + r) ** 2);
    const ground = (x, z) => (world ? world.heightAt(x, z) : centerY);

    // poço seco no centro (com colisor)
    {
      const wx = cx + 3.4;
      const wz = cz + 2.6;
      const wy = ground(wx, wz);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        stoneG.push(_ni(new THREE.BoxGeometry(0.5, 0.85, 0.38), wx + Math.cos(a) * 0.95, wy + 0.4, wz + Math.sin(a) * 0.95, 0, -a + Math.PI / 2, 0));
      }
      woodG.push(_ni(new THREE.BoxGeometry(0.14, 2.1, 0.14), wx - 1.0, wy + 1.0, wz, 0, 0, 0.05));
      woodG.push(_ni(new THREE.BoxGeometry(0.14, 1.7, 0.14), wx + 1.0, wy + 0.8, wz, 0, 0, -0.18));
      woodG.push(_ni(new THREE.BoxGeometry(2.3, 0.1, 0.1), wx - 0.1, wy + 1.95, wz, 0, 0, 0.1));
      if (world?.addStaticCollider) world.addStaticCollider(wx, wz, 1.25, 1.2);
      placedBounds.push({ x: wx, z: wz, r: 1.6 });
    }

    // carroças quebradas (roda solta, eixo partido, caixa tombada)
    const carts = 3;
    for (let c = 0; c < carts; c++) {
      let placed = false;
      for (let t = 0; t < 12 && !placed; t++) {
        const a = rr() * Math.PI * 2;
        const dist = 12 + rr() * (radius - 22);
        const x = cx + Math.cos(a) * dist;
        const z = cz + Math.sin(a) * dist;
        if (!clear(x, z, 3.2)) continue;
        placed = true;
        placedBounds.push({ x, z, r: 2.4 });
        const y = ground(x, z);
        const yaw = rr() * Math.PI;
        const cs = Math.cos(yaw);
        const sn = Math.sin(yaw);
        const P = (lx, ly, lz) => [x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs];
        let q = P(0, 0.62, 0);
        woodG.push(_ni(new THREE.BoxGeometry(1.5, 0.12, 2.5), q[0], q[1], q[2], 0.1, yaw, 0.28));
        for (const sx of [-1, 1]) {
          q = P(sx * 0.78, 0.95, 0.1);
          woodG.push(_ni(new THREE.BoxGeometry(0.08, 0.5, 2.3), q[0], q[1], q[2], 0.1, yaw, 0.28));
        }
        q = P(1.15, 0.5, -0.9);
        const wheel = _ni(new THREE.TorusGeometry(0.5, 0.07, 5, 12), q[0], q[1], q[2], 0, yaw + Math.PI / 2, 0);
        woodG.push(wheel);
        q = P(-1.6, 0.18, 0.6);
        woodG.push(_ni(new THREE.TorusGeometry(0.5, 0.07, 5, 12), q[0], q[1], q[2], Math.PI / 2 - 0.2, yaw, 0.1)); // roda caída
        q = P(0, 0.2, 1.6);
        woodG.push(_ni(new THREE.BoxGeometry(0.1, 0.1, 1.8), q[0], q[1], q[2], 0.2, yaw + 1.1, 0)); // timão quebrado
        q = P(-0.3, 0.55, -0.1);
        ironG.push(_ni(new THREE.BoxGeometry(0.5, 0.35, 0.5), q[0], q[1], q[2], 0.3, yaw, 0.2)); // caixa de mercadoria
      }
    }

    // trechos de cerca caídos, formando arcos ao redor das casas
    const fences = 9;
    for (let f = 0; f < fences; f++) {
      const a = rr() * Math.PI * 2;
      const dist = 8 + rr() * (radius - 14);
      const x = cx + Math.cos(a) * dist;
      const z = cz + Math.sin(a) * dist;
      if (!clear(x, z, 2.4)) continue;
      const y = ground(x, z);
      const yaw = rr() * Math.PI;
      for (let k = 0; k < 4; k++) {
        const lx = (k - 1.5) * 0.85;
        const fall = k % 2 ? 0.2 : 1.2 + rr() * 0.4;
        const px = x + Math.cos(yaw) * lx;
        const pz = z - Math.sin(yaw) * lx;
        woodG.push(_ni(new THREE.BoxGeometry(0.1, 1.1, 0.1), px, y + 0.45, pz, fall, yaw, (rr() - 0.5) * 0.4));
      }
      woodG.push(_ni(new THREE.BoxGeometry(3.4, 0.08, 0.06), x, y + 0.32, z, 0.1, yaw, 0.07));
      woodG.push(_ni(new THREE.BoxGeometry(2.2, 0.08, 0.06), x + 0.6, y + 0.08, z + 0.4, 0, yaw + 0.3, 0.02));
    }

    // postes de tocha apagados com restos de piche
    for (let t = 0; t < 6; t++) {
      const a = (t / 6) * Math.PI * 2 + rr() * 0.4;
      const dist = 7 + rr() * 6;
      const x = cx + Math.cos(a) * dist;
      const z = cz + Math.sin(a) * dist;
      if (!clear(x, z, 1.2)) continue;
      const y = ground(x, z);
      woodG.push(_ni(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 5), x, y + 1.05, z, 0.05, 0, (rr() - 0.5) * 0.3));
      ironG.push(_ni(new THREE.CylinderGeometry(0.13, 0.08, 0.28, 6), x, y + 2.25, z));
    }

    const props = new THREE.Group();
    props.name = "GhostTownStreetProps";
    _addMerged(props, woodG, mats.timberBurned, true);
    _addMerged(props, stoneG, mats.stone, true);
    _addMerged(props, ironG, mats.rustedIron, false);
    townRoot.add(props);
  }

  scene.add(townRoot);

  const townData = {
    name,
    center: new THREE.Vector3(cx, centerY, cz),
    radius,
    root: townRoot,
    visited: false,
  };

  // Beacon espectral da cidade fantasma visível de longe cortando o breu noturno
  if (scene) {
    addCityBeacon(scene, cx, cz, 0x9988bb, 48, world);
  }

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
let _markerClock = 0;
const _markerWorld = new THREE.Vector3();
function _animateHouseMarkers(playerPos, dt) {
  if (ActiveGhostHouses.length === 0) return;
  _markerClock += dt;
  const dm = getDetailMats();
  // pulso único nos materiais compartilhados
  const pulse = 0.5 + 0.5 * Math.sin(_markerClock * 2.6);
  dm.glowGold.opacity = 0.18 + pulse * 0.22;
  dm.glowPale.opacity = 0.1 + pulse * 0.14;
  dm.spriteGold.opacity = 0.55 + pulse * 0.4;
  dm.spritePale.opacity = 0.4 + pulse * 0.3;
  const px = playerPos?.x ?? 0;
  const pz = playerPos?.z ?? 0;
  for (let i = 0; i < ActiveGhostHouses.length; i++) {
    const gh = ActiveGhostHouses[i];
    const m = gh.marker;
    if (!m) continue;
    m.visible = !gh.looted;
    if (gh.looted) continue;
    const dSq = (px - gh.x) ** 2 + (pz - gh.z) ** 2;
    if (dSq > 90 * 90) continue; // longe demais: não anima
    const ud = m.userData;
    if (ud.page) {
      ud.page.position.y = ud.baseY + Math.sin(_markerClock * 1.8 + i) * 0.07;
      ud.page.rotation.y = _markerClock * 1.1 + i;
    }
    const s = 1.35 + pulse * 0.35;
    ud.glow.scale.set(s, s, 1);
  }
}

export function updateGhostTownAtmosphere(playerPos, ui, dt = 0.5) {
  if (!playerPos || ActiveGhostTowns.length === 0) return;

  _animateHouseMarkers(playerPos, dt);

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

  const possiblePages = [3, 7, 11, 16, 19, 21];
  const missingPages = possiblePages.filter((p) => !PlayerInventory.discoveredBookPages.includes(p));
  if (missingPages.length > 0 && Math.random() < 0.75) {
    const gainedPage = missingPages[Math.floor(Math.random() * missingPages.length)];
    PlayerInventory.discoveredBookPages.push(gainedPage);
    const pageTitle = gainedPage === 21 ? "O Sacrifício Final" : `Página ${gainedPage}`;
    if (PlayerInventory.hasDemiurgeDiary) {
      ui?.showToast?.(`✦ Vasculhaste ${town.name}: Fragmento recuperado! Adicionada ${pageTitle} ao códice ([L]).`);
    } else {
      ui?.showToast?.(`✦ Vasculhaste ${town.name}: Fragmento avulso encontrado (${pageTitle})! [L] para inspecionar a folha.`);
    }
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

  const possiblePages = [3, 7, 11, 16, 19, 21];
  const missingPages = possiblePages.filter((p) => !PlayerInventory.discoveredBookPages.includes(p));

  // 1. Chance alta de página / fragmento avulso
  let lootedItemText = "";
  if (houseLoot.marker) houseLoot.marker.visible = false;
  if (missingPages.length > 0 && houseLoot.hasPage !== false) {
    const gainedPage = missingPages[Math.floor(Math.random() * missingPages.length)];
    PlayerInventory.discoveredBookPages.push(gainedPage);
    const pageTitle = gainedPage === 21 ? "O Sacrifício Final" : `Página ${gainedPage}`;
    if (PlayerInventory.hasDemiurgeDiary) {
      lootedItemText = `✦ Códice recuperado no interior da casa: Adicionada ${pageTitle} ao livro ([L]).`;
    } else {
      lootedItemText = `✦ Fragmento recuperado no interior da casa: Folha avulsa (${pageTitle})! [L] para ler a folha.`;
    }
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
