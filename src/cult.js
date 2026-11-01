import * as THREE from "three";
import { createSeededRandom } from "./procedural.js";
import { igniteTarget, spawnLoot } from "./rpg.js";

// ============================================================================
// 1. Materiais e Geometrias Otimizadas do Culto dos Cátaros (Zero-GC)
// ============================================================================
const _robeMat = new THREE.MeshStandardMaterial({
  color: 0x111116,
  roughness: 0.94,
  metalness: 0.08,
  flatShading: true,
});
const _maskMat = new THREE.MeshStandardMaterial({
  color: 0xf2ede4,
  roughness: 0.32,
  metalness: 0.12,
  flatShading: true,
});
const _goldMat = new THREE.MeshStandardMaterial({
  color: 0xc8982a,
  emissive: 0x553805,
  emissiveIntensity: 0.7,
  roughness: 0.35,
  metalness: 0.85,
  flatShading: true,
});
const _crimsonRibbonMat = new THREE.MeshStandardMaterial({
  color: 0x6e0d19,
  roughness: 0.7,
  metalness: 0.2,
  flatShading: true,
});
const _lensMat = new THREE.MeshStandardMaterial({
  color: 0x050508,
  roughness: 0.2,
  metalness: 0.8,
});
const _bladeMat = new THREE.MeshStandardMaterial({
  color: 0x222228,
  roughness: 0.35,
  metalness: 0.8,
});
const _glintMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
});
const _boneMat = new THREE.MeshStandardMaterial({
  color: 0xd8cca8,
  roughness: 0.88,
  flatShading: true,
});
const _altarStoneMat = new THREE.MeshStandardMaterial({
  color: 0x36363c,
  roughness: 0.95,
  flatShading: true,
});
const _purpleFireMat = new THREE.MeshStandardMaterial({
  color: 0x9933cc,
  emissive: 0x7711aa,
  emissiveIntensity: 2.5,
});
const _redTorchMat = new THREE.MeshStandardMaterial({
  color: 0xff2211,
  emissive: 0xff1100,
  emissiveIntensity: 2.8,
});

const _tempVec = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _rotEuler = new THREE.Euler();

// Lista global de altares para pistas e inspeção
export const CULT_ALTARS = [];

// ============================================================================
// Estado de Poder e Sacrifícios da Seita Cátara (A Ordem do Demiurgo)
// ============================================================================
export const CultState = {
  sacrifices: 0,
  level: 1, // Tier 1 a 4
  speedMultiplier: 1.0,
  damageBonus: 0,
  altarTarget: null,
  apocalypseChance: 0, // Inicia em 0%, sobe 5% por dia e 2% por má ação

  addApocalypseProgress(amount = 2) {
    const prev = this.apocalypseChance;
    this.apocalypseChance = Math.min(100, Math.max(0, this.apocalypseChance + amount));
    const stepPrev = Math.floor(prev / 25);
    const stepCurr = Math.floor(this.apocalypseChance / 25);
    if (stepCurr > stepPrev && this.apocalypseChance >= 25) {
      window.__game?.ui?.showToast?.(
        `🌑 O Véu da Criação estremece! Perigo do Fim dos Tempos: ${Math.round(this.apocalypseChance)}%!`
      );
    }
    return this.apocalypseChance;
  },

  recordSacrifice() {
    this.sacrifices++;
    this.addApocalypseProgress(2);
    if (this.sacrifices >= 10) {
      this.level = 4;
      this.speedMultiplier = 1.75;
      this.damageBonus = 4;
    } else if (this.sacrifices >= 6) {
      this.level = 3;
      this.speedMultiplier = 1.5;
      this.damageBonus = 2;
    } else if (this.sacrifices >= 3) {
      this.level = 2;
      this.speedMultiplier = 1.25;
      this.damageBonus = 1;
    } else {
      this.level = 1;
      this.speedMultiplier = 1.1;
      this.damageBonus = 0;
    }
    return this.level;
  },

  syncLevel(sacrifices = 0) {
    this.sacrifices = Number(sacrifices) || 0;
    if (this.sacrifices >= 10) {
      this.level = 4;
      this.speedMultiplier = 1.75;
      this.damageBonus = 4;
    } else if (this.sacrifices >= 6) {
      this.level = 3;
      this.speedMultiplier = 1.5;
      this.damageBonus = 2;
    } else if (this.sacrifices >= 3) {
      this.level = 2;
      this.speedMultiplier = 1.25;
      this.damageBonus = 1;
    } else if (this.sacrifices >= 1) {
      this.level = 1;
      this.speedMultiplier = 1.1;
      this.damageBonus = 0;
    } else {
      this.level = 1;
      this.speedMultiplier = 1.0;
      this.damageBonus = 0;
    }
  },
};

