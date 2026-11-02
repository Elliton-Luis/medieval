import * as THREE from "three";
import { buildCultistMesh, CultState, CULT_ALTARS } from "./cult.js";
import { spawnWaypointMarker } from "./rpg.js";
import { showVictoryEndingModal } from "./gameEndingScreen.js";

// ============================================================================
// 1. Estado Global do Fim dos Tempos (WorldDecay)
// ============================================================================
export const WorldDecay = {
  daysPassed: 0,
  decayLevel: 0.0, // 0.0 (Normal) a 1.0 (Apocalipse)
  isEclipse: false,
  eclipseDayRemaining: 0,
  lightningTimer: 14.0, // Tempo até o próximo raio apocalíptico
  pendingLightning: null, // Ponto de aviso prévio de faíscas (1s antes)
};

const _normalSkyDay = new THREE.Color("#cad4e0");
const _normalSkyNight = new THREE.Color("#0c121e");
const _decaySkyDay = new THREE.Color("#484852");
const _decaySkyNight = new THREE.Color("#06060a");

const _eclipseSkyDay = new THREE.Color("#551216");
const _eclipseSkyNight = new THREE.Color("#280608");
const _eclipseFogColor = new THREE.Color("#4a0e12");
const _eclipseSunColor = new THREE.Color("#cc2a1a");

const _tempVec = new THREE.Vector3();
const _spawnVec = new THREE.Vector3();
const _dummyMatrix = new THREE.Matrix4();
const _zeroScale = new THREE.Vector3(0, 0, 0);
const _tempSkyDay = new THREE.Color();
const _tempSkyNight = new THREE.Color();
const _sunDecayColor = new THREE.Color("#c8c0b4");

// ============================================================================
// 2. Atmosfera Dinâmica, Eclipse e Neblina Corrompida (Zero-GC no loop)
// ============================================================================
export function updateAtmosphereDecay(dayNight, scene, renderer) {
  if (!dayNight || !scene) return;

  const isEclipse = WorldDecay.isEclipse;
  const decay = WorldDecay.decayLevel;
  const daylight = dayNight.daylight ?? 1.0;
  const isNight = dayNight.isNight;

  if (isEclipse) {
    // Atmosfera do Eclipse do Demiurgo (Céu e névoa vermelho-sangue)
    const eclipseBg = isNight ? _eclipseSkyNight : _eclipseSkyDay;
    scene.background.copy(eclipseBg);
    if (scene.fog) {
      scene.fog.color.copy(_eclipseFogColor);
      scene.fog.density = 0.018 + decay * 0.012;
    }
    if (dayNight.sun) {
      dayNight.sun.color.copy(_eclipseSunColor);
      dayNight.sun.intensity = Math.max(0.2, daylight * 0.95);
    }
    if (renderer) renderer.setClearColor(_eclipseFogColor);
  } else if (decay > 0.01) {
    // Decadência progressiva ao longo dos dias (0.0 a 1.0) - Zero-GC
    _tempSkyDay.copy(_normalSkyDay).lerp(_decaySkyDay, decay);
    _tempSkyNight.copy(_normalSkyNight).lerp(_decaySkyNight, decay);
    const currentSky = daylight > 0.5 ? _tempSkyDay : _tempSkyNight;

    if (scene.fog) {
      scene.fog.density = 0.008 + decay * 0.016;
    }
    if (dayNight.sun && decay > 0.3) {
      dayNight.sun.color.lerp(_sunDecayColor, decay * 0.5);
    }
  }
}

// ============================================================================
// 3. Virada de Dia: Cálculos Pesados de Degradação (Apenas 1x a cada 24h)
// ============================================================================
export function triggerDailyDecayCycle(world, npcs, horses, ui, scene, effects) {
  WorldDecay.daysPassed++;
  // O mundo atinge o nível máximo de corrupção em ~20 dias
  WorldDecay.decayLevel = Math.min(1.0, WorldDecay.daysPassed * 0.05);

  // Aumenta 5% de chance do Fim dos Tempos a cada dia passado
  const currentApocalypseChance = CultState?.addApocalypseProgress?.(5) || 0;

  // Gerenciamento da duração do Eclipse e sorteio do Apocalipse
  if (WorldDecay.isEclipse) {
    WorldDecay.eclipseDayRemaining--;
    if (WorldDecay.eclipseDayRemaining <= 0) {
      WorldDecay.isEclipse = false;
      ui?.showToast?.("✦ O sangue arrefece no horizonte. O Eclipse cessou por ora.");
    }
  } else {
    // Sorteio do Apocalipse do Demiurgo conforme a probabilidade acumulada
    const rollApocalypse = Math.random() * 100 < currentApocalypseChance;
    if (rollApocalypse && window.__game) {
      triggerDemiurgeCataclysm(window.__game);
    } else {
      // O Eclipse só pode surgir a partir do Dia 5 E com corrupção avançada (>= 25%), nunca precocemente no Dia 2
      const canEclipse = WorldDecay.daysPassed >= 5 && (currentApocalypseChance >= 25 || WorldDecay.daysPassed >= 16);
      const rollEclipse = canEclipse && (Math.random() * 100 < (currentApocalypseChance * 0.6) || WorldDecay.daysPassed >= 18);
      if (rollEclipse) {
        WorldDecay.isEclipse = true;
        WorldDecay.eclipseDayRemaining = 1; // 1 ciclo completo
        ui?.showToast?.("🌑 O Olho do Demiurgo se abre! O Sol sangra no firmamento!");
        if (effects && world) {
          effects.play("star", 0, 10, 0, "#ff2211", 3.0);
        }
      }
    }
  }

  // Degradação silenciosa de flora e fauna (Zero-GC)
  applyFloraAndFaunaDecay(world, npcs, horses);
}

