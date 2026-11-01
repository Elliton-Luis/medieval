import * as THREE from "three";
import { CONFIG } from "./config.js";

// ============================================================================
// 1. Estado da Cutscene e Vetores de Reuso (Zero-GC)
// ============================================================================
export const GameState = {
  isIntroPlaying: false,
  introPhase: 0, // 0: Fuga na floresta noturna | 1: A Entidade surge | 2: Jump scare & Escuridão | 3: Concluído
  introTimer: 0,
};

const _camTarget = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _tempVec = new THREE.Vector3();

let _introEnv = null;
let _fadeOverlay = null;
let _skipPrompt = null;
let _introWolves = [];
let _tallFigure = null;
let _prevAtmosphere = null;

// ============================================================================
// 2. A Entidade de 6 Olhos (Alta, Fina e Cabeça Alongada)
// ============================================================================
export function createTallFigure() {
  const group = new THREE.Group();
  group.name = "TallFigure_6Eyes";

  const figureMat = new THREE.MeshBasicMaterial({ color: 0x040405 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd200 }); // Amarelo vibrante penetrante na névoa

  // Corpo esguio e alto (4.4m de comprimento, raio 0.22m)
  const bodyGeo = new THREE.CylinderGeometry(0.18, 0.26, 4.4, 8);
  const body = new THREE.Mesh(bodyGeo, figureMat);
  body.position.y = 2.2;
  group.add(body);

  // Braços longos e finos que pendem quase até os pés
  const armGeo = new THREE.CylinderGeometry(0.05, 0.04, 3.4, 6);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, figureMat);
    arm.position.set(side * 0.38, 2.3, 0);
    arm.rotation.z = side * -0.06;
    group.add(arm);
  }

  // Cabeça Fina e Comprida (alongada verticalmente com 1.25m de altura e 0.25m de largura)
  const headGeo = new THREE.BoxGeometry(0.24, 1.25, 0.3);
  const head = new THREE.Mesh(headGeo, figureMat);
  head.position.set(0, 4.85, 0.05);
  group.add(head);

  // 6 Olhos Amarelos Emissivos dispostos em 3 pares ao longo da cabeça comprida
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const eyePositions = [
    // Par superior
    [-0.08, 5.25, 0.22],
    [0.08, 5.25, 0.22],
    // Par do meio
    [-0.09, 4.95, 0.23],
    [0.09, 4.95, 0.23],
    // Par inferior
    [-0.08, 4.65, 0.22],
    [0.08, 4.65, 0.22],
  ];

  eyePositions.forEach((pos) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(pos[0], pos[1], pos[2]);
    group.add(eye);
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
  const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Olho vermelho-sangue

  // Tronco musculoso e arqueado
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.65, 1.55), furMat);
  body.position.y = 0.72;
  group.add(body);

  // Cabeça lupina ameaçadora
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.45, 0.55), furMat);
  head.position.set(0, 1.05, 0.85);
  group.add(head);

  // Focinho com mandíbula
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 5), furMat);
  snout.rotation.x = Math.PI * 0.5;
  snout.position.set(0, 0.94, 1.2);
  group.add(snout);

  // Orelhas pontiagudas
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 4), furMat);
    ear.rotation.z = side * -0.25;
    ear.position.set(side * 0.18, 1.34, 0.75);
    group.add(ear);
  }

  // 3 OLHOS VERMELHOS (Disposição Triangular: dois nas laterais + um superior na testa)
  const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);

  // Olho esquerdo
  const eyeL = new THREE.Mesh(eyeGeo, redEyeMat);
  eyeL.position.set(-0.16, 1.05, 1.1);
  group.add(eyeL);

  // Olho direito
  const eyeR = new THREE.Mesh(eyeGeo, redEyeMat);
  eyeR.position.set(0.16, 1.05, 1.1);
  group.add(eyeR);

  // Terceiro olho: centro superior da testa lupina
  const eyeThird = new THREE.Mesh(eyeGeo, redEyeMat);
  eyeThird.position.set(0.0, 1.22, 1.02);
  group.add(eyeThird);

  // Patas articuladas
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
      "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:9999;transition:opacity 0.8s ease-in-out;";
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
// 5. Inicialização da Cutscene Noturna com Muita Neblina
// ============================================================================
export function startIntroSequence(env) {
  _introEnv = env;
  const { scene, world, player, cameraRig, audio, input, dayNight } = env;

  _ensureUIElements();
  _attachSkipListener();

  if (!_tallFigure) {
    _tallFigure = createTallFigure();
    scene.add(_tallFigure);
  }

  // 3 Bichos de 3 olhos vermelhos em alcateia
  if (_introWolves.length === 0) {
    for (let i = 0; i < 3; i++) {
      const beast = _createThreeEyedBeast();
      scene.add(beast);
      _introWolves.push(beast);
    }
  }

  // Salva estado atmosférico anterior para restaurar com perfeição ao despertar
  _prevAtmosphere = {
    progress: dayNight?.progress ?? 0.25,
    fogDensity: scene.fog ? scene.fog.density : CONFIG.fogDensity,
    fogColor: scene.fog ? scene.fog.color.getHex() : 0xaebfae,
  };

  // FORÇA NOITE PROFUNDA E MUITA NEBLINA DE PESADELO
  if (dayNight) {
    dayNight.progress = 0.88; // Noite fechada
  }
  if (scene.fog) {
    scene.fog.density = 0.048; // Neblina densa
    scene.fog.color.set("#05080e");
  }
  scene.background.set("#05080e");

  // Prepara estado
  GameState.isIntroPlaying = true;
  GameState.introPhase = 0;
  GameState.introTimer = 0;

  if (input) input.setModalOpen(true);
  if (cameraRig) cameraRig.frozen = true;

  // SPAWN BEM LONGE DA CIDADE (Floresta densa a ~270m dos muros)
  const startX = 0;
  const startZ = -270;
  const startY = world.heightAt(startX, startZ);

  player.x = startX;
  player.z = startZ;
  player.root.position.set(startX, startY, startZ);
  if (player.model) player.model.rotation.y = 0; // Correndo em direção a Z+ (sul, rumo à cidade)

  // 3 bichos perseguindo em formação triangular na escuridão
  _introWolves[0].position.set(startX - 3.2, world.heightAt(startX - 3.2, startZ - 9), startZ - 9);
  _introWolves[0].visible = true;

  _introWolves[1].position.set(startX + 3.0, world.heightAt(startX + 3.0, startZ - 13), startZ - 13);
  _introWolves[1].visible = true;

  _introWolves[2].position.set(startX, world.heightAt(startX, startZ - 16), startZ - 16);
  _introWolves[2].visible = true;

  _tallFigure.visible = false;

  if (_skipPrompt) _skipPrompt.style.opacity = "0.9";
  if (_fadeOverlay) _fadeOverlay.style.opacity = "0";

  if (audio?.supernaturalScare) {
    // Leve sussurro espectral no início da fuga
    window.setTimeout(() => audio.pain?.(), 300);
  }
}

