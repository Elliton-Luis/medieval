import * as THREE from "three";

// ============================================================================
// 1. Estado da Cutscene e Vetores de Reuso (Zero-GC)
// ============================================================================
export const GameState = {
  isIntroPlaying: false,
  introPhase: 0, // 0: Corrida desesperada | 1: Figura surge | 2: Jump scare & Fade | 3: Concluído
  introTimer: 0,
};

const _camTarget = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _moveDir = new THREE.Vector3(0, 0, 1);
const _tempVec = new THREE.Vector3();

let _introEnv = null;
let _fadeOverlay = null;
let _skipPrompt = null;
let _introWolves = [];
let _tallFigure = null;

// ============================================================================
// 2. A Entidade de 6 Olhos (Otimização Visual sem PointLights)
// ============================================================================
export function createTallFigure() {
  const group = new THREE.Group();
  group.name = "TallFigure_6Eyes";

  // Corpo esguio (Cilindro preto fosco)
  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.3, 4, 8);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 2; // Figura com 4 metros de altura
  group.add(body);

  // 6 Olhos Amarelos Emissivos (MeshBasicMaterial sem cálculo de sombras/luzes dinâmicas)
  const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

  const eyePositions = [
    [-0.2, 3.6, 0.45],
    [0.2, 3.6, 0.45],
    [-0.25, 3.4, 0.45],
    [0.25, 3.4, 0.45],
    [-0.15, 3.2, 0.45],
    [0.15, 3.2, 0.45],
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
// 3. Modelos Leves de Lobos para a Perseguição
// ============================================================================
function _createWolfMesh() {
  const group = new THREE.Group();
  const furMat = new THREE.MeshLambertMaterial({ color: 0x181412 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });

  // Corpo
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 1.4), furMat);
  body.position.y = 0.65;
  group.add(body);

  // Cabeça e focinho
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.5), furMat);
  head.position.set(0, 0.95, 0.75);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 4), furMat);
  snout.rotation.x = Math.PI * 0.5;
  snout.position.set(0, 0.88, 1.05);
  group.add(snout);

  // Olhos vermelhos brilhantes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), eyeMat);
    eye.position.set(side * 0.16, 0.98, 0.96);
    group.add(eye);
  }

  // Pernas
  group.userData.legs = [];
  const legGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
  const legPositions = [
    [-0.22, 0.3, 0.45],
    [0.22, 0.3, 0.45],
    [-0.22, 0.3, -0.45],
    [0.22, 0.3, -0.45],
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
// 4. Overlays HTML de Fade e Atalho de Pular
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

// Listener para pular cutscene com Espaço ou ESC
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
// 5. Inicialização da Cutscene
// ============================================================================
export function startIntroSequence(env) {
  _introEnv = env;
  const { scene, world, player, cameraRig, audio, input } = env;

  _ensureUIElements();
  _attachSkipListener();

  if (!_tallFigure) {
    _tallFigure = createTallFigure();
    scene.add(_tallFigure);
  }

  if (_introWolves.length === 0) {
    for (let i = 0; i < 2; i++) {
      const wolf = _createWolfMesh();
      scene.add(wolf);
      _introWolves.push(wolf);
    }
  }

  // Prepara o estado
  GameState.isIntroPlaying = true;
  GameState.introPhase = 0;
  GameState.introTimer = 0;

  // Silencia inputs normais do jogador e trava câmera órbita
  if (input) input.setModalOpen(true);
  if (cameraRig) cameraRig.frozen = true;

  // Posição inicial: campo aberto a ~110m do centro da cidade, correndo rumo a Z positivo
  const startX = 0;
  const startZ = -110;
  const startY = world.heightAt(startX, startZ);

  player.x = startX;
  player.z = startZ;
  player.root.position.set(startX, startY, startZ);
  if (player.model) player.model.rotation.y = 0; // Olhando para Z+

  // Posiciona os lobos atrás do jogador
  _introWolves[0].position.set(startX - 2.5, world.heightAt(startX - 2.5, startZ - 8), startZ - 8);
  _introWolves[0].visible = true;
  _introWolves[1].position.set(startX + 2.2, world.heightAt(startX + 2.2, startZ - 12), startZ - 12);
  _introWolves[1].visible = true;

  _tallFigure.visible = false;

  // Mostra aviso de skip
  if (_skipPrompt) _skipPrompt.style.opacity = "0.9";
  if (_fadeOverlay) _fadeOverlay.style.opacity = "0";

  // Passo rápido de uivo distante
  if (audio?.wolfHowl) audio.wolfHowl();
  else if (audio?.pain) audio.pain();
}

// ============================================================================
// 6. Atualização por Frame (Zero-GC, 60 FPS)
// ============================================================================
export function updateIntroSequence(dt, player, camera, world, audio, effects, ui) {
  if (!GameState.isIntroPlaying) return;

  GameState.introTimer += dt;
  const t = GameState.introTimer;

  // 1. Jogador corre automaticamente em direção aos portões (Z+)
  const runSpeed = 6.2;
  player.z += runSpeed * dt;
  player.x += Math.sin(t * 1.5) * 0.15 * dt; // Leve desvio natural de fuga
  const groundY = world ? world.heightAt(player.x, player.z) : 0;
  player.root.position.set(player.x, groundY, player.z);
  if (player.model) player.model.rotation.y = 0;

  // Animação de pernas do jogador
  if (player.animTime !== undefined) {
    player.animTime += dt * 14;
  }

  // 2. Lobos avançam logo atrás (5.6 m/s) com patas animadas
  for (let i = 0; i < _introWolves.length; i++) {
    const wolf = _introWolves[i];
    if (!wolf.visible) continue;

    wolf.position.z += 5.6 * dt;
    const wy = world ? world.heightAt(wolf.position.x, wolf.position.z) : 0;
    wolf.position.y = wy;
    wolf.lookAt(player.x, groundY + 0.6, player.z);

    // Oscilação das patas
    if (wolf.userData.legs) {
      for (const legInfo of wolf.userData.legs) {
        legInfo.mesh.position.z = legInfo.baseZ + Math.sin(t * 16 + legInfo.phase) * 0.14;
      }
    }
  }

  // FASE 0: Corrida Desesperada (0 a 6.0 segundos)
  if (GameState.introPhase === 0) {
    // Câmera à frente do jogador mostrando sua corrida de frente
    _camTarget.set(player.x, groundY + 1.6, player.z + 5.2);
    camera.position.lerp(_camTarget, 0.12);
    camera.lookAt(player.x, groundY + 1.2, player.z);

    if (t >= 6.0) {
      GameState.introPhase = 1;
      // Surge a Entidade de 6 Olhos atrás a 16 metros
      const figZ = player.z - 16;
      const figX = player.x + (Math.random() - 0.5) * 2;
      const figY = world ? world.heightAt(figX, figZ) : 0;
      _tallFigure.position.set(figX, figY, figZ);
      _tallFigure.visible = true;

      if (effects) {
        effects.play("dust", figX, figY + 1.5, figZ, "#0a0a0c", 3.0);
        effects.play("star", figX, figY + 3.2, figZ, "#ffaa00", 1.8);
      }
    }
  }
  // FASE 1: A Entidade Avança em Alta Velocidade (6.0 a 8.5 segundos)
  else if (GameState.introPhase === 1) {
    // A figura desliza muito rápido rumo à câmera (15 m/s)
    _tallFigure.lookAt(camera.position.x, _tallFigure.position.y, camera.position.z);
    _tallFigure.translateZ(15.0 * dt);

    // Ajusta altura no terreno
    const ty = world ? world.heightAt(_tallFigure.position.x, _tallFigure.position.z) : 0;
    _tallFigure.position.y = ty;

    // Trepidação na câmera conforme a figura se aproxima
    camera.position.x += (Math.random() - 0.5) * 0.05;
    camera.position.y += (Math.random() - 0.5) * 0.05;

    if (t >= 8.5) {
      GameState.introPhase = 2;

      // Jump scare suave: o rosto com os 6 olhos gruda na frente da câmera
      camera.getWorldDirection(_camDir);
      _tallFigure.position.copy(camera.position).addScaledVector(_camDir, 0.95);
      _tallFigure.position.y -= 3.2; // Alinha os olhos na altura do foco da lente
      _tallFigure.lookAt(camera.position);

      // Efeito sonoro sobrenatural
      if (audio?.supernaturalScare) audio.supernaturalScare();

      // Inicia fade para preto
      if (_fadeOverlay) {
        _fadeOverlay.style.opacity = "1";
      }
    }
  }
  // FASE 2: Escuridão e Transição para a Cidade (8.5 a 10.0 segundos)
  else if (GameState.introPhase === 2) {
    if (t >= 10.0) {
      endIntroSequence();
    }
  }
}

// ============================================================================
// 7. Encerramento da Introdução (Safe Spawn na Igreja)
// ============================================================================
export function endIntroSequence() {
  if (!GameState.isIntroPlaying && GameState.introPhase === 3) return;

  GameState.isIntroPlaying = false;
  GameState.introPhase = 3;

  if (_tallFigure) _tallFigure.visible = false;
  for (const wolf of _introWolves) {
    wolf.visible = false;
  }

  if (_skipPrompt) _skipPrompt.style.opacity = "0";

  // Reposiciona o jogador na igreja ou praça segura
  if (_introEnv) {
    const { player, settlement, world, cameraRig, input, ui } = _introEnv;

    let targetX = 0;
    let targetZ = 0;

    if (settlement?.churches && settlement.churches.length > 0) {
      const church = settlement.churches[0];
      targetX = church.x + 3;
      targetZ = church.z + 5;
    } else if (settlement?.cityData?.center) {
      targetX = settlement.cityData.center.x;
      targetZ = settlement.cityData.center.z;
    }

    const groundY = world ? world.heightAt(targetX, targetZ) : 0;
    player.x = targetX;
    player.z = targetZ;
    player.root.position.set(targetX, groundY, targetZ);

    if (cameraRig) {
      cameraRig.frozen = false;
      cameraRig.snap?.(player);
    }

    if (input) {
      input.setModalOpen(false);
    }

    ui?.showToast?.("✦ O pesadelo findou. Despertas diante da igreja.");
  }

  // Remove suavemente a tela preta
  if (_fadeOverlay) {
    window.setTimeout(() => {
      if (_fadeOverlay) _fadeOverlay.style.opacity = "0";
    }, 200);
  }
}