function applyFloraAndFaunaDecay(world, npcs, horses) {
  const decay = WorldDecay.decayLevel;
  if (decay <= 0.02) return;

  // Cavalos selvagens distantes: pequena chance de sucumbir nas sombras
  if (horses && Array.isArray(horses.horses)) {
    const horseKillChance = decay * 0.06;
    for (let i = 0; i < horses.horses.length; i++) {
      const h = horses.horses[i];
      if (h && !h.removed && !h.isMissionHorse && !h.controlled && Math.random() < horseKillChance) {
        h.removed = true;
        if (h.root) h.root.visible = false;
      }
    }
  }

  // Árvores dos chunks carregados: uma fração tem o topo escalado para 0 (clareiras secas)
  if (world && Array.isArray(world.environmentInstancedMeshes)) {
    const treeKillChance = decay * 0.08;
    for (let m = 0; m < world.environmentInstancedMeshes.length; m++) {
      const mesh = world.environmentInstancedMeshes[m];
      if (mesh.name === "Trees" && mesh.count > 0) {
        const step = Math.max(1, Math.floor(1 / treeKillChance));
        for (let i = 0; i < mesh.count; i += step) {
          if (Math.random() < 0.35) {
            mesh.getMatrixAt(i, _dummyMatrix);
            _dummyMatrix.scale(_zeroScale);
            mesh.setMatrixAt(i, _dummyMatrix);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}

// ============================================================================
// 4. Raios Apocalípticos no Eclipse com Aviso Prévio (Opção 2A)
// ============================================================================
export function updateEclipseLightning(playerPos, dt, effects, audio, damageFx, combat, npcs, player) {
  if (!WorldDecay.isEclipse || !playerPos) return;

  WorldDecay.lightningTimer -= dt;

  // Fase 1: Aviso prévio de faíscas no solo 1 segundo antes do raio
  if (WorldDecay.lightningTimer <= 1.0 && !WorldDecay.pendingLightning) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 18; // Perto o suficiente para ver/ouvir
    const lx = (playerPos.x ?? 0) + Math.cos(angle) * dist;
    const lz = (playerPos.z ?? 0) + Math.sin(angle) * dist;
    const ly = playerPos.y ?? 0;

    WorldDecay.pendingLightning = { x: lx, y: ly, z: lz };
    if (effects) {
      effects.play("star", lx, ly + 0.2, lz, "#ff4433", 1.2);
      effects.play("dust", lx, ly + 0.1, lz, "#882211", 0.8);
    }
  }

  // Fase 2: O Impacto Fulminante do Raio
  if (WorldDecay.lightningTimer <= 0) {
    WorldDecay.lightningTimer = 12 + Math.random() * 14; // Próximo raio em 12-26s

    const strike = WorldDecay.pendingLightning;
    WorldDecay.pendingLightning = null;
    if (!strike) return;

    // Clarão e estrondo na tela
    if (damageFx) damageFx.flash(0.75);
    if (audio?.explosion) audio.explosion(strike.x, strike.z, 2.5);

    if (effects) {
      effects.play("dust", strike.x, strike.y + 0.6, strike.z, "#331111", 3.2);
      effects.play("star", strike.x, strike.y + 1.2, strike.z, "#ff2200", 2.6);
    }

    // Dano em área de 3.5m (o jogador pode esquivar rolando com ALT)
    const px = playerPos.x ?? player?.x ?? 0;
    const pz = playerPos.z ?? player?.z ?? 0;
    const pDistSq = (strike.x - px) ** 2 + (strike.z - pz) ** 2;

    if (pDistSq < 12.25 && player && !player.rolling) {
      combat?.hurtPlayer?.(2, strike.x, strike.z, { weapon: "lightning", knock: 5.0 });
    }

    // Atinge NPCs próximos no raio
    if (npcs && Array.isArray(npcs.npcs)) {
      for (let i = 0; i < npcs.npcs.length; i++) {
        const npc = npcs.npcs[i];
        if (npc && npc.alive) {
          const ndx = strike.x - npc.x;
          const ndz = strike.z - npc.z;
          if (ndx * ndx + ndz * ndz < 16) {
            combat?.damageNPC?.(npc, 4, ndx, ndz, "#ff3322", 1.8, 3.5);
          }
        }
      }
    }
  }
}

// ============================================================================
// 5. O Mensageiro de Cinzas: Karma Cátaro (Opção 3A)
// ============================================================================
let _messengerNPC = null;
let _demiurgeModalEl = null;

const DEMIURGE_MODAL_CSS = `
#demiurge-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 4, 12, 0.88);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s ease;
  font-family: "Cinzel", "Cinzel Decorative", Georgia, serif;
}
#demiurge-modal-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.demiurge-parchment {
  background: linear-gradient(175deg, #1c1322 0%, #0d0a14 100%);
  border: 2px solid #8e2a36;
  border-radius: 6px;
  box-shadow: 0 0 35px rgba(180, 20, 40, 0.45), inset 0 0 25px rgba(0, 0, 0, 0.85);
  padding: 30px 36px;
  max-width: 640px;
  width: 90%;
  color: #e6dbcb;
  position: relative;
  animation: demiurge-fade-in 0.35s ease-out;
}
@keyframes demiurge-fade-in {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1.0); opacity: 1; }
}
.demiurge-seal {
  font-size: 34px;
  text-align: center;
  color: #ff3344;
  text-shadow: 0 0 14px rgba(255, 50, 70, 0.7);
  margin-bottom: 6px;
}
.demiurge-header {
  text-align: center;
  border-bottom: 1px solid rgba(142, 42, 54, 0.5);
  padding-bottom: 12px;
  margin-bottom: 18px;
}
.demiurge-title {
  margin: 0;
  font-size: 20px;
  letter-spacing: 3px;
  color: #ff4d5a;
  text-shadow: 0 2px 4px rgba(0,0,0,0.9);
}
.demiurge-subtitle {
  display: block;
  font-size: 13px;
  letter-spacing: 1.5px;
  color: #9e9188;
  margin-top: 4px;
}
.demiurge-close-btn {
  position: absolute;
  top: 14px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: rgba(142, 42, 54, 0.15);
  border: 1px solid #8e2a36;
  color: #ff7777;
  font-size: 18px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.demiurge-close-btn:hover {
  background: #8e2a36;
  color: #fff;
  box-shadow: 0 0 10px rgba(255, 50, 70, 0.8);
}
.demiurge-body {
  font-size: 16.5px;
  line-height: 1.75;
  color: #d6c9b8;
  font-style: italic;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  margin-bottom: 24px;
  background: rgba(0, 0, 0, 0.25);
  padding: 16px;
  border-radius: 4px;
  border-left: 3px solid #8e2a36;
}
.demiurge-footer {
  display: flex;
  justify-content: center;
}
.demiurge-confirm-btn {
  background: linear-gradient(180deg, #361017 0%, #20070b 100%);
  border: 1px solid #a82e42;
  color: #ffc4c4;
  padding: 10px 24px;
  font-size: 13.5px;
  font-weight: bold;
  letter-spacing: 2px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  box-shadow: 0 0 12px rgba(168, 46, 66, 0.3);
}
.demiurge-confirm-btn:hover {
  background: #50131e;
  border-color: #ff4d64;
  color: #fff;
  box-shadow: 0 0 18px rgba(255, 77, 100, 0.6);
}
`;

let _decayInput = null;

export const DemiurgeModalState = {
  isOpen: false,
};

function _injectDemiurgeStyles() {
  if (document.getElementById("demiurge-modal-styles")) return;
  const style = document.createElement("style");
  style.id = "demiurge-modal-styles";
  style.textContent = DEMIURGE_MODAL_CSS;
  document.head.appendChild(style);
}

export function showDemiurgeModal(message, level = 1, onDismiss, input = null, customTitle = null, customSubtitle = null) {
  _injectDemiurgeStyles();

  DemiurgeModalState.isOpen = true;
  const activeInput = input || _decayInput;
  if (activeInput?.setModalOpen) {
    activeInput.setModalOpen(true);
  }

  if (document.pointerLockElement) {
    try {
      document.exitPointerLock();
    } catch (_) {}
  }

  if (!_demiurgeModalEl) {
    _demiurgeModalEl = document.createElement("div");
    _demiurgeModalEl.id = "demiurge-modal-overlay";
    document.body.appendChild(_demiurgeModalEl);
  }

  const titleText = customTitle || "SUSSURRO DO DEMIURGO";
  const subText = customSubtitle || `Mensageiro das Cinzas · Seita Cátara (Nível ${level})`;

  _demiurgeModalEl.innerHTML = `
    <div class="demiurge-parchment" role="dialog" aria-modal="true">
      <button class="demiurge-close-btn" id="demiurge-btn-close" aria-label="Fechar mensagem">✕</button>
      <div class="demiurge-seal">👁️</div>
      <div class="demiurge-header">
        <h2 class="demiurge-title">${titleText}</h2>
        <span class="demiurge-subtitle">${subText}</span>
      </div>
      <div class="demiurge-body">${message}</div>
      <div class="demiurge-footer">
        <button class="demiurge-confirm-btn" id="demiurge-btn-confirm">GUARDAR ESCRITURA [ESC]</button>
      </div>
    </div>
  `;

  _demiurgeModalEl.classList.add("active");

  const close = () => {
    if (!_demiurgeModalEl.classList.contains("active")) return;
    _demiurgeModalEl.classList.remove("active");
    window.removeEventListener("keydown", onKeyDown);
    DemiurgeModalState.isOpen = false;
    if (activeInput?.setModalOpen) {
      activeInput.setModalOpen(false);
    }
    try {
      const canvas = activeInput?.canvas || window.__purisCanvas || document.querySelector("canvas");
      canvas?.requestPointerLock?.();
    } catch (_) {}
    if (typeof onDismiss === "function") {
      onDismiss();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape" || e.code === "Escape" || e.key === "Enter" || e.code === "Space") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  window.addEventListener("keydown", onKeyDown);

  const btnClose = _demiurgeModalEl.querySelector("#demiurge-btn-close");
  const btnConfirm = _demiurgeModalEl.querySelector("#demiurge-btn-confirm");
  btnClose?.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  btnConfirm?.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  _demiurgeModalEl.addEventListener("click", (e) => {
    if (e.target === _demiurgeModalEl) close();
  });
}

// ============================================================================
// Modelo Anatômico Exclusivo do Mensageiro do Demiurgo
// Capa roxa com preto e vermelho, partículas de brasas e olhos brancos ameaçadores
// ============================================================================
export function buildDemiurgeMessengerMesh() {
  const root = new THREE.Group();
  root.name = "DemiurgeMessengerRoot";

  const model = new THREE.Group();
  model.name = "DemiurgeMessengerModel";
  root.add(model);

  // Materiais Sombrios Nobres (Estilo Baile Oculto de Eyes Wide Shut)
  const matObsidianVelvet = new THREE.MeshStandardMaterial({
    color: 0x07050a,
    roughness: 0.88,
    metalness: 0.12,
    flatShading: true,
  });
  const matImperialPurple = new THREE.MeshStandardMaterial({
    color: 0x240838,
    roughness: 0.72,
    metalness: 0.2,
    flatShading: true,
  });
  const matCardinalCrimson = new THREE.MeshStandardMaterial({
    color: 0x6e0d19,
    roughness: 0.65,
    metalness: 0.22,
    flatShading: true,
  });
  const matVenetianPorcelain = new THREE.MeshStandardMaterial({
    color: 0xf2ece4,
    roughness: 0.28,
    metalness: 0.15,
    flatShading: true,
  });
  const matAntiqueGold = new THREE.MeshStandardMaterial({
    color: 0xc8982a,
    emissive: 0x664408,
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.82,
    flatShading: true,
  });
  const matVoidBlack = new THREE.MeshBasicMaterial({
    color: 0x000000,
  });
  const matWhiteEyeDot = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  const matEbonyWood = new THREE.MeshStandardMaterial({
    color: 0x110e14,
    roughness: 0.6,
    metalness: 0.3,
  });

  // 1. Túnica Sacerdotal Longa de Corte Reto (Sem cantos redondos, estrutura sólida e imponente de 2.25m)
  const robeCore = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.46, 1.72, 8), matObsidianVelvet);
  robeCore.position.set(0, 0.86, 0);
  robeCore.castShadow = true;
  model.add(robeCore);

  // Estola Sacrificial Central de Seda Carmesim com Franjas Douradas
  const stola = new THREE.Mesh(new THREE.BoxGeometry(0.19, 1.48, 0.035), matCardinalCrimson);
  stola.position.set(0, 0.76, 0.24);
  stola.rotation.x = -0.05;
  model.add(stola);

  const stolaGoldTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.48, 0.038), matAntiqueGold);
  stolaGoldTrimL.position.set(-0.086, 0.76, 0.241);
  stolaGoldTrimL.rotation.x = -0.05;
  model.add(stolaGoldTrimL);

  const stolaGoldTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.48, 0.038), matAntiqueGold);
  stolaGoldTrimR.position.set(0.086, 0.76, 0.241);
  stolaGoldTrimR.rotation.x = -0.05;
  model.add(stolaGoldTrimR);

  // 2. Sobrecapa Cerimonial Pesada e Estruturada (Ombros angulares de alfaiataria nobre)
  const capeBack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.42, 0.05), matImperialPurple);
  capeBack.position.set(0, 1.05, -0.22);
  capeBack.rotation.x = -0.06;
  model.add(capeBack);

  const capeLining = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.38, 0.02), matCardinalCrimson);
  capeLining.position.set(0, 1.05, -0.19);
  capeLining.rotation.x = -0.06;
  model.add(capeLining);

  // Ombreiras estruturadas e rígidas (ombros retos e ameaçadores de cerimônia oculta)
  for (const side of [-1, 1]) {
    const shoulderMantle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.36), matImperialPurple);
    shoulderMantle.position.set(side * 0.34, 1.62, 0);
    shoulderMantle.rotation.z = -side * 0.12;
    model.add(shoulderMantle);

    const shoulderGold = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.13, 0.365), matAntiqueGold);
    shoulderGold.position.set(side * 0.44, 1.62, 0);
    shoulderGold.rotation.z = -side * 0.12;
    model.add(shoulderGold);
  }

  // Gola Alta Cerimonial Rígida (Colarinho fechado em volta do pescoço)
  const collarBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.04), matImperialPurple);
  collarBack.position.set(0, 1.82, -0.15);
  collarBack.rotation.x = 0.15;
  model.add(collarBack);

  for (const side of [-1, 1]) {
    const collarSide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.24), matImperialPurple);
    collarSide.position.set(side * 0.22, 1.82, -0.04);
    collarSide.rotation.z = -side * 0.12;
    model.add(collarSide);
  }

  // 3. Cabeça e Capuz Gótico Geométrico (Sem esferas redondas)
  const hoodRoof = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), matImperialPurple);
  hoodRoof.position.set(0, 2.05, 0.02);
  model.add(hoodRoof);

  const hoodPeak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 4), matImperialPurple);
  hoodPeak.position.set(0, 2.16, -0.06);
  hoodPeak.rotation.x = -0.35;
  model.add(hoodPeak);

  for (const side of [-1, 1]) {
    const hoodSide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.32), matImperialPurple);
    hoodSide.position.set(side * 0.17, 1.86, 0.02);
    model.add(hoodSide);
  }

  // 4. Máscara Cerimonial Veneziana de Porcelana e Ouro (Inspirada no Baile de Eyes Wide Shut)
  const maskGroup = new THREE.Group();
  maskGroup.position.set(0, 1.78, 0.12);

  // Placa facial frontal angulada com queixo reto e maçãs do rosto marcadas
  const maskFace = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.06), matVenetianPorcelain);
  maskGroup.add(maskFace);

  // Queixo afiado e geométrico estilo Bauta veneziana
  const maskChin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 4), matVenetianPorcelain);
  maskChin.position.set(0, -0.16, 0.04);
  maskChin.rotation.x = Math.PI * 0.95;
  maskGroup.add(maskChin);

  // Filigrana e detalhes rúnicos dourados na máscara
  const foreheadGold = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.04, 0.065), matAntiqueGold);
  foreheadGold.position.set(0, 0.11, 0.002);
  maskGroup.add(foreheadGold);

  const noseRidge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.08), matAntiqueGold);
  noseRidge.position.set(0, 0.01, 0.03);
  maskGroup.add(noseRidge);

  // Órbitas oculares chanfradas e profundas com olhar pontual branco penetrante
  for (const sx of [-0.065, 0.065]) {
    const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.028, 0.04), matVoidBlack);
    eyeSocket.position.set(sx, 0.04, 0.038);
    maskGroup.add(eyeSocket);

    const eyeGlint = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.02), matWhiteEyeDot);
    eyeGlint.position.set(sx, 0.04, 0.054);
    maskGroup.add(eyeGlint);
  }

  model.add(maskGroup);

  // 5. Braços com Mangas Nobres e Conexão Anatômica Perfeita
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 0.16), matObsidianVelvet);
  armL.position.set(-0.35, 1.34, 0.08);
  armL.rotation.x = 0.28;
  armL.rotation.z = 0.18;
  model.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 0.16), matObsidianVelvet);
  armR.position.set(0.35, 1.34, 0.12);
  armR.rotation.x = 0.62; // Braço direito estendido de forma austera e inquisitorial
  armR.rotation.z = -0.16;
  model.add(armR);

  // Mãos enluvadas em couro negro sem partes soltas
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), matObsidianVelvet);
  handR.position.set(0.38, 1.02, 0.40);
  handR.rotation.x = Math.PI * 0.38;
  model.add(handR);

  const handRSignet = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), matAntiqueGold);
  handRSignet.position.set(0.38, 1.05, 0.44);
  model.add(handRSignet);

  // 6. Cetro Ocular do Demiurgo (Firmemente empunhado pela mão esquerda — sem esferas flutuando no ar)
  const scepterGroup = new THREE.Group();
  scepterGroup.position.set(-0.38, 0.98, 0.25);
  scepterGroup.rotation.x = 0.18;

  // Haste de ébano maciço com anéis de ouro
  const scepterStaff = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.65, 6), matEbonyWood);
  scepterStaff.position.set(0, 0, 0);
  scepterGroup.add(scepterStaff);

  const goldCollar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 6), matAntiqueGold);
  goldCollar1.position.set(0, 0.62, 0);
  scepterGroup.add(goldCollar1);

  // Topo do Cetro: Brasão Ocular de Ouro Esculpido
  const eyeEmblem = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.04), matAntiqueGold);
  eyeEmblem.position.set(0, 0.82, 0);
  scepterGroup.add(eyeEmblem);

  const eyeSealIris = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.045), matCardinalCrimson);
  eyeSealIris.position.set(0, 0.82, 0.005);
  scepterGroup.add(eyeSealIris);

  const eyeSealPupil = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.05), matVoidBlack);
  eyeSealPupil.position.set(0, 0.82, 0.008);
  scepterGroup.add(eyeSealPupil);

  const scepterLight = new THREE.PointLight(0x9911bb, 2.2, 8.0, 1.8);
  scepterLight.position.set(0, 0.85, 0.05);
  scepterGroup.add(scepterLight);

  model.add(scepterGroup);

  // 7. Enxame de Brasas e Cinzas Ocultas (Roxas e Carmesins ao redor da túnica)
  const pCount = 32;
  const pPositions = new Float32Array(pCount * 3);
  const pColors = new Float32Array(pCount * 3);
  const pSpeeds = new Float32Array(pCount);
  const pAngles = new Float32Array(pCount);
  const pRadii = new Float32Array(pCount);

  const colPurple = new THREE.Color(0xa822ee);
  const colCrimson = new THREE.Color(0xff2244);
  const colDark = new THREE.Color(0x220533);

  for (let i = 0; i < pCount; i++) {
    pAngles[i] = Math.random() * Math.PI * 2;
    pRadii[i] = 0.35 + Math.random() * 0.55;
    pSpeeds[i] = 1.2 + Math.random() * 1.6;
    const y = 0.1 + Math.random() * 1.9;
    pPositions[i * 3] = Math.cos(pAngles[i]) * pRadii[i];
    pPositions[i * 3 + 1] = y;
    pPositions[i * 3 + 2] = Math.sin(pAngles[i]) * pRadii[i];

    const pick = Math.random();
    const c = pick < 0.45 ? colPurple : pick < 0.8 ? colCrimson : colDark;
    pColors[i * 3] = c.r;
    pColors[i * 3 + 1] = c.g;
    pColors[i * 3 + 2] = c.b;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pColors, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.09,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.name = "DemiurgeParticles";
  model.add(particles);

  root.visible = false;
  return {
    root,
    model,
    robe: robeCore,
    cape: capeBack,
    armL,
    armR,
    orb: eyeEmblem,
    sealLight: scepterLight,
    scepterLight,
    eyeGlow: scepterLight,
    particles,
    pPositions,
    pAngles,
    pRadii,
    pSpeeds,
    pCount,
  };
}