// ============================================================================
// 2. Geração de Pistas Estáticas e Altares Rituais (InstancedMesh)
// ============================================================================
export function createCultistCluesMeshes(scene) {
  // Geometria de Crânio Humano
  const skullGeo = new THREE.DodecahedronGeometry(0.18, 1);
  const skullsMesh = new THREE.InstancedMesh(skullGeo, _boneMat, 64);
  skullsMesh.name = "CultSkulls";
  skullsMesh.castShadow = true;
  skullsMesh.userData = { currentIndex: 0 };

  // Geometria de Espadas/Lâminas Quebradas
  const swordGeo = new THREE.BoxGeometry(0.08, 0.65, 0.02);
  const weaponsMesh = new THREE.InstancedMesh(swordGeo, _bladeMat, 64);
  weaponsMesh.name = "CultWeapons";
  weaponsMesh.castShadow = true;
  weaponsMesh.userData = { currentIndex: 0 };

  if (scene) {
    scene.add(skullsMesh);
    scene.add(weaponsMesh);
  }

  return { skullsMesh, weaponsMesh };
}

/**
 * Espalha pistas e altares rituais fora das muralhas da cidade (>150m).
 */
export function spawnCultistClues(skullsMesh, weaponsMesh, regionSeed, cityCenter, scene, world) {
  if (!skullsMesh || !weaponsMesh || !cityCenter) return;
  const random = createSeededRandom(regionSeed || 12345);

  const cx = cityCenter.x ?? 0;
  const cz = cityCenter.z ?? 0;

  // 4 Acampamentos Garantidos nas 4 Direções Cardeais bem afastados da cidade e das vilas (> 210m nos ermos)
  const CARDINAL_OUTPOSTS = [
    { x: cx + 35, z: cz - 225, name: "Acampamento Cátaro do Ermo Norte", dir: "Norte" },
    { x: cx - 45, z: cz + 220, name: "Acampamento Cátaro da Floresta Sul", dir: "Sul" },
    { x: cx + 225, z: cz + 50, name: "Acampamento Cátaro dos Montes Leste", dir: "Leste" },
    { x: cx - 225, z: cz - 45, name: "Acampamento Cátaro do Vale Oeste", dir: "Oeste" },
  ];

  for (let c = 0; c < CARDINAL_OUTPOSTS.length; c++) {
    const out = CARDINAL_OUTPOSTS[c];
    const oy = world ? world.heightAt(out.x, out.z) : 0;
    const outpostData = {
      x: out.x,
      y: oy,
      z: out.z,
      radius: 6.5,
      inspected: false,
      name: out.name,
      lorePrompt: `Acampamento de sentinelas heréticas do ${out.dir}. Tochas rubras ardem em torno da fogueira do Demiurgo.`,
    };
    CULT_ALTARS.push(outpostData);
    if (!CultState.altarTarget) {
      CultState.altarTarget = outpostData;
    }

    if (scene) {
      const campGroup = new THREE.Group();
      campGroup.position.set(out.x, oy, out.z);

      // Círculo de pedras rituais da fogueira
      for (let p = 0; p < 8; p++) {
        const pang = (p / 8) * Math.PI * 2;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), _altarStoneMat);
        stone.position.set(Math.cos(pang) * 1.35, 0.12, Math.sin(pang) * 1.35);
        campGroup.add(stone);
      }

      // Lenha cruzada
      for (let l = 0; l < 3; l++) {
        const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.95, 5), _robeMat);
        logMesh.position.set(0, 0.08, 0);
        logMesh.rotation.y = (l / 3) * Math.PI;
        logMesh.rotation.z = Math.PI / 2;
        campGroup.add(logMesh);
      }

      // Fogueira de Chama Roxa ritual (Luz dobrada)
      const purpleFlame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.92, 6), _purpleFireMat);
      purpleFlame.position.set(0, 0.52, 0);
      campGroup.add(purpleFlame);

      const campfireLight = new THREE.PointLight(0xaa33ff, 5.2, 36, 1.6);
      campfireLight.position.set(0, 0.8, 0);
      campGroup.add(campfireLight);

      // Duas Tochas Rubras Cerimoniais fincadas em estacas ao lado do fogo (Luz dobrada)
      for (const side of [-1.5, 1.5]) {
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.8, 5), _robeMat);
        stake.position.set(side, 0.9, side * 0.3);
        campGroup.add(stake);

        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 5), _redTorchMat);
        flame.position.set(side, 1.95, side * 0.3);
        campGroup.add(flame);

        const tLight = new THREE.PointLight(0xff1100, 4.8, 28, 1.8);
        tLight.position.set(side, 2.05, side * 0.3);
        campGroup.add(tLight);
      }

      // Crânios de aviso
      const skullDeco = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), _boneMat);
      skullDeco.position.set(0.7, 0.14, 0.7);
      campGroup.add(skullDeco);

      scene.add(campGroup);
    }
  }

  // Spawna mais 1 a 2 altares ocultos distantes nos ermos (> 220m)
  for (let i = 0; i < 2; i++) {
    if (random() > 0.65 && i > 0) continue;

    const angle = random() * Math.PI * 2;
    const dist = 220 + random() * 100;
    const ax = cx + Math.cos(angle) * dist;
    const az = cz + Math.sin(angle) * dist;
    const ay = world ? world.heightAt(ax, az) : 0;

    const altarData = {
      x: ax,
      y: ay,
      z: az,
      radius: 4.5,
      inspected: false,
      lorePrompt:
        "Símbolos do Demiurgo gravados no osso e cera negra... Uma presença herética esteve aqui recentemente.",
    };
    CULT_ALTARS.push(altarData);
    if (!CultState.altarTarget) {
      CultState.altarTarget = altarData;
    }

    // Constrói o visual do Altar Ritual no mundo
    if (scene) {
      const altarGroup = new THREE.Group();
      altarGroup.position.set(ax, ay, az);

      // Círculo de pedras escuras da fogueira
      for (let p = 0; p < 8; p++) {
        const pang = (p / 8) * Math.PI * 2;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), _altarStoneMat);
        stone.position.set(Math.cos(pang) * 1.3, 0.12, Math.sin(pang) * 1.3);
        altarGroup.add(stone);
      }

      // Troncos de lenha cruzados na fogueira
      for (let l = 0; l < 3; l++) {
        const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.95, 5), _robeMat);
        logMesh.position.set(0, 0.08, 0);
        logMesh.rotation.y = (l / 3) * Math.PI;
        logMesh.rotation.z = Math.PI / 2;
        altarGroup.add(logMesh);
      }

      // Fogueira de Chama Roxa ritual mística
      const purpleFlame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.74, 6), _purpleFireMat);
      purpleFlame.position.set(0, 0.42, 0);
      altarGroup.add(purpleFlame);

      const campfireLight = new THREE.PointLight(0xaa33ff, 4.8, 32, 1.6);
      campfireLight.position.set(0, 0.65, 0);
      altarGroup.add(campfireLight);

      // Crânios de aviso ao redor da fogueira
      const skullDeco = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 1), _boneMat);
      skullDeco.position.set(0.65, 0.12, 0.65);
      altarGroup.add(skullDeco);

      scene.add(altarGroup);
    }

    // Adiciona crânios e armas quebradas espalhadas nas instâncias
    const skullsCount = 3 + Math.floor(random() * 3);
    for (let s = 0; s < skullsCount; s++) {
      if (skullsMesh.userData.currentIndex >= skullsMesh.count) break;
      const sAng = random() * Math.PI * 2;
      const sDist = 0.8 + random() * 2.2;
      const sx = ax + Math.cos(sAng) * sDist;
      const sz = az + Math.sin(sAng) * sDist;
      const sy = world ? world.heightAt(sx, sz) : ay;

      _rotEuler.set(random() * 0.4, random() * Math.PI * 2, random() * 0.4);
      _matrix.makeRotationFromEuler(_rotEuler);
      _matrix.setPosition(sx, sy + 0.12, sz);
      skullsMesh.setMatrixAt(skullsMesh.userData.currentIndex++, _matrix);
    }

    const weaponsCount = 2 + Math.floor(random() * 2);
    for (let w = 0; w < weaponsCount; w++) {
      if (weaponsMesh.userData.currentIndex >= weaponsMesh.count) break;
      const wAng = random() * Math.PI * 2;
      const wDist = 0.9 + random() * 2.4;
      const wx = ax + Math.cos(wAng) * wDist;
      const wz = az + Math.sin(wAng) * wDist;
      const wy = world ? world.heightAt(wx, wz) : ay;

      _rotEuler.set(Math.PI * 0.48, random() * Math.PI * 2, random() * 0.3);
      _matrix.makeRotationFromEuler(_rotEuler);
      _matrix.setPosition(wx, wy + 0.06, wz);
      weaponsMesh.setMatrixAt(weaponsMesh.userData.currentIndex++, _matrix);
    }
  }

  skullsMesh.instanceMatrix.needsUpdate = true;
  weaponsMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================================
