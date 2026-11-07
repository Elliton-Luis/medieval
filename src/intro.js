import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeGlowTexture } from "./torches.js";

// ============================================================================
// 1. Estado da Cutscene e Vetores de Reuso (Zero-GC)
// ============================================================================
export const GameState = {
  isIntroPlaying: false,
  introPhase: 0,
  introTimer: 0,
};

const _camTarget = new THREE.Vector3();
const _camDir = new THREE.Vector3();

let _introEnv = null;
let _fadeOverlay = null;
let _skipPrompt = null;
let _introWolves = [];
let _tallFigure = null;
let _entitySpawnedZ = 0;
let _wolfHowl1Played = false;
let _wolfGrowlPlayed = false;
let _wolfStepsTimer = 0;
let _introFlags = { howls: new Set(), caption: false, black: false, monster: false, ended: false };
let _originX = 0;
let _originZ = -270;

// ============================================================================
// 2. A Entidade do Vazio Abissal: VULGUS (Silhueta Espectral com Capa e Capuz Profundo)
// ============================================================================
export function createTallFigure() {
  const group = new THREE.Group();
  group.name = "Vulgus";

  // Materiais sóbrios e discretos: tecido pesado de manto ébano e vazio abissal
  const pitchBlackMat = new THREE.MeshBasicMaterial({ color: 0x020203 });
  const cloakMat = new THREE.MeshLambertMaterial({ color: 0x09090c });
  const cloakFoldMat = new THREE.MeshLambertMaterial({ color: 0x050507 });
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff1600 });
  const eyeWhitePixelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const zipperTeethMat = new THREE.MeshBasicMaterial({ color: 0xe0e0e0 });

  // --------------------------------------------------------------------------
  // 1. O Manto e Túnica Longa (Cobre totalmente pernas e corpo, sem exposição)
  // --------------------------------------------------------------------------
  // Manto principal cônico que desce dos ombros até quase o solo
  const robeGeo = new THREE.CylinderGeometry(0.46, 1.05, 4.3, 12, 1, true);
  const robe = new THREE.Mesh(robeGeo, cloakMat);
  robe.position.set(0, 2.15, -0.04);
  robe.rotation.y = Math.PI / 12;
  group.add(robe);

  // Interior preto absoluto do manto
  const robeInnerGeo = new THREE.CylinderGeometry(0.40, 0.98, 4.25, 8);
  const robeInner = new THREE.Mesh(robeInnerGeo, pitchBlackMat);
  robeInner.position.set(0, 2.15, -0.04);
  group.add(robeInner);

  // Capa externa traseira pesada que escorre das costas ao chão
  const backCapeGeo = new THREE.CylinderGeometry(0.55, 1.25, 4.4, 8, 1, true, -Math.PI * 0.45, Math.PI * 0.9);
  const backCape = new THREE.Mesh(backCapeGeo, cloakFoldMat);
  backCape.position.set(0, 2.2, -0.12);
  backCape.scale.set(1.0, 1.0, 1.15);
  group.add(backCape);

  // Dobras frontais da capa que caem dos ombros sobre o peito e laterais
  for (const side of [-1, 1]) {
    const foldGeo = new THREE.BoxGeometry(0.38, 3.85, 0.24);
    const fold = new THREE.Mesh(foldGeo, cloakFoldMat);
    fold.position.set(side * 0.32, 2.1, 0.12);
    fold.rotation.y = side * 0.22;
    fold.rotation.z = side * 0.04;
    group.add(fold);
  }

  // --------------------------------------------------------------------------
  // 2. Gola Alta e Ombros Largos Imponentes (Mantle / Cowl)
  // --------------------------------------------------------------------------
  // Ombreiras largas e imponentes da capa
  const mantleGeo = new THREE.BoxGeometry(1.35, 0.48, 0.65);
  const mantle = new THREE.Mesh(mantleGeo, cloakMat);
  mantle.position.set(0, 4.25, 0.05);
  group.add(mantle);

  // Gola envolvente na base do pescoço
  const cowlGeo = new THREE.CylinderGeometry(0.42, 0.58, 0.55, 8);
  const cowl = new THREE.Mesh(cowlGeo, cloakFoldMat);
  cowl.position.set(0, 4.55, 0.12);
  cowl.rotation.x = 0.14;
  group.add(cowl);

  // --------------------------------------------------------------------------
  // 3. Mangas Longas da Capa e Garras Discretas
  // --------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    // Manga larga cônica drapeada
    const sleeveGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.4, 7);
    const sleeve = new THREE.Mesh(sleeveGeo, cloakMat);
    sleeve.position.set(side * 0.62, 3.15, 0.08);
    sleeve.rotation.z = side * -0.16;
    sleeve.rotation.x = 0.12;
    group.add(sleeve);

    // Foz escura da manga de onde as garras emergem
    const sleeveCuffGeo = new THREE.CylinderGeometry(0.12, 0.34, 0.45, 6);
    const sleeveCuff = new THREE.Mesh(sleeveCuffGeo, cloakFoldMat);
    sleeveCuff.position.set(side * 0.78, 2.05, 0.22);
    sleeveCuff.rotation.z = side * -0.22;
    group.add(sleeveCuff);

    // Garras pontiagudas pretas saindo discretamente sob a manga
    for (let c = -1; c <= 2; c++) {
      const clawGeo = new THREE.ConeGeometry(0.018, 0.42, 4);
      const claw = new THREE.Mesh(clawGeo, pitchBlackMat);
      claw.position.set(side * 0.78 + c * 0.038, 1.62, 0.26 + Math.abs(c) * 0.03);
      claw.rotation.x = 0.32 + c * 0.06;
      claw.rotation.z = side * (0.12 + c * 0.08);
      group.add(claw);
    }
  }

  // --------------------------------------------------------------------------
  // 4. O Capuz Profundo (Deep Hood) e Vazio Abissal da Face
  // --------------------------------------------------------------------------
  // Cúpula superior do capuz (alongada e sutilmente pontuda atrás)
  const hoodDomeGeo = new THREE.SphereGeometry(0.38, 10, 8);
  const hoodDome = new THREE.Mesh(hoodDomeGeo, cloakMat);
  hoodDome.position.set(0, 5.35, 0.2);
  hoodDome.scale.set(1.05, 1.25, 1.2);
  group.add(hoodDome);

  // Paredes laterais e traseira do capuz que descem até a gola
  const hoodBackGeo = new THREE.BoxGeometry(0.68, 0.95, 0.55);
  const hoodBack = new THREE.Mesh(hoodBackGeo, cloakMat);
  hoodBack.position.set(0, 5.05, 0.12);
  hoodBack.rotation.x = 0.12;
  group.add(hoodBack);

  // Aba frontal proeminente do capuz (cria sombra profunda sobre o rosto)
  const hoodBrimGeo = new THREE.CylinderGeometry(0.36, 0.42, 0.52, 7, 1, true, -Math.PI * 0.5, Math.PI);
  const hoodBrim = new THREE.Mesh(hoodBrimGeo, cloakFoldMat);
  hoodBrim.position.set(0, 5.25, 0.35);
  hoodBrim.rotation.x = Math.PI * 0.5;
  hoodBrim.scale.set(1.0, 1.2, 0.85);
  group.add(hoodBrim);

  // Vazio interno da face (preto absoluto, abissal, sob a sombra do capuz)
  const faceVoidGeo = new THREE.BoxGeometry(0.42, 0.65, 0.18); // raso: não cobre mais as íris
  const faceVoid = new THREE.Mesh(faceVoidGeo, pitchBlackMat);
  faceVoid.position.set(0, 5.15, 0.2);
  group.add(faceVoid);

  // --------------------------------------------------------------------------
  // 5. Olhos Carmesins Incandescentes e Dentes Zíper Discretos
  // --------------------------------------------------------------------------
  const eyesConfig = [
    { x: -0.12, y: 5.18, z: 0.38, radius: 0.042 },
    { x:  0.12, y: 5.18, z: 0.38, radius: 0.042 },
    { x: -0.15, y: 5.35, z: 0.32, radius: 0.030 },
    { x:  0.15, y: 5.35, z: 0.32, radius: 0.030 },
  ];

  eyesConfig.forEach((eyeCfg) => {
    const iris = new THREE.Mesh(new THREE.SphereGeometry(eyeCfg.radius, 6, 6), eyeGlowMat);
    iris.position.set(eyeCfg.x, eyeCfg.y, eyeCfg.z);
    group.add(iris);

    const pupilPixel = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.022), eyeWhitePixelMat);
    pupilPixel.position.set(eyeCfg.x, eyeCfg.y, eyeCfg.z + eyeCfg.radius * 0.75);
    group.add(pupilPixel);
  });

  // Dentes-zíper verticais discretos entre os olhos
  const zipperTeethData = [
    { side: -1, y: 4.80, xOffset: 0.016, z: 0.395, rotZ:  0.08, w: 0.014, h: 0.013, d: 0.020 },
    { side:  1, y: 4.86, xOffset: 0.015, z: 0.402, rotZ: -0.14, w: 0.013, h: 0.015, d: 0.022 },
    { side: -1, y: 4.93, xOffset: 0.018, z: 0.408, rotZ: -0.06, w: 0.015, h: 0.013, d: 0.020 },
    { side:  1, y: 5.00, xOffset: 0.016, z: 0.410, rotZ:  0.12, w: 0.014, h: 0.016, d: 0.024 },
    { side: -1, y: 5.07, xOffset: 0.018, z: 0.412, rotZ: -0.11, w: 0.014, h: 0.014, d: 0.022 },
    { side:  1, y: 5.14, xOffset: 0.020, z: 0.410, rotZ:  0.07, w: 0.016, h: 0.015, d: 0.025 },
    { side: -1, y: 5.22, xOffset: 0.019, z: 0.406, rotZ:  0.16, w: 0.015, h: 0.016, d: 0.025 },
    { side:  1, y: 5.29, xOffset: 0.017, z: 0.402, rotZ: -0.13, w: 0.015, h: 0.014, d: 0.023 },
    { side: -1, y: 5.36, xOffset: 0.019, z: 0.396, rotZ:  0.09, w: 0.015, h: 0.015, d: 0.022 },
    { side:  1, y: 5.43, xOffset: 0.016, z: 0.388, rotZ: -0.08, w: 0.013, h: 0.013, d: 0.020 },
  ];

  zipperTeethData.forEach((t) => {
    const toothGeo = new THREE.BoxGeometry(t.w, t.h, t.d);
    const toothMesh = new THREE.Mesh(toothGeo, zipperTeethMat);
    toothMesh.position.set(t.side * t.xOffset, t.y, t.z);
    toothMesh.rotation.z = t.rotZ;
    group.add(toothMesh);
  });

  // Bainha da capa com pontas rasgadas / fiapos escuros na base
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const hemSpike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 4), cloakFoldMat);
    hemSpike.position.set(Math.cos(angle) * 0.95, 0.2, Math.sin(angle) * 0.95 - 0.05);
    hemSpike.rotation.x = Math.PI;
    hemSpike.rotation.y = angle;
    group.add(hemSpike);
  }

  group.visible = false;
  return group;
}