function _ensureMessenger(scene) {
  const activeScene = scene || window.__game?.scene;
  if (!activeScene) return _messengerNPC;
  if (_messengerNPC) {
    if (_messengerNPC.root.parent !== activeScene) {
      activeScene.add(_messengerNPC.root);
    }
    return _messengerNPC;
  }

  const meshData = buildDemiurgeMessengerMesh();
  const { root, model } = meshData;
  root.name = "CultistMessenger";
  root.visible = false;
  activeScene.add(root);

  _messengerNPC = {
    ...meshData,
    root,
    model,
    x: 0,
    z: 0,
    visible: false,
    state: "IDLE",
    isEvilMessage: false,
    timer: 0,
    floatPhase: 0,
    lastDustTime: 0,
  };
  return _messengerNPC;
}

/**
 * Disparado ao cometer um crime hediondo ou ato virtuoso.
 */
export function triggerCultistMessenger(player, scene, world, isEvilAction = true, force = false) {
  const activePlayer = player || window.__game?.player;
  const activeScene = scene || window.__game?.scene;
  const activeWorld = world || window.__game?.world;

  if (!activePlayer || !activeScene) return;
  const messenger = _ensureMessenger(activeScene);
  if (!messenger || messenger.visible) return; // Não sobrepõe mensageiros

  const now = performance.now();
  // Só pode aparecer em intervalos raros (mínimo 180s), a menos que forçado por marco de 15% ou cheat
  if (!force && messenger.lastSpawnTime && now - messenger.lastSpawnTime < 180000) {
    return;
  }
  messenger.lastSpawnTime = now;

  const px = activePlayer.x ?? activePlayer.root?.position?.x ?? 0;
  const py = activePlayer.root?.position?.y ?? 0;
  const pz = activePlayer.z ?? activePlayer.root?.position?.z ?? 0;
  const rotY = activePlayer.model?.rotation?.y ?? 0;

  // Spawna a ~11 metros à frente do jogador no seu campo visual
  const spawnAngle = rotY + (Math.random() < 0.5 ? 0.35 : -0.35);
  _spawnVec.set(Math.sin(spawnAngle) * 11, 0, Math.cos(spawnAngle) * 11);
  const mx = px + _spawnVec.x;
  const mz = pz + _spawnVec.z;
  const my = activeWorld ? activeWorld.heightAt(mx, mz) : py;

  messenger.x = mx;
  messenger.z = mz;
  messenger.root.position.set(mx, my + 0.22, mz);
  messenger.root.visible = true;
  messenger.visible = true;
  messenger.state = "APPROACH_PLAYER";
  messenger.isEvilMessage = isEvilAction;
  messenger.timer = performance.now() + 25000; // 25 segundos de timeout
  messenger.lastDustTime = 0;
}

