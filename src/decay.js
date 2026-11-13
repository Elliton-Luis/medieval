import * as THREE from "three";
import { buildCultistMesh, CultState, CULT_ALTARS } from "./cult.js";
import { spawnWaypointMarker, getEvilPercent } from "./rpg.js";
import { showVictoryEndingModal } from "./gameEndingScreen.js";
import { EventBus, GAME_EVENTS } from "./EventBus.js";
import { finalizeMonster } from "./monsterParts.js";

// ============================================================================
// 1. Estado Global do Fim dos Tempos (WorldDecay)
// ============================================================================
export const WorldDecay = {
  daysPassed: 1, // Inicia no Dia 1
  decayLevel: 0.0, // 0.0 (Normal) a 1.0 (Apocalipse)
  isEclipse: false,
  eclipseDayRemaining: 0,
  scheduledEclipseDays: [], // Dias de eclipse sorteados (sempre > Dia 4)
  eclipsesExperienced: 0,   // Contagem de eclipses já ocorridos
  lightningTimer: 14.0,     // Tempo até o próximo raio apocalíptico
  pendingLightning: null,   // Ponto de aviso prévio de faíscas (1s antes)

  reduceDecay(amount, reason = "") {
    const prev = this.decayLevel;
    this.decayLevel = Math.max(0, this.decayLevel - amount);
    EventBus.emit(GAME_EVENTS.CORRUPTION_CHANGED, { level: this.decayLevel, delta: this.decayLevel - prev, reason });
  },

  addDecay(amount, reason = "") {
    const prev = this.decayLevel;
    this.decayLevel = Math.min(1.0, this.decayLevel + amount);
    EventBus.emit(GAME_EVENTS.CORRUPTION_CHANGED, { level: this.decayLevel, delta: this.decayLevel - prev, reason });
  },

  setDay(dayNumber, ui = null) {
    const d = Math.max(1, Math.round(Number(dayNumber) || 1));
    this.daysPassed = d;
    const isTodayEclipse = Array.isArray(this.scheduledEclipseDays) && this.scheduledEclipseDays.includes(d);
    this.isEclipse = Boolean(isTodayEclipse);
    const uiRef = ui || window.__game?.ui;
    if (uiRef?.showToast) {
      uiRef.showToast(`📅 Dia alterado para o Dia ${d}${this.isEclipse ? " · 🌑 ECLIPSE TOTAL!" : ""}`);
    }
    return d;
  },

  /**
   * Sorteia ao menos 1 dia de eclipse estritamente DEPOIS do dia 4 (dia >= 5).
   * Pode ser 1 ou mais dias. Como o final com maldade > 90% pode acontecer no dia 7,
   * o primeiro dia sorteado é estrategicamente agendado no dia 5 ou 6.
   */
  initEclipseSchedule() {
    if (this.scheduledEclipseDays && this.scheduledEclipseDays.length > 0) return;
    const firstDay = Math.random() < 0.5 ? 5 : 6; // Dia 5 ou 6 (após dia 4)
    this.scheduledEclipseDays = [firstDay];
    // Sorteia se haverá mais dias de eclipse (pode ser 1 ou mais)
    if (Math.random() < 0.65) {
      const secondDay = 10 + Math.floor(Math.random() * 5); // Dia 10, 11, 12, 13 ou 14
      this.scheduledEclipseDays.push(secondDay);
    }
  },

  restore(saved) {
    if (!saved) return;
    if (typeof saved.daysPassed === "number") this.daysPassed = saved.daysPassed;
    if (typeof saved.decayLevel === "number") this.decayLevel = saved.decayLevel;
    if (typeof saved.isEclipse === "boolean") this.isEclipse = saved.isEclipse;
    if (typeof saved.eclipsesExperienced === "number") this.eclipsesExperienced = saved.eclipsesExperienced;
    if (Array.isArray(saved.eclipseDays) && saved.eclipseDays.length > 0) {
      this.scheduledEclipseDays = saved.eclipseDays;
    } else {
      this.initEclipseSchedule();
    }
  },
};

WorldDecay.initEclipseSchedule();