// ============================================================================
// 3. Bichos Perseguidores (3 Olhos Vermelhos em Disposição Triangular)
// ============================================================================
function _createThreeEyedBeast() {
  const group = new THREE.Group();
  const furMat = new THREE.MeshLambertMaterial({ color: 0x0c0b0a });
  const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.65, 1.55), furMat);
  body.position.y = 0.72;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.45, 0.55), furMat);
  head.position.set(0, 1.05, 0.85);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 5), furMat);
  snout.rotation.x = Math.PI * 0.5;
  snout.position.set(0, 0.94, 1.2);
  group.add(snout);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 4), furMat);
    ear.rotation.z = side * -0.25;
    ear.position.set(side * 0.18, 1.34, 0.75);
    group.add(ear);
  }

  const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);

  const eyeL = new THREE.Mesh(eyeGeo, redEyeMat);
  eyeL.position.set(-0.16, 1.05, 1.1);
  group.add(eyeL);

  const eyeR = new THREE.Mesh(eyeGeo, redEyeMat);
  eyeR.position.set(0.16, 1.05, 1.1);
  group.add(eyeR);

  const eyeThird = new THREE.Mesh(eyeGeo, redEyeMat);
  eyeThird.position.set(0.0, 1.22, 1.02);
  group.add(eyeThird);

  group.userData.legs = [];
  const legGeo = new THREE.BoxGeometry(0.16, 0.7, 0.16);
  const legPositions = [
    [-0.26, 0.35, 0.5],
    [0.26, 0.35, 0.5],
    [-0.26, 0.35, -0.5],
    [0.26, 0.35, -0.5],
  ];
  legPositions.forEach((p, idx) => {
    const leg = new THREE.Mesh(legGeo, furMat);
    leg.position.set(p[0], p[1], p[2]);
    group.add(leg);
    group.userData.legs.push({ mesh: leg, baseZ: p[2], phase: idx * Math.PI * 0.5 });
  });

  return group;
}

// ============================================================================
// 3b. Fogueira e Cultistas da cutscene (poucas malhas, nenhuma luz além da fogueira)
// ============================================================================
let _baseFov = 0;
let _fire = null;
let _cultists = [];
let _caption = null;
let _path = null;

const _purpleEyeMat = new THREE.MeshBasicMaterial({ color: 0xb53cff });
const _maskMat = new THREE.MeshBasicMaterial({ color: 0xe6e0d2 });
const _maskDarkMat = new THREE.MeshBasicMaterial({ color: 0x050405 });
const _robeMat = new THREE.MeshLambertMaterial({ color: 0x0b080d });
let _glowTex = null;
const _tmpP = { x: 0, z: 0, psi: 0 };
const _tmpW = { x: 0, z: 0, psi: 0 };

function _glow() {
  if (!_glowTex) _glowTex = makeGlowTexture("255,235,170");
  return _glowTex;
}