// 3. Modelo Anatômico 3D do Cultista Cátaro (Estilo Baile Oculto - Eyes Wide Shut)
// ============================================================================
export function buildCultistMesh() {
  const root = new THREE.Group();
  root.name = "CultistRoot";

  const model = new THREE.Group();
  model.name = "CultistModel";
  root.add(model);

  // Manto preto longo sacerdotal (silhueta austera, reta e sem cantos redondos)
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.44, 1.55, 8), _robeMat);
  robe.position.set(0, 0.8, 0);
  robe.castShadow = true;
  model.add(robe);

  // Faixa/Estola cerimonial carmesim descendo pelo centro do peito
  const stola = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.35, 0.03), _crimsonRibbonMat);
  stola.position.set(0, 0.75, 0.23);
  stola.rotation.x = -0.04;
  model.add(stola);

  const stolaClasp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), _goldMat);
  stolaClasp.position.set(0, 1.38, 0.22);
  model.add(stolaClasp);

  // Ombreiras angulares de corte reto (ombros largos e imponentes de cerimônia oculta)
  for (const side of [-1, 1]) {
    const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.32), _robeMat);
    epaulet.position.set(side * 0.28, 1.48, 0);
    epaulet.rotation.z = -side * 0.12;
    model.add(epaulet);

    const epauletGold = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.10, 0.325), _goldMat);
    epauletGold.position.set(side * 0.36, 1.48, 0);
    epauletGold.rotation.z = -side * 0.12;
    model.add(epauletGold);
  }

  // Gola alta rígida cerimonial
  const collarBack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.03), _robeMat);
  collarBack.position.set(0, 1.62, -0.12);
  collarBack.rotation.x = 0.12;
  model.add(collarBack);

  // Capuz facetado gótico rígido (sem esferas redondas)
  const hoodRoof = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.32), _robeMat);
  hoodRoof.position.set(0, 1.84, 0.02);
  model.add(hoodRoof);

  const hoodPeak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 4), _robeMat);
  hoodPeak.position.set(0, 1.94, -0.05);
  hoodPeak.rotation.x = -0.32;
  model.add(hoodPeak);

  for (const side of [-1, 1]) {
    const hoodSide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.28), _robeMat);
    hoodSide.position.set(side * 0.15, 1.68, 0.02);
    model.add(hoodSide);
  }

  // Máscara Veneziana de Porcelana Oculta (Estilo Baile Eyes Wide Shut - Bauta / Volto)
  const maskGroup = new THREE.Group();
  maskGroup.position.set(0, 1.65, 0.10);

  const maskFace = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.23, 0.05), _maskMat);
  maskGroup.add(maskFace);

  // Queixo afiado geométrico característico da Bauta
  const maskChin = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.20, 4), _maskMat);
  maskChin.position.set(0, -0.13, 0.035);
  maskChin.rotation.x = Math.PI * 0.95;
  maskGroup.add(maskChin);

  // Filigrana e detalhes dourados nas têmporas
  const maskBrowGold = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.03, 0.055), _goldMat);
  maskBrowGold.position.set(0, 0.09, 0.002);
  maskGroup.add(maskBrowGold);

  // Órbitas oculares vazadas e profundas com ponto de luz penetrante
  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.035), _lensMat);
    eyeSocket.position.set(side * 0.055, 0.035, 0.032);
    maskGroup.add(eyeSocket);

    const eyeDot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.018), _glintMat);
    eyeDot.position.set(side * 0.055, 0.035, 0.046);
    maskGroup.add(eyeDot);
  }
  model.add(maskGroup);

  // Mangas pretas estruturadas com conexão física
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.70, 0.13), _robeMat);
  armL.position.set(-0.3, 1.25, 0);
  armL.rotation.z = 0.22;
  model.add(armL);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.07), _robeMat);
  handL.position.set(-0.34, 0.94, 0.10);
  model.add(handL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.70, 0.13), _robeMat);
  armR.position.set(0.3, 1.25, 0.05);
  armR.rotation.z = -0.22;
  model.add(armR);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.07), _robeMat);
  handR.position.set(0.34, 0.94, 0.12);
  model.add(handR);

  // Tocha Cerimonial de Ferro Forjado na mão esquerda (os servos que vigiam além dos muros)
  const torchGroup = new THREE.Group();
  torchGroup.name = "CultistRedTorch";
  torchGroup.position.set(-0.32, 1.05, 0.16);

  const torchStick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.48, 6), _bladeMat);
  torchStick.position.set(0, 0, 0);
  torchGroup.add(torchStick);

  const torchCage = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), _bladeMat);
  torchCage.position.set(0, 0.22, 0);
  torchGroup.add(torchCage);

  const torchFlame = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 5), _redTorchMat);
  torchFlame.position.set(0, 0.28, 0);
  torchGroup.add(torchFlame);

  const torchLight = new THREE.PointLight(0xff2211, 2.8, 18, 1.8);
  torchLight.position.set(0, 0.32, 0);
  torchGroup.add(torchLight);

  model.add(torchGroup);

  // Adaga ritual cerimonial na mão direita (obsidiana com guarda e pomo de ouro)
  const daggerGroup = new THREE.Group();
  daggerGroup.position.set(0.34, 0.92, 0.12);

  const daggerGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 5), _bladeMat);
  daggerGrip.position.set(0, 0, 0);
  daggerGroup.add(daggerGrip);

  const daggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.025, 0.035), _goldMat);
  daggerGuard.position.set(0, -0.07, 0);
  daggerGroup.add(daggerGuard);

  const daggerBlade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.34, 4), _bladeMat);
  daggerBlade.position.set(0, -0.24, 0);
  daggerBlade.rotation.x = Math.PI;
  daggerGroup.add(daggerBlade);

  const daggerPommel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), _goldMat);
  daggerPommel.position.set(0, 0.08, 0);
  daggerGroup.add(daggerPommel);

  model.add(daggerGroup);

  root.visible = false;
  return { root, model, robe, armL, armR, torchGroup, torchLight };
}