/**
 * Validação estrita das regras do Final do Demiurgo:
 * 1. Deve ter acontecido AO MENOS 1 DIA DE ECLIPSE antes do cataclismo.
 * 2. Se maldade > 90%: pode acontecer a partir do Dia 7.
 * 3. Se maldade <= 90%: só pode acontecer estritamente DEPOIS do Dia 15 (Dia 16+).
 */
export function canDemiurgeCataclysmTrigger() {
  if (WorldDecay.demiurgePrevented) {
    return false; // Grão-Mestre Morvath foi derrotado, impedindo a chegada do Demiurgo
  }

  if ((WorldDecay.eclipsesExperienced || 0) < 1) {
    return false; // Obrigatório: ao menos 1 eclipse precisa ter acontecido antes
  }

  // Trava de Endless Survival: O apocalipse SÓ ocorre se a Barra Global de Corrupção atingir o limite (100% / 1.0)
  if (WorldDecay.decayLevel < 0.99) {
    return false;
  }

  const evil = typeof getEvilPercent === "function" ? getEvilPercent() : 50;
  const day = WorldDecay.daysPassed;

  // Se maldade acima de 90%, permitido a partir do dia 7
  if (evil > 90) {
    return day >= 7;
  }

  // Caso contrário, só pode acontecer depois do dia 15
  return day > 15;
}

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

  if (DemiurgeCataclysm.active) {
    // Durante o Cataclismo do Demiurgo (final mal), zera a neblina completamente
    // para que a abóbada de olhos e a descida do Sol Negro fiquem 100% visíveis
    if (scene.fog) {
      scene.fog.density = 0;
    }
    const isNight = dayNight.isNight;
    const eclipseBg = isNight ? _eclipseSkyNight : _eclipseSkyDay;
    if (scene.background) scene.background.copy(eclipseBg);
    if (renderer) renderer.setClearColor(eclipseBg);
    return;
  }

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
      // o eclipse nunca deixa a névoa mais rala que o piso dramático; respeita níveis de neblina mais densos
      scene.fog.density = Math.max(scene.fog.density, 0.012 + decay * 0.008);
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
      // A decadência ENGROSSA a névoa que o ciclo dia/noite e os níveis de neblina já definiram (antes ela
      // sobrescrevia a densidade com valores fixos e os níveis/horários deixavam de ter efeito).
      scene.fog.density *= isNight ? 1 + decay * 0.1 : 1 + decay * 0.5;
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
  WorldDecay.initEclipseSchedule();

  // 1. Finaliza eclipse anterior se estava ativo no dia passado
  if (WorldDecay.isEclipse) {
    WorldDecay.isEclipse = false;
    WorldDecay.eclipseDayRemaining = 0;
    ui?.showToast?.("✦ O sangue arrefece no horizonte. O Eclipse cessou por ora.");
  }

  // 2. Verifica se hoje é um dos dias agendados de Eclipse (> Dia 4)
  const isTodayEclipse = WorldDecay.scheduledEclipseDays.includes(WorldDecay.daysPassed);
  if (isTodayEclipse) {
    WorldDecay.isEclipse = true;
    WorldDecay.eclipseDayRemaining = 1; // 1 ciclo completo de 24h
    WorldDecay.eclipsesExperienced = (WorldDecay.eclipsesExperienced || 0) + 1;
    ui?.showToast?.("🌑 O Olho do Demiurgo se abre! O Sol sangra no firmamento... O Eclipse começou!");
    if (effects && world) {
      effects.play("star", 0, 10, 0, "#ff2211", 3.0);
    }
  }

  // 3. Aumenta corrupção progressiva diária (apenas +0.045 por dia, permitindo sobrevivência infinita via ações do jogador)
  WorldDecay.addDecay(0.045, "DAILY_TICK");
  const currentApocalypseChance = CultState?.addApocalypseProgress?.(5) || 0;

  // 4. Eventos Orgânicos de Suspense por Âncoras (sem calendário fixo)
  triggerOrganicVillageEvents(ui, effects);

  // 5. Avaliação estrita do Fim dos Tempos (Descida do Demiurgo):
  // Regra do Usuário:
  // - Requisito preliminar: deve ter ocorrido ao menos 1 eclipse antes.
  // - Trava de Endless Survival: Barra Global de Corrupção no limite (100%).
  // - Se maldade > 90%: pode acontecer a partir do Dia 7.
  // - Se maldade <= 90%: só pode acontecer estritamente depois do Dia 15.
  if (canDemiurgeCataclysmTrigger() && !WorldDecay.isEclipse) {
    const evil = typeof getEvilPercent === "function" ? getEvilPercent() : 50;
    const triggerChance = evil > 90 ? Math.max(35, currentApocalypseChance) : currentApocalypseChance;
    const rollApocalypse = Math.random() * 100 < triggerChance;
    if (rollApocalypse && window.__game) {
      triggerDemiurgeCataclysm(window.__game);
    }
  }

  // Degradação silenciosa de flora e fauna (Zero-GC)
  applyFloraAndFaunaDecay(world, npcs, horses);
}