function _buildBonfire() {
  const group = new THREE.Group();
  group.name = "IntroBonfire";
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x2a1a10 });
  const logGeo = new THREE.CylinderGeometry(0.085, 0.11, 1.15, 6);
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(logGeo, woodMat);
    const a = (i / 6) * Math.PI * 2;
    log.position.set(Math.cos(a) * 0.2, 0.42, Math.sin(a) * 0.2);
    log.rotation.set(Math.sin(a) * 0.62, 0, -Math.cos(a) * 0.62);
    group.add(log);
  }
  const ember = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), new THREE.MeshBasicMaterial({ color: 0x4a1405 }));
  ember.rotation.x = -Math.PI / 2;
  ember.position.y = 0.04;
  group.add(ember);

  // corpo da chama: 3 cones aninhados (vermelho -> laranja -> amarelo)
  const flames = [];
  const defs = [[0.3, 1.25, 0xff4a0a, 0.85], [0.22, 1.0, 0xff9a1c, 0.9], [0.13, 0.72, 0xffe27a, 0.95]];
  for (const [r, h, color, op] of defs) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = 0.2 + h / 2;
    cone.userData.h = h;
    group.add(cone);
    flames.push(cone);
  }
  // halo luminoso aditivo
  const sprites = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glow(), color: i === 0 ? 0xff7a28 : 0xffb050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    sp.position.y = 0.7 + i * 0.25;
    sp.scale.setScalar(2.2 - i * 0.5);
    group.add(sp);
    sprites.push(sp);
  }
  const light = new THREE.PointLight(0xff8a3a, 12, 24, 2);
  light.position.y = 0.95;
  group.add(light);
  group.userData = { flames, sprites, light };
  return group;
}

function _updateBonfire(t) {
  if (!_fire) return;
  const { flames, sprites, light } = _fire.userData;
  const f = 0.86 + Math.sin(t * 23) * 0.07 + Math.sin(t * 37 + 1.3) * 0.05 + Math.sin(t * 9) * 0.04;
  for (let i = 0; i < flames.length; i++) {
    const c = flames[i];
    c.scale.set(1 + Math.sin(t * 15 + i) * 0.08, f + Math.sin(t * 19 + i * 2) * 0.16, 1 + Math.cos(t * 13 + i) * 0.08);
    c.rotation.y = t * (2 + i);
    c.position.y = 0.2 + (c.userData.h * c.scale.y) / 2;
  }
  for (let i = 0; i < sprites.length; i++) {
    sprites[i].material.opacity = 0.55 + f * 0.3;
    sprites[i].position.x = Math.sin(t * 7 + i * 2) * 0.05;
  }
  light.intensity = 12 * f;
}

function _buildCultist() {
  const g = new THREE.Group();
  g.name = "IntroCultist";
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.52, 1.75, 8), _robeMat);
  robe.position.y = 0.875;
  g.add(robe);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), _robeMat);
  shoulders.scale.set(1.1, 0.55, 0.8);
  shoulders.position.y = 1.6;
  g.add(shoulders);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.14), _robeMat);
  arms.position.set(0, 1.28, 0.2);
  g.add(arms);

  const head = new THREE.Group();
  head.position.y = 1.82;
  g.add(head);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.245, 10, 8), _robeMat);
  hood.position.z = -0.04;
  head.add(hood);
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), _maskMat);
  mask.scale.set(0.78, 1.14, 0.5);
  mask.position.z = 0.12;
  head.add(mask);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), _maskMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.02, 0.2);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.01), _maskDarkMat);
  mouth.position.set(0, -0.1, 0.188);
  head.add(mouth);

  const eyes = new THREE.Group();
  eyes.position.set(0, 0.035, 0.172);
  head.add(eyes);
  for (const s of [-1, 1]) {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.01), _maskDarkMat);
    slit.position.set(s * 0.055, 0, -0.004);
    eyes.add(slit);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), _purpleEyeMat);
    eye.scale.set(1.35, 0.8, 0.5);
    eye.position.set(s * 0.055, 0, 0.006);
    eyes.add(eye);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glow(), color: 0xff1010, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.set(0, 0.035, 0.19);
  halo.scale.setScalar(0.3);
  head.add(halo);
  g.userData = { eyes, halo, head };
  g.visible = false;
  return g;
}

// ============================================================================
// 3c. Trajetória da fuga: pré-calculada (determinística), então cada frame só consulta a tabela
// ============================================================================
const RUN_DURATION = 11.2;
const PATH_STEP = 1 / 60;

function _buildPath() {
  const n = Math.ceil(RUN_DURATION / PATH_STEP) + 2;
  const xs = new Float32Array(n);
  const zs = new Float32Array(n);
  const ps = new Float32Array(n);
  let x = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    const tau = i * PATH_STEP;
    const turn = _smooth(tau / 7.5);
    const psi = -1.45 + turn * 1.35; // foge para o lado (-X) e vai curvando para a estrada
    const accel = Math.min(1, tau / 0.7);
    const brake = tau > RUN_DURATION - 0.6 ? Math.max(0, (RUN_DURATION - tau) / 0.6) : 1;
    const v = 6.4 * accel * brake;
    xs[i] = x;
    zs[i] = z;
    ps[i] = psi;
    x += Math.sin(psi) * v * PATH_STEP;
    z += Math.cos(psi) * v * PATH_STEP;
  }
  return { xs, zs, ps, n };
}

function _pathAt(tau, out = _tmpP) {
  const p = _path;
  const f = Math.max(0, Math.min(p.n - 2, tau / PATH_STEP));
  const i = Math.floor(f);
  const u = f - i;
  out.x = p.xs[i] + (p.xs[i + 1] - p.xs[i]) * u;
  out.z = p.zs[i] + (p.zs[i + 1] - p.zs[i]) * u;
  out.psi = p.ps[i] + (p.ps[i + 1] - p.ps[i]) * u;
  return out;
}

