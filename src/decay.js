import * as THREE from "three";
import { buildCultistMesh, CultState, CULT_ALTARS } from "./cult.js";
import { spawnWaypointMarker } from "./rpg.js";

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
    // Decadência progressiva ao longo dos dias (0.0 a 1.0)
    const baseDay = _normalSkyDay.clone().lerp(_decaySkyDay, decay);
    const baseNight = _normalSkyNight.clone().lerp(_decaySkyNight, decay);
    const currentSky = daylight > 0.5 ? baseDay : baseNight;

    if (scene.fog) {
      scene.fog.density = 0.008 + decay * 0.016;
    }
    if (dayNight.sun && decay > 0.3) {
      dayNight.sun.color.lerp(new THREE.Color("#c8c0b4"), decay * 0.5);
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

  // Gerenciamento da duração do Eclipse (Opção 1A: dura 1 ciclo diário completo)
  if (WorldDecay.isEclipse) {
    WorldDecay.eclipseDayRemaining--;
    if (WorldDecay.eclipseDayRemaining <= 0) {
      WorldDecay.isEclipse = false;
      ui?.showToast?.("✦ O sangue arrefece no horizonte. O Eclipse cessou por ora.");
    }
  } else {
    // Sorteio do Eclipse na virada da meia-noite (ampliado pelo nível da seita)
    const cultBonus = CultState ? Math.min(0.35, (CultState.level - 1) * 0.1) : 0;
    const rollEclipse = Math.random() < (0.05 + cultBonus) || WorldDecay.daysPassed >= 20;
    if (rollEclipse) {
      WorldDecay.isEclipse = true;
      WorldDecay.eclipseDayRemaining = 1; // 1 ciclo completo
      ui?.showToast?.("🌑 O Olho do Demiurgo se abre! O Sol sangra no firmamento!");
      if (effects && world) {
        effects.play("star", 0, 10, 0, "#ff2211", 3.0);
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

export function showDemiurgeModal(message, level = 1, onDismiss, input = null) {
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

  _demiurgeModalEl.innerHTML = `
    <div class="demiurge-parchment" role="dialog" aria-modal="true">
      <button class="demiurge-close-btn" id="demiurge-btn-close" aria-label="Fechar mensagem">✕</button>
      <div class="demiurge-seal">👁️</div>
      <div class="demiurge-header">
        <h2 class="demiurge-title">SUSSURRO DO DEMIURGO</h2>
        <span class="demiurge-subtitle">Mensageiro das Cinzas · Seita Cátara (Nível ${level})</span>
      </div>
      <div class="demiurge-body">${message}</div>
      <div class="demiurge-footer">
        <button class="demiurge-confirm-btn" id="demiurge-btn-confirm">ACEITAR O DESTINO [ESC]</button>
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

  // Materiais Sombrios Exclusivos
  const robeBlack = new THREE.MeshStandardMaterial({
    color: 0x09070f,
    roughness: 0.85,
    metalness: 0.15,
    flatShading: true,
  });
  const cloakPurple = new THREE.MeshStandardMaterial({
    color: 0x2e0d47,
    roughness: 0.65,
    metalness: 0.25,
    flatShading: true,
  });
  const liningCrimson = new THREE.MeshStandardMaterial({
    color: 0x820f1e,
    roughness: 0.6,
    metalness: 0.25,
    flatShading: true,
  });
  const voidFace = new THREE.MeshBasicMaterial({
    color: 0x010103,
  });
  const whiteEyes = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  const darkSpikes = new THREE.MeshStandardMaterial({
    color: 0x140d1c,
    roughness: 0.4,
    metalness: 0.6,
  });
  const orbCoreMat = new THREE.MeshBasicMaterial({
    color: 0xcc22ff,
  });

  // 1. Manto preto longo até o chão (esguio e ameaçador, 2.2m de altura)
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.48, 1.7, 10), robeBlack);
  robe.position.set(0, 0.88, 0);
  robe.castShadow = true;
  model.add(robe);

  // Faixas carmesins rasgadas na frente do manto
  const frontSash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.45, 0.04), liningCrimson);
  frontSash.position.set(0, 0.78, 0.23);
  frontSash.rotation.x = -0.06;
  model.add(frontSash);

  // Tiras esfarrapadas inferiores
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const tatter = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.35, 0.02), i % 2 === 0 ? cloakPurple : liningCrimson);
    tatter.position.set(Math.cos(angle) * 0.44, 0.16, Math.sin(angle) * 0.44);
    tatter.rotation.y = angle;
    tatter.rotation.z = Math.sin(i * 1.5) * 0.2;
    model.add(tatter);
  }

  // 2. Sobrecapa real roxa (violeta profundo) com ombreiras e gola alta
  const cape = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.62, 1.35, 9, 1, true, -Math.PI * 0.78, Math.PI * 1.56),
    cloakPurple
  );
  cape.position.set(0, 1.15, -0.02);
  cape.castShadow = true;
  model.add(cape);

  // Forro interno da capa em vermelho sangue
  const capeLining = new THREE.Mesh(
    new THREE.CylinderGeometry(0.365, 0.605, 1.34, 9, 1, true, -Math.PI * 0.76, Math.PI * 1.52),
    liningCrimson
  );
  capeLining.position.set(0, 1.15, -0.015);
  model.add(capeLining);

  // Gola pontiaguda e ombreiras sombrias
  const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.62, 7), cloakPurple);
  mantle.position.set(0, 1.55, -0.03);
  mantle.rotation.y = Math.PI;
  model.add(mantle);

  const collarTrim = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.58, 7), liningCrimson);
  collarTrim.position.set(0, 1.53, -0.03);
  collarTrim.rotation.y = Math.PI;
  collarTrim.scale.set(0.98, 0.98, 0.98);
  model.add(collarTrim);

  // 3. Capuz profundo inclinado para a frente
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.75),
    cloakPurple
  );
  hood.position.set(0, 1.82, 0.02);
  hood.rotation.x = 0.28;
  model.add(hood);

  // Borda carmesim do capuz
  const hoodRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.028, 6, 12, Math.PI * 1.2),
    liningCrimson
  );
  hoodRim.position.set(0, 1.82, 0.14);
  hoodRim.rotation.x = Math.PI * 0.42;
  hoodRim.rotation.z = Math.PI * 0.9;
  model.add(hoodRim);

  // Chifres/espinhos curvados de obsidiana
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.36, 5), darkSpikes);
    horn.position.set(side * 0.18, 1.95, -0.08);
    horn.rotation.x = -0.45;
    horn.rotation.z = side * 0.42;
    model.add(horn);
  }

  // 4. Rosto abissal (Vazio de escuridão pura)
  const faceVoid = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), voidFace);
  faceVoid.position.set(0, 1.78, 0.08);
  model.add(faceVoid);

  // 5. Olhos Brancos Incandescentes e Ameaçadores
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), whiteEyes);
  eyeL.scale.set(1.4, 0.7, 0.8);
  eyeL.position.set(-0.068, 1.81, 0.19);
  eyeL.rotation.z = 0.15;
  model.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), whiteEyes);
  eyeR.scale.set(1.4, 0.7, 0.8);
  eyeR.position.set(0.068, 1.81, 0.19);
  eyeR.rotation.z = -0.15;
  model.add(eyeR);

  // Pequena luz branca espectral nos olhos
  const eyeGlow = new THREE.PointLight(0xffffff, 0.8, 3.2, 2.0);
  eyeGlow.position.set(0, 1.82, 0.28);
  model.add(eyeGlow);

  // 6. Braços longos com mangas esvoaçantes
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.82, 6), robeBlack);
  armL.position.set(-0.35, 1.34, 0.1);
  armL.rotation.x = 0.35;
  armL.rotation.z = 0.28;
  model.add(armL);

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.82, 6), robeBlack);
  armR.position.set(0.35, 1.34, 0.15);
  armR.rotation.x = 0.65; // Braço direito estendido chamando o jogador
  armR.rotation.z = -0.22;
  model.add(armR);

  // Mão direita em garra escura estendida
  const clawHand = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 4), darkSpikes);
  clawHand.position.set(0.38, 1.05, 0.45);
  clawHand.rotation.x = Math.PI * 0.45;
  model.add(clawHand);

  // Mão esquerda segurando o Selo do Demiurgo (Orbe violeta pulsante)
  const sealGroup = new THREE.Group();
  sealGroup.position.set(-0.38, 1.05, 0.32);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), orbCoreMat);
  sealGroup.add(orb);

  const sealLight = new THREE.PointLight(0xaa22ff, 1.8, 6.0, 2.0);
  sealGroup.add(sealLight);
  model.add(sealGroup);

  // 7. Enxame de Partículas Espirituais (Brasas e cinzas roxas e vermelhas)
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
    robe,
    cape,
    armL,
    armR,
    orb,
    sealLight,
    eyeGlow,
    particles,
    pPositions,
    pAngles,
    pRadii,
    pSpeeds,
    pCount,
  };
}

function _ensureMessenger(scene) {
  if (_messengerNPC || !scene) return _messengerNPC;

  const meshData = buildDemiurgeMessengerMesh();
  const { root, model } = meshData;
  root.name = "CultistMessenger";
  root.visible = false;
  scene.add(root);

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
export function triggerCultistMessenger(player, scene, world, isEvilAction = true) {
  if (!player || !scene) return;
  const messenger = _ensureMessenger(scene);
  if (!messenger || messenger.visible) return; // Não sobrepõe mensageiros

  const px = player.x ?? player.position?.x ?? 0;
  const py = player.root?.position?.y ?? 0;
  const pz = player.z ?? player.position?.z ?? 0;
  const rotY = player.model?.rotation?.y ?? 0;

  // Spawna a ~11 metros com leve desvio para surgir no campo visual do jogador
  const spawnAngle = rotY + (Math.random() < 0.5 ? 0.35 : -0.35);
  _spawnVec.set(Math.sin(spawnAngle) * 11, 0, Math.cos(spawnAngle) * 11);
  const mx = px + _spawnVec.x;
  const mz = pz + _spawnVec.z;
  const my = world ? world.heightAt(mx, mz) : py;

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