export const CULT_MESSAGES = {
  EVIL_TIER_1: [
    "«Sinto o estalar da carne impura se partindo! O Demiurgo contempla teus atos com deleite. Não temas a culpa, mortal... tu apenas arrancaste a casca podre daquela alma. Caminhe até as matas ao norte, além dos muros... nosso Altar sussurra teu nome.»",
    "«A matéria é a verdadeira prisão deste mundo, e tua lâmina começou a libertá-la! Nossos irmãos nas sombras já celebram tua crueldade. Busque nosso círculo ritual nos ermos do norte.»",
  ],
  EVIL_TIER_2: [
    "«Magnífico! O cárcere de carne deste vilarejo está ruindo sob teus golpes! Nossos irmãos sentem o pulsar do sangue no solo. O Santuário das Cinzas nos ermos do norte te aguarda; siga o feixe rubro em tua bússola. A Grande Noite se aproxima!»",
    "«Mais uma casca vazia tombou! Nossa seita ganha força a cada gota de sangue. Nossos servos já deslizam velozes pela floresta. Venha ao Santuário ao norte... há oferendas à tua espera!»",
  ],
  EVIL_TIER_3: [
    "«Bendito sejas, Flagelo da Criação! Cada vida ceifada enfraquece o véu da mentira e alimenta o Olho que tudo vê. As tochas do nosso círculo ardem em chamas carmesins em tua honra! Nossos sacerdotes agora caçam com fúria sobrenatural pela floresta!»",
    "«O próprio ar treme com tua sede de sangue! A seita agora é uma tempestade nos ermos. O Demiurgo te observa do firmamento escuro. O Santuário ao norte já se prepara para coroar o teu rastro de morte!»",
  ],
  EVIL_TIER_4: [
    "«Tu és o Avatar da Aniquilação! As muralhas da cidade não passarão de cinzas ao vento! O Demiurgo rasgou o céu e nossa irmandade curva-se à tua lâmina. O Santuário Eterno ao norte é teu trono nos ermos... queime este reino até não sobrar vida!»",
    "«O Sol já sangra no horizonte! O poder do culto atingiu o ápice graças às tuas mãos! Vá ao Santuário nas profundezas da mata do norte e reivindique a glória do caos supremo!»",
  ],
  GOOD: [
    "«Independente da tua falsa bondade, a carne continua aprisionando tua essência no mundo material.»",
    "«Tua esmola adia a dor do mundo, mas não cura o mal da existência terrena.»",
  ],
};

export function updateMessenger(dt, player, effects, ui, audio, world, input = null) {
  if (input) _decayInput = input;
  if (!_messengerNPC || !_messengerNPC.visible || !player) return;

  const m = _messengerNPC;
  const now = performance.now();
  m.floatPhase += dt * 3.8;

  // Atualiza as partículas de brasas orbitais ao redor do mensageiro
  if (m.pPositions && m.particles) {
    const pos = m.pPositions;
    for (let i = 0; i < m.pCount; i++) {
      m.pAngles[i] += dt * m.pSpeeds[i];
      pos[i * 3] = Math.cos(m.pAngles[i]) * m.pRadii[i];
      pos[i * 3 + 1] += dt * 0.45;
      if (pos[i * 3 + 1] > 2.25) {
        pos[i * 3 + 1] = 0.15 + Math.random() * 0.25;
        m.pRadii[i] = 0.3 + Math.random() * 0.55;
      }
      pos[i * 3 + 2] = Math.sin(m.pAngles[i]) * m.pRadii[i];
    }
    m.particles.geometry.attributes.position.needsUpdate = true;
  }

  // Pulso do orbe violeta e brilho nos olhos
  if (m.sealLight) {
    m.sealLight.intensity = 1.4 + Math.sin(m.floatPhase * 2.0) * 0.6;
  }
  if (m.eyeGlow) {
    m.eyeGlow.intensity = 0.7 + Math.sin(m.floatPhase * 1.5) * 0.3;
  }

  const px = player.x ?? player.position?.x ?? 0;
  const pz = player.z ?? player.position?.z ?? 0;
  const dx = px - m.x;
  const dz = pz - m.z;
  const dist = Math.hypot(dx, dz) || 0.001;

  if (m.state === "APPROACH_PLAYER") {
    // Velocidade adaptativa: persegue ativamente o jogador sem ficar para trás
    const playerSpeed = Math.hypot(player.vx ?? 0, player.vz ?? 0);
    const speed = Math.max(5.6, playerSpeed + 2.4);

    // Desliza velozmente e suavemente em direção ao jogador
    m.x += (dx / dist) * (speed * dt);
    m.z += (dz / dist) * (speed * dt);

    // Encarar fixamente o jogador
    const targetYaw = Math.atan2(dx, dz);
    m.model.rotation.y = THREE.MathUtils.lerp(m.model.rotation.y, targetYaw, 0.15);

    // Inclinação sutil para a frente ao deslizar e balanço lateral suave
    m.model.rotation.x = THREE.MathUtils.lerp(m.model.rotation.x, 0.12, 0.1);
    m.model.rotation.z = Math.sin(m.floatPhase * 1.6) * 0.07;

    // Levitação espectral acima do solo (0.22m + flutuação senoidal)
    const gy = world ? world.heightAt(m.x, m.z) : (player.root?.position?.y ?? 0);
    const hoverY = gy + 0.22 + Math.sin(m.floatPhase) * 0.12;
    m.root.position.set(m.x, hoverY, m.z);

    // Emite rastro de cinzas negras e partículas roxas no chão enquanto voa
    if (now - (m.lastDustTime || 0) > 140 && effects) {
      m.lastDustTime = now;
      effects.play("dust", m.x + (Math.random() - 0.5) * 0.3, gy + 0.15, m.z + (Math.random() - 0.5) * 0.3, "#1a0824", 1.2);
      if (Math.random() < 0.4) {
        effects.play("star", m.x, gy + 0.35, m.z, "#7711bb", 1.1);
      }
    }

    // Chegou a ~3.2 metros: entrega a profecia cerimonial evolutiva
    if (dist < 3.4) {
      m.state = "DELIVERING";
      m.model.rotation.x = 0;

      let pool = CULT_MESSAGES.GOOD;
      const level = CultState?.level || 1;
      if (m.isEvilMessage) {
        if (level >= 4) pool = CULT_MESSAGES.EVIL_TIER_4;
        else if (level === 3) pool = CULT_MESSAGES.EVIL_TIER_3;
        else if (level === 2) pool = CULT_MESSAGES.EVIL_TIER_2;
        else pool = CULT_MESSAGES.EVIL_TIER_1;
      }

      const message = pool[Math.floor(Math.random() * pool.length)];
      if (audio?.hit) audio.hit(false);

      if (effects) {
        effects.play("dust", m.x, gy + 1.2, m.z, "#220533", 2.4);
        effects.play("star", m.x, gy + 1.8, m.z, "#ffffff", 1.8);
      }

      // Exibe a Profecia em Modal Gótico escuro que só fecha no ESC ou botão [X]
      showDemiurgeModal(
        message,
        level,
        () => {
          // Marca o Altar Ritual fora dos muros no Minimap e com Pilar de Luz
          if (m.isEvilMessage) {
            const altar = CultState?.altarTarget || (CULT_ALTARS && CULT_ALTARS[0]);
            if (altar) {
              spawnWaypointMarker({ x: altar.x, y: altar.y, z: altar.z });
              ui?.showToast?.(
                `✦ SANTUÁRIO DO DEMIURGO: O Altar nas matas do norte foi marcado em sua bússola! (Seita Nível ${level})`
              );
            }
          }

          // Dissipação espetacular ao fechar o modal
          if (effects) {
            effects.play("dust", m.x, gy + 1.0, m.z, "#0c0814", 3.4);
            effects.play("star", m.x, gy + 1.4, m.z, "#a822ee", 2.6);
            effects.play("star", m.x, gy + 1.8, m.z, "#ff2244", 2.2);
          }
          m.visible = false;
          m.root.visible = false;
        },
        input
      );
    }
  } else if (m.state === "DELIVERING") {
    // Enquanto o modal estiver aberto, ele fica flutuando suavemente encarando o jogador
    const targetYaw = Math.atan2(dx, dz);
    m.model.rotation.y = THREE.MathUtils.lerp(m.model.rotation.y, targetYaw, 0.1);
    const gy = world ? world.heightAt(m.x, m.z) : 0;
    m.root.position.set(m.x, gy + 0.22 + Math.sin(m.floatPhase) * 0.08, m.z);
  }

  // Timeout de segurança se travar no relevo
  if (now > m.timer && m.visible && m.state !== "DELIVERING") {
    m.visible = false;
    m.root.visible = false;
    if (effects) {
      effects.play("dust", m.x, m.root.position.y + 0.9, m.z, "#16151c", 2.0);
    }
  }
}