function _smooth(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function _angDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

// ============================================================================
// 4. Overlays HTML de Transição, Legenda e Atalho de Pular
// ============================================================================
function _ensureUIElements() {
  if (!_fadeOverlay) {
    _fadeOverlay = document.createElement("div");
    _fadeOverlay.className = "intro-fade-black";
    _fadeOverlay.style.cssText =
      "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:9999;transition:opacity 0.6s ease-in-out;";
    document.body.appendChild(_fadeOverlay);
  }

  if (!_skipPrompt) {
    _skipPrompt = document.createElement("div");
    _skipPrompt.className = "intro-skip-prompt";
    _skipPrompt.style.cssText =
      "position:fixed;bottom:26px;right:28px;z-index:10000;color:#e6d3a0;font-family:Georgia,serif;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;text-shadow:0 2px 8px #000;pointer-events:none;opacity:0;transition:opacity 0.5s ease;";
    _skipPrompt.innerHTML = "Pressione <strong>[ESPAÇO]</strong> ou <strong>[ESC]</strong> para pular";
    document.body.appendChild(_skipPrompt);
  }

  if (!_redVignette) {
    _redVignette = document.createElement("div");
    _redVignette.className = "intro-red-vignette";
    _redVignette.style.cssText =
      "position:fixed;inset:0;z-index:9000;pointer-events:none;opacity:0;transition:opacity 0.12s linear;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 38%,rgba(120,4,10,0.55) 78%,rgba(60,0,4,0.9) 100%);";
    document.body.appendChild(_redVignette);
  }

  if (!_caption) {
    _caption = document.createElement("div");
    _caption.className = "intro-caption";
    _caption.style.cssText =
      "position:fixed;left:50%;bottom:17%;transform:translateX(-50%);max-width:82vw;text-align:center;z-index:10000;color:#efe4c8;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:clamp(22px,3.2vw,38px);letter-spacing:0.08em;text-shadow:0 0 18px rgba(0,0,0,0.95),0 2px 6px #000;pointer-events:none;opacity:0;transition:opacity 1.3s ease-in-out;";
    document.body.appendChild(_caption);
  }
}

let _keyListenerAttached = false;
function _attachSkipListener() {
  if (_keyListenerAttached) return;
  _keyListenerAttached = true;
  window.addEventListener(
    "keydown",
    (event) => {
      if (GameState.isIntroPlaying && (event.code === "Space" || event.code === "Escape" || event.code === "Enter")) {
        event.preventDefault();
        event.stopPropagation();
        endIntroSequence(true); // Pulo imediato com tela de loading
      }
    },
    true
  );
}

// ============================================================================
// 5. Linha do tempo (segundos)
// ============================================================================
const T = {
  look: 5.6, // o protagonista vira o rosto para o lado
  cultist: 6.3, // o cultista surge na penumbra
  zoom: 8.8, // zoom nos olhos
  wolves: 12.0, // as 3 sombras de olhos vermelhos
  run: 14.0, // começa a fuga
  caption: 27.8, // legenda
  captionOff: 31.0,
  black: 31.4, // fade suave para preto
  monster: 33.4, // som do bicho com a tela preta
  end: 37.2,
};
const ENTITY_DIST = 3.4; // distância entre o ponto final da corrida e a entidade
const WOLF_X = [-3.0, 0.0, 3.0];

// ============================================================================
// 5a. Preparação para rodar LISO (gambiarras assumidas)
//  - o mundo inteiro (casas, NPCs, animais, plantações...) é desligado: a cutscene só desenha chão + o que ela usa
//  - todos os chunks do trajeto são gerados ANTES, e o streaming fica travado durante a cena
//  - fogueira (PointLight), cultistas, lobos e entidade são compilados/enviados à GPU sob a tela de loading
//  - mapa de sombras congelado (a luz do luar é quase zero): menos uma passada de render por frame
//  - tempo da cena suavizado (média exponencial do dt): hitches isolados não viram trancos na câmera
// ============================================================================
let _hiddenForIntro = [];
let _shadowRestore = null;
let _dtSmooth = 0;
let _redVignette = null;
let _hbTimer = 0;
let _drone = null;
const INTRO_SPEED = 1.12; // a cena corre ~12% mais rápida: mais tensa, menos arrastada

function _prepareIntroWorld(env, startX, startZ) {
  const { scene, world, player, dayNight, renderer, camera } = env;
  // 1) chunks do trajeto, todos antes (cada chamada constrói no máximo 1)
  if (world?.updateAround) {
    for (let i = 0; i < 140; i++) {
      world.updateAround(startX, startZ);
      if (!world._pendingChunkQueue || world._pendingChunkQueue.length === 0) break;
    }
  }
  GameState.anchorX = startX;
  GameState.anchorZ = startZ;

  // 2) esconde o resto do mundo
  const keep = new Set([player.root, _tallFigure, _fire, ..._introWolves, ..._cultists, dayNight?.fixedAstroGroup]);
  if (world?.chunks) for (const chunk of world.chunks.values()) keep.add(chunk.group);
  _hiddenForIntro.length = 0;
  for (const ch of scene.children) {
    if (!ch.visible || ch.isLight || ch.isSprite || keep.has(ch)) continue;
    if (ch.isGroup || ch.isMesh || ch.isPoints || ch.isLine) {
      ch.visible = false;
      _hiddenForIntro.push(ch);
    }
  }

  // 3) pré-compila e envia à GPU tudo o que a cena usa (com a fogueira já presente => mesma contagem de luzes)
  const objs = [_tallFigure, _fire, ..._introWolves, ..._cultists];
  const prev = objs.map((o) => o.visible);
  const culled = [];
  for (const o of objs) {
    o.visible = true;
    o.traverse((m) => {
      if (m.isMesh || m.isSprite) {
        culled.push([m, m.frustumCulled]);
        m.frustumCulled = false;
      }
    });
  }
  try {
    if (_glowTex) renderer.initTexture?.(_glowTex);
    renderer.compile(scene, camera);
    const sun = dayNight?.sun;
    if (sun) {
      sun.shadow.needsUpdate = true;
      renderer.render(scene, camera); // uma passada: aloca o mapa de sombras e sobe geometrias/texturas
      _shadowRestore = sun.shadow.autoUpdate;
      sun.shadow.autoUpdate = false;
    } else {
      renderer.render(scene, camera);
    }
  } catch (err) {
    console.warn("Pré-aquecimento da cutscene falhou:", err);
  }
  for (const [m, f] of culled) m.frustumCulled = f;
  objs.forEach((o, i) => (o.visible = prev[i]));
}

function _restoreIntroWorld() {
  for (const o of _hiddenForIntro) o.visible = true;
  _hiddenForIntro.length = 0;
  const sun = _introEnv?.dayNight?.sun;
  if (sun && _shadowRestore !== null) {
    sun.shadow.autoUpdate = _shadowRestore;
    sun.shadow.needsUpdate = true;
    _shadowRestore = null;
  }
  _stopDrone();
  if (_redVignette) _redVignette.style.opacity = "0";
}

// Drone grave contínuo (3 osciladores graves levemente dessintonizados): mal-estar constante sem música extra
function _startDrone(audio) {
  if (_drone || !audio?.context) return;
  const ctx = audio.context;
  try {
    const out = ctx.createGain();
    out.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    out.connect(lp).connect(audio.sfx || audio.master || ctx.destination);
    const oscs = [[47, "sine"], [50.6, "sine"], [94.5, "triangle"]].map(([f, type]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(out);
      o.start();
      return o;
    });
    out.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 4);
    _drone = { out, oscs, ctx };
  } catch (_) {
    _drone = null;
  }
}

function _stopDrone() {
  if (!_drone) return;
  const { out, oscs, ctx } = _drone;
  try {
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    for (const o of oscs) o.stop(ctx.currentTime + 0.7);
  } catch (_) {}
  _drone = null;
}

// Tensão crescente: batimento cardíaco que acelera, drone, vinheta vermelha pulsando e tremor de câmera
function _suspense(t, dt, audio, camera) {
  const tension = _smooth(t / (T.black - 2)); // 0 -> 1 até o fim da fuga
  if (t > 0.4) _startDrone(audio);
  if (t >= 3 && t < T.black) {
    _hbTimer -= dt;
    if (_hbTimer <= 0) {
      _hbTimer = 1.05 - 0.68 * tension; // de ~57 bpm a ~160 bpm
      audio?.heartbeat?.(0.5 + tension * 0.9);
    }
  }
  if (_redVignette) {
    const chase = t > T.zoom ? Math.min(1, 0.35 + tension) : 0;
    const pulse = 0.5 + 0.5 * Math.sin(t * (4 + tension * 9));
    const o = chase * (0.18 + pulse * 0.22 * tension);
    const text = o.toFixed(2);
    if (_redVignette.style.opacity !== text) _redVignette.style.opacity = text;
  }
  // tremor extra proporcional à tensão (a câmera nunca fica "limpa" demais)
  const j = 0.004 + tension * 0.02;
  camera.position.x += Math.sin(t * 41) * j;
  camera.position.y += Math.cos(t * 37) * j * 0.8;
}