/**
 * Dispara eventos orgânicos de suspense na virada da noite (baseados em testes de probabilidade PRNG).
 */
export function triggerOrganicVillageEvents(ui, effects) {
  // 1. O Sacrifício: Animais têm chance procedural de amanhecerem mortos em seus currais com sangue
  if (Math.random() < 0.28 && window.__game?.farmAnimals) {
    const victim = window.__game.farmAnimals.triggerSacrificeEvent();
    if (victim) {
      ui?.showToast?.("🩸 O Sacrifício: Um animal amanheceu massacrado no curral! O terror toma a vila.");
      WorldDecay.addDecay(0.025, "ANIMAL_SACRIFICED");
      EventBus.emit(GAME_EVENTS.ANIMAL_SACRIFICED, { victim });
    }
  }

  // 2. A Peste: NPCs têm chance procedural de amanhecerem doentes (sick = true)
  if (Math.random() < 0.22 && window.__game?.npcs?.npcs) {
    const villagers = window.__game.npcs.npcs.filter((n) => n.alive && !n.isDead && !n.sick && n.type === "villager");
    if (villagers.length > 0) {
      const sickNpc = villagers[Math.floor(Math.random() * villagers.length)];
      sickNpc.sick = true;
      sickNpc.task = "Acometido pela Peste Negra! (Ofereça uma Poção [E])";
      ui?.showToast?.(`☣ A Peste: ${sickNpc.name || "Um aldeão"} adoeceu gravemente! Ajude-o com uma poção.`);
      WorldDecay.addDecay(0.03, "NPC_SICK");
      EventBus.emit(GAME_EVENTS.NPC_SICK, { npc: sickNpc });
    }
  }

  // 3. O Colapso do Sino de Bronze da Igreja: Se a corrupção estiver alta (> 35%), chance de desabar da torre
  if (WorldDecay.decayLevel > 0.35 && Math.random() < 0.2 && window.__game?.villageGenerator?.bells) {
    const intactBells = window.__game.villageGenerator.bells.filter((b) => b.state === "intact");
    if (intactBells.length > 0) {
      const bell = intactBells[Math.floor(Math.random() * intactBells.length)];
      bell.collapse();
    }
  }
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
  const _msgParts = {
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
  finalizeMonster(root, _msgParts);
  return _msgParts;
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
    fog: false,
  });
  const matWing = new THREE.MeshStandardMaterial({
    color: wingColor,
    emissive: wingColor,
    emissiveIntensity: 2.8,
    roughness: 0.3,
    metalness: 0.15,
    side: THREE.DoubleSide,
    fog: false,
  });
  const matEyes = new THREE.MeshBasicMaterial({
    color: eyeColor,
    fog: false,
  });
  const matPupilDot = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    fog: false,
  });
  const matBlade = new THREE.MeshStandardMaterial({
    color: 0x110d18,
    emissive: wingColor,
    emissiveIntensity: 1.4,
    metalness: 0.9,
    roughness: 0.2,
    fog: false,
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

  const _angelParts = { root, model, wingGroupL, wingGroupR, scytheGroup };
  return _angelParts;
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

  // 1. Materiais do Sol Negro e Vazio Abissal (fog: false para nunca ser ocultado pela neblina)
  const matVoidCore = new THREE.MeshBasicMaterial({
    color: 0x010002,
    fog: false,
  });

  const matDarkPlasma = new THREE.MeshStandardMaterial({
    color: 0x16021f,
    emissive: 0x2e0238,
    emissiveIntensity: 1.8,
    roughness: 0.9,
    transparent: true,
    opacity: 0.92,
    flatShading: true,
    fog: false,
  });

  const matCoronaCrimson = new THREE.MeshBasicMaterial({
    color: 0x880018,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    fog: false,
  });

  const matCoronaViolet = new THREE.MeshBasicMaterial({
    color: 0x3d005e,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    fog: false,
  });

  const matScleraTrio = new THREE.MeshStandardMaterial({
    color: 0xf0ebe1,
    emissive: 0x3d0408,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    fog: false,
  });

  const matIrisTrio = new THREE.MeshStandardMaterial({
    color: 0xff0025,
    emissive: 0xdd001a,
    emissiveIntensity: 3.8,
    roughness: 0.15,
    fog: false,
  });

  const matSlitBlack = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });

  // 2. Núcleo Amorfo do Sol Negro (diâmetro ~28m)
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(14.0, 24, 18), matVoidCore);
  blackSunGroup.add(coreMesh);

  // Nuvens e massas de matéria escura amorfa pulsante orbitando o núcleo (otimizado: 5 blobs)
  const amorphousBlobs = [];
  for (let b = 0; b < 5; b++) {
    const blob = new THREE.Mesh(new THREE.DodecahedronGeometry(10.5 + (b % 3) * 1.8, 1), matDarkPlasma);
    const ang = (b / 5) * Math.PI * 2;
    blob.position.set(Math.cos(ang) * 6.5, (b % 2 === 0 ? 3.5 : -3.5), Math.sin(ang) * 6.5);
    blob.rotation.set(b * 0.7, b * 1.2, b * 0.5);
    blackSunGroup.add(blob);
    amorphousBlobs.push(blob);
  }

  // 3. Coroa de Espículas e Prominências Cósmicas Flamejantes (otimizado: 16 espículas)
  const coronaSpikes = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
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
  background: transparent;
  text-shadow: 0 0 45px #ff0022, 0 0 95px #880011, 0 8px 24px #000;
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
 * Geometrias e materiais compartilhados dos Olhos do Firmamento.
 * Ultra-leve: aloca 1 única vez, compartilha entre todos os olhos, sem PointLights e com fog: false.
 */
