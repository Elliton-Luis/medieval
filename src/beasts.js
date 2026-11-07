import * as THREE from "three";
import { addDetail, finalizeMonster } from "./monsterParts.js";
import { spawnLoot, addGood, PlayerInventory, PlayerStats } from "./rpg.js";
import { WorldDecay } from "./decay.js";

// ============================================================================
// Texturas Suaves para Efeitos de Brilho e Aura (Zero-GC)
// ============================================================================
let _yellowGlowTexture = null;
function getYellowGlowTexture() {
  if (!_yellowGlowTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.0, "rgba(255, 255, 220, 1.0)");
    g.addColorStop(0.2, "rgba(255, 235, 60, 0.9)");
    g.addColorStop(0.5, "rgba(255, 190, 20, 0.45)");
    g.addColorStop(0.8, "rgba(220, 140, 10, 0.12)");
    g.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    _yellowGlowTexture = new THREE.CanvasTexture(canvas);
    _yellowGlowTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return _yellowGlowTexture;
}

let _auraMistTexture = null;
function getAuraMistTexture() {
  if (!_auraMistTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0.0, "rgba(255, 240, 90, 0.52)");
    g.addColorStop(0.25, "rgba(255, 215, 50, 0.36)");
    g.addColorStop(0.55, "rgba(230, 170, 25, 0.16)");
    g.addColorStop(0.82, "rgba(180, 120, 10, 0.04)");
    g.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    _auraMistTexture = new THREE.CanvasTexture(canvas);
    _auraMistTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return _auraMistTexture;
}

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

// Materiais próprios do Gulur com emissive e iluminação sutil para destaque noturno
const _gulurBodyMat = new THREE.MeshStandardMaterial({
  color: 0x1f1d24,
  roughness: 0.85,
  metalness: 0.12,
  emissive: 0x2e2307,
  emissiveIntensity: 0.45,
  flatShading: true,
});

const _gulurLegMat = new THREE.MeshStandardMaterial({
  color: 0x17151c,
  roughness: 0.85,
  metalness: 0.12,
  emissive: 0x241c05,
  emissiveIntensity: 0.40,
  flatShading: true,
});

// Olhos amarelos intensos e brilhantes do Gulur (Bicho Altão)
const _gulurGlowingEyeMat = new THREE.MeshBasicMaterial({
  color: 0xffff33,
  toneMapped: false,
});