// ============================================================================
// 5b. Inicialização
// ============================================================================
export function startIntroSequence(env) {
  _introEnv = env;
  const { scene, world, player, cameraRig, input, dayNight, music, audio } = env;

  _wolfHowl1Played = false;
  _wolfGrowlPlayed = false;
  _wolfStepsTimer = 0;
  _introFlags = { howls: new Set(), caption: false, black: false, monster: false, ended: false };

  _baseFov = env.camera?.fov || 60;
  _ensureUIElements();
  _attachSkipListener();
  if (!_path) _path = _buildPath();

  if (!_tallFigure) {
    _tallFigure = createTallFigure();
    // olhos amarelos da entidade (o material é local a esta instância da figura)
    _tallFigure.traverse((o) => {
      if (o.material && o.material.isMeshBasicMaterial && o.material.color.r > 0.9 && o.material.color.g < 0.2) {
        o.material.color.setHex(0xffd21a);
      }
    });
    // As íris originais ficam atrás da aba do capuz. Olhos amarelos próprios, à frente do capuz,
    // em fendas estreitas com brilho aditivo (leve: 4 malhas + 2 sprites).
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd21a });
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const eyes = new THREE.Group();
    eyes.name = "VulgusYellowEyes";
    for (const [x, y, r] of [[-0.135, 5.2, 1], [0.135, 5.2, 1], [-0.19, 5.4, 0.7], [0.19, 5.4, 0.7]]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.scale.set(1.7 * r, 0.62 * r, 0.5 * r);
      eye.position.set(x, y, 0.64);
      eye.rotation.z = x < 0 ? -0.22 : 0.22; // olhar oblíquo, ameaçador
      eyes.add(eye);
    }
    for (const x of [-0.135, 0.135]) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glow(), color: 0xffc400, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
      glow.scale.setScalar(0.42);
      glow.position.set(x, 5.2, 0.66);
      eyes.add(glow);
    }
    _tallFigure.add(eyes);
    scene.add(_tallFigure);
  } else if (!_tallFigure.parent) {
    scene.add(_tallFigure);
  }

  if (_introWolves.length === 0) {
    for (let i = 0; i < 3; i++) {
      const beast = _createThreeEyedBeast();
      scene.add(beast);
      _introWolves.push(beast);
    }
  } else {
    for (const b of _introWolves) if (!b.parent) scene.add(b);
  }

  if (_cultists.length === 0) {
    for (let i = 0; i < 5; i++) {
      const c = _buildCultist();
      scene.add(c);
      _cultists.push(c);
    }
  } else {
    for (const c of _cultists) if (!c.parent) scene.add(c);
  }

  if (!_fire) _fire = _buildBonfire();
  if (!_fire.parent) scene.add(_fire);
  _fire.visible = true;

  // TOCA MÚSICA TENSA
  if (music?.setOverride) music.setOverride("tense");
  const unlockCutsceneAudio = () => {
    if (audio?._unlock) audio._unlock();
    if (music?.current?.element?.paused) music.current.element.play().catch(() => {});
  };
  window.addEventListener("pointerdown", unlockCutsceneAudio, { once: true });
  window.addEventListener("keydown", unlockCutsceneAudio, { once: true });

  // NOITE BREU: meia-noite, neblina densa. Só a fogueira e os olhos das criaturas iluminam.
  if (dayNight?.setTime) dayNight.setTime(0.0, true);
  else if (dayNight) dayNight.progress = 0.0;
  dayNight?.setFogLevel?.(3, true);

  GameState.isIntroPlaying = true;
  GameState.introPhase = 0;
  GameState.introTimer = 0;

  if (input) input.setModalOpen(true);
  if (cameraRig) cameraRig.frozen = true;

  // Acampamento na mata fechada a ~270m dos muros da cidade
  const startX = 0;
  const startZ = -270;
  _originX = startX;
  _originZ = startZ;
  const startY = world.heightAt(startX, startZ);

  player.x = startX;
  player.z = startZ;
  player.root.position.set(startX, startY, startZ);
  player.root.visible = true;
  if (player.model) player.model.rotation.y = 0; // de frente para a câmera (+Z)
  player.walkPhase = 0;
  player._pose && (player._pose.ready = false);

  // Fogueira entre o jogador e a câmera
  const fy = world.heightAt(startX - 0.45, startZ + 1.5);
  _fire.position.set(startX - 0.45, fy, startZ + 1.5);
  _fire.scale.setScalar(0.72);

  // Cultista principal: de lado, na penumbra, encarando o jogador
  const cx = startX + 6.2;
  const cz = startZ + 0.8;
  const main = _cultists[0];
  main.position.set(cx, world.heightAt(cx, cz), cz);
  main.rotation.y = Math.atan2(startX - cx, startZ - cz);
  main.visible = false;
  main.userData.eyes.scale.setScalar(1);
  main.userData.halo.material.opacity = 0;

  // Cultistas ao longo da fuga (aparecem de relance na escuridão)
  const taus = [2.6, 4.6, 6.8, 8.6];
  const sides = [5.0, -4.6, 4.2, -3.8];
  for (let k = 0; k < taus.length; k++) {
    const pp = _pathAt(taus[k] + 0.6, _tmpP);
    const wx = startX + pp.x + Math.cos(pp.psi) * sides[k];
    const wz = startZ + pp.z - Math.sin(pp.psi) * sides[k];
    const c = _cultists[k + 1];
    c.position.set(wx, world.heightAt(wx, wz), wz);
    c.rotation.y = Math.atan2(startX + pp.x - wx, startZ + pp.z - wz);
    c.visible = false;
    c.userData.eyes.scale.setScalar(1);
    c.userData.halo.material.opacity = 0.0;
  }

  // Lobos: começam escondidos na escuridão atrás do jogador (-Z)
  for (let i = 0; i < 3; i++) {
    const b = _introWolves[i];
    b.visible = false;
    b.position.set(startX + WOLF_X[i], world.heightAt(startX + WOLF_X[i], startZ - 17), startZ - 17 - i * 1.5);
  }

  // Entidade alta: parada no fim da corrida, de frente para o jogador
  const pe = _pathAt(RUN_DURATION, _tmpP);
  const ex = startX + pe.x + Math.sin(pe.psi) * ENTITY_DIST;
  const ez = startZ + pe.z + Math.cos(pe.psi) * ENTITY_DIST;
  _tallFigure.position.set(ex, world.heightAt(ex, ez), ez);
  _tallFigure.rotation.set(0, pe.psi + Math.PI, 0);
  _tallFigure.visible = false;
  _entitySpawnedZ = 0;

  if (_caption) {
    _caption.textContent = "temos tanto planos para você";
    _caption.style.opacity = "0";
  }
  if (_skipPrompt) _skipPrompt.style.opacity = "0.9";
  if (_fadeOverlay) {
    _fadeOverlay.style.transition = "opacity 0.6s ease-in-out";
    _fadeOverlay.style.opacity = "0";
  }

  _dtSmooth = 0;
  _hbTimer = 0.5;
  _prepareIntroWorld(env, startX, startZ);
  document.body.classList.add("intro-playing");
}

// ============================================================================
// 6. Atualização por frame
// ============================================================================
const _camPos = new THREE.Vector3();
const _eyeW = new THREE.Vector3();
const _look = new THREE.Vector3();

function _poseIdle(player, dt, breathRate = 1) {
  player.grounded = true;
  player.crouching = false;
  player.rolling = false;
  player.blocking = false;
  player.vx = 0;
  player.vz = 0;
  player.speedRatio = 0;
  player.idleTime = (player.idleTime || 0) + dt * breathRate;
  if (typeof player._animate === "function") player._animate(dt, null, false, false, 0);
}

