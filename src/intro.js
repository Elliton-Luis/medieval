import * as THREE from "three";
import { CONFIG } from "./config.js";

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

// ============================================================================
// 2. A Entidade de 5 Olhos: O Corpo Seco (Figura Alta, Magra e Esquelética)
// ============================================================================
export function createTallFigure() {
  const group = new THREE.Group();
  group.name = "CorpoSeco_5Eyes";

  // Textura e material de carne mumificada ressequida, osso escuro e tendões secos
  const dryFleshMat = new THREE.MeshBasicMaterial({ color: 0x09080b });
  const boneAccentMat = new THREE.MeshBasicMaterial({ color: 0x181414 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffea00 }); // Amarelo vibrante penetrante na névoa

  // --------------------------------------------------------------------------
  // 1. Pernas Longas, Emaciadas e Articuladas (Digitígradas / Esqueléticas)
  // --------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    // Coxa fina e ressequida
    const thighGeo = new THREE.CylinderGeometry(0.055, 0.045, 1.35, 5);
    const thigh = new THREE.Mesh(thighGeo, dryFleshMat);
    thigh.position.set(side * 0.18, 1.95, -0.05);
    thigh.rotation.x = -0.18;
    group.add(thigh);

    // Joelho nodoso saliente de cartilagem seca
    const kneeGeo = new THREE.DodecahedronGeometry(0.07, 0);
    const knee = new THREE.Mesh(kneeGeo, boneAccentMat);
    knee.position.set(side * 0.18, 1.32, 0.08);
    group.add(knee);

    // Canela longa, arqueada para trás
    const shinGeo = new THREE.CylinderGeometry(0.042, 0.032, 1.45, 5);
    const shin = new THREE.Mesh(shinGeo, dryFleshMat);
    shin.position.set(side * 0.18, 0.65, -0.02);
    shin.rotation.x = 0.16;
    group.add(shin);

    // Pé esquelético comprido com dedos secos cravados no solo
    const footGeo = new THREE.BoxGeometry(0.09, 0.04, 0.38);
    const foot = new THREE.Mesh(footGeo, dryFleshMat);
    foot.position.set(side * 0.18, 0.03, 0.12);
    group.add(foot);

    // Garras finas dos pés
    for (const fx of [-0.03, 0, 0.03]) {
      const toeClaw = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.12, 4), boneAccentMat);
      toeClaw.position.set(side * 0.18 + fx, 0.03, 0.31);
      toeClaw.rotation.x = Math.PI * 0.5;
      group.add(toeClaw);
    }
  }

  // --------------------------------------------------------------------------
  // 2. Pelve Estreita e Coluna Vertebral Ressequida com Vértebras Salientes
  // --------------------------------------------------------------------------
  const pelvisGeo = new THREE.BoxGeometry(0.32, 0.18, 0.22);
  const pelvis = new THREE.Mesh(pelvisGeo, dryFleshMat);
  pelvis.position.set(0, 2.58, 0);
  group.add(pelvis);

  // Coluna lombar e dorsal curva e fina
  const spineGeo = new THREE.CylinderGeometry(0.055, 0.065, 1.25, 6);
  const spine = new THREE.Mesh(spineGeo, dryFleshMat);
  spine.position.set(0, 3.22, -0.04);
  spine.rotation.x = 0.15; // Curvado para a frente em postura predatória
  group.add(spine);

  // Vértebras pontiagudas salientes nas costas (corcunda do Corpo Seco)
  for (let v = 0; v < 6; v++) {
    const vertGeo = new THREE.ConeGeometry(0.035, 0.18, 4);
    const vert = new THREE.Mesh(vertGeo, boneAccentMat);
    vert.position.set(0, 2.75 + v * 0.22, -0.12 - (v * 0.02));
    vert.rotation.x = -Math.PI * 0.42;
    group.add(vert);
  }

  // --------------------------------------------------------------------------
  // 3. Tórax Esquelético e Costelas Proeminentes (Pele Grudada no Osso)
  // --------------------------------------------------------------------------
  const sternumGeo = new THREE.BoxGeometry(0.18, 0.95, 0.16);
  const sternum = new THREE.Mesh(sternumGeo, dryFleshMat);
  sternum.position.set(0, 3.42, 0.04);
  sternum.rotation.x = 0.15;
  group.add(sternum);

  // Costelas individuais salientes contornando o tórax emaciado
  for (let r = 0; r < 4; r++) {
    const ry = 3.15 + r * 0.22;
    const rScale = 0.85 + (r === 2 ? 0.25 : r * 0.1);
    for (const side of [-1, 1]) {
      const ribGeo = new THREE.BoxGeometry(0.14 * rScale, 0.035, 0.24 * rScale);
      const rib = new THREE.Mesh(ribGeo, boneAccentMat);
      rib.position.set(side * (0.13 * rScale), ry, 0.02);
      rib.rotation.z = side * -0.22;
      rib.rotation.y = side * 0.15;
      group.add(rib);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Clavículas Pontiagudas, Escápulas e Braços Longos Desproporcionais
  // --------------------------------------------------------------------------
  const clavicleGeo = new THREE.BoxGeometry(0.68, 0.06, 0.09);
  const clavicle = new THREE.Mesh(clavicleGeo, boneAccentMat);
  clavicle.position.set(0, 3.96, 0.06);
  group.add(clavicle);

  for (const side of [-1, 1]) {
    // Escápula saliente para cima como galho seco
    const scapulaGeo = new THREE.ConeGeometry(0.09, 0.38, 4);
    const scapula = new THREE.Mesh(scapulaGeo, dryFleshMat);
    scapula.position.set(side * 0.32, 4.12, -0.06);
    scapula.rotation.z = side * -0.45;
    scapula.rotation.x = -0.25;
    group.add(scapula);

    // Braço superior muito fino (úmero)
    const upperArmGeo = new THREE.CylinderGeometry(0.045, 0.038, 1.45, 5);
    const upperArm = new THREE.Mesh(upperArmGeo, dryFleshMat);
    upperArm.position.set(side * 0.42, 3.25, 0.02);
    upperArm.rotation.z = side * -0.12;
    upperArm.rotation.x = 0.12;
    group.add(upperArm);

    // Cotovelo pontiagudo
    const elbowGeo = new THREE.DodecahedronGeometry(0.055, 0);
    const elbow = new THREE.Mesh(elbowGeo, boneAccentMat);
    elbow.position.set(side * 0.48, 2.52, 0.12);
    group.add(elbow);

    // Antebraço esguio que desce quase até o chão
    const forearmGeo = new THREE.CylinderGeometry(0.038, 0.028, 1.55, 5);
    const forearm = new THREE.Mesh(forearmGeo, dryFleshMat);
    forearm.position.set(side * 0.52, 1.76, 0.08);
    forearm.rotation.z = side * -0.06;
    group.add(forearm);

    // Mão seca e garras compridas de galho
    for (let c = -1; c <= 2; c++) {
      const clawGeo = new THREE.ConeGeometry(0.018, 0.42, 4);
      const claw = new THREE.Mesh(clawGeo, boneAccentMat);
      claw.position.set(side * 0.52 + c * 0.035, 0.82, 0.06 + Math.abs(c) * 0.02);
      claw.rotation.x = 0.28 + c * 0.05;
      claw.rotation.z = side * (0.08 + c * 0.06);
      group.add(claw);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Pescoço Longo, Fino e Projetado para a Frente
  // --------------------------------------------------------------------------
  const neckGeo = new THREE.CylinderGeometry(0.085, 0.11, 0.85, 6);
  const neck = new THREE.Mesh(neckGeo, dryFleshMat);
  neck.position.set(0, 4.38, 0.14);
  neck.rotation.x = 0.24; // Pescoço esticado e inclinado para encarar a presa
  group.add(neck);

  // --------------------------------------------------------------------------
  // 6. Cabeça Comprida, Afilada e Ressequida (Crânio Cadavérico do Corpo Seco)
  // --------------------------------------------------------------------------
  const headGeo = new THREE.BoxGeometry(0.22, 1.15, 0.32);
  const head = new THREE.Mesh(headGeo, dryFleshMat);
  head.position.set(0, 5.05, 0.26);
  head.rotation.x = 0.14;
  group.add(head);

  // Mandíbula alongada e pontiaguda afilando para baixo
  const jawGeo = new THREE.ConeGeometry(0.12, 0.55, 5);
  const jaw = new THREE.Mesh(jawGeo, dryFleshMat);
  jaw.position.set(0, 4.48, 0.25);
  jaw.rotation.x = Math.PI * 0.95;
  group.add(jaw);

  // Topo do crânio afilado e pontiagudo
  const skullGeo = new THREE.ConeGeometry(0.13, 0.48, 5);
  const skull = new THREE.Mesh(skullGeo, dryFleshMat);
  skull.position.set(0, 5.75, 0.22);
  group.add(skull);

  // --------------------------------------------------------------------------
  // 7. OS 5 OLHOS AMARELOS PENETRANTES ("O BICHO DE 5 OLHOS")
  // --------------------------------------------------------------------------
  // Disposição mística pentagonal perturbadora:
  // - 1 Olho Central Superior na Testa
  // - 2 Olhos Intermediários nas Órbitas
  // - 2 Olhos Inferiores na Mandíbula/Bochecha
  const fiveEyePositions = [
    // 1. Olho Central Superior (testa)
    { x: 0, y: 5.38, z: 0.44, size: 0.095 },
    // 2. Olho Intermediário Esquerdo
    { x: -0.09, y: 5.08, z: 0.43, size: 0.08 },
    // 3. Olho Intermediário Direito
    { x: 0.09, y: 5.08, z: 0.43, size: 0.08 },
    // 4. Olho Inferior Esquerdo (mandíbula)
    { x: -0.065, y: 4.78, z: 0.41, size: 0.07 },
    // 5. Olho Inferior Direito (mandíbula)
    { x: 0.065, y: 4.78, z: 0.41, size: 0.07 },
  ];

  fiveEyePositions.forEach((pos) => {
    const eyeMesh = new THREE.Mesh(new THREE.BoxGeometry(pos.size, pos.size, pos.size * 0.8), eyeMat);
    eyeMesh.position.set(pos.x, pos.y, pos.z);
    group.add(eyeMesh);
  });

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
// 4. Overlays HTML de Transição e Atalho de Pular
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
}

let _keyListenerAttached = false;
function _attachSkipListener() {
  if (_keyListenerAttached) return;
  _keyListenerAttached = true;
  window.addEventListener(
    "keydown",
    (event) => {
      if (GameState.isIntroPlaying && (event.code === "Space" || event.code === "Escape")) {
        event.preventDefault();
        event.stopPropagation();
        endIntroSequence();
      }
    },
    true
  );
}

// ============================================================================
// 5. Inicialização da Cutscene Noturna com Trilha Tensa
// ============================================================================
export function startIntroSequence(env) {
  _introEnv = env;
  const { scene, world, player, cameraRig, input, dayNight, music } = env;

  _ensureUIElements();
  _attachSkipListener();

  if (!_tallFigure) {
    _tallFigure = createTallFigure();
    scene.add(_tallFigure);
  }

  if (_introWolves.length === 0) {
    for (let i = 0; i < 3; i++) {
      const beast = _createThreeEyedBeast();
      scene.add(beast);
      _introWolves.push(beast);
    }
  }

  // TOCA MÚSICA TENSA (audio/tense.mp3)
  if (music?.setOverride) {
    music.setOverride("tense");
  }

  // FORÇA NOITE PROFUNDA E MUITA NEBLINA
  if (dayNight) {
    dayNight.progress = 0.88;
  }
  if (scene.fog) {
    scene.fog.density = 0.048;
    scene.fog.color.set("#05080e");
  }
  scene.background.set("#05080e");

  GameState.isIntroPlaying = true;
  GameState.introPhase = 0;
  GameState.introTimer = 0;

  if (input) input.setModalOpen(true);
  if (cameraRig) cameraRig.frozen = true;

  // Spawn na mata fechada a ~270m dos muros da cidade
  const startX = 0;
  const startZ = -270;
  const startY = world.heightAt(startX, startZ);

  player.x = startX;
  player.z = startZ;
  player.root.position.set(startX, startY, startZ);
  if (player.model) player.model.rotation.y = 0; // Olhando para o sul

  _introWolves[0].position.set(startX - 2.8, world.heightAt(startX - 2.8, startZ - 9), startZ - 9);
  _introWolves[0].visible = true;

  _introWolves[1].position.set(startX + 2.8, world.heightAt(startX + 2.8, startZ - 13), startZ - 13);
  _introWolves[1].visible = true;

  _introWolves[2].position.set(startX, world.heightAt(startX, startZ - 16), startZ - 16);
  _introWolves[2].visible = true;

  _tallFigure.visible = false;
  _tallFigure.rotation.set(0, Math.PI, 0); // Rosto voltado para o player (-Z)
  _entitySpawnedZ = 0;

  if (_skipPrompt) _skipPrompt.style.opacity = "0.9";
  if (_fadeOverlay) _fadeOverlay.style.opacity = "0";
}

// ============================================================================
// 6. Atualização por Frame (5 Ângulos Cinematográficos com a Entidade Corrigida)
// ============================================================================
export function updateIntroSequence(dt, player, camera, world, audio, effects, ui) {
  if (!GameState.isIntroPlaying) return;

  GameState.introTimer += dt;
  const t = GameState.introTimer;

  // Tremores orgânicos de câmera
  const shakeLightX = Math.sin(t * 11) * 0.025 + Math.cos(t * 17) * 0.015;
  const shakeLightY = Math.cos(t * 13) * 0.02 + Math.sin(t * 19) * 0.012;
  const shakeHeavyX = (Math.sin(t * 22) + Math.cos(t * 31) * 0.5) * 0.06;
  const shakeHeavyY = (Math.cos(t * 26) + Math.sin(t * 37) * 0.5) * 0.055;

  // 1. Corrida do Jogador (até 9.6s, depois ele para em choque diante da Entidade)
  let runSpeed = t < 9.6 ? 6.4 : 0;
  if (t >= 9.6 && t < 10.0) {
    runSpeed = Math.max(0, 6.4 * (1 - (t - 9.6) / 0.4)); // Frena bruscamente no susto
  }

  player.z += runSpeed * dt;
  if (runSpeed > 0) {
    player.x += Math.sin(t * 1.6) * 0.15 * dt;
  }
  const groundY = world ? world.heightAt(player.x, player.z) : 0;
  player.root.position.set(player.x, groundY, player.z);

  if (runSpeed > 0 && player.animTime !== undefined) {
    player.animTime += dt * 16;
  }

  // 2. Os Bichos de 3 Olhos Vermelhos correm atrás a 5.9 m/s
  for (let i = 0; i < _introWolves.length; i++) {
    const beast = _introWolves[i];
    if (!beast.visible) continue;

    if (t < 9.6) {
      beast.position.z += 5.9 * dt;
    }
    const by = world ? world.heightAt(beast.position.x, beast.position.z) : 0;
    beast.position.y = by;
    beast.lookAt(player.x, groundY + 0.6, player.z);

    if (beast.userData.legs) {
      for (const legInfo of beast.userData.legs) {
        legInfo.mesh.position.z = legInfo.baseZ + Math.sin(t * 18 + legInfo.phase) * 0.16;
      }
    }
  }

  // --------------------------------------------------------------------------
  // ÂNGULO 1 (0.0s a 2.8s): Player correndo de frente, vindo em direção à câmera
  // --------------------------------------------------------------------------
  if (t < 2.8) {
    if (player.model) player.model.rotation.y = 0;
    _camTarget.set(player.x + shakeHeavyX, groundY + 1.45 + shakeHeavyY, player.z + 5.2);
    camera.position.copy(_camTarget);
    camera.lookAt(player.x, groundY + 1.15, player.z);
  }
  // --------------------------------------------------------------------------
  // ÂNGULO 2 (2.8s a 5.2s): Corte seco para lateral (Tracking de Perfil)
  // --------------------------------------------------------------------------
  else if (t < 5.2) {
    if (player.model) player.model.rotation.y = 0;
    _camTarget.set(player.x - 4.6 + shakeHeavyX * 0.6, groundY + 1.25 + shakeHeavyY * 0.7, player.z + 0.5);
    camera.position.copy(_camTarget);
    camera.lookAt(player.x, groundY + 1.1, player.z);
  }
  // --------------------------------------------------------------------------
  // ÂNGULO 3 (5.2s a 7.2s): Corte seco para os 3 olhos vermelhos das feras
  // --------------------------------------------------------------------------
  else if (t < 7.2) {
    if (player.model) player.model.rotation.y = 0;
    const beast = _introWolves[0] || player;
    const bPos = beast.position;
    _camTarget.set(bPos.x + shakeHeavyX * 0.8, bPos.y + 1.18 + shakeHeavyY * 0.8, bPos.z + 1.55);
    camera.position.copy(_camTarget);
    camera.lookAt(bPos.x, bPos.y + 1.05, bPos.z);

    if (t > 5.25 && t < 5.35 && audio?.pain) {
      audio.pain();
    }
  }
  // --------------------------------------------------------------------------
  // ÂNGULO 4 (7.2s a 9.6s): POV correndo junto + Player olhando para trás em pânico
  // --------------------------------------------------------------------------
  else if (t < 9.6) {
    _camTarget.set(player.x + shakeHeavyX * 1.3, groundY + 1.5 + shakeHeavyY * 1.2, player.z + 2.8);
    camera.position.copy(_camTarget);
    camera.lookAt(player.x, groundY + 1.2, player.z);

    if (player.model) {
      player.model.rotation.y = THREE.MathUtils.lerp(player.model.rotation.y, Math.PI * 0.7, 0.12);
    }
  }
  // --------------------------------------------------------------------------
  // ÂNGULO 5 (9.6s a 12.0s): Ele vira para frente: O Corpo Seco de 5 Olhos surge!
  // --------------------------------------------------------------------------
  else if (t < 12.0) {
    // 1. O jogador vira a cabeça para a frente em choque absoluto
    if (player.model) {
      player.model.rotation.y = THREE.MathUtils.lerp(player.model.rotation.y, 0, 0.35);
    }

    // 2. A Entidade é instanciada na frente do jogador (a 5.2 metros em Z)
    if (!_tallFigure.visible) {
      _entitySpawnedZ = player.z + 5.2;
      const ey = world ? world.heightAt(player.x, _entitySpawnedZ) : groundY;
      _tallFigure.position.set(player.x, ey, _entitySpawnedZ);
      _tallFigure.rotation.set(0, Math.PI, 0); // Rosto frontal virado para -Z (encarando o jogador!)
      _tallFigure.visible = true;

      if (effects) {
        effects.play("dust", player.x, ey + 2.5, _entitySpawnedZ, "#05070a", 4.0);
        effects.play("star", player.x, ey + 5.1, _entitySpawnedZ, "#ffea00", 3.2);
      }
    }

    // 3. FASE CLÍMAX: Contra-Plongée ➔ Avanço de Pesadelo
    if (t < 10.6) {
      // Contra-plongée dramático: câmera atrás do ombro do player apontando para cima
      _camTarget.set(player.x + 0.6 + shakeLightX, groundY + 1.3 + shakeLightY, player.z - 1.0);
      camera.position.copy(_camTarget);
      // Foca na cabeça comprida esquelética iluminada pelos 5 olhos amarelos
      camera.lookAt(_tallFigure.position.x, _tallFigure.position.y + 5.08, _tallFigure.position.z);
    } else {
      // Em 10.6s: A figura inclina o torso macabramente para a frente
      _tallFigure.rotation.x = THREE.MathUtils.lerp(_tallFigure.rotation.x, -0.28, 6.0 * dt);

      // Câmera é engolida pela aproximação imediata dos 5 olhos amarelos
      _camTarget.set(
        _tallFigure.position.x + shakeHeavyX * 1.6,
        _tallFigure.position.y + 5.05 + shakeHeavyY * 1.6,
        _tallFigure.position.z - 1.15
      );
      camera.position.lerp(_camTarget, 0.22);
      camera.lookAt(_tallFigure.position.x, _tallFigure.position.y + 5.08, _tallFigure.position.z);

      if (t >= 10.6 && GameState.introPhase < 2) {
        GameState.introPhase = 2;
        if (audio?.supernaturalScare) audio.supernaturalScare();
      }

      if (t >= 11.2 && _fadeOverlay) {
        _fadeOverlay.style.opacity = "1";
      }
    }
  } else {
    endIntroSequence();
  }
}

// ============================================================================
// 7. Encerramento: Despertar na Estrada Principal (Saída 100% Desobstruída)
// ============================================================================
export function endIntroSequence() {
  if (!GameState.isIntroPlaying && GameState.introPhase === 3) return;

  GameState.isIntroPlaying = false;
  GameState.introPhase = 3;

  if (_tallFigure) {
    _tallFigure.visible = false;
    _tallFigure.rotation.set(0, 0, 0);
  }
  for (const beast of _introWolves) {
    beast.visible = false;
  }

  if (_skipPrompt) _skipPrompt.style.opacity = "0";

  if (_introEnv) {
    const { player, world, cameraRig, input, ui, dayNight, scene, music } = _introEnv;

    // RESTAURA MÚSICA NORMAL (libera o override de tense.mp3)
    if (music?.setOverride) {
      music.setOverride(null);
    }

    // SPAWN NA ESTRADA PRINCIPAL DO LADO DE FORA DO PORTÃO (Saída 100% garantida)
    const safeSpawnX = 0;
    const safeSpawnZ = -62;
    const safeGroundY = world ? world.heightAt(safeSpawnX, safeSpawnZ) : 0;

    player.x = safeSpawnX;
    player.z = safeSpawnZ;
    player.root.position.set(safeSpawnX, safeGroundY, safeSpawnZ);
    if (player.model) player.model.rotation.y = 0; // Olhando para o portão da cidade

    // TRANSIÇÃO PARA AMANHECER SUAVE (6h da manhã, névoa limpa)
    if (dayNight) {
      dayNight.progress = 0.25; // 6:00 AM (Amanhecer claro)
    }
    if (scene && scene.fog) {
      scene.fog.density = CONFIG.fogDensity || 0.0165;
      scene.fog.color.set("#aebfae");
      scene.background.set("#aebfae");
    }

    if (cameraRig) {
      cameraRig.frozen = false;
      cameraRig.snap?.(player);
    }

    if (input) {
      input.setModalOpen(false);
    }

    ui?.showToast?.("✦ Despertas na estrada diante dos portões. A névoa da noite se dissipa.");
  }

  // Remove fade preto suavemente
  if (_fadeOverlay) {
    window.setTimeout(() => {
      if (_fadeOverlay) _fadeOverlay.style.opacity = "0";
    }, 250);
  }
}