let _sharedEyeBallGeom = null;
let _sharedIrisGeom = null;
let _sharedIrisRingGeom = null;
let _sharedSlitGeom = null;
let _matScleraShared = null;
let _matPupilShared = null;
let _matIrisRingShared = null;
const _irisMatCache = new Map();

function _initSharedEyeResources() {
  if (_sharedEyeBallGeom) return;
  _sharedEyeBallGeom = new THREE.SphereGeometry(1.0, 16, 12);
  _sharedIrisGeom = new THREE.CircleGeometry(0.48, 20);
  _sharedIrisRingGeom = new THREE.RingGeometry(0.44, 0.52, 20);

  const slitShape = new THREE.Shape();
  const sw = 0.48 * 0.22;
  const sh = 0.48 * 1.35;
  slitShape.moveTo(0, sh * 0.5);
  slitShape.lineTo(sw * 0.5, 0);
  slitShape.lineTo(0, -sh * 0.5);
  slitShape.lineTo(-sw * 0.5, 0);
  slitShape.closePath();
  _sharedSlitGeom = new THREE.ShapeGeometry(slitShape);

  _matScleraShared = new THREE.MeshBasicMaterial({
    color: 0xedebe4,
    fog: false,
  });
  _matPupilShared = new THREE.MeshBasicMaterial({
    color: 0x000000,
    fog: false,
  });
  _matIrisRingShared = new THREE.MeshBasicMaterial({
    color: 0x330006,
    fog: false,
  });
}

function _getIrisMaterial(color) {
  if (!_irisMatCache.has(color)) {
    _irisMatCache.set(color, new THREE.MeshBasicMaterial({
      color: color,
      fog: false,
    }));
  }
  return _irisMatCache.get(color);
}

/**
 * Olho do Firmamento colossal com pupila reptiliana vertical pontiaguda.
 * Otimizado: geometria compartilhada, fog: false para visão cristalina no céu, zero PointLights.
 */