// ============================================================================
// 4. Classe Cultist (IA Furtiva, Sabotagem e Desvanecimento Sobrenatural)
// ============================================================================
const CULTIST_SPEED = 2.0; // Movimento fantasmagórico lento
const CULTIST_FLEE_SPEED = 5.2;

export class Cultist {
  constructor(scene, world, effects, combat) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = combat;

    const { root, model, robe, armL, armR, torchGroup, torchLight } = buildCultistMesh();
    this.root = root;
    this.model = model;
    this.robe = robe;
    this.armL = armL;
    this.armR = armR;
    this.torchGroup = torchGroup;
    this.torchLight = torchLight;
    this.isSeated = false;

    this.roleKey = "cultist";
    this.name = "Cultista do Demiurgo";
    this.title = "A Ordem do Demiurgo";
    this.alive = false;
    this.hostile = true;
    this.temporary = true;
    this.health = 24;
    this.maxHealth = 24;
    this.meleeDamage = 2;
    this.meleeRange = 2.2;
    this.task = "Invocando as sombras do Demiurgo";

    this.x = 9999;
    this.z = 9999;
    this.floatPhase = Math.random() * Math.PI * 2;
    this._spellTimer = 0;
    this._attackTimer = 0;

    this.userData = {
      type: "CULTIST",
      state: "DESPAWNED",
      anchor: new THREE.Vector3(),
      nextActionTime: 0,
      vanishTimer: 0,
      fleeTimer: 0,
      isDead: true,
    };