// ============================================================================
// 6. O MAL FINAL: O CATACLISMO DO DEMIURGO E O FIM DA CRIAÇÃO MATERIAL
// ============================================================================

/**
 * Modelo aprimorado dos Anjos Pretos do Vazio com Asas Carmesins ou Roxas e Foice Cerimonial.
 */
export function buildDarkAngelMesh({ wingColor = 0xff1a33, eyeColor = 0xff2222 } = {}) {
  const root = new THREE.Group();
  root.name = "DarkAngelRoot";

  const model = new THREE.Group();
  model.name = "DarkAngelModel";
  root.add(model);

  const matObsidian = new THREE.MeshStandardMaterial({
    color: 0x050409,
    roughness: 0.82,
    metalness: 0.35,
    flatShading: true,
  });
  const matWing = new THREE.MeshStandardMaterial({
    color: wingColor,
    emissive: wingColor,
    emissiveIntensity: 2.8,
    roughness: 0.3,
    metalness: 0.15,
    side: THREE.DoubleSide,
  });
  const matEyes = new THREE.MeshBasicMaterial({
    color: eyeColor,
  });
  const matPupilDot = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  const matBlade = new THREE.MeshStandardMaterial({
    color: 0x110d18,
    emissive: wingColor,
    emissiveIntensity: 1.4,
    metalness: 0.9,
    roughness: 0.2,
  });

  // Manto/Corpo espectral esguio e imponente (2.6m de altura)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 2.1, 8), matObsidian);
  body.position.set(0, 1.05, 0);
  model.add(body);

  // Capuz sombrio pontiagudo
  const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 6), matObsidian);
  cowl.position.set(0, 2.25, -0.05);
  cowl.rotation.x = -0.22;
  model.add(cowl);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 7), matObsidian);
  head.position.set(0, 2.05, 0);
  model.add(head);

  // Chifres curvos de obsidiana projetando-se do capuz
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 5), matObsidian);
    horn.position.set(sx * 0.16, 2.32, -0.02);
    horn.rotation.z = -sx * 0.55;
    horn.rotation.x = -0.3;
    model.add(horn);
  }

  // Olhos penetrantes com pupila branca pontual no centro
  for (const sx of [-0.07, 0.07]) {
    const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.04), matEyes);
    eyeSocket.position.set(sx, 2.05, 0.18);
    model.add(eyeSocket);

    const pupilDot = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.01), matPupilDot);
    pupilDot.position.set(sx, 2.05, 0.202);
    model.add(pupilDot);
  }

  // Grandes Asas Angelicais de 5 camadas cada
  const wingGroupL = new THREE.Group();
  wingGroupL.position.set(-0.2, 1.7, -0.16);
  for (let i = 0; i < 5; i++) {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.13 - i * 0.018, 1.05 + i * 0.28, 4), matWing);
    feather.rotation.z = 0.55 + i * 0.26;
    feather.rotation.x = -0.18;
    feather.position.set(-0.28 - i * 0.22, 0.35 + i * 0.18, 0);
    wingGroupL.add(feather);
  }
  model.add(wingGroupL);

  const wingGroupR = new THREE.Group();
  wingGroupR.position.set(0.2, 1.7, -0.16);
  for (let i = 0; i < 5; i++) {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.13 - i * 0.018, 1.05 + i * 0.28, 4), matWing);
    feather.rotation.z = -0.55 - i * 0.26;
    feather.rotation.x = -0.18;
    feather.position.set(0.28 + i * 0.22, 0.35 + i * 0.18, 0);
    wingGroupR.add(feather);
  }
  model.add(wingGroupR);

  // Foice do Vazio cerimonial portada na mão direita
  const scytheGroup = new THREE.Group();
  scytheGroup.position.set(0.38, 1.1, 0.15);
  scytheGroup.rotation.z = 0.3;
  scytheGroup.rotation.y = -0.4;

  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.5, 6), matObsidian);
  scytheGroup.add(haft);

  const scytheBlade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.75, 0.22), matBlade);
  scytheBlade.position.set(0.18, 1.15, 0);
  scytheBlade.rotation.z = -1.15;
  scytheGroup.add(scytheBlade);
  model.add(scytheGroup);

  // Luz espectral emitida pelo anjo
  const angelLight = new THREE.PointLight(wingColor, 2.2, 12, 1.8);
  angelLight.position.set(0, 1.7, 0.4);
  model.add(angelLight);

  return { root, model, wingGroupL, wingGroupR, angelLight, scytheGroup };
}

/**
 * Modelo do Olho Colossal do Demiurgo Descendo do Firmamento.
 * Altamente visível, colossal (24m), com plasma, coroa solar e halos astrais.
 */
/**
 * O Demiurgo: Um ser amorfo sem forma, um Sol Negro colossal de 3 Olhos Malignos.
 */
