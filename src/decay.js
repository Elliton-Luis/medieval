import * as THREE from "three";
import { buildCultistMesh, CultState, CULT_ALTARS } from "./cult.js?v=20";
import { spawnWaypointMarker } from "./rpg.js?v=20";

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

function _ensureMessenger(scene) {
  if (_messengerNPC || !scene) return _messengerNPC;

  const { root, model } = buildCultistMesh();
  root.name = "CultistMessenger";
  root.visible = false;
  scene.add(root);

  _messengerNPC = {
    root,
    model,
    x: 0,
    z: 0,
    visible: false,
    state: "IDLE",
    isEvilMessage: false,
    timer: 0,
    floatPhase: 0,
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

  // Spawna exatamente às costas da visão do jogador a 10 metros
  _spawnVec.set(0, 0, -10).applyEuler(new THREE.Euler(0, rotY, 0));
  const mx = px + _spawnVec.x;
  const mz = pz + _spawnVec.z;
  const my = world ? world.heightAt(mx, mz) : py;

  messenger.x = mx;
  messenger.z = mz;
  messenger.root.position.set(mx, my, mz);
  messenger.root.visible = true;
  messenger.visible = true;
  messenger.state = "APPROACH_PLAYER";
  messenger.isEvilMessage = isEvilAction;
  messenger.timer = performance.now() + 18000; // 18 segundos de timeout
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

export function updateMessenger(dt, player, effects, ui, audio, world) {
  if (!_messengerNPC || !_messengerNPC.visible || !player) return;

  const m = _messengerNPC;
  const now = performance.now();
  m.floatPhase += dt * 3.5;

  const px = player.x ?? player.position?.x ?? 0;
  const pz = player.z ?? player.position?.z ?? 0;
  const dx = px - m.x;
  const dz = pz - m.z;
  const distSq = dx * dx + dz * dz;

  if (m.state === "APPROACH_PLAYER") {
    // Caminha silenciosamente até o jogador deslizando a 2.4 m/s
    const len = Math.hypot(dx, dz) || 1;
    m.x += (dx / len) * (2.4 * dt);
    m.z += (dz / len) * (2.4 * dt);

    const targetYaw = Math.atan2(dx, dz);
    m.model.rotation.y = THREE.MathUtils.lerp(m.model.rotation.y, targetYaw, 0.08);

    const gy = world ? world.heightAt(m.x, m.z) : 0;
    m.root.position.set(m.x, gy + 0.05 + Math.sin(m.floatPhase) * 0.04, m.z);

    // Chegou a 3.2 metros: entrega a profecia cerimonial evolutiva
    if (distSq < 10.24) {
      m.state = "DELIVERED";
      let pool = CULT_MESSAGES.GOOD;
      const level = CultState?.level || 1;
      if (m.isEvilMessage) {
        if (level >= 4) pool = CULT_MESSAGES.EVIL_TIER_4;
        else if (level === 3) pool = CULT_MESSAGES.EVIL_TIER_3;
        else if (level === 2) pool = CULT_MESSAGES.EVIL_TIER_2;
        else pool = CULT_MESSAGES.EVIL_TIER_1;
      }

      const message = pool[Math.floor(Math.random() * pool.length)];
      ui?.showToast?.(`✦ MENSAGEIRO DOS CÁTAROS: ${message}`);
      if (audio?.hit) audio.hit(false);

      // Marca o Altar Ritual fora dos muros no Minimap e com Pilar de Luz
      if (m.isEvilMessage) {
        const altar = CultState?.altarTarget || (CULT_ALTARS && CULT_ALTARS[0]);
        if (altar) {
          spawnWaypointMarker({ x: altar.x, y: altar.y, z: altar.z });
          window.setTimeout(() => {
            ui?.showToast?.(
              `✦ SANTUÁRIO DO DEMIURGO: O Altar nas matas do norte foi marcado em sua bússola! (Seita Nível ${level})`
            );
          }, 1400);
        }
      }

      // Desfaz-se em cinzas e névoa negra após a mensagem
      if (effects) {
        effects.play("dust", m.x, gy + 0.9, m.z, "#16151c", 2.6);
        effects.play("star", m.x, gy + 1.2, m.z, "#7722bb", 1.8);
      }
      m.visible = false;
      m.root.visible = false;
    }
  }

  // Timeout de segurança se travar no relevo
  if (now > m.timer && m.visible) {
    m.visible = false;
    m.root.visible = false;
    if (effects) {
      effects.play("dust", m.x, m.root.position.y + 0.9, m.z, "#16151c", 2.0);
    }
  }
}