const _gulurAuraMeshMat = new THREE.MeshBasicMaterial({
  color: 0xffd533,
  transparent: true,
  opacity: 0.16,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// Olhos amarelos brilhantes gerais
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

const _WHITE_FLASH = new THREE.Color("#ffffff");
const _RED_FLASH = new THREE.Color("#ff1122");
const _ZERO_FLASH = new THREE.Color("#000000");

const _mouthInteriorMat = new THREE.MeshBasicMaterial({
  color: 0x4a0a0e,
});

const _tornClothMat = new THREE.MeshStandardMaterial({
  color: 0x2b221d,
  roughness: 0.95,
  flatShading: true,
});

const _pupilMat = new THREE.MeshBasicMaterial({
  color: 0x050403,
});

const _boneSpineMat = new THREE.MeshStandardMaterial({
  color: 0xd0c4a4,
  roughness: 0.85,
  metalness: 0.08,
  flatShading: true,
});

const _bloodDriedMat = new THREE.MeshStandardMaterial({
  color: 0x48080c,
  roughness: 0.75,
  metalness: 0.15,
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
    this._groundY = 0;

    this.root = new THREE.Group();
    this.root.name = "Gulur";
    this.root.visible = false; // Começa invisível de dia
    this.root.userData = { entity: this, type: "MONSTER" };

    // Torso quadrúpede no topo (a 16m de altura, acima das copas das árvores)
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.set(0, 16.2, 0);
    this.root.add(this.bodyGroup);

    // Tronco e costelas do quadrúpede
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 3.8), _gulurBodyMat);
    torsoMesh.castShadow = true;
    this.bodyGroup.add(torsoMesh);

    // Crista de espinhos ósseos afiados ao longo da espinha dorsal
    for (let s = 0; s < 6; s++) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 4), _boneSpineMat);
      spine.position.set(0, 0.75, 1.4 - s * 0.55);
      spine.rotation.x = -0.35;
      this.bodyGroup.add(spine);
    }

    // Tiras de tecido negro rasgado e esfarrapado pendentes dos flancos
    for (let t = 0; t < 4; t++) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.35), _tornClothMat);
      flap.position.set((t % 2 === 0 ? 0.8 : -0.8), -0.6, 0.8 - Math.floor(t / 2) * 1.2);
      flap.rotation.z = (t % 2 === 0 ? 0.15 : -0.15);
      this.bodyGroup.add(flap);
    }

    // Caixa torácica esguia / flancos
    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.8), _gulurBodyMat);
    chestMesh.position.set(0, -0.1, -0.9);
    this.bodyGroup.add(chestMesh);

    // Pescoço e Cabeça canina estilizada no topo
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.4, -1.9);
    this.bodyGroup.add(this.neck);

    const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 1.2), _gulurBodyMat);
    neckMesh.position.set(0, 0.4, -0.4);
    neckMesh.rotation.x = -0.35;
    this.neck.add(neckMesh);

    // Cabeça alongada com focinho canino
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 1.4), _gulurBodyMat);
    headMesh.position.set(0, 0.95, -0.95);
    this.neck.add(headMesh);

    // Focinho esguio
    const snoutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.9), _gulurBodyMat);
    snoutMesh.position.set(0, 0.85, -1.7);
    this.neck.add(snoutMesh);

    // Mandíbula inferior com presas aterradoras
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.85), _gulurBodyMat);
    jawMesh.position.set(0, 0.55, -1.65);
    this.neck.add(jawMesh);
    for (let f of [-0.18, 0.18]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 4), _teethMat);
      fang.position.set(f, 0.68, -1.9);
      fang.rotation.x = Math.PI;
      this.neck.add(fang);
    }

    // ========================================================================
    // Visual Aterrorizante do Gulur: Crista Óssea Espinhosa & Chifres Negros
    // ========================================================================
    // Chifres curvos e retorcidos brotando do topo do crânio
    for (let side of [-1, 1]) {
      const hornGroup = new THREE.Group();
      hornGroup.position.set(side * 0.32, 1.35, -0.85);
      hornGroup.rotation.set(0.3, side * 0.25, side * 0.4);

      const hornBase = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 5), _boneSpineMat);
      hornBase.position.set(0, 0.35, 0);
      hornGroup.add(hornBase);

      const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6, 4), _boneSpineMat);
      hornTip.position.set(side * 0.08, 0.85, -0.12);
      hornTip.rotation.set(-0.35, 0, side * 0.2);
      hornGroup.add(hornTip);

      this.neck.add(hornGroup);
    }

    // Crista dorsal espinhosa ao longo do topo do crânio e pescoço
    for (let s = 0; s < 4; s++) {
      const crestSpike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45 - s * 0.06, 4), _boneSpineMat);
      crestSpike.position.set(0, 1.25 - s * 0.2, -0.55 + s * 0.28);
      crestSpike.rotation.x = -0.45;
      this.neck.add(crestSpike);
    }

    // ========================================================================
    // Olhos Amarelos Múltiplos, Grandes e Ameaçadores (Cluster Eldritch)
    // ========================================================================
    const eyeGlowTex = getYellowGlowTexture();
    const eyeSpriteMat = new THREE.SpriteMaterial({
      map: eyeGlowTex,
      color: 0xffea22,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.eyeHalos = [];

    // Conjunto de 10 Grandes Olhos Amarelos espalhados pelo Crânio, Têmporas, Focinho e Pescoço
    const eyeConfigs = [
      // 2 Olhos Frontais Principais (Grandes, colossais na face dianteira)
      { pos: [0.38, 1.18, -1.35], r: 0.28, pupilH: 0.32, haloScale: 2.2 },
      { pos: [-0.38, 1.18, -1.35], r: 0.28, pupilH: 0.32, haloScale: 2.2 },
      // 2 Olhos Superiores da Fronte (No alto da testa, encarando o céu/presa)
      { pos: [0.24, 1.42, -1.05], r: 0.22, pupilH: 0.26, haloScale: 1.8 },
      { pos: [-0.24, 1.42, -1.05], r: 0.22, pupilH: 0.26, haloScale: 1.8 },
      // 2 Olhos Temporais Laterais (Nas laterais da cabeça, vigiando os flancos)
      { pos: [0.44, 0.98, -0.75], r: 0.24, pupilH: 0.28, haloScale: 1.9 },
      { pos: [-0.44, 0.98, -0.75], r: 0.24, pupilH: 0.28, haloScale: 1.9 },
      // 2 Olhos Inferiores do Focinho (Próximos às mandíbulas caninas e presas)
      { pos: [0.28, 0.76, -1.58], r: 0.19, pupilH: 0.22, haloScale: 1.6 },
      { pos: [-0.28, 0.76, -1.58], r: 0.19, pupilH: 0.22, haloScale: 1.6 },
      // 2 Olhos Aberrantes no Pescoço (Brotando no dorso do pescoço)
      { pos: [0.36, 0.45, -0.55], r: 0.21, pupilH: 0.24, haloScale: 1.7 },
      { pos: [-0.36, 0.45, -0.55], r: 0.21, pupilH: 0.24, haloScale: 1.7 },
    ];

    for (const ec of eyeConfigs) {
      const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(ec.r, 8, 6), _gulurGlowingEyeMat);
      eyeMesh.position.set(ec.pos[0], ec.pos[1], ec.pos[2]);
      this.neck.add(eyeMesh);

      // Fenda preta predadora de pupila
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, ec.pupilH, ec.r * 0.4), _pupilMat);
      pupil.position.set(0, 0, -ec.r * 0.85);
      eyeMesh.add(pupil);

      // Halo luminoso aditivo
      const halo = new THREE.Sprite(eyeSpriteMat.clone());
      halo.scale.set(ec.haloScale, ec.haloScale, 1.0);
      halo.position.set(0, 0, -ec.r * 0.5);
      halo.userData = { baseScale: ec.haloScale };
      eyeMesh.add(halo);
      this.eyeHalos.push(halo);
    }

    // ========================================================================
    // Aura Amarela Simples e Elegante do Gulur (Sem cilindro artificial)
    // ========================================================================
    // 1. Luz pontual suave banhando o dorso e pernas superiores do colosso
    // NÃO é uma PointLight real: luzes que aparecem/somem com o monstro mudam o número de luzes da cena e forçam o
    // three a RECOMPILAR todos os shaders com iluminação (stutter de ~1 s ao anoitecer/amanhecer). O visual da aura
    // vem do halo aditivo abaixo; aqui fica só o valor de intensidade que a lógica já pulsa/apaga.
    this.auraLight = { intensity: 2.6 };

    // 2. Halo/Sprite de neblina etérea suave em volta do corpo
    const auraMistTex = getAuraMistTexture();
    const auraSpriteMat = new THREE.SpriteMaterial({
      map: auraMistTex,
      color: 0xffe244,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.auraSprite = new THREE.Sprite(auraSpriteMat);
    this.auraSprite.scale.set(13.0, 9.5, 1.0);
    this.auraSprite.position.set(0, 0.2, 0);
    this.bodyGroup.add(this.auraSprite);

    // 3. Motes / partículas douradas flutuantes ao redor do corpo
    const moteCount = 16;
    const moteGeo = new THREE.BufferGeometry();
    const motePos = new Float32Array(moteCount * 3);
    for (let m = 0; m < moteCount; m++) {
      motePos[m * 3 + 0] = (Math.random() - 0.5) * 4.2;
      motePos[m * 3 + 1] = (Math.random() - 0.5) * 3.2;
      motePos[m * 3 + 2] = (Math.random() - 0.5) * 5.2;
    }
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      map: eyeGlowTex,
      color: 0xffe633,
      size: 0.85,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.auraMotes = new THREE.Points(moteGeo, moteMat);
    this.bodyGroup.add(this.auraMotes);

    // 4 Pernas Finas Colossais (16 metros de altura cada) com Esporões Ósseos
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
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 8.2, 5), _gulurLegMat);
      upper.position.set(0, -4.1, 0);
      legRoot.add(upper);

      // Articulação do joelho alto com esporão ósseo
      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(0, -8.2, 0);
      legRoot.add(kneeGroup);

      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.11, 5, 4), _gulurLegMat);
      kneeGroup.add(kneeJoint);

      const kneeSpur = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 4), _boneSpineMat);
      kneeSpur.position.set(0, 0, -0.16);
      kneeSpur.rotation.x = -Math.PI / 2.2;
      kneeGroup.add(kneeSpur);

      // Canela inferior finíssima até o solo
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 8.2, 5), _gulurLegMat);
      lower.position.set(0, -4.1, 0);
      kneeGroup.add(lower);

      this.legs.push({ legRoot, kneeGroup, upper, lower });

      // Garras/esporões no fim de cada perna (animam junto com o joelho) e tufo de ossos no calcanhar
      addDetail(kneeGroup, [
        { t: "cone", a: [0.07, 0.55, 4], p: [0, -8.3, -0.28], r: [-1.9, 0, 0], c: 0xd0c4a4 },
        { t: "cone", a: [0.06, 0.5, 4], p: [-0.16, -8.3, -0.22], r: [-1.8, 0.35, 0], c: 0xcabd9c },
        { t: "cone", a: [0.06, 0.5, 4], p: [0.16, -8.3, -0.22], r: [-1.8, -0.35, 0], c: 0xcabd9c },
        { t: "cone", a: [0.05, 0.4, 4], p: [0, -8.25, 0.22], r: [1.9, 0, 0], c: 0xb8ab8a },
        { t: "sph", a: [0.12, 5, 4], p: [0, -8.15, 0], s: [1, 0.6, 1.2], c: 0x2a2630 },
        { t: "cone", a: [0.05, 0.45, 4], p: [0, -4.3, 0.12], r: [0.5, 0, 0], c: 0xc6baa0 },
      ], "GulurClaws");
    }

    // Detalhes do tronco (uma malha só): costelas à mostra, quadril pontudo, cauda óssea, feridas
    {
      const d = [];
      for (let i = 0; i < 7; i++) {
        const z = -1.5 + i * 0.5;
        for (const side of [-1, 1]) {
          d.push({ t: "box", a: [0.07, 1.0 - Math.abs(i - 3) * 0.08, 0.13], p: [side * 0.74, -0.15, z], r: [0, 0, -side * 0.28], c: 0xcdc1a2, ao: 0.45 });
        }
      }
      // vértebras proeminentes no dorso (assimétricas)
      for (let i = 0; i < 9; i++) {
        d.push({ t: "cone", a: [0.09 + (i % 3) * 0.02, 0.5 + ((i * 7) % 5) * 0.08, 4], p: [((i % 2) - 0.5) * 0.12, 0.8, -1.5 + i * 0.4], r: [0.35, 0, ((i % 2) - 0.5) * 0.4], c: 0xd8ccae });
      }
      // ossos do quadril
      for (const side of [-1, 1]) {
        d.push({ t: "cone", a: [0.14, 0.75, 4], p: [side * 0.62, 0.78, 1.7], r: [0.2, 0, -side * 0.35], c: 0xcabd9c });
      }
      // cauda: segmentos que afinam, com espinhos
      for (let i = 0; i < 5; i++) {
        const r0 = 0.2 - i * 0.032;
        d.push({ t: "cyl", a: [r0 * 0.8, r0, 0.62, 5], p: [0, 0.15 - i * 0.2, 2.2 + i * 0.55], r: [Math.PI / 2 - 0.3, 0, 0], c: 0x211f27 });
        d.push({ t: "cone", a: [0.05, 0.3, 4], p: [0, 0.38 - i * 0.2, 2.2 + i * 0.55], r: [0.3, 0, 0], c: 0xcabd9c });
      }
      d.push({ t: "cone", a: [0.09, 0.55, 4], p: [0, -0.95, 5.0], r: [Math.PI / 2 + 0.7, 0, 0], c: 0xd0c4a4 });
      // feridas abertas / sangue escorrido nos flancos
      for (const side of [-1, 1]) {
        d.push({ t: "box", a: [0.05, 0.5, 0.8], p: [side * 0.71, -0.05, -0.55 + side * 0.4], c: 0x5c0a10, ao: 1 });
        d.push({ t: "box", a: [0.05, 0.9, 0.12], p: [side * 0.72, -0.75, -0.3 + side * 0.4], c: 0x430609, ao: 1 });
      }
      addDetail(this.bodyGroup, d, "GulurTorsoDetail");

      // Cabeça: fileira de dentes, presas, saliência óssea e baba sangrenta
      const h = [];
      for (let i = 0; i < 6; i++) {
        for (const side of [-1, 1]) {
          h.push({ t: "cone", a: [0.03, 0.15 + (i % 2) * 0.06, 4], p: [side * 0.21, 0.68, -1.3 - i * 0.14], r: [Math.PI, 0, 0], c: 0xf0e8d4, ao: 0.8 });
          h.push({ t: "cone", a: [0.028, 0.12 + ((i + 1) % 2) * 0.06, 4], p: [side * 0.2, 0.46, -1.3 - i * 0.14], c: 0xe4dcc6, ao: 0.8 });
        }
      }
      for (const side of [-1, 1]) {
        h.push({ t: "cone", a: [0.06, 0.4, 4], p: [side * 0.24, 0.5, -1.92], r: [Math.PI, 0, 0], c: 0xfff6e0 });
        h.push({ t: "box", a: [0.1, 0.1, 0.8], p: [side * 0.34, 1.2, -1.0], r: [0.12, 0, 0], c: 0xcabd9c });
      }
      h.push({ t: "box", a: [0.05, 0.4, 0.05], p: [0.12, 0.28, -1.75], c: 0x5a0a10, ao: 1 });
      h.push({ t: "box", a: [0.04, 0.55, 0.04], p: [-0.15, 0.22, -1.7], c: 0x5a0a10, ao: 1 });
      h.push({ t: "box", a: [0.5, 0.05, 0.5], p: [0, 0.84, -1.55], c: 0x4a0c10, ao: 1 });
      addDetail(this.neck, h, "GulurHeadDetail");
    }

    finalizeMonster(this.root, this); // funde partes estáticas (menos draw calls e materiais)
    this.flashMaterials = [];
    this.root.traverse((child) => {
      if (child.isMesh && child.material && child.material.emissive) {
        if (!child._origMaterial) {
          child.material = child.material.clone();
          child._origMaterial = true;
        }
        this.flashMaterials.push(child.material);
      }
    });
    this._flashTimer = 0;
    this._hitHop = 0;
    this._tremorTimer = 0;

    this._groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, this._groundY, z);
    scene.add(this.root);
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.5);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this._flashTimer = 0.24;
    this._hitHop = 0.55;
    this._tremorTimer = 0.35;

    const mag = Math.hypot(dirX, dirZ);
    if (mag > 0.01) {
      this.x += (dirX / mag) * (0.6 * force);
      this.z += (dirZ / mag) * (0.6 * force);
    }

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
    // Só aparece e existe estritamente à noite (ou se invocado via comando de teste)
    const active = isNight || Boolean(this._forceSpawned);
    if (!active) {
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
        // Desvanece a aura e as luzes durante o colapso
        if (this.auraLight) {
          this.auraLight.intensity = Math.max(0, this.auraLight.intensity - dt * 1.5);
        }
        if (this.auraSprite) {
          this.auraSprite.material.opacity = Math.max(0, this.auraSprite.material.opacity - dt * 0.18);
        }
        if (this.eyeHalos) {
          for (let i = 0; i < this.eyeHalos.length; i++) {
            this.eyeHalos[i].scale.multiplyScalar(Math.max(0, 1.0 - dt * 1.2));
          }
        }
      } else if (this.deadTime > 5.0) {
        this.root.visible = false;
      }
      return;
    }

    if (!this.root.visible) this.root.visible = true;

    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const isWhite = this._flashTimer > 0.12;
      const c = this._flashTimer > 0 ? (isWhite ? _WHITE_FLASH : _RED_FLASH) : _ZERO_FLASH;
      const intensity = this._flashTimer > 0 ? (isWhite ? 1.0 : 0.85) : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.copy(c);
        this.flashMaterials[i].emissiveIntensity = intensity;
      }
    }

    // Pulsação suave e respiração etérea da Aura Amarela e dos Olhos
    const tNow = performance.now() * 0.002;
    const auraPulse = 1.0 + Math.sin(tNow * 1.8) * 0.08;
    if (this.auraLight) {
      this.auraLight.intensity = 2.6 + Math.sin(tNow * 1.8) * 0.4;
    }
    if (this.auraSprite) {
      this.auraSprite.scale.set(13.0 * auraPulse, 9.5 * auraPulse, 1.0);
      this.auraSprite.material.opacity = (0.32 + Math.sin(tNow * 1.2) * 0.05) * Math.min(1, (this.auraLight?.intensity ?? 2.6) / 2.6);
    }
    if (this.eyeHalos) {
      const eyeFlicker = 1.0 + Math.sin(tNow * 3.2) * 0.12;
      for (let i = 0; i < this.eyeHalos.length; i++) {
        const h = this.eyeHalos[i];
        const s = (h.userData?.baseScale || 2.0) * eyeFlicker;
        h.scale.set(s, s, 1.0);
      }
    }
    if (this.auraMotes) {
      const pArr = this.auraMotes.geometry.attributes.position.array;
      const count = pArr.length / 3;
      for (let i = 0; i < count; i++) {
        pArr[i * 3 + 1] += dt * 0.75;
        if (pArr[i * 3 + 1] > 2.6) {
          pArr[i * 3 + 1] = -2.2;
        }
      }
      this.auraMotes.geometry.attributes.position.needsUpdate = true;
    }

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
    const distSq = dx * dx + dz * dz;

    const hasCultRobe = Boolean(PlayerInventory.hasDemiurgeRobe || PlayerStats.wearingDemiurgeRobe);

    // Se o jogador estiver de túnica do culto, o Gulur não se espanta e encara com serenidade:
    if (hasCultRobe) {
      this.state = "staring";
      const targetYaw = Math.atan2(dx, dz);
      this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 1.8);
      this.root.rotation.y = this.heading;
      this.speed = Math.max(0, this.speed - dt * 5.0);
    } else if (distSq > 784) {
      if (this.fleeTimer > 0) {
        this.fleeTimer -= dt;
        // Desacelera suavemente ao atingir distância segura
        this.speed = Math.max(0, this.speed - dt * 3.5);
      } else {
        this.state = "staring";
        const targetYaw = Math.atan2(dx, dz);
        this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 1.8);
        this.root.rotation.y = this.heading;
        this.speed = Math.max(0, this.speed - dt * 5.0);
      }
    } else {
      // Jogador chegou muito perto (<= 28m): o Gulur se assusta e recua com passadas elegantes na direção oposta
      this.state = "fleeing";
      this.fleeTimer = 3.5;

      const fleeYaw = Math.atan2(-dx, -dz);
      this.heading = THREE.MathUtils.lerp(this.heading, fleeYaw, dt * 3.0);
      this.root.rotation.y = this.heading;
      this.speed = THREE.MathUtils.lerp(this.speed, 7.8, dt * 3.5);
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

    if (this._groundY === undefined || this.speed > 0.1) {
      this._groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    }
    let hopY = 0;
    if (this._hitHop > 0) {
      this._hitHop = Math.max(0, this._hitHop - dt * 2.8);
      hopY = this._hitHop * 1.8;
    }
    let tremX = 0;
    let tremZ = 0;
    if (this._tremorTimer > 0) {
      this._tremorTimer = Math.max(0, this._tremorTimer - dt);
      const trem = (this._tremorTimer / 0.35) * 0.28;
      tremX = (Math.random() - 0.5) * trem;
      tremZ = (Math.random() - 0.5) * trem;
    }
    this.root.position.set(this.x + tremX, this._groundY + hopY, this.z + tremZ);

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

  reposition(x, z) {
    this.x = x;
    this.z = z;
    this.alive = true;
    this.health = this.maxHealth;
    this.state = "staring";
    this.deadTime = 0;
    this.fleeTimer = 0;
    this.speed = 0;
    this.root.userData.isDead = false;
    this.bodyGroup.position.set(0, 16.2, 0);
    this.bodyGroup.rotation.set(0, 0, 0);
    for (let i = 0; i < 4; i++) {
      this.legs[i].legRoot.rotation.set(0, 0, 0);
      this.legs[i].kneeGroup.rotation.set(0, 0, 0);
    }
    if (this.auraLight) this.auraLight.intensity = 2.6;
    if (this.auraSprite) this.auraSprite.material.opacity = 0.32;
    this._groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, this._groundY, z);
    this.root.visible = true;
    if (this.npcs?.spatialGrid) {
      if (this._inGrid) this.npcs.spatialGrid.remove(this);
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
    }
  }
}