export function buildDemiurgeColossalEyeMesh() {
  const root = new THREE.Group();
  root.name = "DemiurgeBlackSunRoot";

  const blackSunGroup = new THREE.Group();
  root.add(blackSunGroup);

  // 1. Materiais do Sol Negro e Vazio Abissal
  const matVoidCore = new THREE.MeshBasicMaterial({
    color: 0x010002, // Absorção abissal total de luz
  });

  const matDarkPlasma = new THREE.MeshStandardMaterial({
    color: 0x16021f,
    emissive: 0x2e0238,
    emissiveIntensity: 1.8,
    roughness: 0.9,
    transparent: true,
    opacity: 0.92,
    flatShading: true,
  });

  const matCoronaCrimson = new THREE.MeshBasicMaterial({
    color: 0x880018,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  const matCoronaViolet = new THREE.MeshBasicMaterial({
    color: 0x3d005e,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });

  const matScleraTrio = new THREE.MeshStandardMaterial({
    color: 0xf0ebe1,
    emissive: 0x3d0408,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });

  const matIrisTrio = new THREE.MeshStandardMaterial({
    color: 0xff0025,
    emissive: 0xdd001a,
    emissiveIntensity: 3.8,
    roughness: 0.15,
  });

  const matSlitBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // 2. Núcleo Amorfo do Sol Negro (diâmetro ~28m)
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(14.0, 24, 18), matVoidCore);
  blackSunGroup.add(coreMesh);

  // Nuvens e massas de matéria escura amorfa pulsante orbitando o núcleo
  const amorphousBlobs = [];
  for (let b = 0; b < 7; b++) {
    const blob = new THREE.Mesh(new THREE.DodecahedronGeometry(10.5 + (b % 3) * 1.8, 1), matDarkPlasma);
    const ang = (b / 7) * Math.PI * 2;
    blob.position.set(Math.cos(ang) * 6.5, (b % 2 === 0 ? 3.5 : -3.5), Math.sin(ang) * 6.5);
    blob.rotation.set(b * 0.7, b * 1.2, b * 0.5);
    blackSunGroup.add(blob);
    amorphousBlobs.push(blob);
  }

  // 3. Coroa de Espículas e Prominências Cósmicas Flamejantes
  const coronaSpikes = [];
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    const spikeH = 11.0 + (i % 4) * 3.5;
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, spikeH, 4),
      i % 2 === 0 ? matCoronaCrimson : matCoronaViolet
    );
    spike.position.set(Math.cos(ang) * 17.0, -1.5, Math.sin(ang) * 17.0);
    spike.rotation.z = Math.cos(ang) * 1.2;
    spike.rotation.x = Math.sin(ang) * 1.2;
    blackSunGroup.add(spike);
    coronaSpikes.push(spike);
  }

  // Anéis de acreção de sombra gravitacional
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(20.5, 0.75, 8, 36), matCoronaCrimson);
  ring1.rotation.x = Math.PI * 0.45;
  blackSunGroup.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(24.5, 0.65, 8, 36), matCoronaViolet);
  ring2.rotation.x = -Math.PI * 0.42;
  ring2.rotation.y = 0.35;
  blackSunGroup.add(ring2);

  // 4. OS 3 OLHOS MALIGNOS DO DEMIURGO (Dispostos em Tríade Demoníaca olhando para o Jogador)
  function createDemonEye(eyeRadius) {
    const eyeRoot = new THREE.Group();

    // Globo ocular esférico branco leitosa com veias
    const ball = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 20, 14), matScleraTrio);
    eyeRoot.add(ball);

    // Íris de sangue cósmica voltada para o pólo +Z
    const irisR = eyeRadius * 0.52;
    const irisMesh = new THREE.Mesh(new THREE.CircleGeometry(irisR, 24), matIrisTrio);
    irisMesh.position.set(0, 0, eyeRadius * 0.96);
    eyeRoot.add(irisMesh);

    // Pupila de crocodilo / réptil vertical pontiaguda
    const slitShape = new THREE.Shape();
    const sw = irisR * 0.22;
    const sh = irisR * 1.4;
    slitShape.moveTo(0, sh * 0.5);
    slitShape.lineTo(sw * 0.5, 0);
    slitShape.lineTo(0, -sh * 0.5);
    slitShape.lineTo(-sw * 0.5, 0);
    slitShape.closePath();

    const pupilMesh = new THREE.Mesh(new THREE.ShapeGeometry(slitShape), matSlitBlack);
    pupilMesh.position.set(0, 0, eyeRadius * 0.98);
    eyeRoot.add(pupilMesh);

    return eyeRoot;
  }

  // 1) Olho Central Inferior (Olho Alfa Colossal)
  const eyeCenter = createDemonEye(5.8);
  eyeCenter.position.set(0, -6.5, 12.8);
  eyeCenter.rotation.x = -0.25; // Apontado para baixo em direção à terra/jogador
  blackSunGroup.add(eyeCenter);

  // 2) Olho Superior Esquerdo
  const eyeLeft = createDemonEye(4.2);
  eyeLeft.position.set(-7.5, 4.2, 10.8);
  eyeLeft.rotation.x = -0.28;
  eyeLeft.rotation.y = 0.32;
  blackSunGroup.add(eyeLeft);

  // 3) Olho Superior Direito
  const eyeRight = createDemonEye(4.2);
  eyeRight.position.set(7.5, 4.2, 10.8);
  eyeRight.rotation.x = -0.28;
  eyeRight.rotation.y = -0.32;
  blackSunGroup.add(eyeRight);

  // Ponto de luz e feixe gravitacional devastador do Sol Negro
  const sunLight = new THREE.PointLight(0xff0028, 10.0, 160, 1.5);
  sunLight.position.set(0, -6, 8);
  blackSunGroup.add(sunLight);

  return {
    root,
    blackSunGroup,
    coreMesh,
    amorphousBlobs,
    coronaSpikes,
    ring1,
    ring2,
    eyeCenter,
    eyeLeft,
    eyeRight,
    sunLight,
    eyeball: coreMesh,
  };
}

/**
 * Olho do Firmamento para espalhar pela abóbada celeste.
 */
// Banner dramático na tela para o Apocalipse
let _heIsComingEl = null;

const HE_IS_COMING_CSS = `
#demiurge-he-is-coming {
  position: fixed;
  inset: 0;
  z-index: 99998;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 1.0s cubic-bezier(0.16, 1, 0.3, 1);
  background: radial-gradient(circle at center, rgba(32, 2, 8, 0.8) 0%, rgba(2, 0, 4, 0.94) 100%);
  text-align: center;
  padding: 20px;
}
#demiurge-he-is-coming.show {
  opacity: 1;
}
.he-is-coming-title {
  font-family: "Cinzel Decorative", "Almendra", Georgia, serif;
  font-size: clamp(52px, 12vw, 136px);
  font-weight: 900;
  letter-spacing: 0.16em;
  color: #ff1133;
  text-shadow: 0 0 35px #ff0022, 0 0 85px #880011, 0 6px 18px #000;
  margin: 0;
  text-transform: uppercase;
  line-height: 1.05;
  animation: dread-pulse 1.8s ease-in-out infinite;
}
.he-is-coming-sub {
  font-family: Georgia, serif;
  font-size: clamp(16px, 2.8vw, 30px);
  font-style: italic;
  letter-spacing: 0.22em;
  color: #f7b2c0;
  text-shadow: 0 0 20px rgba(255, 20, 60, 0.7);
  margin-top: 18px;
}
@keyframes dread-pulse {
  0%, 100% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.06); filter: brightness(1.35); }
}
`;

function _injectHeIsComingStyles() {
  if (document.getElementById("he-is-coming-styles")) return;
  const style = document.createElement("style");
  style.id = "he-is-coming-styles";
  style.textContent = HE_IS_COMING_CSS;
  document.head.appendChild(style);
}

function _showHeIsComingBanner() {
  _injectHeIsComingStyles();
  if (!_heIsComingEl) {
    _heIsComingEl = document.createElement("div");
    _heIsComingEl.id = "demiurge-he-is-coming";
    _heIsComingEl.innerHTML = `
      <h1 class="he-is-coming-title">ELE ESTÁ VINDO</h1>
      <p class="he-is-coming-sub">O ARCONTE SUPREMO DESPERTOU DO ABISMO</p>
    `;
    document.body.appendChild(_heIsComingEl);
  }
  requestAnimationFrame(() => {
    _heIsComingEl?.classList.add("show");
  });
}

function _hideHeIsComingBanner() {
  if (_heIsComingEl) {
    _heIsComingEl.classList.remove("show");
    setTimeout(() => {
      _heIsComingEl?.remove();
      _heIsComingEl = null;
    }, 1200);
  }
}

/**
 * Olho do Firmamento colossal com pupila reptiliana vertical pontiaguda.
 */
/**
 * Olho do Firmamento colossal esférico, com esclera branca ensanguentada,
 * veias vermelhas, músculos retro-oculares e íris de crocodilo voltada diretamente para o Player.
 */