    this.root.visible = false;
    if (scene) scene.add(root);
  }

  endAlert() {
    if (this.userData.state === "ATTACKING") {
      this.userData.state = "CAMPING";
      this.setSeatedPose(true);
    }
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.0, 0);
  }

  setSeatedPose(isSeated) {
    this.isSeated = Boolean(isSeated);
    if (this.isSeated) {
      this.model.position.y = -0.42;
      if (this.robe) this.robe.scale.set(1.24, 0.62, 1.24);
      if (this.armL) this.armL.rotation.set(-0.62, 0, 0.28);
      if (this.torchGroup) this.torchGroup.position.set(-0.28, 0.62, 0.22);
    } else {
      this.model.position.y = 0;
      if (this.robe) this.robe.scale.set(1, 1, 1);
      if (this.armL) this.armL.rotation.set(0, 0, 0.22);
      if (this.torchGroup) this.torchGroup.position.set(-0.32, 1.05, 0.16);
    }
  }

  spawnAtCamp(anchorPos, seatIndex = 0, totalSeats = 3) {
    this.alive = true;
    this.health = this.maxHealth;
    const angle = (seatIndex / Math.max(1, totalSeats)) * Math.PI * 2 + 0.4;
    this.x = anchorPos.x + Math.cos(angle) * 2.3;
    this.z = anchorPos.z + Math.sin(angle) * 2.3;
    this.userData.anchor.copy(anchorPos);
    this.userData.state = "CAMPING";
    this.userData.nextActionTime = performance.now() + 8000;
    this.userData.isDead = false;

    // Encarando a fogueira no centro do altar
    const targetYaw = Math.atan2(anchorPos.x - this.x, anchorPos.z - this.z);
    this.model.rotation.y = targetYaw;

    const y = this.world ? this.world.heightAt(this.x, this.z) : anchorPos.y;
    this.root.position.set(this.x, y, this.z);
    this.setSeatedPose(true);
    this.root.visible = true;

    if (this.effects) {
      this.effects.play("dust", this.x, y + 0.35, this.z, "#1c1b22", 1.2);
    }
  }

  spawnAt(anchorPos) {
    this.alive = true;
    this.health = this.maxHealth;
    this.x = anchorPos.x + 3;
    this.z = anchorPos.z + 3;
    this.userData.anchor.copy(anchorPos);
    this.userData.state = "PATROL";
    this.userData.nextActionTime = performance.now() + 8000 + Math.random() * 8000;
    this.userData.isDead = false;

    const y = this.world ? this.world.heightAt(this.x, this.z) : anchorPos.y;
    this.root.position.set(this.x, y, this.z);
    this.setSeatedPose(false);
    this.root.visible = true;

    if (this.effects) {
      this.effects.play("dust", this.x, y + 0.8, this.z, "#1c1b22", 1.8);
    }
  }

  takeHit(amount, dirX, dirZ, force = 1.8, launch = 0) {
    if (!this.alive || !this.root.visible) return false;
    this.health -= amount;

    if (this.effects) {
      this.effects.play("dust", this.x, this.root.position.y + 1.1, this.z, "#111116", 2.2);
      this.effects.play("star", this.x, this.root.position.y + 1.3, this.z, "#8844cc", 1.5);
    }

    if (this.health <= 0) {
      this.vanish(true);
      return true;
    }

    // Se alvejado, passa ao ataque frontal imediato
    this.userData.state = "ATTACKING";
    this.setSeatedPose(false);
    return false;
  }

  vanish(dropRelic = false) {
    if (!this.root.visible) return;
    this.alive = false;
    this.root.visible = false;
    this.userData.state = "DESPAWNED";
    this.userData.isDead = true;

    if (this.effects) {
      this.effects.play("dust", this.x, this.root.position.y + 0.9, this.z, "#14141a", 2.8);
      this.effects.play("dust", this.x, this.root.position.y + 1.6, this.z, "#221a2c", 2.2);
      this.effects.play("star", this.x, this.root.position.y + 1.2, this.z, "#8844cc", 2.0);
    }

    if (dropRelic) {
      spawnLoot(this.root.position, 45);
      // Chance alta de dropar a Roupa/Manto do Demiurgo ao derrotar cultistas
      import("./rpg.js").then(({ unlockDemiurgeAttire }) => {
        unlockDemiurgeAttire();
      }).catch(() => {});
    }
  }

  update(dt, player, npcs, firePool, time = performance.now()) {
    if (!this.alive || !this.root.visible) return;

    this.floatPhase += dt * 3.2;
    const px = player?.x ?? player?.position?.x ?? 0;
    const pz = player?.z ?? player?.position?.z ?? 0;

    const toPlayerX = px - this.x;
    const toPlayerZ = pz - this.z;
    const distToPlayerSq = toPlayerX * toPlayerX + toPlayerZ * toPlayerZ;
    const distToPlayer = Math.sqrt(distToPlayerSq);

    // 1. Deteção & Reação ao Jogador:
    // Ao chegar perto (<= 16m), os servos do Demiurgo sentados ao redor da fogueira se levantam e FOGEM nas sombras!
    if (distToPlayer <= 16 && this.userData.state === "CAMPING") {
      this.userData.state = "FLEEING";
      this.userData.fleeTimer = 5.5;
      this.setSeatedPose(false);
      this.task = "Fugindo nas sombras do Demiurgo";
      if (this.effects) {
        this.effects.play("dust", this.x, this.root.position.y + 0.5, this.z, "#1e1d24", 1.8);
        this.effects.play("star", this.x, this.root.position.y + 1.1, this.z, "#a822ee", 1.8);
      }
    } else if (distToPlayer > 36 && this.userData.state === "ATTACKING") {
      // Retorna para o acampamento se o jogador fugir para muito longe
      this.userData.state = "CAMPING";
      this.setSeatedPose(true);
      return;
    }

    if (this.userData.state === "CAMPING") {
      // Permanece sentado ao redor da fogueira com a tocha vermelha ardendo
      if (this.torchLight) {
        this.torchLight.intensity = 1.3 + Math.sin(time * 0.008 + this.floatPhase) * 0.35;
      }
      return;
    }

    if (this.userData.state === "FLEEING") {
      this.setSeatedPose(false);
      const d = Math.max(0.001, distToPlayer);
      const cultSpeed = (CULTIST_SPEED + 2.2) * (CultState.speedMultiplier || 1.0);

      // Corre na direção oposta ao jogador
      this.x -= (toPlayerX / d) * (cultSpeed * dt);
      this.z -= (toPlayerZ / d) * (cultSpeed * dt);

      // Encarar a direção da fuga
      const fleeYaw = Math.atan2(-toPlayerX, -toPlayerZ);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, fleeYaw, 0.2);

      const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
      this.root.position.set(this.x, groundY + 0.05 + Math.sin(this.floatPhase) * 0.04, this.z);

      this.userData.fleeTimer = (this.userData.fleeTimer || 5.5) - dt;
      if (this.userData.fleeTimer <= 0 || distToPlayer > 32) {
        // Desaparece na escuridão
        this.vanish(false);
      }
      return;
    }

    if (this.userData.state === "ATTACKING") {
      this.setSeatedPose(false);
      const d = Math.max(0.001, distToPlayer);

      // Encarar o jogador
      const targetYaw = Math.atan2(toPlayerX, toPlayerZ);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, targetYaw, 0.15);

      // Ataque à distância: Conjura centelhas místicas do vazio (entre 3.5m e 16m)
      this._spellTimer = (this._spellTimer || 0) + dt;
      if (d >= 3.5 && d <= 16 && this._spellTimer > 2.6) {
        this._spellTimer = 0;
        if (this.effects) {
          this.effects.play("star", this.x + Math.sin(targetYaw) * 0.8, this.root.position.y + 1.4, this.z + Math.cos(targetYaw) * 0.8, "#a822ee", 1.5);
          this.effects.play("star", px, (player?.root?.position?.y ?? 0) + 1.2, pz, "#ff2233", 1.2);
        }
        if (this.combat?.hurtPlayer && Math.random() < 0.65) {
          this.combat.hurtPlayer(1 + (CultState.damageBonus || 0), this.x, this.z, { weapon: "cult_magic", knock: 2.0 });
        }
      }

      // Ataque corpo a corpo: Golpe com a Adaga Sacrificial quando <= 2.2m
      this._attackTimer = (this._attackTimer || 0) + dt;
      if (d <= 2.2 && this._attackTimer > 1.1) {
        this._attackTimer = 0;
        if (this.armR) this.armR.rotation.x = -2.2;
        if (this.combat?.hurtPlayer) {
          this.combat.hurtPlayer(2 + (CultState.damageBonus || 0), this.x, this.z, { weapon: "dagger", knock: 3.2 });
        }
        if (this.effects) {
          this.effects.play("glint", px, (player?.root?.position?.y ?? 0) + 1.2, pz, "#ff2211", 1.2);
        }
      } else if (this.armR && this.armR.rotation.x < -0.3) {
        this.armR.rotation.x += dt * 5.0;
      }

      // Perseguição do jogador
      if (d > 2.0) {
        const cultSpeed = (CULTIST_SPEED + 1.5) * (CultState.speedMultiplier || 1.0);
        this.x += (toPlayerX / d) * (cultSpeed * dt);
        this.z += (toPlayerZ / d) * (cultSpeed * dt);
      }

      const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
      this.root.position.set(this.x, groundY + 0.05 + Math.sin(this.floatPhase) * 0.04, this.z);
      return;
    }

    // 2. Caos Discreto e Sabotagem (cooldown de ações)
    if (time > this.userData.nextActionTime) {
      this.userData.nextActionTime = time + 11000 + Math.random() * 9000;
      const actionRoll = Math.random();

      if (actionRoll < 0.35) {
        // Ateia fogo ao próprio redor (solo mágico / árvores)
        igniteTarget(this.root, { x: this.x, y: this.root.position.y + 0.4, z: this.z }, firePool, time);
      } else if (actionRoll < 0.75 && Array.isArray(npcs)) {
        // Abate silencioso de NPC desgarrado fora da cidade
        for (let i = 0; i < npcs.length; i++) {
          const victim = npcs[i];
          if (!victim || !victim.alive || victim.userData?.type === "CULTIST" || victim.roleKey === "werewolf" || victim.roleKey === "guard") {
            continue;
          }
          const vdx = this.x - victim.x;
          const vdz = this.z - victim.z;
          if (vdx * vdx + vdz * vdz < 100) {
            // Morte limpa e instantânea sem alertar guardas
            victim.alive = false;
            victim.userData = victim.userData || {};
            victim.userData.isDead = true;
            victim.task = "Abatido em sacrifício silencioso";
            if (this.effects) {
              this.effects.play("dust", victim.x, victim.root.position.y + 0.8, victim.z, "#1c1b22", 1.8);
            }
            break;
          }
        }
      }
    }

    // 3. Patrulha espectral em círculos ao redor do seu altar (âncora)
    const anchor = this.userData.anchor;
    const patrolAngle = time * 0.00045;
    const targetX = anchor.x + Math.cos(patrolAngle) * 11;
    const targetZ = anchor.z + Math.sin(patrolAngle) * 11;

    _targetDir.set(targetX - this.x, 0, targetZ - this.z);
    const tDist = _targetDir.length();
    if (tDist > 0.1) {
      _targetDir.normalize();
      const currentSpeed = CULTIST_SPEED * (CultState.speedMultiplier || 1.0);
      this.x += _targetDir.x * (currentSpeed * dt);
      this.z += _targetDir.z * (currentSpeed * dt);

      const targetYaw = Math.atan2(_targetDir.x, _targetDir.z);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, targetYaw, 0.06);
    }

    const groundY = this.world ? this.world.heightAt(this.x, this.z) : anchor.y;
    this.root.position.set(this.x, groundY + 0.05 + Math.sin(this.floatPhase) * 0.035, this.z);
  }
}