function _howl(audio, key, t, at, vol, dist) {
  if (t >= at && !_introFlags.howls.has(key)) {
    _introFlags.howls.add(key);
    audio?.playWolfHowl?.(vol, dist);
  }
}

export function updateIntroSequence(dtRaw, player, camera, world, audio, effects, ui) {
  if (!GameState.isIntroPlaying) return;

  // dt suavizado (média exponencial) e limitado: picos isolados não viram trancos de câmera
  const clamped = Math.min(dtRaw, 0.05);
  _dtSmooth = _dtSmooth === 0 ? clamped : _dtSmooth + (clamped - _dtSmooth) * 0.2;
  const dt = _dtSmooth * INTRO_SPEED;

  GameState.introTimer += dt;
  const t = GameState.introTimer;
  const ox = _originX;
  const oz = _originZ;
  const gy = world ? world.heightAt(ox, oz) : 0;

  const shakeL = (Math.sin(t * 11) * 0.02 + Math.cos(t * 17) * 0.012);
  const shakeLY = (Math.cos(t * 13) * 0.016 + Math.sin(t * 19) * 0.01);
  const shakeH = (Math.sin(t * 22) + Math.cos(t * 31) * 0.5) * 0.05;
  const shakeHY = (Math.cos(t * 26) + Math.sin(t * 37) * 0.5) * 0.045;

  _updateBonfire(t);

  // Sons de fera: uivos distantes, rosnados, latidos e passadas conforme a perseguição se aproxima
  _howl(audio, "h0", t, 1.0, 0.45, 55);
  _howl(audio, "h1", t, 7.4, 0.55, 42);
  _howl(audio, "h2", t, T.wolves + 0.1, 1.0, 6);
  _howl(audio, "h3", t, T.run + 0.3, 0.95, 8);
  _howl(audio, "h4", t, T.run + 3.6, 0.85, 10);
  _howl(audio, "h5", t, T.run + 7.0, 0.8, 12);
  if (t >= T.wolves + 0.2 && t < T.run + 8.5) {
    _wolfStepsTimer += dt;
    if (_wolfStepsTimer >= 0.28) {
      _wolfStepsTimer = 0;
      audio?.playBeastStep?.(t < T.run ? 12 : 6);
    }
  }

  const runTau = t - T.run;
  const running = runTau >= 0 && runTau < RUN_DURATION;
  const px = ox + _pathAt(Math.max(0, Math.min(RUN_DURATION, runTau)), _tmpP).x;
  const pz = oz + _tmpP.z;
  const ppsi = _tmpP.psi;

  // ------------------------------------------------------------------ jogador
  if (runTau >= 0) {
    player.x = px;
    player.z = pz;
  } else {
    player.x = ox;
    player.z = oz;
  }
  const groundY = world ? world.heightAt(player.x, player.z) : 0;
  player.root.position.set(player.x, groundY, player.z);

  const modelYaw = player.model ? player.model.rotation.y : 0;
  const playerEye = _look.set(player.x, groundY + 1.62, player.z); // reutilizado abaixo (copiado antes de usar)
  const eyeX = playerEye.x;
  const eyeY = playerEye.y;
  const eyeZ = playerEye.z;

  let headYaw = 0;
  let headPitch = 0.1; // cabeça levemente caída: cansaço
  if (t < T.look) {
    _poseIdle(player, dt, 0.8);
    if (player.model) player.model.rotation.y = 0;
    headPitch = 0.12 + Math.sin(t * 0.9) * 0.025;
    // pisca lento e pesado perto dos 3,5 s: leve queda da cabeça
    const sag = _smooth((t - 3.2) / 0.5) * (1 - _smooth((t - 3.9) / 0.6));
    headPitch += sag * 0.12;
  } else if (t < T.wolves) {
    _poseIdle(player, dt, t > T.zoom ? 2.2 : 1.1);
    // olhar: cabeça vai primeiro, o corpo acompanha
    const yawBody = 1.45 * _smooth((t - (T.look + 0.5)) / 1.5);
    if (player.model) player.model.rotation.y = yawBody;
    headYaw = 0.6 * _smooth((t - T.look) / 0.6) * (1 - _smooth((t - (T.look + 1.2)) / 1.2));
    headPitch = 0.04;
    if (t > T.zoom) headPitch = -0.02;
  } else if (runTau < 0) {
    _poseIdle(player, dt, 3.0);
    // vira rápido para trás ao ouvir/ver os lobos
    const turn = _smooth((t - (T.wolves + 0.5)) / 0.55);
    if (player.model) player.model.rotation.y = 1.45 + _angDiff(Math.PI, 1.45) * turn;
    headPitch = 0.0;
  } else if (running && _pathSpeedOK(runTau)) {
    player.grounded = true;
    player.crouching = false;
    player.rolling = false;
    player.blocking = false;
    player.vx = Math.sin(ppsi) * 6.4;
    player.vz = Math.cos(ppsi) * 6.4;
    player.speedRatio = 1.0;
    player.walkPhase = (player.walkPhase || 0) + dt * 14.5;
    const stepIndex = Math.floor(player.walkPhase / Math.PI);
    if (stepIndex !== player._introStepIndex) {
      player._introStepIndex = stepIndex;
      audio?.step?.(true, 1);
    }
    if (typeof player._animate === "function") player._animate(dt, null, false, true, 0);
    if (player.model) player.model.rotation.y += _angDiff(ppsi, player.model.rotation.y) * (1 - Math.exp(-14 * dt));
    // glance para os lados onde passam os cultistas: primeiro um lado, depois o outro
    const gA = _smooth((runTau - 2.7) / 0.4) * (1 - _smooth((runTau - 4.3) / 0.4));
    const gB = _smooth((runTau - 4.7) / 0.4) * (1 - _smooth((runTau - 6.0) / 0.4));
    headYaw = 0.95 * gA - 0.95 * gB;
    headPitch = 0.02 + (runTau > 9.4 ? -0.35 * _smooth((runTau - 9.4) / 0.9) : 0); // olha para cima, para a entidade
  } else {
    // freou diante da entidade: choque
    _poseIdle(player, dt, 3.4);
    headPitch = -0.5;
  }
  if (player.head) {
    player.head.rotation.y = headYaw;
    player.head.rotation.x = headPitch;
  }

  // ------------------------------------------------------------------ cultistas
  const main = _cultists[0];
  if (t >= T.cultist) main.visible = true;
  // olhos: tremeluzem na penumbra, depois crescem em zoom com aura vermelha
  const zoomP = _smooth((t - T.zoom) / 2.8);
  const flick = 0.85 + Math.sin(t * 31) * 0.08 + Math.sin(t * 7.3) * 0.07;
  main.userData.eyes.scale.setScalar(1 + zoomP * zoomP * 1.7 * flick);
  main.userData.halo.material.opacity = zoomP * 0.42 * flick;
  main.userData.halo.scale.setScalar(0.3 + zoomP * 0.55);
  main.userData.head.rotation.y = Math.sin(t * 0.7) * 0.08;
  for (let k = 1; k < _cultists.length; k++) {
    const c = _cultists[k];
    const appear = runTau >= (k === 1 ? 1.4 : k === 2 ? 3.4 : k === 3 ? 5.6 : 7.4);
    c.visible = appear && runTau < RUN_DURATION + 3;
    c.userData.eyes.scale.setScalar(1 + Math.sin(t * 5 + k) * 0.08);
  }

  // ------------------------------------------------------------------ lobos
  for (let i = 0; i < 3; i++) {
    const b = _introWolves[i];
    const show = t >= T.wolves - 0.7 && runTau < RUN_DURATION + 2;
    b.visible = show;
    if (!show) continue;
    let wx;
    let wz;
    let wpsi = 0;
    if (runTau < 0) {
      const q = _smooth((t - (T.wolves - 0.7)) / (T.run - T.wolves + 0.7));
      const sx = ox + WOLF_X[i];
      const sz = oz - 17 - i * 1.5;
      const ex = ox + WOLF_X[i] * 0.6;
      const ez = oz - 5.5 - i * 0.8;
      wx = sx + (ex - sx) * q;
      wz = sz + (ez - sz) * q;
    } else {
      const lag = (1.55 + 0.22 * i) + ((0.8 + 0.12 * i) - (1.55 + 0.22 * i)) * _smooth(runTau / 8);
      const qq = runTau - lag;
      if (qq >= 0) {
        const wp = _pathAt(Math.min(RUN_DURATION, qq), _tmpW);
        wx = ox + wp.x + Math.cos(wp.psi) * (i - 1) * 0.9;
        wz = oz + wp.z - Math.sin(wp.psi) * (i - 1) * 0.9;
        wpsi = wp.psi;
      } else {
        const u = _smooth(runTau / lag);
        const ex = ox + WOLF_X[i] * 0.6;
        const ez = oz - 5.5 - i * 0.8;
        wx = ex + (ox - ex) * u;
        wz = ez + (oz - ez) * u;
        wpsi = Math.atan2(ox - ex, oz - ez);
      }
    }
    b.position.set(wx, world ? world.heightAt(wx, wz) : 0, wz);
    b.rotation.set(0, wpsi + Math.sin(t * 6 + i) * 0.05, 0);
    if (b.userData.legs) {
      for (const leg of b.userData.legs) leg.mesh.position.z = leg.baseZ + Math.sin(t * 18 + leg.phase) * 0.16;
    }
  }

  // ------------------------------------------------------------------ entidade
  if (runTau >= 6.4 && !_tallFigure.visible) _tallFigure.visible = true;
  if (runTau >= RUN_DURATION + 1.3) {
    _tallFigure.rotation.x = THREE.MathUtils.lerp(_tallFigure.rotation.x, -0.1, 1 - Math.exp(-3.0 * dt));
  }
  if (runTau >= RUN_DURATION + 0.2 && GameState.introPhase < 2) {
    GameState.introPhase = 2;
  }

  // ------------------------------------------------------------------ câmera
  // FOV: fecha devagar no plano 1 (zoom nos olhos cansados) e volta ao normal nos demais
  const fovTarget = t < T.look ? _baseFov - 32 * _smooth(t / T.look) : t >= T.zoom && t < T.wolves ? _baseFov - 12 * _smooth((t - T.zoom) / 2.5) : _baseFov;
  if (Math.abs(camera.fov - fovTarget) > 0.01) {
    camera.fov = fovTarget;
    camera.updateProjectionMatrix();
  }
  if (t < T.look) {
    // PLANO 1: câmera baixa, fogueira entre ela e o protagonista; empurra devagar para os olhos cansados
    const k = _smooth(t / T.look);
    const dist = 4.6 - k * 1.1;
    _camPos.set(ox + 0.7 + shakeL * 0.5, gy + 0.38 + k * 0.1 + shakeLY * 0.5, oz + dist);
    camera.position.copy(_camPos);
    camera.lookAt(ox, gy + 1.62 - (1 - k) * 0.06, oz);
  } else if (t < T.zoom) {
    // PLANO 2: lateral, protagonista (à esq.), fogueira e o cultista surgindo na penumbra (à dir.)
    const k = _smooth((t - T.look) / (T.zoom - T.look));
    camera.position.set(ox + 3.2 - k * 0.5 + shakeL, gy + 1.2 + shakeLY, oz + 3.4);
    camera.lookAt(ox + 2.9 + k * 0.4, gy + 1.45, oz + 0.5);
  } else if (t < T.wolves) {
    // PLANO 3: zoom do ponto de vista do protagonista até o rosto mascarado (olhos enormes, aura vermelha)
    const k = _smooth((t - T.zoom) / (T.wolves - T.zoom - 0.4));
    const kk = k * k;
    const cx = main.position.x;
    const cy = main.position.y + 1.88;
    const cz = main.position.z;
    const fx = THREE.MathUtils.lerp(eyeX + 0.4, cx - 0.9, kk);
    const fy = THREE.MathUtils.lerp(eyeY, cy, k);
    const fz = THREE.MathUtils.lerp(eyeZ, cz - 0.1, kk);
    camera.position.set(fx + shakeH * k, fy + shakeHY * k, fz);
    camera.lookAt(cx, cy, cz);
  } else if (runTau < 0) {
    // PLANO 4: sobre o ombro, olhando para a escuridão onde só se veem 6 olhos vermelhos se aproximando
    camera.position.set(ox + 0.9 + shakeH * 0.5, gy + 1.35 + shakeHY * 0.5, oz + 0.6);
    camera.lookAt(ox - 0.2, gy + 1.05, oz - 14);
  } else if (runTau < 3.0) {
    // PLANO 5: câmera à frente, baixa, o protagonista corre em direção a ela com os lobos nas costas
    const fwdX = Math.sin(ppsi);
    const fwdZ = Math.cos(ppsi);
    camera.position.set(px + fwdX * 3.8 + Math.cos(ppsi) * 1.0 + shakeH, groundY + 0.95 + shakeHY, pz + fwdZ * 3.8 - Math.sin(ppsi) * 1.0);
    camera.lookAt(px, groundY + 1.3, pz);
  } else if (runTau < 6.0) {
    // PLANO 6: tracking lateral; ele olha para o lado e vê outros membros do culto no escuro
    const sx = Math.cos(ppsi);
    const sz = -Math.sin(ppsi);
    camera.position.set(px - sx * 3.6 + Math.sin(ppsi) * 0.8 + shakeH * 0.6, groundY + 1.0 + shakeHY * 0.6, pz - sz * 3.6 + Math.cos(ppsi) * 0.8);
    camera.lookAt(px + sx * 1.5, groundY + 1.25, pz + sz * 1.5);
  } else if (runTau < RUN_DURATION - 0.9) {
    // PLANO 7: POV da corrida; olhos amarelos crescem na névoa à frente
    const fwdX = Math.sin(ppsi);
    const fwdZ = Math.cos(ppsi);
    const bob = Math.sin(player.walkPhase * 2) * 0.05;
    camera.position.set(px + fwdX * 0.25 + shakeH * 1.2, groundY + 1.6 + bob + shakeHY * 1.2, pz + fwdZ * 0.25);
    camera.lookAt(px + fwdX * 8, groundY + 2.2 + (runTau > 8.5 ? (runTau - 8.5) * 0.9 : 0), pz + fwdZ * 8);
  } else if (t < T.caption - 0.4) {
    // PLANO 8: freou. Contra-plongée sobre o ombro até os olhos amarelos a poucos passos
    const fwdX = Math.sin(ppsi);
    const fwdZ = Math.cos(ppsi);
    camera.position.set(px - fwdX * 1.1 + Math.cos(ppsi) * 0.8 + shakeL, groundY + 0.8 + shakeLY, pz - fwdZ * 1.1 - Math.sin(ppsi) * 0.8);
    camera.lookAt(_tallFigure.position.x, _tallFigure.position.y + 4.9, _tallFigure.position.z);
  } else {
    // PLANO 9: a entidade encara de perto: capuz e olhos amarelos preenchem a tela
    const fwdX = Math.sin(ppsi);
    const fwdZ = Math.cos(ppsi);
    const kk = _smooth((t - (T.caption - 0.4)) / 1.2);
    const dist = THREE.MathUtils.lerp(1.9, 1.5, kk);
    // posição REAL dos olhos (a figura se inclina): a câmera fica sempre à frente deles, nunca dentro da cabeça
    _tallFigure.updateMatrixWorld(true);
    _eyeW.set(0, 5.25, 0.64);
    _tallFigure.localToWorld(_eyeW);
    _camPos.set(_eyeW.x - fwdX * dist + shakeH * 1.2, _eyeW.y - 0.12 + shakeHY * 1.2, _eyeW.z - fwdZ * dist);
    camera.position.lerp(_camPos, 1 - Math.exp(-9 * dt));
    camera.lookAt(_eyeW.x, _eyeW.y, _eyeW.z);
  }

  // ------------------------------------------------------------------ suspense (áudio, vinheta, tremor)
  _suspense(t, dt, audio, camera);
  if (t >= T.cultist && !_introFlags.stCultist) {
    _introFlags.stCultist = true;
    audio?._tone?.("sawtooth", 130, 48, 1.1, 0.16);
    audio?._tone?.("sine", 70, 30, 1.4, 0.4);
  }
  if (t >= T.zoom && !_introFlags.stZoom) {
    _introFlags.stZoom = true;
    audio?._tone?.("sawtooth", 60, 240, 2.4, 0.07); // riser
  }
  if (t >= T.run && !_introFlags.stRun) {
    _introFlags.stRun = true;
    audio?._tone?.("sine", 90, 28, 0.9, 0.6); // pancada de saída
    audio?.pain?.();
  }
  if (runTau >= RUN_DURATION + 0.2 && !_introFlags.stEntity) {
    _introFlags.stEntity = true;
    audio?._tone?.("sine", 55, 24, 2.2, 0.7);
    audio?._tone?.("sawtooth", 82, 41, 1.6, 0.12);
  }

  // ------------------------------------------------------------------ legenda, fade e som final
  if (t >= T.caption && !_introFlags.caption) {
    _introFlags.caption = true;
    if (_caption) _caption.style.opacity = "1";
  }
  if (t >= T.captionOff && _caption && _caption.style.opacity !== "0") _caption.style.opacity = "0";
  if (t >= T.black && !_introFlags.black) {
    _introFlags.black = true;
    if (_fadeOverlay) {
      _fadeOverlay.style.transition = "opacity 1.8s ease-in-out";
      _fadeOverlay.style.opacity = "1";
    }
  }
  if (t >= T.monster && !_introFlags.monster) {
    _introFlags.monster = true;
    audio?.playCutsceneMonster?.(1.0); // com a tela totalmente preta
  }
  if (t >= T.end && !_introFlags.ended) {
    _introFlags.ended = true;
    endIntroSequence();
  }
}