// ============================================================================
// 6. Atualização por Frame na Neblina Noturna
// ============================================================================
export function updateIntroSequence(dt, player, camera, world, audio, effects, ui) {
  if (!GameState.isIntroPlaying) return;

  GameState.introTimer += dt;
  const t = GameState.introTimer;

  // 1. Jogador corre desesperadamente na floresta (6.4 m/s) rumo aos portões
  const runSpeed = 6.4;
  player.z += runSpeed * dt;
  player.x += Math.sin(t * 1.8) * 0.2 * dt;
  const groundY = world ? world.heightAt(player.x, player.z) : 0;
  player.root.position.set(player.x, groundY, player.z);
  if (player.model) player.model.rotation.y = 0;

  if (player.animTime !== undefined) {
    player.animTime += dt * 15;
  }

  // 2. Os 3 bichos com 3 olhos vermelhos perseguem a 5.8 m/s
  for (let i = 0; i < _introWolves.length; i++) {
    const beast = _introWolves[i];
    if (!beast.visible) continue;

    beast.position.z += 5.8 * dt;
    const by = world ? world.heightAt(beast.position.x, beast.position.z) : 0;
    beast.position.y = by;
    beast.lookAt(player.x, groundY + 0.6, player.z);

    if (beast.userData.legs) {
      for (const legInfo of beast.userData.legs) {
        legInfo.mesh.position.z = legInfo.baseZ + Math.sin(t * 18 + legInfo.phase) * 0.16;
      }
    }
  }

  // FASE 0: Corrida Desesperada na Neblina Noturna (0 a 6.0s)
  if (GameState.introPhase === 0) {
    // Câmera frontal dramática focando o jogador correndo em direção à tela
    _camTarget.set(player.x, groundY + 1.55, player.z + 5.5);
    camera.position.lerp(_camTarget, 0.14);
    camera.lookAt(player.x, groundY + 1.15, player.z);

    if (t >= 6.0) {
      GameState.introPhase = 1;
      // Surge a Entidade de 6 Olhos alta e esguia na névoa atrás a 18 metros
      const figZ = player.z - 18;
      const figX = player.x + (Math.random() - 0.5) * 1.5;
      const figY = world ? world.heightAt(figX, figZ) : 0;
      _tallFigure.position.set(figX, figY, figZ);
      _tallFigure.visible = true;

      if (effects) {
        effects.play("dust", figX, figY + 2.0, figZ, "#05070a", 3.4);
        effects.play("star", figX, figY + 4.8, figZ, "#ffd200", 2.2);
      }
    }
  }
  // FASE 1: A Entidade Alta Avança Velozmente (6.0 a 8.5s)
  else if (GameState.introPhase === 1) {
    _tallFigure.lookAt(camera.position.x, _tallFigure.position.y, camera.position.z);
    _tallFigure.translateZ(16.5 * dt);

    const ty = world ? world.heightAt(_tallFigure.position.x, _tallFigure.position.z) : 0;
    _tallFigure.position.y = ty;

    // Trepidação perturbadora na câmera
    camera.position.x += (Math.random() - 0.5) * 0.08;
    camera.position.y += (Math.random() - 0.5) * 0.08;

    if (t >= 8.5) {
      GameState.introPhase = 2;

      // Jump scare: a cabeça fina e comprida com os 6 olhos amarelos cola na lente da câmera
      camera.getWorldDirection(_camDir);
      _tallFigure.position.copy(camera.position).addScaledVector(_camDir, 0.9);
      _tallFigure.position.y -= 4.6; // Centraliza a cabeça comprida com os 6 olhos na lente
      _tallFigure.lookAt(camera.position);

      if (audio?.supernaturalScare) audio.supernaturalScare();

      if (_fadeOverlay) {
        _fadeOverlay.style.opacity = "1";
      }
    }
  }
  // FASE 2: Escuridão e Transição para o Amanhecer (8.5 a 10.0s)
  else if (GameState.introPhase === 2) {
    if (t >= 10.0) {
      endIntroSequence();
    }
  }
}

// ============================================================================
// 7. Encerramento: Despertar na Estrada Principal (Saída 100% Desobstruída)
// ============================================================================
export function endIntroSequence() {
  if (!GameState.isIntroPlaying && GameState.introPhase === 3) return;

  GameState.isIntroPlaying = false;
  GameState.introPhase = 3;

  if (_tallFigure) _tallFigure.visible = false;
  for (const beast of _introWolves) {
    beast.visible = false;
  }

  if (_skipPrompt) _skipPrompt.style.opacity = "0";

  if (_introEnv) {
    const { player, world, cameraRig, input, ui, dayNight, scene } = _introEnv;

    // SPAWN NA ESTRADA PRINCIPAL DO LADO DE FORA DO PORTÃO (Saída 100% garantida)
    // O Portão de Caldera fica em z = -48. A estrada externa em z = -62 é ampla e desimpedida.
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
      scene.fog.density = CONFIG.fogDensity || 0.009;
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