// ============================================================================
// 5. Pool e Gerenciador de Cultistas (Noite e Névoa fora dos muros)
// ============================================================================
export function createCultistsPool(scene, world, effects, combat, count = 8) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    const c = new Cultist(scene, world, effects, combat);
    pool.push(c);
  }
  return pool;
}

let _cultistCheckTimer = 0;

/**
 * Atualiza o ciclo de vida dos Cultistas do Demiurgo fora dos muros.
 */
export function updateCultistsLifeCycle(cultistsPool, player, npcs, firePool, dt, isNight, cityData) {
  if (!Array.isArray(cultistsPool) || !player) return;

  const time = performance.now();

  // Avalia acampamentos fora das muralhas a cada 1.0 segundo
  _cultistCheckTimer += dt;
  if (_cultistCheckTimer > 1.0) {
    _cultistCheckTimer = 0;

    const px = player.x ?? player.position?.x ?? 0;
    const pz = player.z ?? player.position?.z ?? 0;

    for (let a = 0; a < CULT_ALTARS.length; a++) {
      const altar = CULT_ALTARS[a];
      const adx = altar.x - px;
      const adz = altar.z - pz;
      const aDistSq = adx * adx + adz * adz;

      // Ativa o acampamento herético apenas se o jogador estiver nos ermos a <= 55m do local
      if (aDistSq <= 3025) {
        const activeHere = cultistsPool.filter(
          (c) => c.root.visible && c.userData.anchor && c.userData.anchor.distanceToSquared(altar) < 25
        );
        if (activeHere.length < 2) {
          const available = cultistsPool.find((c) => !c.root.visible);
          if (available) {
            available.spawnAtCamp(altar, activeHere.length, 2);
          }
        }
      }
    }
  }

  // Atualiza a rotina individual de cada cultista ativo
  for (let i = 0; i < cultistsPool.length; i++) {
    const c = cultistsPool[i];
    if (c.root.visible) {
      c.update(dt, player, npcs, firePool, time);
    }
  }
}

/**
 * Checa se o jogador está perto de um Altar Ritual para inspecionar pistas com E.
 */
export function checkAltarInteraction(playerPos, onInspect) {
  if (!playerPos) return null;
  const px = playerPos.x ?? playerPos.position?.x ?? 0;
  const pz = playerPos.z ?? playerPos.position?.z ?? 0;

  for (let i = 0; i < CULT_ALTARS.length; i++) {
    const altar = CULT_ALTARS[i];
    const dx = altar.x - px;
    const dz = altar.z - pz;
    if (dx * dx + dz * dz < 10) {
      return altar;
    }
  }
  return null;
}