// (a corrida só vale enquanto o jogador ainda se move: depois ele freia)
function _pathSpeedOK(runTau) {
  return runTau < RUN_DURATION - 0.55;
}

// ============================================================================
// 7. Encerramento: Despertar na Estrada Principal (Saída 100% Desobstruída)
// ============================================================================
export function endIntroSequence(isSkipped = false) {
  if (!GameState.isIntroPlaying && GameState.introPhase === 3) return;

  GameState.isIntroPlaying = false;
  GameState.introPhase = 3;
  GameState.anchorX = undefined;
  GameState.anchorZ = undefined;
  _restoreIntroWorld();
  document.body.classList.remove("intro-playing");

  if (_tallFigure) {
    _tallFigure.visible = false;
    _tallFigure.rotation.set(0, 0, 0);
  }
  for (const beast of _introWolves) beast.visible = false;
  for (const c of _cultists) c.visible = false;
  if (_fire) {
    _fire.visible = false;
    if (_fire.parent) _fire.parent.remove(_fire); // remove a PointLight da cena (a tela já está preta)
  }
  if (_caption) _caption.style.opacity = "0";
  if (_skipPrompt) _skipPrompt.style.opacity = "0";
  if (_introEnv?.camera && _baseFov && _introEnv.camera.fov !== _baseFov) {
    _introEnv.camera.fov = _baseFov;
    _introEnv.camera.updateProjectionMatrix();
  }

  if (_introEnv) {
    const { player, world, cameraRig, input, ui, dayNight, scene, music, loadingScreen, renderer, camera } = _introEnv;

    const performWakeup = () => {
      if (music?.setOverride) music.setOverride(null);
      dayNight?.setFogAuto?.(true);
      if (player.head) {
        player.head.rotation.set(0, 0, 0);
      }

      // SPAWN NA ESTRADA PRINCIPAL DO LADO DE FORA DO PORTÃO
      const safeSpawnX = 0;
      const safeSpawnZ = -62;
      const safeGroundY = world ? world.heightAt(safeSpawnX, safeSpawnZ) : 0;

      player.x = safeSpawnX;
      player.z = safeSpawnZ;
      player.root.position.set(safeSpawnX, safeGroundY, safeSpawnZ);
      player.vx = 0;
      player.vz = 0;
      player.speedRatio = 0;
      player.walkPhase = 0;
      if (player.model) player.model.rotation.y = 0;
      if (player._pose) player._pose.ready = false;
      if (typeof player._animate === "function") player._animate(0.016, null, false, false, 0);

      // TRANSIÇÃO PARA PLENO DIA
      if (dayNight?.setTime) dayNight.setTime(0.40, true);
      else if (dayNight) dayNight.progress = 0.40;

      if (cameraRig) {
        cameraRig.frozen = false;
        cameraRig.snap?.(player);
      }
      if (input) input.setModalOpen(false);

      ui?.showToast?.("✦ Despertas na estrada diante dos portões. A névoa da noite se dissipa.");
    };

    if (loadingScreen) {
      loadingScreen.transition({
        title: "PURIS · REINO DE CALDERA",
        message: isSkipped ? "Avançando para os portões da cidade..." : "Despertando diante dos portões...",
        action: performWakeup,
        world,
        scene,
        camera: cameraRig?.camera || camera,
        renderer,
        player,
        minDuration: isSkipped ? 650 : 450,
        onComplete: () => {
          if (_fadeOverlay) {
            _fadeOverlay.style.transition = "opacity 0.6s ease-in-out";
            _fadeOverlay.style.opacity = "0";
          }
        },
      });
      return;
    }

    performWakeup();
  }

  if (_fadeOverlay) {
    window.setTimeout(() => {
      if (_fadeOverlay) {
        _fadeOverlay.style.transition = "opacity 0.6s ease-in-out";
        _fadeOverlay.style.opacity = "0";
      }
    }, 250);
  }
}