export function buildFirmamentEyeMesh(color = 0xd91624, radius = 9) {
  const root = new THREE.Group();
  root.name = "FirmamentReptilianEye";

  // Esclera branca leitosa orgânica com leve tonalidade ensanguentada
  const matSclera = new THREE.MeshStandardMaterial({
    color: 0xedebe4,
    emissive: 0x28060a,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.05,
  });

  // Íris de crocodilo carmesim / plasma cósmico
  const matIris = new THREE.MeshStandardMaterial({
    color: color,
    emissive: 0xaa0e1a,
    emissiveIntensity: 3.2,
    roughness: 0.2,
  });

  // Pupila de réptil fenda negra profunda
  const matPupil = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // Veias sanguíneas na esclera
  const matVein = new THREE.MeshBasicMaterial({ color: 0x990011 });

  // Músculos e feixes retro-oculares arrancados
  const matMuscle = new THREE.MeshStandardMaterial({
    color: 0x5e0810,
    emissive: 0x2a0306,
    roughness: 0.85,
    metalness: 0.1,
  });

  // 1. Globo Ocular Esférico Completo Tridimensional (não é achatado nem disco)
  const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), matSclera);
  root.add(eyeBall);

  // 2. Veias vermelhas ramificadas sobre a esclera
  for (let v = 0; v < 8; v++) {
    const vAngle = (v / 8) * Math.PI * 2;
    const veinCurve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06 * radius, 0.02 * radius, radius * 1.1, 4),
      matVein
    );
    veinCurve.position.set(
      Math.cos(vAngle) * radius * 0.75,
      Math.sin(vAngle) * radius * 0.75,
      radius * 0.2
    );
    veinCurve.rotation.z = vAngle + 0.3;
    veinCurve.rotation.x = 0.5;
    root.add(veinCurve);
  }

  // 3. Músculos Retro-Oculares e Nervo Óptico (estendendo-se para trás em -Z)
  const opticNerve = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.22, radius * 0.35, radius * 1.6, 8),
    matMuscle
  );
  opticNerve.position.set(0, 0, -radius * 1.1);
  opticNerve.rotation.x = Math.PI / 2;
  root.add(opticNerve);

  const muscleOffsets = [
    [0, radius * 0.7, -radius * 0.8],
    [0, -radius * 0.7, -radius * 0.8],
    [radius * 0.7, 0, -radius * 0.8],
    [-radius * 0.7, 0, -radius * 0.8],
  ];
  for (let m = 0; m < muscleOffsets.length; m++) {
    const mPos = muscleOffsets[m];
    const muscle = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.12, radius * 0.18, radius * 1.2, 5),
      matMuscle
    );
    muscle.position.set(mPos[0], mPos[1], mPos[2]);
    muscle.rotation.x = Math.PI / 2 + (mPos[1] !== 0 ? Math.sign(mPos[1]) * 0.25 : 0);
    muscle.rotation.y = mPos[0] !== 0 ? Math.sign(mPos[0]) * 0.25 : 0;
    root.add(muscle);
  }

  // 4. ÍRIS VERMELHA DE CROCODILO NO PÓLO FRONTAL (+Z, voltada para o Player)
  const irisRadius = radius * 0.48;
  const iris = new THREE.Mesh(new THREE.CircleGeometry(irisRadius, 32), matIris);
  iris.position.set(0, 0, radius * 0.97);
  root.add(iris);

  // Anel de transição da íris
  const irisRing = new THREE.Mesh(
    new THREE.RingGeometry(irisRadius * 0.88, irisRadius * 1.02, 32),
    new THREE.MeshBasicMaterial({ color: 0x220004 })
  );
  irisRing.position.set(0, 0, radius * 0.98);
  root.add(irisRing);

  // 5. PUPILA DE CROCODILO / RÉPTIL: Fenda vertical negra pontiaguda no centro
  const slitGroup = new THREE.Group();
  slitGroup.position.set(0, 0, radius * 0.99);

  const slitWidth = irisRadius * 0.18;
  const slitHeight = irisRadius * 1.35;

  const slitShape = new THREE.Shape();
  slitShape.moveTo(0, slitHeight * 0.5);
  slitShape.lineTo(slitWidth * 0.5, 0);
  slitShape.lineTo(0, -slitHeight * 0.5);
  slitShape.lineTo(-slitWidth * 0.5, 0);
  slitShape.closePath();

  const slitMesh = new THREE.Mesh(new THREE.ShapeGeometry(slitShape), matPupil);
  slitGroup.add(slitMesh);
  root.add(slitGroup);

  // Luz incandescente avermelhada que emana da íris em direção ao solo (+Z)
  const pLight = new THREE.PointLight(color, 4.5, 95, 1.8);
  pLight.position.set(0, 0, radius * 1.1);
  root.add(pLight);

  return { root, eyeBall, iris, slit: slitGroup, pLight, radius };
}

export const DemiurgeCataclysm = {
  active: false,
  timer: 0,
  angels: [],
  firmamentEyes: [],
  colossalEye: null,
  shockwave: null,
  lastDescentSound: 0,
  bannerShown: false,
  eyesOpened: false,
  descentStarted: false,
  groundImpactDone: false,
  modalShown: false,
  destroyed: false,
  env: null,
};

/**
 * Inicia o Fim dos Tempos: Descida do Demiurgo à Terra.
 */