export function buildFirmamentEyeMesh(color = 0xd91624, radius = 9) {
  _initSharedEyeResources();
  const root = new THREE.Group();
  root.name = "FirmamentReptilianEye";

  const eyeBall = new THREE.Mesh(_sharedEyeBallGeom, _matScleraShared);
  root.add(eyeBall);

  const irisMat = _getIrisMaterial(color);
  const iris = new THREE.Mesh(_sharedIrisGeom, irisMat);
  iris.position.set(0, 0, 0.97);
  root.add(iris);

  const irisRing = new THREE.Mesh(_sharedIrisRingGeom, _matIrisRingShared);
  irisRing.position.set(0, 0, 0.98);
  root.add(irisRing);

  const slitMesh = new THREE.Mesh(_sharedSlitGeom, _matPupilShared);
  slitMesh.position.set(0, 0, 0.99);
  root.add(slitMesh);

  root.scale.setScalar(radius);

  return { root, eyeBall, iris, slit: slitMesh, radius };
}

/**
 * Sistema de Chuva de Sangue Apocalíptica (60 FPS, ultra leve, 1 draw call, partículas carmesins).
 */
class BloodRainSystem {
  constructor(scene, count = 900) {
    this.scene = scene;
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count);
    this.active = false;

    for (let i = 0; i < count; i++) {
      this.positions[i * 3 + 0] = (Math.random() - 0.5) * 44;
      this.positions[i * 3 + 1] = Math.random() * 26;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 44;
      this.velocities[i] = 24 + Math.random() * 12;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    // Textura de gota de sangue vertical alongada (procedural via Canvas)
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(8, 0, 8, 32);
    grad.addColorStop(0, "rgba(255, 30, 50, 0.95)");
    grad.addColorStop(0.7, "rgba(180, 0, 20, 0.9)");
    grad.addColorStop(1, "rgba(90, 0, 10, 0.2)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(8, 16, 5, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    const dropTexture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      color: 0xff1128,
      size: 0.9,
      map: dropTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.NormalBlending,
      fog: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    if (scene) scene.add(this.points);
  }

  start(px, py, pz) {
    this.active = true;
    this.points.visible = true;
    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3 + 0] = px + (Math.random() - 0.5) * 44;
      this.positions[i * 3 + 1] = py + Math.random() * 26;
      this.positions[i * 3 + 2] = pz + (Math.random() - 0.5) * 44;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  update(dt, px, py, pz) {
    if (!this.active || !this.points.visible) return;
    const pos = this.positions;
    const v = this.velocities;
    const minHeight = py - 0.8;
    const maxHeight = py + 26;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      pos[idx + 1] -= v[i] * dt;

      const dx = pos[idx] - px;
      const dz = pos[idx + 2] - pz;
      if (pos[idx + 1] < minHeight || Math.abs(dx) > 24 || Math.abs(dz) > 24) {
        pos[idx] = px + (Math.random() - 0.5) * 44;
        pos[idx + 1] = maxHeight + Math.random() * 4;
        pos[idx + 2] = pz + (Math.random() - 0.5) * 44;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  stop() {
    this.active = false;
    this.points.visible = false;
  }
}

let _bloodRain = null;
function _getBloodRain(scene) {
  if (!_bloodRain && scene) {
    _bloodRain = new BloodRainSystem(scene, 900);
  }
  return _bloodRain;
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
  impactTime: 0,
  modalShown: false,
  destroyed: false,
  env: null,
};

let _abyssOverlayEl = null;

function _showAbyssVoidOverlay() {
  if (!_abyssOverlayEl) {
    _abyssOverlayEl = document.getElementById("demiurge-abyss-overlay");
    if (!_abyssOverlayEl) {
      _abyssOverlayEl = document.createElement("div");
      _abyssOverlayEl.id = "demiurge-abyss-overlay";
      _abyssOverlayEl.style.cssText = `
        position: fixed;
        inset: 0;
        background: #000000;
        z-index: 99998;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.22s ease-in-out;
      `;
      document.body.appendChild(_abyssOverlayEl);
    }
  }
  requestAnimationFrame(() => {
    if (_abyssOverlayEl) _abyssOverlayEl.style.opacity = "1";
  });
}

/**
 * Descarrega e oculta todas as entidades do mundo durante o cataclismo para travar o jogo a 60 FPS:
 * Mantém apenas o terreno imediato, os 8 anjos malignos, os 10 olhos, o sol negro e o céu.
 */
export function isolateDemiurgeCataclysmScene(env) {
  if (!env) return;
  const { world, player, npcs, houses, settlement, beasts, clutter, farmAnimals, farming, torches, villageGenerator, horses, weapons } = env;

  if (world) {
    world.cataclysmIsolated = true;
    const px = player?.x ?? 0;
    const pz = player?.z ?? 0;
    world.updateVisibility(env.camera || world.camera, px, pz, false);
  }

  if (npcs?.group) npcs.group.visible = false;
  if (houses?.group) houses.group.visible = false;
  if (settlement?.group) settlement.group.visible = false;
  if (beasts?.group) beasts.group.visible = false;
  if (clutter?.group) clutter.group.visible = false;
  if (farmAnimals?.group) farmAnimals.group.visible = false;
  if (farming?.group) farming.group.visible = false;
  if (villageGenerator?.group) villageGenerator.group.visible = false;
  if (horses?.group) horses.group.visible = false;
  if (torches?.group) torches.group.visible = false;
  if (torches?.impostorMesh) torches.impostorMesh.visible = false;
  if (torches?.lights) {
    for (let i = 0; i < torches.lights.length; i++) torches.lights[i].intensity = 0;
  }
  if (weapons?.playerBuildingsPool) {
    for (let b of weapons.playerBuildingsPool) {
      if (b) b.visible = false;
    }
  }

  const gameRoot = document.getElementById("game");
  if (gameRoot) gameRoot.classList.add("wasted");
}

/**
 * Inicia o Fim dos Tempos: Descida do Demiurgo à Terra.
 * @param {object} env
 * @param {boolean} [force=false] - Se true, bypassa as travas de dia/eclipse (ex: Cheat Menu)
 */
export function triggerDemiurgeCataclysm(env, force = false) {
  if (DemiurgeCataclysm.active) return;
  if (!force && !canDemiurgeCataclysmTrigger()) return;
  DemiurgeCataclysm.active = true;
  DemiurgeCataclysm.timer = 0;
  DemiurgeCataclysm.lastDescentSound = 0;
  DemiurgeCataclysm.bannerShown = false;
  DemiurgeCataclysm.eyesOpened = true; // Olhos abertos e visíveis imediatamente!
  DemiurgeCataclysm.descentStarted = false;
  DemiurgeCataclysm.groundImpactDone = false;
  DemiurgeCataclysm.modalShown = false;
  DemiurgeCataclysm.destroyed = false;
  DemiurgeCataclysm.env = env;

  const { scene, player, dayNight, ui, audio, hemisphere } = env;

  WorldDecay.isEclipse = true;
  if (dayNight) {
    dayNight.progress = 0.5; // Meia-noite do Eclipse
    if (dayNight.sun) {
      dayNight.sun.color.setHex(0xcc1111);
      dayNight.sun.intensity = 1.2;
    }
  }

  // Banha o mundo em luz carmesim profunda sem custo de shader
  if (hemisphere) {
    hemisphere.color.setHex(0x990011);
    hemisphere.groundColor.setHex(0x220004);
    hemisphere.intensity = 2.5;
  }

  // Tira a neblina completamente para que o céu e os olhos fiquem 100% visíveis
  if (scene && scene.fog) {
    scene.fog.density = 0;
  }

  ui?.showToast?.("🌑 O VÉU DA CRIAÇÃO FOI RASGADO! OS ANJOS MALIGNOS DESCEM!");
  audio?.playBigMonster?.(1.0);
  audio?.demiurgeDescent?.();
  audio?.deathBell?.();

  const px = player?.x ?? 0;
  const pz = player?.z ?? 0;
  const py = player?.root?.position?.y ?? 0;

  // Inicia a chuva de sangue apocalíptica contínua
  const rain = _getBloodRain(scene);
  rain?.start(px, py, pz);

  // Trava controle do jogador para contemplação
  if (player) {
    player.knockedOut = true;
  }

  // Descarrega tudo o que for desnecessário do mundo para garantir 60 FPS puros
  isolateDemiurgeCataclysmScene(env);

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

  // 2. Spawna EXATAMENTE 10 Olhos Colossais BEM PERTO nos céus, olhando diretamente para o jogador
  DemiurgeCataclysm.firmamentEyes = [];
  const colors = [0xff1133, 0xff7700, 0xee11ee, 0xff0033, 0xdd0022, 0xaa00ee, 0xff3355, 0xcc00ff, 0xff5500, 0xff0055];

  // Anel 1 (Próximo e Envolvente): 7 olhos em círculo a apenas 11-13m de distância e 5.5-8.5m de altura
  for (let k = 0; k < 7; k++) {
    const ang = (k / 7) * Math.PI * 2 + 0.15;
    const dist = 11.5 + (k % 2) * 2.0;
    const eyX = px + Math.cos(ang) * dist;
    const eyZ = pz + Math.sin(ang) * dist;
    const eyY = py + 5.5 + (k % 3) * 1.5;

    const fEye = buildFirmamentEyeMesh(colors[k % colors.length], 4.8);
    fEye.root.position.set(eyX, eyY, eyZ);
    fEye.root.lookAt(px, py + 1.6, pz);
    fEye.root.visible = true;

    if (scene) scene.add(fEye.root);
    DemiurgeCataclysm.firmamentEyes.push(fEye);
  }

  // Anel 2 (Cúpula Superior / Zênite): 3 olhos a apenas 5.5-7.5m de raio e 11-13m de altura
  for (let k = 0; k < 3; k++) {
    const ang = (k / 3) * Math.PI * 2 + 0.4;
    const dist = 5.5 + (k % 2) * 2.0;
    const eyX = px + Math.cos(ang) * dist;
    const eyZ = pz + Math.sin(ang) * dist;
    const eyY = py + 11.0 + (k % 2) * 2.0;

    const fEye = buildFirmamentEyeMesh(colors[(k + 7) % colors.length], 6.2);
    fEye.root.position.set(eyX, eyY, eyZ);
    fEye.root.lookAt(px, py + 1.6, pz);
    fEye.root.visible = true;

    if (scene) scene.add(fEye.root);
    DemiurgeCataclysm.firmamentEyes.push(fEye);
  }

  // 3. Spawna o Olho Colossal do Demiurgo próximo nos céus (py + 52m para visão imediata e imponente)
  const eyeData = buildDemiurgeColossalEyeMesh();
  eyeData.root.position.set(px, py + 52, pz);
  eyeData.targetY = py + 0.8;
  if (scene) scene.add(eyeData.root);
  DemiurgeCataclysm.colossalEye = eyeData;

  // 4. Cria anel de onda de choque no solo para o impacto
  const shockMat = new THREE.MeshBasicMaterial({
    color: 0xff2244,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
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
 * Atualiza o Cataclismo a cada frame com progressão cinematográfica dramática e suave.
 */
export function updateDemiurgeCataclysm(dt, env) {
  if (!DemiurgeCataclysm.active) return;
  DemiurgeCataclysm.timer += dt;
  const t = DemiurgeCataclysm.timer;
  const { player, cameraRig, effects, audio, scene, hemisphere } = env;
  const px = player?.x ?? 0;
  const pz = player?.z ?? 0;
  const py = player?.root?.position?.y ?? 0;

  // Atualiza a chuva contínua de sangue ao redor do jogador
  _bloodRain?.update(dt, px, py, pz);

  // Garante que a neblina permaneça desativada em todos os frames do cataclismo
  if (scene && scene.fog && scene.fog.density > 0) {
    scene.fog.density = 0;
  }

  // Pulso de luz carmesim apocalíptica no céu
  if (hemisphere) {
    hemisphere.intensity = 2.2 + Math.sin(t * 5.0) * 0.7;
  }

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

    if (Math.random() < 0.08 && effects) {
      const col = i % 2 === 1 ? "#aa22ee" : "#ff1a33";
      effects.play("star", a.root.position.x, a.root.position.y + 1.6, a.root.position.z, col, 1.2);
    }
  }

  // FASE 2 (t = 2.5s a 6.0s): Título cinematográfico "ELE ESTÁ VINDO"
  if (t >= 2.5 && !DemiurgeCataclysm.bannerShown) {
    DemiurgeCataclysm.bannerShown = true;
    _showHeIsComingBanner();
    audio?.deathBell?.();
    if (cameraRig?.shakeAt) {
      cameraRig.shakeAt(px, pz, 0.6, px, pz);
    }
  }

  if (t >= 6.0 && _heIsComingEl) {
    _hideHeIsComingBanner();
  }

  // Inclinação suave da câmera para o céu para enquadrar a abóbada de olhos e a descida
  if (cameraRig) {
    cameraRig.pitch = THREE.MathUtils.lerp(cameraRig.pitch, -0.32, dt * 1.5);
  }

  // Atualização dos 10 Olhos no Céu: SEMPRE olhando diretamente para os olhos do jogador
  for (let k = 0; k < DemiurgeCataclysm.firmamentEyes.length; k++) {
    const fEye = DemiurgeCataclysm.firmamentEyes[k];
    fEye.root.lookAt(px, py + 1.6, pz);
    if (fEye.slit) {
      fEye.slit.scale.x = 0.85 + Math.sin(t * 3.0 + k) * 0.45;
    }
  }

  // FASE 4 (t >= 14.0s): O Demiurgo desce com fúria total
  if (t >= 14.0) {
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
      const fallProgress = (t - 14.0);
      const descentSpeed = THREE.MathUtils.clamp(0.6 + fallProgress * 0.35, 0.6, 3.8);
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

      // Tremores de terra crescentes conforme o Olho cai
      if (cameraRig?.shakeAt) {
        const shakeAmt = THREE.MathUtils.clamp(0.3 + fallProgress * 0.3, 0.3, 2.5);
        cameraRig.shakeAt(px, pz, shakeAmt, px, pz);
      }

      // Impacto Colossal do Demiurgo no solo (t >= 19.5s ou proximidade do solo)
      if ((t >= 19.5 || eye.root.position.y <= py + 2.5) && !DemiurgeCataclysm.groundImpactDone) {
        DemiurgeCataclysm.groundImpactDone = true;
        DemiurgeCataclysm.impactTime = t;
        audio?.colossalImpact?.();
        audio?.explosion?.(px, pz, 30.0);
        audio?.deathBell?.();

        if (cameraRig?.shakeAt) {
          cameraRig.shakeAt(px, pz, 4.5, px, pz);
        }

        // 1. "faça que não dê para vê nada": Blecaute instantâneo total da tela
        _showAbyssVoidOverlay();

        // 2. "eu tomo muito dano mas ao invés de morrer, acaba o jogo":
        if (env.damageFx?.triggerFlash) {
          env.damageFx.triggerFlash("critical");
        }
        if (player) {
          player.health = 1; // Dano devastador sem zerar (evita tela de morte comum / respawn)
          player.dead = false;
          player.knockedOut = true;
        }

        // Ativa onda de choque devastadora
        if (DemiurgeCataclysm.shockwave) {
          DemiurgeCataclysm.shockwave.visible = true;
          DemiurgeCataclysm.shockwave.material.opacity = 0.98;
        }

        // Erupção de partículas cósmicas leve
        if (effects) {
          for (let k = 0; k < 12; k++) {
            const ang = (k / 12) * Math.PI * 2;
            const rad = 6 + Math.random() * 22;
            effects.play("dust", px + Math.cos(ang) * rad, py + 0.5, pz + Math.sin(ang) * rad, "#220533", 4.0);
            effects.play("star", px + Math.cos(ang) * rad, py + 1.2, pz + Math.sin(ang) * rad, "#ff6600", 2.5);
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

  // FASE 5: Logo após o impacto e o blecaute total (1.2s), acaba o jogo definitivamente
  if (DemiurgeCataclysm.groundImpactDone && !DemiurgeCataclysm.destroyed) {
    if (t - DemiurgeCataclysm.impactTime >= 1.2) {
      DemiurgeCataclysm.destroyed = true;
      _bloodRain?.stop();

      // Fim definitivo do jogo: a tela de encerramento do Demiurgo se abre diretamente sobre o vazio
      showVictoryEndingModal({
        type: "DEMIURGE",
        title: "O FIM DA CRIAÇÃO MATERIAL",
        subtitle: "A TERRA E A MATÉRIA FORAM TOTALMENTE CONSUMIDAS",
        quote: "«O Demiurgo colidiu contra a terra e consumiu o mundo na pureza do nada. O cárcere da carne ruiu para sempre. Não há mais terra, corpos ou sofrimento.»",
      });
    }
  }
}