// Alias de retrocompatibilidade
export { Gulur as TallWalker };

// ============================================================================
// 2. Necron: O Humanoide Cego (Sem topo da cabeça, dentes expostos, fica esperando)
// ============================================================================
export class Necron {
  constructor(scene, world, effects, combat, player, npcs, x, z, audio = null) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = combat;
    this.player = player;
    this.npcs = npcs;
    this.audio = audio;
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
    this._stepTimer = 0;
    this._howlCooldown = 0;

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

    // Costelas salientes e vértebras visíveis sob a pele esticada
    for (let r = 0; r < 4; r++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.26), _boneSpineMat);
      rib.position.set(0, 0.82 + r * 0.12, 0.01);
      this.model.add(rib);
    }

    // Farrapos rasgados no tronco e cintura
    const rag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.28), _tornClothMat);
    rag.position.set(0, 0.75, 0.02);
    this.model.add(rag);

    // CABEÇA ASSUSTADORA: SEM TOPO, SEM OLHOS, APENAS A BOCA COM DUPLA CAMADA DE DENTES EXPOSTOS
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.38, -0.12);
    this.model.add(this.headGroup);

    // Mandíbula inferior e base do queixo cadavérico
    const jawBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.38), _paleSkinMat);
    jawBase.position.set(0, 0, 0);
    this.headGroup.add(jawBase);

    // Borda da boca com manchas de sangue seco e putrefação
    const rimStain = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.40), _bloodDriedMat);
    rimStain.position.set(0, 0.08, 0);
    this.headGroup.add(rimStain);

    // Interior carmesim-profundo da boca escancarada
    const mouthCavity = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.30), _mouthInteriorMat);
    mouthCavity.position.set(0, 0.04, -0.02);
    this.headGroup.add(mouthCavity);

    // 1ª CAMADA EXTERNA: Dentes triangulares afiados brancos visíveis ao redor de toda a borda
    for (let d = 0; d < 12; d++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.13, 4), _teethMat);
      const angle = (d / 12) * Math.PI * 2;
      tooth.position.set(Math.cos(angle) * 0.14, 0.11, Math.sin(angle) * 0.14 - 0.02);
      tooth.rotation.x = Math.PI;
      this.headGroup.add(tooth);
    }

    // 2ª CAMADA INTERNA: Fileira concêntrica de dentes ósseos afiados e desiguais
    for (let d2 = 0; d2 < 8; d2++) {
      const innerTooth = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 4), _boneSpineMat);
      const angle2 = (d2 / 8) * Math.PI * 2 + 0.2;
      innerTooth.position.set(Math.cos(angle2) * 0.09, 0.08, Math.sin(angle2) * 0.09 - 0.02);
      innerTooth.rotation.x = Math.PI;
      this.headGroup.add(innerTooth);
    }

    // Braços esguios com dedos em agulha alongados
    this.arms = [];
    const armGeo = new THREE.BoxGeometry(0.12, 0.75, 0.12);

    for (const s of [1, -1]) {
      const armGroup = new THREE.Group();
      armGroup.position.set(s * 0.28, 1.25, -0.1);

      const armMesh = new THREE.Mesh(armGeo, _paleSkinMat);
      armMesh.position.set(0, -0.32, 0);
      armGroup.add(armMesh);

      // Três garras/dedos longos em forma de agulha cadavérica
      for (let f = 0; f < 3; f++) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.22, 4), _boneSpineMat);
        finger.position.set((f - 1) * 0.035, -0.72, 0.04);
        finger.rotation.x = Math.PI * 0.85;
        armGroup.add(finger);
      }

      this.model.add(armGroup);
      this.arms.push(armGroup);
    }

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

    // --- Detalhes do Necron (malhas fundidas) ---
    {
      const d = [];
      // coluna vertebral saltada nas costas + omoplatas
      for (let i = 0; i < 7; i++) {
        d.push({ t: "cone", a: [0.035, 0.1 + (i % 3) * 0.03, 4], p: [((i % 2) - 0.5) * 0.02, 0.72 + i * 0.1, 0.14 - i * 0.004], r: [Math.PI / 2 - 0.2, 0, 0], c: 0xd6caa8 });
      }
      for (const side of [-1, 1]) d.push({ t: "box", a: [0.13, 0.17, 0.03], p: [side * 0.1, 1.2, 0.15], r: [0.1, 0, side * 0.25], c: 0x8c867c });
      // carne exposta e feridas no peito/abdômen
      d.push({ t: "box", a: [0.2, 0.2, 0.02], p: [0.05, 1.0, -0.125], r: [-0.22, 0, 0], c: 0x6a1c20, ao: 1 });
      d.push({ t: "box", a: [0.12, 0.28, 0.02], p: [-0.1, 0.8, -0.13], r: [-0.22, 0, 0.1], c: 0x4a0d12, ao: 1 });
      // pelve + trapos presos por tiras de pele
      d.push({ t: "box", a: [0.3, 0.1, 0.2], p: [0, 0.58, 0.04], c: 0x8a8478 });
      for (let i = 0; i < 4; i++) d.push({ t: "box", a: [0.05, 0.3 + (i % 2) * 0.12, 0.02], p: [(i - 1.5) * 0.09, 0.45, -0.1], r: [0.1, 0, ((i % 2) - 0.5) * 0.2], c: 0x2b221d });
      addDetail(this.model, d, "NecronBodyDetail");

      // Cabeça: coroa de ossos quebrados, cabelo ralo/pele pendente, baba de sangue
      const h = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        h.push({ t: "cone", a: [0.03, 0.12 + (i % 3) * 0.07, 4], p: [Math.cos(a) * 0.15, 0.2 + (i % 2) * 0.03, Math.sin(a) * 0.15 - 0.02], r: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], c: 0xcdc1a2 });
      }
      for (let i = 0; i < 6; i++) h.push({ t: "box", a: [0.015, 0.28 + (i % 3) * 0.1, 0.015], p: [(i - 2.5) * 0.05, 0.02 - (i % 2) * 0.03, 0.2], c: 0x15110e, ao: 0.9 });
      for (let i = 0; i < 3; i++) h.push({ t: "box", a: [0.015, 0.22 + i * 0.07, 0.015], p: [(i - 1) * 0.08, -0.22, -0.18], c: 0x5a0a10, ao: 1 });
      h.push({ t: "box", a: [0.1, 0.02, 0.02], p: [0, -0.1, -0.2], c: 0x5a0a10, ao: 1 });
      addDetail(this.headGroup, h, "NecronHeadDetail");

      // Braços: cotovelo ósseo e dedos mais longos
      for (const armGroup of this.arms) {
        addDetail(armGroup, [
          { t: "cone", a: [0.045, 0.2, 4], p: [0, -0.34, 0.09], r: [1.2, 0, 0], c: 0xd0c4a4 },
          { t: "sph", a: [0.07, 5, 4], p: [0, -0.34, 0], c: 0x8a8478 },
          { t: "cone", a: [0.012, 0.3, 4], p: [-0.05, -0.9, 0.04], r: [Math.PI * 0.88, 0, 0.15], c: 0xd6caa8 },
          { t: "cone", a: [0.012, 0.3, 4], p: [0.05, -0.9, 0.04], r: [Math.PI * 0.88, 0, -0.15], c: 0xd6caa8 },
          { t: "box", a: [0.02, 0.2, 0.02], p: [0.04, -0.15, 0.07], c: 0x5a0a10, ao: 1 },
        ], "NecronArmDetail");
      }
      // Pernas: joelho, canela fina e garras no pé
      for (const leg of this.legs) {
        addDetail(leg, [
          { t: "cone", a: [0.05, 0.16, 4], p: [0, 0.02, -0.1], r: [-Math.PI / 2, 0, 0], c: 0xd0c4a4 },
          { t: "box", a: [0.16, 0.06, 0.26], p: [0, -0.4, -0.06], c: 0x4a4540 },
          { t: "cone", a: [0.02, 0.14, 4], p: [-0.04, -0.4, -0.2], r: [-Math.PI / 2, 0, 0], c: 0xcabd9c },
          { t: "cone", a: [0.02, 0.14, 4], p: [0.04, -0.4, -0.2], r: [-Math.PI / 2, 0, 0], c: 0xcabd9c },
        ], "NecronLegDetail");
      }
    }

    const groundY = this.world ? this.world.heightAt(x, z) : 0;
    this._groundY = groundY;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);

    finalizeMonster(this.root, this); // funde partes estáticas (menos draw calls e materiais)
    this.flashMaterials = [];
    this.root.traverse((child) => {
      if (child.isMesh && child.material) {
        if (!child._origMaterial) {
          child.material = child.material.clone();
          child._origMaterial = true;
        }
        this.flashMaterials.push(child.material);
      }
    });
    this._flashTimer = 0;
    this._hitHop = 0;
    this._tremorTimer = 0;

    this._inGrid = false;
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.5);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this._flashTimer = 0.24;
    this._hitHop = 0.45;
    this._tremorTimer = 0.28;

    if (this.effects) {
      this.effects.play("star", this.x, this.root.position.y + 1.1, this.z, "#ff2233", 1.4);
      this.effects.play("slash", this.x, this.root.position.y + 1.2, this.z, "#cc1122", 1.2);
    }

    // Recuo de impacto
    const mag = Math.hypot(dirX, dirZ);
    if (mag > 0.01) {
      this.x += (dirX / mag) * (0.85 * force);
      this.z += (dirZ / mag) * (0.85 * force);
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

    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const isWhite = this._flashTimer > 0.12;
      const c = this._flashTimer > 0 ? (isWhite ? _WHITE_FLASH : _RED_FLASH) : _ZERO_FLASH;
      const intensity = this._flashTimer > 0 ? (isWhite ? 1.0 : 0.85) : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        if (this.flashMaterials[i].emissive) {
          this.flashMaterials[i].emissive.copy(c);
          this.flashMaterials[i].emissiveIntensity = intensity;
        }
      }
    }

    // Garante presença na Spatial Grid de combate à noite para ser atingido e focado
    if (this.npcs?.spatialGrid && !this._inGrid) {
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this._howlCooldown > 0) this._howlCooldown -= dt;

    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    const py = (this.player.root?.position?.y || 0);
    const dx = px - this.x;
    const dz = pz - this.z;
    const distSq = dx * dx + dz * dz;

    const hasCultRobe = Boolean(PlayerInventory.hasDemiurgeRobe || PlayerStats.wearingDemiurgeRobe);

    // O Necron reconhece o Manto da Seita do Demiurgo e não ataca discípulos
    if (!hasCultRobe && distSq <= 56.25) {
      if (this.state !== "charging" && this._howlCooldown <= 0) {
        this._howlCooldown = 5.0;
        this.audio?.playWolfHowl?.(0.85, Math.sqrt(distSq));
      }
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
      this.headGroup.rotation.z = 0;

      // Ataque de mordida feroz corpo a corpo (<= 2.2m, distSq <= 4.84)
      if (distSq <= 4.84) {
        this.speed = 1.8; // Desacelera para infligir a mordida sem atravessar o corpo
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 0.95;
          this.audio?.playWolfHowl?.(0.65, Math.sqrt(distSq));
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
      // Quando o jogador está afastado ou veste o manto da seita: O Necron FICA ESPERANDO
      this.state = "waiting";
      this.speed = 0; // Imóvel esperando a presa
      this.model.rotation.x = 0.08;

      // Movimentos sutis de respiração com espasmos e tremores nervosos no pescoço
      const now = performance.now();
      const breath = Math.sin(now * 0.0035) * 0.06;
      const twitch = Math.sin(now * 0.006) > 0.93 ? (Math.sin(now * 0.035) * 0.22) : 0;

      this.headGroup.rotation.x = breath;
      this.headGroup.rotation.z = twitch;
      this.headGroup.rotation.y = twitch * 0.75;

      for (let i = 0; i < this.arms.length; i++) {
        this.arms[i].rotation.x = -0.15 + breath * 0.5;
        this.arms[i].rotation.z = (i === 0 ? 1 : -1) * (0.05 + Math.abs(twitch) * 0.4);
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

      this._stepTimer = (this._stepTimer || 0) + dt;
      if (this._stepTimer >= 0.22) {
        this._stepTimer = 0;
        this.audio?.playBeastStep?.(Math.sqrt(distSq));
      }
    } else {
      this.legs[0].rotation.x = 0;
      this.legs[1].rotation.x = 0;
    }

    if (this._groundY === undefined || this.speed > 0.05) {
      this._groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    }
    let hopY = 0;
    if (this._hitHop > 0) {
      this._hitHop = Math.max(0, this._hitHop - dt * 3.2);
      hopY = this._hitHop * 1.8;
    }
    let tremX = 0;
    let tremZ = 0;
    if (this._tremorTimer > 0) {
      this._tremorTimer = Math.max(0, this._tremorTimer - dt);
      const trem = (this._tremorTimer / 0.28) * 0.18;
      tremX = (Math.random() - 0.5) * trem;
      tremZ = (Math.random() - 0.5) * trem;
    }
    this.root.position.set(this.x + tremX, this._groundY + hopY, this.z + tremZ);

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

  reposition(x, z) {
    this.x = x;
    this.z = z;
    this.alive = true;
    this.health = this.maxHealth;
    this.state = "waiting";
    this.deadTime = 0;
    this.speed = 0;
    this.root.userData.isDead = false;
    this.torso.rotation.set(0, 0, 0);
    this.torso.position.set(0, 0.8, 0);
    this.legs[0].rotation.set(0, 0, 0);
    this.legs[1].rotation.set(0, 0, 0);
    this._groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, this._groundY, z);
    this.root.visible = true;
    if (this.npcs?.spatialGrid) {
      if (this._inGrid) this.npcs.spatialGrid.remove(this);
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
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

    // Crista de chifres ósseos occipitais projetando-se para trás
    for (let h = 0; h < 3; h++) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.38, 4), _boneSpineMat);
      horn.position.set(0, 0.22 - h * 0.18, -0.15 - h * 0.05);
      horn.rotation.x = -Math.PI * 0.35;
      this.headGroup.add(horn);
    }

    // 6 OLHOS AMARELOS INCANDESCENTES alinhados em duas colunas verticais com pupilas de fenda negra
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
      // Órbita ocular sombria rebaixada
      const socketMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), _shadowBodyMat);
      socketMesh.position.set(eyePositions[e].x, eyePositions[e].y, eyePositions[e].z - 0.02);
      this.headGroup.add(socketMesh);

      const eye = new THREE.Mesh(eyeGeo, _glowingYellowEyeMat);
      eye.position.set(eyePositions[e].x, eyePositions[e].y, eyePositions[e].z);

      // Fenda de pupila vertical preta
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, 0.03), _pupilMat);
      pupil.position.set(0, 0, 0.045);
      eye.add(pupil);

      this.headGroup.add(eye);
      this.eyes.push(eye);
    }

    // Tiras de manto sombrio fantasmagórico pendentes dos ombros
    for (let sh = 0; sh < 4; sh++) {
      const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.18), _tornClothMat);
      shroud.position.set((sh % 2 === 0 ? 0.32 : -0.32), 2.1 - Math.floor(sh / 2) * 0.3, -0.05);
      shroud.rotation.z = (sh % 2 === 0 ? 0.15 : -0.15);
      this.model.add(shroud);
    }

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

    // --- Detalhes do Hexoculus: cornos de galhada, costelas em arco, mantos esfarrapados, juntas pontudas ---
    {
      const d = [];
      for (let r = 0; r < 6; r++) {
        for (const side of [-1, 1]) {
          d.push({ t: "box", a: [0.28, 0.035, 0.05], p: [side * 0.2, 1.38 + r * 0.19, 0.12], r: [0, side * -0.5, side * -0.18], c: 0xcec2a2, ao: 0.5 });
        }
      }
      for (const side of [-1, 1]) {
        d.push({ t: "cone", a: [0.08, 0.55, 4], p: [side * 0.34, 2.62, 0], r: [0, 0, -side * 0.9], c: 0xcabd9c });
        d.push({ t: "cone", a: [0.05, 0.45, 4], p: [side * 0.5, 2.68, -0.05], r: [0.2, 0, -side * 1.2], c: 0xd6caa8 });
      }
      // pelve e cinta de tiras rasgadas
      d.push({ t: "box", a: [0.4, 0.14, 0.24], p: [0, 1.2, 0], c: 0x211f27 });
      for (let i = 0; i < 6; i++) d.push({ t: "box", a: [0.07, 0.8 + (i % 3) * 0.2, 0.025], p: [(i - 2.5) * 0.09, 0.72, 0.13], r: [0.06, 0, ((i % 2) - 0.5) * 0.12], c: 0x2b221d });
      // ferida pulsante no peito
      d.push({ t: "box", a: [0.16, 0.34, 0.03], p: [0.04, 1.85, 0.12], c: 0x5a0a10, ao: 1 });
      d.push({ t: "box", a: [0.03, 0.55, 0.03], p: [0.1, 1.45, 0.12], c: 0x430609, ao: 1 });
      addDetail(this.model, d, "HexoBodyDetail");

      // coroa de espinhos na cabeça + mandíbula de dentes sem boca
      const h = [];
      for (let i = 0; i < 5; i++) {
        const a = -0.7 + i * 0.35;
        h.push({ t: "cone", a: [0.025, 0.35 + (i % 2) * 0.15, 4], p: [Math.sin(a) * 0.14, 0.4, -0.08], r: [-0.3, 0, -a * 0.9], c: 0xd0c4a4 });
      }
      for (let i = 0; i < 5; i++) h.push({ t: "cone", a: [0.015, 0.1, 4], p: [(i - 2) * 0.04, -0.3, 0.13], r: [Math.PI, 0, 0], c: 0xefe6cf });
      addDetail(this.headGroup, h, "HexoHeadDetail");

      for (const armRoot of this.arms) {
        addDetail(armRoot, [
          { t: "cone", a: [0.05, 0.28, 4], p: [0, -0.85, -0.1], r: [-1.1, 0, 0], c: 0xd0c4a4 },
          { t: "sph", a: [0.07, 5, 4], p: [0, -0.9, 0.05], c: 0x15141a },
          { t: "cone", a: [0.014, 0.32, 4], p: [-0.04, -1.8, 0.14], r: [Math.PI * 0.9, 0, 0.1], c: 0xd6caa8 },
          { t: "cone", a: [0.014, 0.32, 4], p: [0.04, -1.8, 0.14], r: [Math.PI * 0.9, 0, -0.1], c: 0xd6caa8 },
        ], "HexoArmDetail");
      }
      for (const legRoot of this.legs) {
        addDetail(legRoot, [
          { t: "cone", a: [0.045, 0.22, 4], p: [0, -0.62, 0.1], r: [1.2, 0, 0], c: 0xd0c4a4 },
          { t: "box", a: [0.12, 0.05, 0.3], p: [0, -1.33, 0.08], c: 0x15141a },
          { t: "cone", a: [0.02, 0.18, 4], p: [0, -1.33, 0.28], r: [Math.PI / 2, 0, 0], c: 0xcabd9c },
        ], "HexoLegDetail");
      }
    }

    const groundY = this.world ? this.world.heightAt(x, z) : 0;
    this._groundY = groundY;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);

    finalizeMonster(this.root, this); // funde partes estáticas (menos draw calls e materiais)
    this.flashMaterials = [];
    this.root.traverse((child) => {
      if (child.isMesh && child.material) {
        if (!child._origMaterial) {
          child.material = child.material.clone();
          child._origMaterial = true;
        }
        this.flashMaterials.push(child.material);
      }
    });
    this._flashTimer = 0;
    this._hitHop = 0;
    this._tremorTimer = 0;

    this._inGrid = false;
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.5);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this._flashTimer = 0.24;
    this._hitHop = 0.45;
    this._tremorTimer = 0.28;

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

    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const isWhite = this._flashTimer > 0.12;
      const c = this._flashTimer > 0 ? (isWhite ? _WHITE_FLASH : _RED_FLASH) : _ZERO_FLASH;
      const intensity = this._flashTimer > 0 ? (isWhite ? 1.0 : 0.85) : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        if (this.flashMaterials[i].emissive) {
          this.flashMaterials[i].emissive.copy(c);
          this.flashMaterials[i].emissiveIntensity = intensity;
        }
      }
    }

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
    const distSq = dx * dx + dz * dz;

    // Efeito pulsante e cintilante assíncrono dos 6 olhos
    const now = performance.now();

    for (let i = 0; i < this.eyes.length; i++) {
      const pScale = 1.0 + Math.sin(now * 0.008 + i * 1.05) * 0.16;
      this.eyes[i].scale.set(pScale, pScale, pScale);
    }

    const hasCultRobe = Boolean(PlayerInventory.hasDemiurgeRobe || PlayerStats.wearingDemiurgeRobe);

    // Se estiver a <= 18m (distSq <= 324) e o player NÃO vestir o Manto da Seita, encara e persegue
    if (!hasCultRobe && distSq <= 324) {
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

      // Golpe com as garras afiadas (<= 2.4m, distSq <= 5.76)
      if (distSq <= 5.76) {
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
      this.heading += (Math.sin(now * 0.0006) * 0.04);
      this.model.rotation.y = this.heading;
    }

    if (this.speed > 0.05) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;

      const legCycle = now * 0.008 * this.speed;
      this.legs[0].rotation.x = Math.sin(legCycle) * 0.55;
      this.legs[1].rotation.x = -Math.sin(legCycle) * 0.55;
      this.arms[0].rotation.x = -Math.sin(legCycle) * 0.45;
      this.arms[1].rotation.x = Math.sin(legCycle) * 0.45;
    }

    if (this._groundY === undefined || this.speed > 0.05) {
      this._groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    }
    let hopY = 0;
    if (this._hitHop > 0) {
      this._hitHop = Math.max(0, this._hitHop - dt * 3.2);
      hopY = this._hitHop * 1.8;
    }
    let tremX = 0;
    let tremZ = 0;
    if (this._tremorTimer > 0) {
      this._tremorTimer = Math.max(0, this._tremorTimer - dt);
      const trem = (this._tremorTimer / 0.28) * 0.18;
      tremX = (Math.random() - 0.5) * trem;
      tremZ = (Math.random() - 0.5) * trem;
    }
    this.root.position.set(this.x + tremX, this._groundY + hopY, this.z + tremZ);

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

  reposition(x, z) {
    this.x = x;
    this.z = z;
    this.alive = true;
    this.health = this.maxHealth;
    this.state = "stalking";
    this.deadTime = 0;
    this.speed = 0;
    this.root.userData.isDead = false;
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this._groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, this._groundY, z);
    this.root.visible = true;
    if (this.npcs?.spatialGrid) {
      if (this._inGrid) this.npcs.spatialGrid.remove(this);
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
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

      // Cristas de espinhos ósseos na coluna dorsal do segmento
      for (let sp = 0; sp < 2; sp++) {
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.25, 4), _boneSpineMat);
        spine.position.set(0, 0.15 - sp * 0.2, 0.22);
        spine.rotation.x = Math.PI * 0.5;
        segMesh.add(spine);
      }
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

    // TRÊS CABEÇAS / FAUCES DENTADAS CANIBAIS (SEM OLHOS) COM LÍNGUAS BÍFIDAS
    this.mouths = [];
    this.tongues = [];
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

      // Manchas de sangue seco e secreção em torno da boca
      const bloodRim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.34), _bloodDriedMat);
      bloodRim.position.set(0, 0.09, 0);
      mGroup.add(bloodRim);

      const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 0.24), _mouthInteriorMat);
      cavity.position.set(0, 0.02, 0.04);
      mGroup.add(cavity);

      // Língua bífida escura e ameaçadora que se projeta da garganta
      const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.26), _mouthInteriorMat);
      tongue.position.set(0, 0.01, 0.16);
      mGroup.add(tongue);
      this.tongues.push(tongue);

      // Dentes afiados triangulares
      for (let t = 0; t < 8; t++) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.10, 4), _teethMat);
        const tang = (t / 8) * Math.PI * 2;
        tooth.position.set(Math.cos(tang) * 0.11, 0.08, Math.sin(tang) * 0.11 + 0.04);
        tooth.rotation.x = Math.PI;
        mGroup.add(tooth);
      }

      this.mouths.push(mGroup);

      // Bordas da boca: gengiva, dentes extras desiguais, baba e lábios rasgados
      const md = [];
      for (let t2 = 0; t2 < 7; t2++) {
        const a2 = (t2 / 7) * Math.PI * 2 + 0.3;
        md.push({ t: "cone", a: [0.018, 0.07 + (t2 % 3) * 0.04, 4], p: [Math.cos(a2) * 0.075, 0.075, Math.sin(a2) * 0.075 + 0.04], r: [Math.PI, 0, 0], c: 0xf0e8d4, ao: 0.8 });
      }
      md.push({ t: "box", a: [0.3, 0.035, 0.36], p: [0, 0.11, 0], c: 0x7a2a30, ao: 1 });
      for (let t2 = 0; t2 < 3; t2++) md.push({ t: "box", a: [0.015, 0.2 + t2 * 0.06, 0.015], p: [(t2 - 1) * 0.07, -0.2, 0.15], c: 0x5a0a10, ao: 1 });
      for (const sx of [-1, 1]) md.push({ t: "cone", a: [0.02, 0.2, 4], p: [sx * 0.14, 0.12, 0.1], r: [0.2, 0, -sx * 0.5], c: 0xcabd9c });
      addDetail(mGroup, md, "PolyMouthDetail");
    }

    // Detalhes do corpo serpentino: vértebras, escamas, tentáculos e feridas
    {
      for (let s2 = 0; s2 < this.segments.length; s2++) {
        const seg = this.segments[s2];
        const sd = [];
        for (let k = 0; k < 4; k++) sd.push({ t: "cone", a: [0.03, 0.18 + (k % 2) * 0.08, 4], p: [(k - 1.5) * 0.12, 0.28 - s2 * 0.01, 0.2], r: [Math.PI / 2, 0, (k - 1.5) * 0.25], c: 0xcabd9c });
        sd.push({ t: "box", a: [0.3, 0.12, 0.05], p: [0.08, 0.05, -0.27], c: 0x5a0a10, ao: 1 });
        sd.push({ t: "box", a: [0.02, 0.5, 0.02], p: [-0.2, -0.25, 0.1], r: [0, 0, 0.3], c: 0x3a0608, ao: 1 });
        addDetail(seg, sd, "PolySegDetail");
      }
      for (const arm of this.arms) {
        addDetail(arm, [
          { t: "cone", a: [0.014, 0.22, 4], p: [-0.025, -0.45, 0.0], r: [Math.PI, 0, 0.15], c: 0xd0c4a4 },
          { t: "cone", a: [0.014, 0.22, 4], p: [0.025, -0.45, 0.0], r: [Math.PI, 0, -0.15], c: 0xd0c4a4 },
          { t: "sph", a: [0.06, 5, 4], p: [0, -0.1, 0], c: 0x8a8478 },
        ], "PolyArmDetail");
      }
    }

    const groundY = this.world ? this.world.heightAt(x, z) : 0;
    this._groundY = groundY;
    this.root.position.set(x, groundY, z);
    scene.add(this.root);

    finalizeMonster(this.root, this); // funde partes estáticas (menos draw calls e materiais)
    this.flashMaterials = [];
    this.root.traverse((child) => {
      if (child.isMesh && child.material) {
        if (!child._origMaterial) {
          child.material = child.material.clone();
          child._origMaterial = true;
        }
        this.flashMaterials.push(child.material);
      }
    });
    this._flashTimer = 0;
    this._hitHop = 0;
    this._tremorTimer = 0;

    this._inGrid = false;
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.5);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 2.0, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this._flashTimer = 0.24;
    this._hitHop = 0.45;
    this._tremorTimer = 0.28;

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

    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const isWhite = this._flashTimer > 0.12;
      const c = this._flashTimer > 0 ? (isWhite ? _WHITE_FLASH : _RED_FLASH) : _ZERO_FLASH;
      const intensity = this._flashTimer > 0 ? (isWhite ? 1.0 : 0.85) : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        if (this.flashMaterials[i].emissive) {
          this.flashMaterials[i].emissive.copy(c);
          this.flashMaterials[i].emissiveIntensity = intensity;
        }
      }
    }

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
    const distSq = dx * dx + dz * dz;

    const now = performance.now();

    // Movimentação independente e ameaçadora das múltiplas mandíbulas canibais
    if (this.mouths.length >= 3) {
      this.mouths[0].rotation.x = Math.sin(now * 0.012) * 0.28;
      this.mouths[1].rotation.x = 0.25 + Math.sin(now * 0.016 + 1.2) * 0.22;
      this.mouths[2].rotation.x = 0.25 + Math.cos(now * 0.014 + 2.4) * 0.22;
    }

    // Projeção rápida e trêmula das línguas bífidas
    for (let t = 0; t < this.tongues.length; t++) {
      this.tongues[t].position.z = 0.16 + Math.sin(now * 0.024 + t * 1.8) * 0.06;
    }

    // Ondulação dos segmentos serpentiformes
    for (let s = 0; s < this.segments.length; s++) {
      this.segments[s].position.x = Math.sin(this.slitherPhase + s * 0.8) * 0.14;
    }

    const hasCultRobe = Boolean(PlayerInventory.hasDemiurgeRobe || PlayerStats.wearingDemiurgeRobe);

    if (!hasCultRobe && distSq <= 196) { // <= 14m (ignora se o player usar o Manto da Seita)
      const targetYaw = Math.atan2(dx, dz);
      this.heading = THREE.MathUtils.lerp(this.heading, targetYaw, dt * 7.5);
      this.model.rotation.y = this.heading;

      // Dispara em bote rápido
      this.speed = THREE.MathUtils.lerp(this.speed, 8.2, dt * 5.0);

      if (distSq <= 4.84) { // <= 2.2m
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
      this.heading += Math.sin(now * 0.0008) * 0.05;
      this.model.rotation.y = this.heading;
    }

    if (this.speed > 0.05) {
      const step = this.speed * dt;
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;
    }

    if (this._groundY === undefined || this.speed > 0.05) {
      this._groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    }
    let hopY = 0;
    if (this._hitHop > 0) {
      this._hitHop = Math.max(0, this._hitHop - dt * 3.2);
      hopY = this._hitHop * 1.8;
    }
    let tremX = 0;
    let tremZ = 0;
    if (this._tremorTimer > 0) {
      this._tremorTimer = Math.max(0, this._tremorTimer - dt);
      const trem = (this._tremorTimer / 0.28) * 0.18;
      tremX = (Math.random() - 0.5) * trem;
      tremZ = (Math.random() - 0.5) * trem;
    }
    this.root.position.set(this.x + tremX, this._groundY + hopY, this.z + tremZ);

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

  reposition(x, z) {
    this.x = x;
    this.z = z;
    this.alive = true;
    this.health = this.maxHealth;
    this.state = "slithering";
    this.deadTime = 0;
    this.speed = 0;
    this.root.userData.isDead = false;
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this._groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, this._groundY, z);
    this.root.visible = true;
    if (this.npcs?.spatialGrid) {
      if (this._inGrid) this.npcs.spatialGrid.remove(this);
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
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
    // Despertar escalonado: ao anoitecer os monstros NÃO surgem todos juntos (o 1º desenho de cada um sobe geometria à
    // GPU e inicializa a IA: 13 de uma vez = ~1 s de trava). Um acorda por vez, com intervalo calmo.
    this._wasNight = false;
    this._wakeQueue = [];
    this._wakeTimer = 0;
  }

  _allBeasts() {
    return [...this.walkers, ...this.biters, ...this.hexoculusList, ...this.polyphoniaList];
  }

  _updateWake(dt, isNight) {
    if (isNight && !this._wasNight) {
      this._wasNight = true;
      const q = this._allBeasts().filter((b) => !b._awake);
      for (let i = q.length - 1; i > 0; i--) { // embaralha: a ordem de surgimento muda a cada noite
        const j = Math.floor(Math.random() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
      this._wakeQueue = q;
      this._wakeTimer = 2.0; // o primeiro só acorda 2 s depois de anoitecer
    } else if (!isNight && this._wasNight) {
      this._wasNight = false;
      this._wakeQueue.length = 0;
      for (const b of this._allBeasts()) b._awake = false;
    }
    if (isNight && this._wakeQueue.length > 0) {
      this._wakeTimer -= dt;
      if (this._wakeTimer <= 0) {
        const b = this._wakeQueue.shift();
        b._awake = true;
        const eclipse = Boolean(WorldDecay && WorldDecay.isEclipse);
        this._wakeTimer = eclipse ? 1.8 : 4.0 + Math.random() * 3.0; // um a cada ~4–7 s (1,8 s no eclipse)
      }
    }
  }

  spawnInitialBeasts(cityCenter) {
    const cx = cityCenter.x ?? 0;
    const cz = cityCenter.z ?? 0;

    // 1. Gulurs (Bichos Altões): Criaturas imponentes nos ermos com olhos amarelos visíveis a média distância
    const walkerSpots = [
      { x: cx - 85, z: cz + 80 },
      { x: cx + 95, z: cz - 75 },
      { x: cx - 60, z: cz - 105 },
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
    this.spawnRandomBiters(cx, cz, 4);

    // 3. Hexoculus (O Observador dos 6 Olhos): 3 criaturas esguias nos ermos noturnos
    const hexSpots = [
      { x: cx + 70, z: cz + 75 },
      { x: cx - 75, z: cz - 65 },
      { x: cx + 85, z: cz - 80 },
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
      { x: cx - 70, z: cz + 90 },
      { x: cx + 80, z: cz - 90 },
      { x: cx - 55, z: cz - 85 },
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

  spawnRandomBiters(cx, cz, count = 4, awake = false) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Spawna no limiar da neblina (78m-88m) para o jogador avistar apenas a silhueta se aproximando
      const radius = 78 + Math.random() * 10;
      const bx = cx + Math.cos(angle) * radius;
      const bz = cz + Math.sin(angle) * radius;

      // POOL: reaproveita um Necron morto/oculto (antes cada leva construía Necrons novos = trava de ~1 s por spawn
      // e os mortos ficavam para sempre na cena). Só constrói um novo se não houver nenhum para reciclar e abaixo do teto.
      const reusable = this.biters.find((b) => (!b.alive && b.deadTime > 6.0) || (b.alive === false && !b.root.visible));
      if (reusable) {
        reusable.reposition(bx, bz);
        reusable._awake = awake;
        continue;
      }
      if (this.biters.length >= 10) continue; // teto de Necrons existentes

      const necron = new Necron(
        this.scene,
        this.world,
        this.effects,
        this.combat,
        this.player,
        this.npcs,
        bx,
        bz,
        this.audio
      );
      necron._awake = awake; // reposição noturna (já espaçada pelo timer) nasce acordada; os iniciais esperam a fila
      this.biters.push(necron);
      if (this.npcs?.npcs && !this.npcs.npcs.includes(necron)) {
        this.npcs.npcs.push(necron);
      }
    }
  }

  update(dt, isNight = false) {
    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;

    this._updateWake(dt, isNight);

    // Atualiza todos os Gulurs (cada um só fica ativo depois de "acordar" na fila escalonada)
    for (let i = 0; i < this.walkers.length; i++) {
      this.walkers[i].update(dt, isNight && this.walkers[i]._awake);
    }

    // Reposicionamento dinâmico / Respawn dos Gulurs (Colossos dos Ermos com Olhos Amarelos)
    for (let i = 0; i < this.walkers.length; i++) {
      const g = this.walkers[i];
      if (!g._awake) continue; // ainda dormindo na fila de despertar: não reposiciona (evita piscar 1 frame)
      const gdx = g.x - px;
      const gdz = g.z - pz;
      const gDistSq = gdx * gdx + gdz * gdz;
      // Se morreu e já passou o colapso, ou se o jogador se afastou muito (> 140m)
      if ((!g.alive && g.deadTime > 10.0) || gDistSq > 140 * 140) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 65 + Math.random() * 25; // 65m a 90m do player, visível na bruma
        g.reposition(px + Math.cos(angle) * dist, pz + Math.sin(angle) * dist);
      }
    }

    // Atualiza todos os Necrons
    for (let i = 0; i < this.biters.length; i++) {
      this.biters[i].update(dt, isNight && this.biters[i]._awake);
    }

    // Atualiza todos os Hexoculus (6 olhos)
    for (let i = 0; i < this.hexoculusList.length; i++) {
      this.hexoculusList[i].update(dt, isNight && this.hexoculusList[i]._awake);
    }

    // Atualiza todas as Polyphonias (fauces múltiplas)
    for (let i = 0; i < this.polyphoniaList.length; i++) {
      this.polyphoniaList[i].update(dt, isNight && this.polyphoniaList[i]._awake);
    }

    // À noite ou durante o Eclipse, repõe criaturas mortas periodicamente
    const isDangerous = isNight || (WorldDecay && WorldDecay.isEclipse);
    if (isDangerous) {
      // Reposicionamento dinâmico dos Hexoculus nos ermos
      for (let i = 0; i < this.hexoculusList.length; i++) {
        const hex = this.hexoculusList[i];
        if (!hex._awake) continue;
        const hdx = hex.x - px;
        const hdz = hex.z - pz;
        const hDistSq = hdx * hdx + hdz * hdz;
        if ((!hex.alive && hex.deadTime > 6.0) || hDistSq > 130 * 130) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 55 + Math.random() * 25;
          hex.reposition(px + Math.cos(angle) * dist, pz + Math.sin(angle) * dist);
        }
      }

      // Reposicionamento dinâmico das Polyphonias nos ermos
      for (let i = 0; i < this.polyphoniaList.length; i++) {
        const poly = this.polyphoniaList[i];
        if (!poly._awake) continue;
        const pdx = poly.x - px;
        const pdz = poly.z - pz;
        const pDistSq = pdx * pdx + pdz * pdz;
        if ((!poly.alive && poly.deadTime > 6.0) || pDistSq > 130 * 130) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 50 + Math.random() * 25;
          poly.reposition(px + Math.cos(angle) * dist, pz + Math.sin(angle) * dist);
        }
      }

      this.ambientHowlTimer = (this.ambientHowlTimer || (25 + Math.random() * 25)) - dt;
      if (this.ambientHowlTimer <= 0) {
        this.ambientHowlTimer = 45 + Math.random() * 45;
        this.audio?.playWolfHowl?.(0.5, 55 + Math.random() * 30);
      }

      // Eco misterioso do Big Monster na escuridão da noite (quando isolado na natureza)
      this.ambientBigMonsterTimer = (this.ambientBigMonsterTimer || (20 + Math.random() * 25)) - dt;
      if (this.ambientBigMonsterTimer <= 0) {
        this.ambientBigMonsterTimer = 50 + Math.random() * 40;
        this.audio?.playBigMonster?.(0.78, 55 + Math.random() * 45);
      }

      this.respawnTimer += dt;
      const isEclipse = Boolean(WorldDecay && WorldDecay.isEclipse);
      const respawnLimit = isEclipse ? 14.0 : 28.0; // Dobro da taxa de reposição no eclipse
      if (this.respawnTimer > respawnLimit) {
        this.respawnTimer = 0;
        const maxBiters = isEclipse ? 8 : 4; // Dobro do limite de feras ativas no eclipse
        const activeBiters = this.biters.filter((b) => b.alive && b.root.visible).length;
        if (activeBiters < maxBiters) {
          const spawnCount = isEclipse ? 4 : 2; // Dobro da quantidade spawnada por leva
          this.spawnRandomBiters(px, pz, spawnCount, true);
        }
      }
    }
  }
}