export function triggerDemiurgeCataclysm(env) {
  if (DemiurgeCataclysm.active) return;
  DemiurgeCataclysm.active = true;
  DemiurgeCataclysm.timer = 0;
  DemiurgeCataclysm.lastDescentSound = 0;
  DemiurgeCataclysm.bannerShown = false;
  DemiurgeCataclysm.eyesOpened = false;
  DemiurgeCataclysm.descentStarted = false;
  DemiurgeCataclysm.groundImpactDone = false;
  DemiurgeCataclysm.modalShown = false;
  DemiurgeCataclysm.destroyed = false;
  DemiurgeCataclysm.env = env;

  const { scene, player, dayNight, ui, audio } = env;

  WorldDecay.isEclipse = true;
  if (dayNight) {
    dayNight.progress = 0.5; // Meia-noite do Eclipse
  }

  ui?.showToast?.("🌑 O VÉU DA CRIAÇÃO FOI RASGADO! OS ANJOS MALIGNOS DESCEM!");
  audio?.demiurgeDescent?.();
  audio?.deathBell?.();

  const px = player?.x ?? 0;
  const pz = player?.z ?? 0;
  const py = player?.root?.position?.y ?? 0;

  // Trava controle do jogador para contemplação
  if (player) {
    player.knockedOut = true;
  }

  // 1. Spawna os Anjos Pretos com Asas Vermelhas e Roxas em círculo ao redor do jogador
  DemiurgeCataclysm.angels = [];
  const angelCount = 8;
  for (let i = 0; i < angelCount; i++) {
    const isPurple = i % 2 === 1;
    const wingColor = isPurple ? 0xaa22ee : 0xff1a33;
    const eyeColor = isPurple ? 0xcc44ff : 0xff2222;

    const angelData = buildDarkAngelMesh({ wingColor, eyeColor });
    const ang = (i / angelCount) * Math.PI * 2;
    const radius = 10.5;
    const ax = px + Math.cos(ang) * radius;
    const az = pz + Math.sin(ang) * radius;

    angelData.root.position.set(ax, py + 48, az);
    angelData.targetY = py + 0.6;
    angelData.ang = ang;
    angelData.radius = radius;
    angelData.wingPhase = i * 0.8;
    angelData.root.lookAt(px, py + 1.2, pz);

    if (scene) scene.add(angelData.root);
    DemiurgeCataclysm.angels.push(angelData);
  }

  // 2. Spawna 42 Olhos Colossais com Pupilas Reptilianas cobrindo todo o céu
  DemiurgeCataclysm.firmamentEyes = [];
  const colors = [0xff1133, 0xffaa00, 0xee11ee, 0xffcc00, 0xff0022, 0xaa00ee];

  // Domo Zenite (Topo do Céu): 6 olhos colossais
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2;
    const dist = 32 + (k % 2) * 12;
    const eyX = px + Math.cos(ang) * dist;
    const eyZ = pz + Math.sin(ang) * dist;
    const eyY = py + 85 + (k % 3) * 16;

    const fEye = buildFirmamentEyeMesh(colors[k % colors.length], 20, 11);
    fEye.root.position.set(eyX, eyY, eyZ);
    fEye.root.lookAt(px, py + 1.6, pz);
    fEye.root.visible = false;

    if (scene) scene.add(fEye.root);
    DemiurgeCataclysm.firmamentEyes.push(fEye);
  }

  // Domo Médio: 16 olhos colossais
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2 + 0.15;
    const dist = 65 + (k % 3) * 18;
    const eyX = px + Math.cos(ang) * dist;
    const eyZ = pz + Math.sin(ang) * dist;
    const eyY = py + 55 + (k % 4) * 14;

    const fEye = buildFirmamentEyeMesh(colors[(k + 1) % colors.length], 16, 9);
    fEye.root.position.set(eyX, eyY, eyZ);
    fEye.root.lookAt(px, py + 1.6, pz);
    fEye.root.visible = false;

    if (scene) scene.add(fEye.root);
    DemiurgeCataclysm.firmamentEyes.push(fEye);
  }

  // Domo do Horizonte: 20 olhos colossais
  for (let k = 0; k < 20; k++) {
    const ang = (k / 20) * Math.PI * 2;
    const dist = 100 + (k % 3) * 25;
    const eyX = px + Math.cos(ang) * dist;
    const eyZ = pz + Math.sin(ang) * dist;
    const eyY = py + 30 + (k % 4) * 12;

    const fEye = buildFirmamentEyeMesh(colors[(k + 2) % colors.length], 14, 8);
    fEye.root.position.set(eyX, eyY, eyZ);
    fEye.root.lookAt(px, py + 1.6, pz);
    fEye.root.visible = false;

    if (scene) scene.add(fEye.root);
    DemiurgeCataclysm.firmamentEyes.push(fEye);
  }

  // 3. Spawna o Olho Colossal do Demiurgo nos altos céus
  const eyeData = buildDemiurgeColossalEyeMesh();
  eyeData.root.position.set(px, py + 180, pz);
  eyeData.targetY = py + 0.8;
  if (scene) scene.add(eyeData.root);
  DemiurgeCataclysm.colossalEye = eyeData;

  // 4. Cria anel de onda de choque no solo para o impacto
  const shockMat = new THREE.MeshBasicMaterial({
    color: 0xff2244,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const shockGeom = new THREE.RingGeometry(0.5, 3.0, 32);
  const shockMesh = new THREE.Mesh(shockGeom, shockMat);
  shockMesh.rotation.x = -Math.PI / 2;
  shockMesh.position.set(px, py + 0.25, pz);
  shockMesh.visible = false;
  if (scene) scene.add(shockMesh);
  DemiurgeCataclysm.shockwave = shockMesh;
}

/**
 * Atualiza o Cataclismo a cada frame com progressão cinematográfica dramática.
 */
export function updateDemiurgeCataclysm(dt, env) {
  if (!DemiurgeCataclysm.active) return;
  DemiurgeCataclysm.timer += dt;
  const t = DemiurgeCataclysm.timer;
  const { player, cameraRig, effects, audio } = env;
  const px = player?.x ?? 0;
  const pz = player?.z ?? 0;
  const py = player?.root?.position?.y ?? 0;

  // Rugido contínuo da descida a cada 3.0s
  if (t - DemiurgeCataclysm.lastDescentSound >= 3.0 && !DemiurgeCataclysm.groundImpactDone) {
    DemiurgeCataclysm.lastDescentSound = t;
    audio?.demiurgeDescent?.();
  }

  // 1. Descida e movimentação dos anjos negros em círculo
  for (let i = 0; i < DemiurgeCataclysm.angels.length; i++) {
    const a = DemiurgeCataclysm.angels[i];
    a.wingPhase += dt * 3.4;
    a.root.position.y = THREE.MathUtils.lerp(a.root.position.y, a.targetY + Math.sin(a.wingPhase) * 0.2, dt * 1.5);
    const flap = Math.sin(a.wingPhase) * 0.35;
    a.wingGroupL.rotation.z = flap;
    a.wingGroupR.rotation.z = -flap;
    a.scytheGroup.rotation.x = Math.sin(a.wingPhase * 0.5) * 0.15;
    a.root.lookAt(px, py + 1.2, pz);

    if (Math.random() < 0.1 && effects) {
      const col = i % 2 === 1 ? "#aa22ee" : "#ff1a33";
      effects.play("star", a.root.position.x, a.root.position.y + 1.6, a.root.position.z, col, 1.4);
    }
  }

  // FASE 2 (t = 3.5s a 6.5s): Aparece enorme na tela "ELE ESTÁ VINDO"
  if (t >= 3.5 && !DemiurgeCataclysm.bannerShown) {
    DemiurgeCataclysm.bannerShown = true;
    _showHeIsComingBanner();
    audio?.deathBell?.();
    if (cameraRig?.shakeAt) {
      cameraRig.shakeAt(px, pz, 0.6, px, pz);
    }
  }

  // FASE 3 (t = 6.5s a 16.5s — 10 SEGUNDOS COMPLETOS DE OLHOS REPTILIANOS):
  // Esconde o banner e revela os 42 olhos cobrindo todo o céu, fitando o jogador
  if (t >= 6.5 && !DemiurgeCataclysm.eyesOpened) {
    DemiurgeCataclysm.eyesOpened = true;
    _hideHeIsComingBanner();
    for (let k = 0; k < DemiurgeCataclysm.firmamentEyes.length; k++) {
      const fEye = DemiurgeCataclysm.firmamentEyes[k];
      fEye.root.visible = true;
    }
    audio?.demiurgeDescent?.();
    if (cameraRig?.shakeAt) {
      cameraRig.shakeAt(px, pz, 0.8, px, pz);
    }
  }

  // Atualização frame a frame dos Olhos Reptilianos no Céu
  if (DemiurgeCataclysm.eyesOpened) {
    for (let k = 0; k < DemiurgeCataclysm.firmamentEyes.length; k++) {
      const fEye = DemiurgeCataclysm.firmamentEyes[k];
      // Todos os olhos acompanham e olham diretamente para o jogador!
      fEye.root.lookAt(px, py + 1.6, pz);

      // Pupila reptiliana dilata e pulsa organicamente
      const pulse = 1.0 + Math.sin(t * 2.8 + k * 0.7) * 0.35;
      if (fEye.slit) {
        fEye.slit.scale.x = 0.85 + Math.sin(t * 3.0 + k) * 0.45;
      }
      if (fEye.pLight) {
        fEye.pLight.intensity = 3.8 * pulse;
      }
    }
  }

  // FASE 4 (t >= 16.5s): Após 10 segundos com os olhos no céu, o Demiurgo desce com fúria total
  if (t >= 16.5) {
    if (!DemiurgeCataclysm.descentStarted) {
      DemiurgeCataclysm.descentStarted = true;
      audio?.demiurgeDescent?.();
      audio?.deathBell?.();
    }

    if (DemiurgeCataclysm.colossalEye) {
      const eye = DemiurgeCataclysm.colossalEye;
      eye.root.position.x = px;
      eye.root.position.z = pz;

      // Velocidade de descida acelerando até o chão
      const fallProgress = (t - 16.5);
      const descentSpeed = THREE.MathUtils.clamp(0.8 + fallProgress * 0.45, 0.8, 4.2);
      eye.root.position.y = THREE.MathUtils.lerp(eye.root.position.y, eye.targetY, dt * descentSpeed);

      eye.ring1.rotation.z += dt * 1.4;
      eye.ring2.rotation.z -= dt * 1.8;
      eye.eyeball.rotation.z += dt * 0.6;

      if (eye.blackSunGroup) {
        eye.blackSunGroup.rotation.y += dt * 0.45;
        eye.blackSunGroup.rotation.z = Math.sin(t * 1.5) * 0.08;
      }
      if (eye.coronaSpikes) {
        for (let s = 0; s < eye.coronaSpikes.length; s++) {
          eye.coronaSpikes[s].rotation.z += dt * (s % 2 === 0 ? 0.3 : -0.3);
        }
      }
      if (eye.sunLight) {
        eye.sunLight.intensity = 8.0 + Math.sin(t * 8.0) * 4.0;
      }

      // Tremores de terra crescentes conforme o Olho cai
      if (cameraRig?.shakeAt) {
        const shakeAmt = THREE.MathUtils.clamp(0.4 + fallProgress * 0.35, 0.4, 2.8);
        cameraRig.shakeAt(px, pz, shakeAmt, px, pz);
      }

      // Impacto Colossal do Demiurgo no solo (t >= 21.0s ou proximidade do solo)
      if ((t >= 21.0 || eye.root.position.y <= py + 2.5) && !DemiurgeCataclysm.groundImpactDone) {
        DemiurgeCataclysm.groundImpactDone = true;
        audio?.colossalImpact?.();
        audio?.explosion?.(px, pz, 15.0);

        if (cameraRig?.shakeAt) {
          cameraRig.shakeAt(px, pz, 3.5, px, pz);
        }

        // Ativa onda de choque devastadora
        if (DemiurgeCataclysm.shockwave) {
          DemiurgeCataclysm.shockwave.visible = true;
          DemiurgeCataclysm.shockwave.material.opacity = 0.98;
        }

        // Erupção de 50 plumas de poeira e chamas cósmicas
        if (effects) {
          for (let k = 0; k < 50; k++) {
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.random() * 35;
            const dustColor = k % 2 === 0 ? "#ff1144" : "#220533";
            effects.play("dust", px + Math.cos(ang) * rad, py + 0.5, pz + Math.sin(ang) * rad, dustColor, 6.0);
            effects.play("star", px + Math.cos(ang) * rad, py + 1.5, pz + Math.sin(ang) * rad, "#ff2244", 4.2);
          }
        }
      }

      // Expansão da onda de choque no chão
      if (DemiurgeCataclysm.groundImpactDone && DemiurgeCataclysm.shockwave && DemiurgeCataclysm.shockwave.visible) {
        const sw = DemiurgeCataclysm.shockwave;
        sw.scale.x += dt * 38.0;
        sw.scale.y += dt * 38.0;
        sw.material.opacity = Math.max(0, sw.material.opacity - dt * 0.6);
      }
    }
  }

  // FASE 5 (t >= 24.0s): Fim definitivo do jogo e abertura da tela de vitória do Mal
  if (t >= 24.0 && !DemiurgeCataclysm.destroyed) {
    DemiurgeCataclysm.destroyed = true;

    if (effects) {
      for (let k = 0; k < 20; k++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 40;
        effects.play("dust", px + Math.cos(ang) * rad, py + 1, pz + Math.sin(ang) * rad, "#220533", 5.0);
      }
    }

    // Fim definitivo do jogo: a matéria ruiu
    showVictoryEndingModal({
      type: "DEMIURGE",
      title: "O FIM DA CRIAÇÃO MATERIAL",
      subtitle: "A TERRA E A MATÉRIA FORAM TOTALMENTE CONSUMIDAS",
      quote: "«O Demiurgo colidiu contra a terra e consumiu o mundo na pureza do nada. O cárcere da carne ruiu para sempre. Não há mais terra, corpos ou sofrimento.»",
    });
  }
}
