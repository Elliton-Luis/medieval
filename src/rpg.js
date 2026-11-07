import * as THREE from "three";
import { canPlace as _canPlaceFootprint, reserve as _reserveFootprint, release as _releaseFootprint } from "./placement.js";
import { triggerCultistMessenger, WorldDecay } from "./decay.js";
import { CultState } from "./cult.js";

// ============================================================================
// 1. Parâmetros e Cache de Vetores (Zero-GC)
// ============================================================================
const _dirToCrime = new THREE.Vector3();
const _npcDir = new THREE.Vector3();
const _crimeVec = new THREE.Vector3();
const _npcPos = new THREE.Vector3();
const _victimPos = new THREE.Vector3();
const _baitPos = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _sharedRaycaster = new THREE.Raycaster();

export const NPC_TYPES = { VILLAGER: 0, GUARD: 1, BANDIT: 2 };
export const NPC_STATES = { IDLE: 0, WORK: 1, SLEEP: 2, STEAL: 3, FLEE: 4 };

// Referências globais conectadas na inicialização (para spawnLoot, triggerWantedLevel, terreno, etc.)
const _env = {
  scene: null,
  world: null,
  npcs: null,
  drops: null,
  player: null,
  ui: null,
  effects: null,
  audio: null,
  weapons: null,
  candle: null,
  horses: null,
  settlement: null,
};

export function setRpgEnv(env) {
  if (!env) return;
  Object.assign(_env, env);
}

// Pool pré-alocado de meshes de feno (Zero-GC ao largar iscas no cenário)
const HAY_POOL_SIZE = 8;
const _hayPool = [];
let _hayPoolCursor = 0;

function _initHayPool(scene) {
  if (_hayPool.length > 0 || !scene) return;
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd8b458, roughness: 0.92, metalness: 0 });
  const twineMat = new THREE.MeshStandardMaterial({ color: 0x6b4c2b, roughness: 0.9, metalness: 0 });
  const mainGeo = new THREE.BoxGeometry(0.68, 0.34, 0.48);
  const strawGeo = new THREE.ConeGeometry(0.18, 0.24, 5);
  const strapGeo = new THREE.BoxGeometry(0.7, 0.36, 0.04);

  for (let i = 0; i < HAY_POOL_SIZE; i++) {
    const group = new THREE.Group();
    const bale = new THREE.Mesh(mainGeo, hayMat);
    bale.position.y = 0.17;
    bale.castShadow = false;
    bale.receiveShadow = true;
    group.add(bale);

    const strap1 = new THREE.Mesh(strapGeo, twineMat);
    strap1.position.set(0, 0.17, 0.14);
    group.add(strap1);

    const strap2 = new THREE.Mesh(strapGeo, twineMat);
    strap2.position.set(0, 0.17, -0.14);
    group.add(strap2);

    const tuft = new THREE.Mesh(strawGeo, hayMat);
    tuft.position.set(0.22, 0.36, 0.08);
    tuft.rotation.z = -0.35;
    group.add(tuft);

    group.visible = false;
    group.userData.isHayBait = true;
    group.userData.active = false;
    group.userData.spawnTime = 0;
    scene.add(group);
    _hayPool.push(group);
  }
}

export function getHayFromPool() {
  if (_hayPool.length === 0 && _env.scene) _initHayPool(_env.scene);
  if (_hayPool.length === 0) {
    const fallback = new THREE.Group();
    fallback.userData = { isHayBait: true, active: true, spawnTime: performance.now() };
    return fallback;
  }
  for (let i = 0; i < _hayPool.length; i++) {
    const candidate = _hayPool[i];
    if (!candidate.visible) {
      candidate.visible = true;
      candidate.userData.active = true;
      candidate.userData.spawnTime = performance.now();
      return candidate;
    }
  }
  const reused = _hayPool[_hayPoolCursor % _hayPool.length];
  _hayPoolCursor++;
  reused.visible = true;
  reused.userData.active = true;
  reused.userData.spawnTime = performance.now();
  return reused;
}

// ============================================================================
// 2. Sistema de Atributos do Jogador (PlayerStats) e Inventário de Camponês
// ============================================================================
const TEMPLAR_NEUTRAL = Object.freeze({ dmg: 1, hp: 1, spd: 1, weak: 0 });
const _templarMods = { dmg: 1, hp: 1, spd: 1, weak: 0 };

export const PlayerStats = {
  // Atributos base
  str: 10, // Dano corpo a corpo e capacidade de carga
  con: 10, // Vida máxima (CON * 10) e resistência a hitstun
  cha: 10, // Preços (-2% por ponto acima de 10) e tolerância a crimes menores
  spd: 10, // Multiplicador de velocidade e estamina

  // Status dinâmico
  hp: 100,
  maxHp: 100,
  armorLevel: 0, // 0: Camponês, 1: Couro, 2: Malha, 3: Placas
  gold: 0,
  hay: 0,
  morality: 0, // -100 (Caos/Demiurgo) a +100 (Luz/Bondade)

  // Facção
  isTemplar: false,
  hasBrokenVow: false,
  wearingDemiurgeRobe: false,
  lastConfessionDay: null,

  // Getters otimizados com penalidade de Voto Quebrado e peso de armadura
  // Juramento Templário: com maldade <= 50% => +25% dano, +20% vida máxima, +12% velocidade.
  // Acima de 50% o voto vai apodrecendo de forma contínua: em 100% de maldade o templário rende 65% do dano,
  // 75% da vida e 70% da velocidade. Voto quebrado ou sem juramento => sem modificador (1.0).
  getTemplarMods: () => {
    if (!PlayerStats.isTemplar || PlayerStats.hasBrokenVow) return TEMPLAR_NEUTRAL;
    const w = Math.max(0, Math.min(1, (getEvilPercent() - 50) / 50)); // 0 = puro ... 1 = totalmente corrompido
    _templarMods.dmg = 1.25 + (0.65 - 1.25) * w;
    _templarMods.hp = 1.2 + (0.75 - 1.2) * w;
    _templarMods.spd = 1.12 + (0.7 - 1.12) * w;
    _templarMods.weak = w;
    return _templarMods;
  },
  getMaxHp: () => PlayerStats.con * 10 * PlayerStats.getTemplarMods().hp,
  getMaxHearts: () => Math.max(3, Math.round(PlayerStats.con * 0.5 * PlayerStats.getTemplarMods().hp)),
  getMeleeMult: () => {
    let mult = (1.0 + (PlayerStats.str - 10) * 0.05) * PlayerStats.getTemplarMods().dmg;
    if (PlayerStats.wearingDemiurgeRobe) mult += 0.45; // Poder do Demiurgo (+45%)
    if (PlayerStats.hasBrokenVow) mult *= 0.5; // Fraqueza extrema (-50%)
    return mult;
  },
  getHitstunMult: () => Math.max(0.35, 1.0 - (PlayerStats.con - 10) * 0.04),
  getSpeedMult: () => {
    let mult = (1.0 + (PlayerStats.spd - 10) * 0.03) * PlayerStats.getTemplarMods().spd;
    if (PlayerStats.wearingDemiurgeRobe) mult += 0.25; // Leveza espectral (+25%)
    if (PlayerStats.armorLevel === 3) mult -= 0.15; // Armadura pesada deixa 15% mais lento
    if (PlayerStats.hasBrokenVow) mult *= 0.5; // Punição divina (50% mais lento)
    return mult;
  },
  getPriceMult: () => Math.max(0.5, 1.0 - (PlayerStats.cha - 10) * 0.02),
};

/**
 * Retorna o nível de maldade do jogador em porcentagem (0% a 100%).
 * A escala moral neutra inicial é 0 (Bondade neutra = 50% de maldade).
 * -100 Morality (Puro Caos/Demiurgo) = 100% Maldade.
 * +100 Morality (Pura Luz/Santidade) = 0% Maldade.
 */
export function getEvilPercent() {
  const morality = PlayerStats?.morality ?? 0;
  return Math.max(0, Math.min(100, Math.round(50 - (morality / 2))));
}

const _evilHistory = new Map();
const EVIL_WINDOW_MS = 5 * 60 * 1000; // 5 minutos (300.000 ms)
const MAX_EVIL_REPEATS = 8; // Máximo 8x no período

export function checkMessengerEvilProgression(evil) {
  if (evil < 65) return;
  // O mensageiro só pode aparecer a cada 15% de maldade (a partir de 65%: 65%, 80%, 95%)
  const currentTier = Math.floor((evil - 50) / 15);
  const lastTier = PlayerStats.lastMessengerTier || 0;

  if (currentTier > lastTier) {
    PlayerStats.lastMessengerTier = currentTier;
    const player = _env.player || window.__game?.player;
    const scene = _env.scene || window.__game?.scene;
    const world = _env.world || window.__game?.world;
    if (player && scene) {
      triggerCultistMessenger(player, scene, world, true, true);
    }
  }
}

export function addEvil(amount = 2, reason = null) {
  const now = performance.now();
  const key = reason ? String(reason).trim().toLowerCase() : "geral";

  let history = _evilHistory.get(key) || [];
  history = history.filter((t) => now - t < EVIL_WINDOW_MS);

  const ui = _env.ui || window.__game?.ui;

  // Se já atingiu 8x nos últimos 5 minutos, na 9x já não conta!
  if (history.length >= MAX_EVIL_REPEATS) {
    _evilHistory.set(key, history);
    if (reason && ui) {
      ui.showToast(`🌑 ${reason}: limite de maldade repetida atingido (8x em 5min). Nada somado.`);
    }
    return getEvilPercent();
  }

  // Registra o uso
  history.push(now);
  _evilHistory.set(key, history);

  // A coisa mais má que você pode fazer é 2%
  const effectiveAmount = Math.min(2.0, Math.max(0.1, Number(amount) || 1.0));

  const currentMorality = PlayerStats.morality ?? 0;
  // 1% de maldade = 2 pontos de moralidade
  PlayerStats.morality = Math.max(-100, Math.min(100, currentMorality - effectiveAmount * 2));

  CultState?.addApocalypseProgress?.(effectiveAmount * 0.15);

  const evil = getEvilPercent();

  // O Templário não pode fazer o mal: qualquer ato maligno quebra o voto
  if (PlayerStats.isTemplar && !PlayerStats.hasBrokenVow) {
    PlayerStats.hasBrokenVow = true;
    ui?.showToast?.("⚠️ VOTO TEMPLÁRIO QUEBRADO! O mal não habita um cavaleiro da Ordem. Abata uma fera nas matas para se redimir.");
  }
  syncPlayerStatsToPlayer(); // a vida máxima/dano/velocidade do Templário dependem da maldade

  if (reason && ui) {
    ui.showToast(`🌑 Maldade ${evil}% (+${effectiveAmount.toFixed(1)}%) [${history.length}/${MAX_EVIL_REPEATS} em 5min] · ${reason}`);
  }

  // Verifica se cruzou um novo patamar de 15% (65%, 80%, 95%)
  checkMessengerEvilProgression(evil);

  return evil;
}

export function addGood(amount = 2, reason = null) {
  const currentMorality = PlayerStats.morality ?? 0;
  PlayerStats.morality = Math.max(-100, Math.min(100, currentMorality + amount * 2));

  const evil = getEvilPercent();
  syncPlayerStatsToPlayer();
  const ui = _env.ui || window.__game?.ui;
  if (reason && ui) {
    ui.showToast(`✦ Maldade ${evil}% (-${Math.round(amount)}%) · ${reason}`);
  }
  return evil;
}

export function setEvilPercent(targetPercent, reason = null) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(targetPercent) || 0)));
  PlayerStats.morality = Math.max(-100, Math.min(100, 100 - pct * 2));
  const evil = getEvilPercent();
  syncPlayerStatsToPlayer();
  const ui = _env.ui || window.__game?.ui;
  if (ui) {
    ui.showToast(`⚖️ Índice de Maldade definido para ${evil}%${reason ? ` · ${reason}` : ""}`);
  }
  checkMessengerEvilProgression(evil);
  return evil;
}

/**
 * Atualiza a armadura visualmente sem alocar novos meshes (Zero-GC).
 * Alterna a visibilidade de partes do corpo pré-carregadas.
 */
export function equipArmor(level, player = _env.player) {
  const safeLevel = Math.max(0, Math.min(3, Math.round(level)));
  PlayerStats.armorLevel = safeLevel;
  if (player?.setArmorVisuals) {
    player.setArmorVisuals(safeLevel);
  }
  // 0: 0% | 1: 20% couro | 2: 40% malha | 3: 65% placas
  PlayerEquipment.armorNegationChance = [0.0, 0.20, 0.40, 0.65][safeLevel] || 0.0;
  return safeLevel;
}

/**
 * Consome uma refeição reforçada na taverna.
 * Recupera toda a vida e aumenta organicamente a Constituição (+1 CON = +10 HP).
 */
export function consumeHeartyMeal(player = _env.player, ui = _env.ui, audio = _env.audio) {
  const cost = 15;
  const currentGold = player?.coins ?? PlayerStats.gold;
  if (currentGold < cost) {
    ui?.showToast?.("Moedas insuficientes para a refeição farta da taverna!");
    return false;
  }
  if (player) player.coins -= cost;
  PlayerStats.gold = Math.max(0, currentGold - cost);
  PlayerInventory.gold = PlayerStats.gold;

  // Aumento orgânico permanente de Constituição (+1 CON = +10 HP máx)
  PlayerStats.con += 1;
  PlayerStats.hp = PlayerStats.getMaxHp();
  if (player) {
    player.maxHealth = PlayerStats.getMaxHearts();
    player.health = player.maxHealth;
  }
  syncPlayerStatsToPlayer(player, ui);
  audio?.potion?.();
  ui?.showToast?.(
    `✦ Banquete da Taverna consumido! +1 Constituição permanente (${PlayerStats.con} CON · ${PlayerStats.getMaxHp()} HP) e vida totalmente restaurada!`
  );
  return true;
}

/**
 * Juramento da Ordem dos Cavaleiros Templários na Igreja (exige Carisma >= 15).
 */
export function takeTemplarVow(player = _env.player, ui = _env.ui, audio = _env.audio) {
  if (PlayerStats.cha < 15) {
    ui?.showToast?.("A Ordem dos Templários exige no mínimo 15 de Carisma para o Juramento!");
    return false;
  }
  PlayerStats.isTemplar = true;
  PlayerStats.hasBrokenVow = false;
  equipArmor(3, player);
  syncPlayerStatsToPlayer(player, ui);
  audio?.choir?.();
  ui?.showToast?.(
    "⚔️ Fizeste o Sagrado Juramento dos Templários! Armadura de Placas Completa concedida. Guarda a pureza de teus atos!"
  );
  return true;
}

/**
 * Concede e equipa a Vestimenta Imponente do Demiurgo (Manto, Capa e Máscara).
 */
export function unlockDemiurgeAttire(player = _env.player, ui = _env.ui, audio = _env.audio) {
  PlayerInventory.hasDemiurgeRobe = true;
  return equipDemiurgeAttire(player, ui, audio);
}

export function equipDemiurgeAttire(player = _env.player, ui = _env.ui, audio = _env.audio) {
  PlayerInventory.hasDemiurgeRobe = true;
  PlayerStats.wearingDemiurgeRobe = true;
  addEvil(10, "Pacto do Demiurgo");
  if (player?.setDemiurgeAttire) {
    player.setDemiurgeAttire(true);
  }
  audio?.choir?.();
  ui?.showToast?.(
    "👁️ VESTIMENTA DO DEMIURGO EQUIPADA! Manto negro cerimonial, capa púrpura com forro carmesim e máscara arconte (+5 FOR · +5 CON · +5 CAR · +25% VEL)!"
  );
  syncPlayerStatsToPlayer(player, ui);
  return true;
}

// Novos Controles Sugeridos:
// WASD: Mover | Shift: Correr | Espaço: Pular
// F: Montar/Desmontar | H: Assobiar
// E: Interagir (Falar, Saquear, Abrir Porta)
// Mouse Esq: Usar Ferramenta/Atacar | Mouse Dir: Mirar/Bloquear
// C: Modo Construção (Alterna) | I: Menu de Crafting (Velas/Tochas)
// 1: Mãos | 2: Machado de Lenhador | 3: Picareta | 4: Arma (se comprada)

export const PlayerInventory = {
  gold: 0,
  wood: 0,
  stone: 0,
  clay: 0,
  hay: 0,
  torches: 0,

  // Equipamentos liberados e itens de missão
  hasAxe: true,
  hasPickaxe: true,
  hasSword: false,
  hasQuestItem: false,
  hasDemiurgeRobe: false,
  hasDemiurgeDiary: false,
  hasCollectedGroundBook: false,
  discoveredBookPages: [],
  torchColor: "orange",
  crystals: { green: 0, blue: 0, pink: 0, red: 0, white: 0, purple: 0 },

  craftTorch: () => {
    if (PlayerInventory.wood >= 1 && PlayerInventory.hay >= 1) {
      PlayerInventory.wood--;
      PlayerInventory.hay--;
      PlayerInventory.torches++;
      PlayerStats.hay = PlayerInventory.hay;
      if (_env.weapons) {
        _env.weapons.unlock("torch", true);
        _env.weapons.equip("torch", false);
      }
      if (_env.candle) {
        _env.candle.count++;
        _env.candle._sync?.();
      }
      syncPlayerStatsToPlayer();
      return true;
    }
    return false;
  },

  craftMakeshiftSpear: () => {
    if (PlayerInventory.wood >= 3) {
      PlayerInventory.wood -= 3;
      if (_env.weapons) {
        _env.weapons.unlock("makeshift_spear", true);
        _env.weapons.setWeaponDurability?.("makeshift_spear", 10);
        _env.weapons.equip("makeshift_spear", false);
      }
      _env.audio?.weaponSwing?.("chop", false);
      syncPlayerStatsToPlayer();
      return true;
    }
    return false;
  },

  craftMakeshiftClub: () => {
    if (PlayerInventory.wood >= 2 && PlayerInventory.stone >= 1) {
      PlayerInventory.wood -= 2;
      PlayerInventory.stone -= 1;
      if (_env.weapons) {
        _env.weapons.unlock("makeshift_club", true);
        _env.weapons.setWeaponDurability?.("makeshift_club", 15);
        _env.weapons.equip("makeshift_club", false);
      }
      _env.audio?.weaponSwing?.("smash", false);
      syncPlayerStatsToPlayer();
      return true;
    }
    return false;
  },
};

let _lastSyncedGold = 0;
let _lastSyncedHay = 0;

export function initRPGSystem(env = {}) {
  Object.assign(_env, env);
  if (_env.scene) _initHayPool(_env.scene);
  if (_env.player) {
    PlayerStats.gold = _env.player.coins;
    PlayerInventory.gold = _env.player.coins;
    _lastSyncedGold = _env.player.coins;
    syncPlayerStatsToPlayer(_env.player, _env.ui);
  }
}

export function syncPlayerStatsToPlayer(player = _env.player, ui = _env.ui) {
  if (!player) return;
  const targetMaxHearts = PlayerStats.getMaxHearts();
  if (player.maxHealth !== targetMaxHearts) {
    const diff = targetMaxHearts - player.maxHealth;
    player.maxHealth = targetMaxHearts;
    if (diff > 0) player.health = Math.min(player.maxHealth, player.health + diff);
    else player.health = Math.min(player.maxHealth, player.health);
  }

  // Sincronização bidirecional entre PlayerInventory.gold, PlayerStats.gold e player.coins
  if (PlayerInventory.gold !== _lastSyncedGold) {
    _lastSyncedGold = Math.max(0, Math.round(PlayerInventory.gold));
  } else if (player.coins !== _lastSyncedGold) {
    _lastSyncedGold = Math.max(0, Math.round(player.coins));
  } else if (PlayerStats.gold !== _lastSyncedGold) {
    _lastSyncedGold = Math.max(0, Math.round(PlayerStats.gold));
  }
  PlayerInventory.gold = _lastSyncedGold;
  PlayerStats.gold = _lastSyncedGold;
  player.coins = _lastSyncedGold;

  // Sincronização bidirecional entre PlayerInventory.hay e PlayerStats.hay
  if (PlayerInventory.hay !== _lastSyncedHay) {
    _lastSyncedHay = Math.max(0, Math.round(PlayerInventory.hay));
  } else if (PlayerStats.hay !== _lastSyncedHay) {
    _lastSyncedHay = Math.max(0, Math.round(PlayerStats.hay));
  }
  PlayerInventory.hay = _lastSyncedHay;
  PlayerStats.hay = _lastSyncedHay;

  if (PlayerInventory.hasSword && _env.weapons && !_env.weapons.owned.has("shortsword")) {
    _env.weapons.unlock("shortsword", true);
  }
  if (PlayerInventory.torches > 0 && _env.weapons && !_env.weapons.owned.has("torch")) {
    _env.weapons.unlock("torch", true);
  }

  ui?.setRPGStats?.(PlayerStats, PlayerEquipment, PlayerInventory);
  ui?.setVitals?.(player.health, player.maxHealth, player.coins, player.potions);
}

export function triggerWantedLevel(levels = 1) {
  if (!_env.npcs) return;
  _env.npcs.addWantedPoints(levels);
  for (let i = 0; i < _env.npcs.npcs.length; i++) {
    const npc = _env.npcs.npcs[i];
    if (npc.alive && npc.roleKey === "guard") {
      const dx = npc.x - (_env.player?.x ?? 0);
      const dz = npc.z - (_env.player?.z ?? 0);
      if (dx * dx + dz * dz < 65 * 65) {
        _env.npcs._hunt(npc);
      }
    }
  }
}

export function spawnLoot(pos, goldAmount = 50) {
  const x = pos.x ?? 0;
  const z = pos.z ?? 0;
  if (_env.drops) {
    // (antes chamava _spawn com a assinatura errada e lançava TypeError a cada morte de monstro)
    const burst = Math.min(6, Math.max(2, Math.ceil(goldAmount / 12)));
    const y = (pos.y ?? _env.world?.heightAt?.(x, z) ?? 0) + 0.4;
    _env.drops.spawnLoot?.(x, y, z, { coins: [burst, burst] }, 1.0);
  }
  if (_env.player) {
    _env.player.coins += goldAmount;
    PlayerStats.gold = _env.player.coins;
    syncPlayerStatsToPlayer(_env.player, _env.ui);
  } else {
    PlayerStats.gold += goldAmount;
  }
}

// ============================================================================
// 3. Sistema de Testemunhas Otimizado (Zero-GC: Distância² + Dot FOV + Oclusão)
// ============================================================================
function _extractNPCRoot(entry) {
  if (!entry) return null;
  return entry.isObject3D ? entry : entry.root || null;
}

function _extractNPCEntity(entry) {
  if (!entry) return null;
  if (entry.isObject3D) return entry.userData?.npcRef || null;
  return entry;
}

/**
 * Verifica se um ato ilícito foi visto.
 * Otimizado: Filtra por distância ao quadrado e ângulo de visão (FOV) antes do Raycast/oclusão.
 * @param {THREE.Vector3|{x:number,y?:number,z:number}} crimePos - Onde o crime ocorreu.
 * @param {Array} npcs - Lista de NPCs ativos (THREE.Object3D ou instâncias de NPC).
 * @param {THREE.Raycaster} [raycaster] - Instância global reaproveitada.
 * @param {boolean} [applyDefaultPenalty=true] - Se true, aplica penalidade padrão de carisma (-2).
 * @returns {boolean} - Retorna true se houver testemunhas.
 */
export function checkWitnesses(crimePos, npcs, raycaster = _sharedRaycaster, applyDefaultPenalty = true) {
  if (!crimePos || !npcs) return false;
  const list = Array.isArray(npcs) ? npcs : npcs.npcs || [];
  _crimeVec.set(crimePos.x ?? 0, crimePos.y ?? 0, crimePos.z ?? 0);

  let witnessed = false;

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const obj = _extractNPCRoot(entry);
    const npcEntity = _extractNPCEntity(entry);
    if (!obj) continue;

    const data = obj.userData;
    if (npcEntity) {
      data.isDead = !npcEntity.alive;
      if (npcEntity.roleKey === "horse" || npcEntity.temporary) continue;
    }
    if (data.isDead || data.isSleeping || data.state === NPC_STATES.SLEEP) continue;

    _npcPos.set(
      npcEntity ? npcEntity.x : obj.position.x,
      obj.position.y,
      npcEntity ? npcEntity.z : obj.position.z,
    );

    _dirToCrime.subVectors(_crimeVec, _npcPos);
    _dirToCrime.y = 0;
    const distSq = _dirToCrime.lengthSq();

    // Ignora a própria vítima no exato ponto do crime (distSq quase zero) ou quem está além de 25m (25*25 = 625)
    if (distSq < 0.04 || distSq > 625) continue;

    _dirToCrime.normalize();

    if (npcEntity && npcEntity.model) {
      const yaw = npcEntity.model.rotation.y;
      _npcDir.set(Math.sin(yaw), 0, Math.cos(yaw));
    } else {
      obj.getWorldDirection(_npcDir);
      _npcDir.y = 0;
      if (_npcDir.lengthSq() > 0.0001) _npcDir.normalize();
    }

    // FOV de ~120 graus (dot product > -0.5)
    if (_npcDir.dot(_dirToCrime) > -0.5) {
      // Verifica paredes no caminho (Raycaster / oclusão de construções)
      if (_env.world && typeof _env.world.isWallBetween === "function") {
        if (_env.world.isWallBetween(_npcPos.x, _npcPos.z, _crimeVec.x, _crimeVec.z)) {
          continue;
        }
      } else if (raycaster && _env.scene) {
        _rayOrigin.copy(_npcPos);
        _rayOrigin.y += 1.5;
        raycaster.set(_rayOrigin, _dirToCrime);
        raycaster.far = Math.sqrt(distSq);
      }

      witnessed = true;
      data.state = "FLEE"; // NPC foge para chamar guarda

      if (npcEntity) {
        if (npcEntity.roleKey === "guard" && _env.npcs) {
          _env.npcs._hunt(npcEntity);
        } else if (_env.npcs) {
          const guard = _env.npcs._nearestGuard(npcEntity);
          if (guard) {
            npcEntity.reportTarget = guard;
            npcEntity.startAlert("report", 26, _crimeVec.x, _crimeVec.z);
          } else {
            npcEntity.startAlert("flee", 6.5, _crimeVec.x, _crimeVec.z);
          }
        }
      }
      // Agrupamento de Testemunhas: break no primeiro NPC que vê o crime
      break;
    }
  }

  if (witnessed && applyDefaultPenalty) {
    PlayerStats.cha = Math.max(1, PlayerStats.cha - 2); // Perde carisma
    triggerWantedLevel(1);
    syncPlayerStatsToPlayer();
  }
  return witnessed;
}

// ============================================================================
// 4. Rotinas de NPCs e IA de Bandidos Ocultos
// ============================================================================
/**
 * Atualiza rotinas dos NPCs baseadas na hora do dia (0.0 a 24.0) e furtos de bandidos.
 * @param {THREE.Object3D|object} npc
 * @param {number} timeOfDay - Hora no jogo (0.0 a 24.0)
 * @param {Array} allNpcs - Para bandidos procurarem vítimas
 */
export function updateNPCRoutine(npc, timeOfDay, allNpcs) {
  const obj = _extractNPCRoot(npc);
  const npcEntity = _extractNPCEntity(npc);
  if (!obj) return;
  const data = obj.userData;
  if (data.isDead) return;

  // Guardas e alvos ativos de missão mantêm-se acordados à noite; civis comuns dormem (21h às 6h)
  const isGuard = data.type === NPC_TYPES.GUARD || npcEntity?.roleKey === "guard";
  const isMissionTarget = Boolean(data.isMissionDebtor || data.isBountyBoss);
  if (!isGuard && !isMissionTarget && (timeOfDay > 21 || timeOfDay < 6)) {
    data.state = NPC_STATES.SLEEP; // 2 = SLEEP (Move-se para casa, desativa render)
    data.isSleeping = true;
    return;
  }

  if (data.isSleeping) {
    data.isSleeping = false;
    if (data.state === NPC_STATES.SLEEP) data.state = NPC_STATES.WORK;
  }

  // Comportamento do Bandido Oculto
  if (data.type === NPC_TYPES.BANDIT && data.state !== NPC_STATES.FLEE && data.state !== "FLEE") {
    const now = performance.now();
    if (typeof data.nextTheftCheck !== "number") {
      data.nextTheftCheck = now + 2000 + Math.random() * 2000;
    }
    // Cooldown para não avaliar furtos todo frame (a cada 3 segundos)
    if (now > data.nextTheftCheck) {
      data.nextTheftCheck = now + 3000;

      const list = Array.isArray(allNpcs) ? allNpcs : allNpcs?.npcs || [];
      _npcPos.set(
        npcEntity ? npcEntity.x : obj.position.x,
        0,
        npcEntity ? npcEntity.z : obj.position.z,
      );

      // Procura vítimas próximas (Raio 5m = distSq 25)
      for (let i = 0; i < list.length; i++) {
        const candidate = list[i];
        const victimObj = _extractNPCRoot(candidate);
        const victimEntity = _extractNPCEntity(candidate);
        if (!victimObj || victimObj === obj) continue;

        const vData = victimObj.userData;
        if (vData.isDead || vData.isSleeping || vData.type === NPC_TYPES.GUARD || victimEntity?.roleKey === "guard" || victimEntity?.roleKey === "horse") {
          continue;
        }

        _victimPos.set(
          victimEntity ? victimEntity.x : victimObj.position.x,
          0,
          victimEntity ? victimEntity.z : victimObj.position.z,
        );

        if (_npcPos.distanceToSquared(_victimPos) < 25) {
          // Rouba a vítima
          data.hasStolenGems = true;
          data.state = NPC_STATES.STEAL;
          if (npcEntity) {
            npcEntity.task = "Escondendo joias furtadas";
            _env.effects?.play("star", npcEntity.x, npcEntity.root.position.y + 1.45, npcEntity.z, "#ffd86b", 0.65);
          }

          // 5% de chance de um guarda notar ou a vítima gritar
          if (Math.random() < 0.05) {
            data.isWantedByGuards = true;
            if (npcEntity && _env.effects) {
              _env.effects.play("alert", npcEntity.x, npcEntity.root.position.y + 2.3, npcEntity.z, "#ff7a66", 0.9);
            }
          }
          break;
        }
      }
    }
  }
}

// ============================================================================
// 5. Justiça Dinâmica: Recompensa vs Assassinato
// ============================================================================
/**
 * Lida com a morte de um NPC pelo jogador.
 * @param {THREE.Object3D|object} npc
 * @param {Array} npcs - Lista global
 * @param {THREE.Raycaster} [raycaster]
 */
export function handleNPCDeath(npc, npcs, raycaster = _sharedRaycaster) {
  const obj = _extractNPCRoot(npc);
  const npcEntity = _extractNPCEntity(npc);
  if (!obj) return { isWitnessed: false, wasProvenBandit: false };

  const data = obj.userData;
  data.isDead = true;
  try { window.__game?.npcLife?.onPlayerKilled?.(npcEntity); } catch (_) {}

  const deathPos = npcEntity
    ? _crimeVec.set(npcEntity.x, obj.position.y, npcEntity.z)
    : obj.position;

  // Caso de Borda 5.3 & Eventos de Missão (BOUNTY / Morte do Mission Giver ou Devedor)
  _handleMissionOnNPCDeath(obj, npcEntity);

  const isWitnessed = checkWitnesses(deathPos, npcs, raycaster, false);
  const wasProvenBandit = data.type === NPC_TYPES.BANDIT && Boolean(data.hasStolenGems);

  if (wasProvenBandit) {
    // Era um criminoso comprovado (roubou algo)
    addGood(3, "Bandido abatido");
    if (isWitnessed) {
      PlayerStats.cha += 1; // Herói local, carisma sobe
      _env.ui?.showToast("Justiça feita! Bandido abatido · +50 moedas · Carisma +1");
    } else {
      // O Crime Perfeito: sem testemunhas, pega o ouro extra mas carisma não sobe nem desce
      _env.ui?.showToast("Bandido abatido nas sombras · +50 moedas recuperadas");
    }
    // Dropa o loot extra (50 moedas)
    spawnLoot(deathPos, 50);
  } else {
    // Matou inocente (ou bandido que ainda não havia cometido crime — Falso Herói)
    addEvil(5, "Inocente abatido");
    const cultTier = CultState?.recordSacrifice?.() || 1;
    const sacCount = CultState?.sacrifices || 1;

    // Quebra do Juramento Templário
    if (PlayerStats.isTemplar && !PlayerStats.hasBrokenVow) {
      PlayerStats.hasBrokenVow = true;
      _env.ui?.showToast(
        "⚠️ VOTO TEMPLÁRIO QUEBRADO! A ira divina cai sobre ti: 50% de lentidão e fraqueza de ataque! Elimine uma fera nas matas para se redimir!"
      );
      if (_env.effects) {
        _env.effects.play("dust", deathPos.x, deathPos.y + 1.2, deathPos.z, "#33080c", 2.6);
        _env.effects.play("star", deathPos.x, deathPos.y + 1.5, deathPos.z, "#ff2200", 2.0);
      }
    }

    if (isWitnessed) {
      PlayerStats.cha = Math.max(1, PlayerStats.cha - 5);
      triggerWantedLevel(2); // Ganha 2 estrelas/escudos
      _env.ui?.showToast(
        `Assassinato! Bondade reduzida · Sacrifício #${sacCount} da Seita (Nível ${cultTier}) · Procurado +2`
      );
    } else {
      _env.ui?.showToast(
        `Assassinato nas sombras · Sacrifício #${sacCount} da Seita (Nível ${cultTier})`
      );
    }
  }

  syncPlayerStatsToPlayer();
  return { isWitnessed, wasProvenBandit };
}

// ============================================================================
// 6. Saque de Baús e Isca para Cavalos (Feno)
// ============================================================================
/**
 * Tenta abrir um baú em uma casa.
 * @param {THREE.Object3D} chest
 * @param {THREE.Vector3|{x:number,y?:number,z:number}} playerPos
 * @param {Array} npcs
 * @param {THREE.Raycaster} [raycaster]
 */
export function interactWithChest(chest, playerPos, npcs, raycaster = _sharedRaycaster) {
  if (!chest) return { looted: false, gold: 0, isWitnessed: false };
  if (chest.userData.isLooted) return { looted: false, gold: 0, isWitnessed: false };

  const isWitnessed = checkWitnesses(playerPos, npcs, raycaster, false);

  chest.userData.isLooted = true;
  if (chest.userData.lid) {
    chest.userData.lid.rotation.x = -Math.PI / 4;
  } else {
    chest.rotation.x = Math.PI / 4; // Abre a tampa
  }

  if (isWitnessed) {
    PlayerStats.cha = Math.max(1, PlayerStats.cha - 2);
    triggerWantedLevel(1); // Crime menor se pego roubando
    addEvil(3, "Furto flagrado em baú");
  } else {
    addEvil(1, "Furto discreto em baú");
  }

  const goldFound = Math.floor(Math.random() * 20) + 10;
  PlayerStats.gold += goldFound;
  if (_env.player) {
    _env.player.coins = PlayerStats.gold;
  }
  syncPlayerStatsToPlayer();
  _env.music?.playDiscovery?.();
  _env.audio?.coin?.();

  return { looted: true, gold: goldFound, isWitnessed };
}

/**
 * Larga feno no chão para atrair cavalos.
 * Dispensa furtividade, puxa o cavalo pelo faro (distância).
 * @param {THREE.Vector3|{x:number,y?:number,z:number}} playerPos
 * @param {Array} horses
 */
export function dropHayBait(playerPos, horses) {
  const hay = getHayFromPool();
  const px = playerPos.x ?? 0;
  const pz = playerPos.z ?? 0;
  const groundY = _env.world ? _env.world.heightAt(px, pz) : 0;

  hay.position.set(px, groundY, pz);
  _baitPos.set(px, 0, pz);

  const horseList = Array.isArray(horses) ? horses : horses?.horses || [];
  let attractedCount = 0;

  // Atrai cavalos em um raio de 30m (distSq = 900)
  for (let i = 0; i < horseList.length; i++) {
    const horse = horseList[i];
    if (!horse || horse.removed || horse.alive === false || horse.controlled) continue;

    const horseObj = horse.isObject3D ? horse : horse.root;
    const hx = horse.x !== undefined ? horse.x : horseObj.position.x;
    const hz = horse.z !== undefined ? horse.z : horseObj.position.z;
    const dx = hx - _baitPos.x;
    const dz = hz - _baitPos.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < 900) {
      if (horseObj) {
        horseObj.userData.targetHay = hay;
        horseObj.userData.state = "APPROACH_HAY";
      }
      if (horse.userData) {
        horse.userData.targetHay = hay;
        horse.userData.state = "APPROACH_HAY";
      }
      horse.targetHay = hay;
      horse.state = "approach_hay";
      horse.stay = false;
      horse.task = "Atraído pelo feno";
      attractedCount++;
    }
  }

  return { hay, attractedCount };
}

// ============================================================================
// 7. Novas Armas, Pool de Emissores de Fogo e Recarga do Mosquete (Zero-GC)
// ============================================================================
const _projectilePos = new THREE.Vector3();
const _hitDir = new THREE.Vector3();
const _recoilAxis = new THREE.Vector3(1, 0, 0); // Eixo X para recuo da arma

const FIRE_POOL_SIZE = 10;
const _firePool = [];

export function createFirePool(scene = _env.scene) {
  if (_firePool.length > 0 || !scene) return _firePool;
  const outerMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.88 });
  const innerMat = new THREE.MeshBasicMaterial({ color: 0xffe47a });
  const outerGeo = new THREE.ConeGeometry(0.28, 0.72, 6);
  const innerGeo = new THREE.ConeGeometry(0.15, 0.44, 5);

  for (let i = 0; i < FIRE_POOL_SIZE; i++) {
    const group = new THREE.Group();
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.y = 0.36;
    group.add(outer);

    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 0.24;
    group.add(inner);

    group.visible = false;
    group.userData = {
      extinguishTime: 0,
      attachedNPC: null,
      burnTickTimer: 0,
    };
    scene.add(group);
    _firePool.push(group);
  }
  return _firePool;
}

/**
 * Acopla fogo temporário a um alvo (NPC ou Árvore/InstancedMesh).
 * @param {object} target
 * @param {THREE.Vector3|{x:number,y:number,z:number}} hitPoint
 * @param {Array} [firePool]
 * @param {number} [time]
 */
export function igniteTarget(target, hitPoint, firePool = _firePool, time = performance.now()) {
  const pool = firePool && firePool.length > 0 ? firePool : createFirePool(_env.scene);
  const fire = pool.find((f) => !f.visible);
  if (!fire) return null;

  fire.visible = true;
  fire.userData.extinguishTime = time + 4000; // Queima rápido (4s)
  fire.userData.burnTickTimer = 0.8;

  const npcEntity = _extractNPCEntity(target);
  const npcObj = _extractNPCRoot(target);
  const isNPC = Boolean(target?.isNPC || npcEntity || npcObj?.userData?.npcRef);

  if (isNPC && (npcObj || target.isObject3D)) {
    const host = npcObj || target;
    host.add(fire);
    fire.position.set(0, 0.85, 0);
    host.userData = host.userData || {};
    host.userData.isOnFire = true;
    fire.userData.attachedNPC = npcEntity || host.userData.npcRef || null;
  } else {
    if (_env.scene && fire.parent !== _env.scene) _env.scene.add(fire);
    fire.position.set(hitPoint.x ?? 0, hitPoint.y ?? 0, hitPoint.z ?? 0);
    fire.userData.attachedNPC = null;
  }
  return fire;
}

/**
 * Limpeza e animação do Pool de Fogo no loop principal (Zero-GC).
 */
export function updateFirePool(firePool = _firePool, time = performance.now(), dt = 0.016, combat = null) {
  for (let i = 0; i < firePool.length; i++) {
    const fire = firePool[i];
    if (!fire.visible) continue;

    if (time > fire.userData.extinguishTime) {
      fire.visible = false;
      const npc = fire.userData.attachedNPC;
      if (npc && npc.root) {
        npc.root.userData.isOnFire = false;
      }
      if (_env.scene && fire.parent !== _env.scene) {
        _env.scene.add(fire);
      }
      fire.userData.attachedNPC = null;
      continue;
    }

    // Cintilação orgânica das chamas
    const flicker = 0.88 + Math.sin(time * 0.025 + i * 1.7) * 0.16;
    fire.scale.set(flicker, 0.9 + Math.cos(time * 0.03 + i) * 0.18, flicker);

    // Dano periódico caso esteja anexado a um NPC vivo
    const npc = fire.userData.attachedNPC;
    if (npc && npc.alive) {
      fire.userData.burnTickTimer -= dt;
      if (fire.userData.burnTickTimer <= 0) {
        fire.userData.burnTickTimer = 1.0;
        if (combat) {
          combat.damageNPC(npc, 1, 0, 0, "#ff8a3a", 0.9, 0.4, 0, false, true);
        } else {
          npc.takeHit?.(1, 0, 0, 0.4, 0);
        }
      }
    }
  }
}

/**
 * Animação procedural de recarga do mosquete no loop (3.5s).
 */
export function updateMusketReload(weapon, time = performance.now()) {
  if (!weapon || !weapon.userData) return;
  const data = weapon.userData;
  if (!data.isReloading) return;

  const progress = 1.0 - (data.reloadEndTime - time) / 3500;

  if (progress >= 1.0) {
    data.isReloading = false;
    weapon.rotation.set(0, 0, 0); // Retorna à posição original
  } else {
    // Animação procedural: gira a arma para baixo e balança ("socando" a pólvora)
    weapon.rotation.x = Math.sin(progress * Math.PI) * -0.8;
    weapon.rotation.z = Math.sin(progress * Math.PI * 4) * 0.1;
  }
}

/**
 * Dispara ou ataca com a arma equipada (TORCH, SPEAR, MUSKET).
 */
export function handleWeaponAction(player, weapon, firePool = _firePool, time = performance.now(), hooks = {}) {
  if (!weapon) return null;
  weapon.userData = weapon.userData || {};
  const data = weapon.userData;

  switch (data.type) {
    case "TORCH": {
      const hitObject = hooks.performMeleeRaycast ? hooks.performMeleeRaycast(player) : null;
      if (hitObject) {
        if (hooks.applyDamage) hooks.applyDamage(hitObject, 5);
        igniteTarget(hitObject.target || hitObject, hitObject.point || _projectilePos, firePool, time);
      }
      return hitObject;
    }

    case "SPEAR": {
      if (data.isThrown) return null;
      if (player.isHoldingSecondary) {
        if (hooks.throwSpear) hooks.throwSpear(weapon, player);
      } else if (hooks.performMeleeRaycast) {
        hooks.performMeleeRaycast(player, 4.0);
      }
      return true;
    }

    case "MUSKET": {
      if (data.isReloading || time < (data.nextShot || 0)) return false;
      if (hooks.fireMusket) hooks.fireMusket(weapon, player);
      data.isReloading = true;
      data.reloadEndTime = time + 3500; // 3.5s de recarga
      data.nextShot = time + 3500;
      return true;
    }
    default:
      return null;
  }
}

// ============================================================================
// 8. Sistema de Armaduras, Resiliência (RNG) e Melhorias no Ferreiro
// ============================================================================
export const PlayerEquipment = {
  weaponLevel: 1, // Melhorado no ferreiro (+25% dano por nível acima de 1)
  armorNegationChance: 0.0, // 0.0 a 0.7 (70% máx de chance de anular o golpe)
  blessingActive: false, // Colar de bênção (15% de chance de cortar dano pela metade)

  getWeaponMult: () => 1.0 + (PlayerEquipment.weaponLevel - 1) * 0.25,
};

function playMetalDeflectSound() {
  _env.audio?.metalDeflect ? _env.audio.metalDeflect() : _env.audio?.block?.();
}

function createSparkParticles() {
  if (_env.effects && _env.player) {
    _env.effects.play(
      "glint",
      _env.player.x,
      _env.player.root.position.y + 1.35,
      _env.player.z,
      "#ffe39a",
      1.25,
    );
    _env.effects.play(
      "star",
      _env.player.x,
      _env.player.root.position.y + 1.25,
      _env.player.z,
      "#d9e6ff",
      1.05,
    );
  }
}

function triggerDamageVignette() {
  _env.damageFx?.flash?.(1);
}

/**
 * Aplica dano ao jogador considerando a chance de bloqueio passivo da armadura (RNG) e bênção.
 * @param {number} amount
 * @returns {{ negated: boolean, blessed: boolean, finalDamage: number }}
 */
export function takeDamage(amount) {
  // Rola chance de não tomar dano baseada na armadura (0% a 70%)
  if (Math.random() < PlayerEquipment.armorNegationChance) {
    playMetalDeflectSound();
    createSparkParticles(); // Partícula de faísca na armadura
    _env.ui?.showToast?.(`Armadura defletiu o golpe! (${Math.round(PlayerEquipment.armorNegationChance * 100)}% proteção)`);
    return { negated: true, blessed: false, finalDamage: 0 };
  }

  let blessed = false;
  // Se o colar da bênção estiver ativo, 15% de chance de reduzir o dano pela metade (mínimo 0 se golpe leve)
  if (PlayerEquipment.blessingActive && Math.random() < 0.15) {
    amount = Math.floor(amount / 2);
    blessed = true;
    if (_env.effects && _env.player) {
      _env.effects.play("glint", _env.player.x, _env.player.root.position.y + 1.6, _env.player.z, "#ffd86b", 1.2);
    }
  }

  if (typeof PlayerStats.hp !== "number") PlayerStats.hp = PlayerStats.getMaxHp();
  PlayerStats.hp = Math.max(0, PlayerStats.hp - amount);
  triggerDamageVignette();
  return { negated: false, blessed, finalDamage: amount };
}

/**
 * Compra de armaduras e upgrades no Ferreiro/Lojas.
 * @param {'ARMOR'|'WEAPON'|'BLESSING'} type
 * @param {number} cost
 * @param {number} [value]
 */
export function buyUpgrade(type, cost, value = 0.3) {
  if (_env.player) PlayerStats.gold = _env.player.coins;
  if (PlayerStats.gold < cost) return false;

  PlayerStats.gold -= cost;
  if (_env.player) _env.player.coins = PlayerStats.gold;

  if (type === "ARMOR") {
    PlayerEquipment.armorNegationChance = Math.min(0.7, value);
    _env.player?.reinforceArmor?.();
  } else if (type === "WEAPON") {
    PlayerEquipment.weaponLevel++;
  } else if (type === "BLESSING") {
    PlayerEquipment.blessingActive = true;
  }

  syncPlayerStatsToPlayer();
  return true;
}

// ============================================================================
// 9. Interações Sociais e Morais (Igreja e Pobres)
// ============================================================================
export function resetWantedLevel() {
  _env.npcs?.clearWanted?.();
}

function playChoirSound() {
  _env.audio?.choir?.();
}

/**
 * Interação Específica: Confessar com o Padre.
 * A confissão e a bênção são SEMPRE gratuitas (nunca cobram moedas obrigatoriamente).
 * Se o jogador desejar, pode passar uma oferta voluntária opcional (voluntaryOffer > 0).
 */
export function interactWithPriest(playerPos, npcPriest, voluntaryOffer = 0) {
  const currentDay = WorldDecay?.daysPassed ?? 1;
  if (PlayerStats.lastConfessionDay === currentDay) {
    return { success: false, reason: "already_confessed_today", currentDay };
  }

  if (_env.player) PlayerStats.gold = _env.player.coins;

  // Oferta estritamente opcional: nunca impede a confissão ou bênção
  if (voluntaryOffer > 0 && PlayerStats.gold >= voluntaryOffer) {
    PlayerStats.gold -= voluntaryOffer;
    if (_env.player) _env.player.coins = PlayerStats.gold;
    PlayerInventory.gold = PlayerStats.gold;
  }

  PlayerStats.lastConfessionDay = currentDay;

  // A confissão reduz em 10% a maldade
  const curEvil = getEvilPercent();
  const reduction = Math.max(1, Math.round(curEvil * 0.10));
  const newEvil = Math.max(0, curEvil - reduction);
  setEvilPercent(newEvil, "Confissão e Absolvição dos Pecados (-10% Maldade)");

  resetWantedLevel(); // Despista guardas e zera procurado gratuitamente
  PlayerStats.cha = Math.min(20, PlayerStats.cha + 2); // Purifica a alma
  addGood(voluntaryOffer >= 20 ? 8 : 4, "Bênção sacerdotal");
  playChoirSound(); // Efeito sonoro angelical
  if (_env.effects && _env.player) {
    _env.effects.play("glint", _env.player.x, _env.player.root.position.y + 1.9, _env.player.z, "#fff3b0", 1.5);
  }
  syncPlayerStatsToPlayer();
  return { success: true, reduction, evil: newEvil, currentDay };
}

/**
 * Interação Específica: Dar esmola ao pobre/mendigo.
 */
export function interactWithBeggar(playerPos, npcBeggar) {
  const obj = _extractNPCRoot(npcBeggar) || npcBeggar;
  const npcEntity = _extractNPCEntity(npcBeggar);
  if (!obj) return false;
  obj.userData = obj.userData || {};
  if (obj.userData.hasReceivedAlms) return false;

  if (_env.player) PlayerStats.gold = _env.player.coins;
  if (PlayerStats.gold >= 5) {
    PlayerStats.gold -= 5;
    if (_env.player) _env.player.coins = PlayerStats.gold;
    PlayerStats.cha = Math.min(20, PlayerStats.cha + 1);
    addGood(4, "Esmola a necessitado");
    obj.userData.hasReceivedAlms = true;
    obj.userData.state = "CHEERING"; // NPC comemora
    if (npcEntity) {
      npcEntity.cheeringTimer = 8.0;
      npcEntity.task = "Agradecendo a esmola!";
      _env.effects?.play("star", npcEntity.x, npcEntity.root.position.y + 1.8, npcEntity.z, "#ffd86b", 1.1);
    }
    _env.audio?.coin?.();
    syncPlayerStatsToPlayer();
    return true;
  }
  return false;
}

// ============================================================================
// 10. Coleta de Recursos (Madeira e Pedra via InstancedMesh — Zero-GC)
// ============================================================================
const _dummyMatrix = new THREE.Matrix4();
const _zeroScale = new THREE.Vector3(0, 0, 0);
const _meleeForward = new THREE.Vector3();
const _rayHits = [];

function playWoodChopSound() {
  _env.audio?.woodChop ? _env.audio.woodChop() : _env.audio?.weaponSwing?.("chop", false);
}

function playStoneMineSound() {
  _env.audio?.stoneMine ? _env.audio.stoneMine() : _env.audio?.weaponSwing?.("smash", false);
}

/**
 * Raycast curto à frente do jogador para atingir árvores e rochas em InstancedMesh.
 */
export function performMeleeRaycast(player = _env.player, environmentInstancedMeshes = null, reach = 3.6) {
  if (!player) return null;
  const meshes = environmentInstancedMeshes || _env.world?.environmentInstancedMeshes || [];
  if (!meshes || meshes.length === 0) return null;

  const px = player.x ?? player.position?.x ?? 0;
  const pz = player.z ?? player.position?.z ?? 0;
  const py = (player.root?.position?.y ?? player.position?.y ?? 0) + 1.0;

  let fx = 0;
  let fz = 1;
  if (typeof player._lastGatherYaw === "number") {
    fx = -Math.sin(player._lastGatherYaw);
    fz = -Math.cos(player._lastGatherYaw);
  } else if (player.model) {
    fx = Math.sin(player.model.rotation.y);
    fz = Math.cos(player.model.rotation.y);
  }
  _meleeForward.set(fx, 0, fz).normalize();

  _rayOrigin.set(px, py, pz);
  _sharedRaycaster.set(_rayOrigin, _meleeForward);
  _sharedRaycaster.near = 0.05;
  _sharedRaycaster.far = reach;
  _rayHits.length = 0;
  _sharedRaycaster.intersectObjects(meshes, false, _rayHits);

  for (let i = 0; i < _rayHits.length; i++) {
    const h = _rayHits[i];
    if (h.instanceId !== undefined && !h.object.userData?.harvested?.has(h.instanceId)) {
      return h;
    }
  }

  // Fallback espacial para troncos finos ou pedras baixas dentro do cone frontal de golpe
  let bestMesh = null;
  let bestId = -1;
  let bestDistSq = reach * reach;

  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    const items = mesh.userData?.items;
    const harvested = mesh.userData?.harvested;
    if (!items) continue;
    for (let id = 0; id < items.length; id++) {
      if (harvested && harvested.has(id)) continue;
      const item = items[id];
      const dx = item.x - px;
      const dz = item.z - pz;
      const dSq = dx * dx + dz * dz;
      if (dSq > bestDistSq || dSq < 0.001) continue;
      const dist = Math.sqrt(dSq);
      const dot = (dx / dist) * _meleeForward.x + (dz / dist) * _meleeForward.z;
      if (dot < 0.25 && dist > 1.35) continue;
      bestDistSq = dSq;
      bestMesh = mesh;
      bestId = id;
    }
  }

  if (bestMesh && bestId >= 0) {
    const item = bestMesh.userData.items[bestId];
    return {
      object: bestMesh,
      instanceId: bestId,
      point: _crimeVec.set(item.x, item.y + 0.8, item.z),
      distance: Math.sqrt(bestDistSq),
    };
  }

  return null;
}

function _registerHarvestedInstance(mesh, instanceId) {
  const uData = mesh.userData;
  if (!uData) return;
  const harvested = uData.harvested || (uData.harvested = new Map());
  if (harvested.has(instanceId)) return;

  const origMatrix = new THREE.Matrix4();
  mesh.getMatrixAt(instanceId, origMatrix);

  const item = uData.items ? uData.items[instanceId] : null;
  const collider = item?.collider || null;
  const originalRadius = collider ? collider.radius : 0;
  if (collider) {
    collider.disabled = true;
    collider.radius = 0; // Desativa colisão física enquanto a árvore/pedra está colhida
  }

  let farMatrix = null;
  let farIndex = -1;
  const farMesh = uData.farMesh || null;
  if (farMesh && item && typeof item.farIndex === "number" && item.farIndex >= 0) {
    farIndex = item.farIndex;
    farMatrix = new THREE.Matrix4();
    farMesh.getMatrixAt(farIndex, farMatrix);
    farMesh.getMatrixAt(farIndex, _dummyMatrix);
    _dummyMatrix.scale(_zeroScale);
    farMesh.setMatrixAt(farIndex, _dummyMatrix);
    farMesh.instanceMatrix.needsUpdate = true;
  }

  harvested.set(instanceId, {
    time: performance.now(),
    matrix: origMatrix,
    collider,
    originalRadius,
    farMesh,
    farIndex,
    farMatrix,
  });
}

const _treeChopProgress = new Map();
const _fallingTrees = [];

function _spawnFallingTree(instancedMesh, instanceId, player, hitPt) {
  const item = instancedMesh.userData?.items?.[instanceId];
  if (!_env.scene) return;

  const bx = item ? item.x : (hitPt?.x ?? 0);
  const by = item ? (item.y ?? 0) : (hitPt?.y ?? 0);
  const bz = item ? item.z : (hitPt?.z ?? 0);
  const rotY = item ? (item.rotation ?? 0) : 0;
  const scale = item ? (item.scale ?? 1.0) : 1.0;

  // Direção de queda para longe do jogador
  const px = player?.x ?? player?.position?.x ?? (bx - 1);
  const pz = player?.z ?? player?.position?.z ?? (bz - 1);
  let fwdX = bx - px;
  let fwdZ = bz - pz;
  const len = Math.hypot(fwdX, fwdZ) || 1;
  fwdX /= len;
  fwdZ /= len;

  // Eixo perpendicular de rotação horizontal
  const axis = new THREE.Vector3(-fwdZ, 0, fwdX).normalize();

  const pivot = new THREE.Group();
  pivot.position.set(bx, by, bz);

  const treeMesh = new THREE.Mesh(instancedMesh.geometry, instancedMesh.material);
  treeMesh.rotation.set(0, rotY, 0);
  treeMesh.scale.set(scale, scale, scale);
  treeMesh.castShadow = true;
  pivot.add(treeMesh);

  _env.scene.add(pivot);

  _fallingTrees.push({
    pivot,
    mesh: treeMesh,
    axis,
    elapsed: 0,
    duration: 1.25, // ~1.25s de tombo físico suave
    baseX: bx,
    baseY: by,
    baseZ: bz,
    fwdX,
    fwdZ,
    scale,
    species: instancedMesh.userData?.species,
  });
}

/**
 * Atualiza a física de rotação e impacto no solo de árvores derrubadas.
 */
export function updateFallingTrees(dt) {
  if (_fallingTrees.length === 0) return;

  for (let i = _fallingTrees.length - 1; i >= 0; i--) {
    const fTree = _fallingTrees[i];
    fTree.elapsed += dt;
    const progress = Math.min(1.0, fTree.elapsed / fTree.duration);

    // Queda física acelerada por gravidade (ease-in 1.85)
    const angle = Math.pow(progress, 1.85) * (Math.PI * 0.49);
    fTree.pivot.quaternion.setFromAxisAngle(fTree.axis, angle);

    if (progress >= 1.0) {
      // Impacto estrondoso no solo com poeira e detritos
      playWoodChopSound();
      const topDist = fTree.scale * 3.6;
      const hitX = fTree.baseX + fTree.fwdX * topDist;
      const hitZ = fTree.baseZ + fTree.fwdZ * topDist;
      const hitY = _env.world ? _env.world.heightAt(hitX, hitZ) : fTree.baseY;

      if (_env.effects) {
        _env.effects.play("dust", hitX, hitY + 0.35, hitZ, "#63472d", 2.2);
        _env.effects.play(
          "dust",
          fTree.baseX + fTree.fwdX * (topDist * 0.5),
          fTree.baseY + 0.25,
          fTree.baseZ + fTree.fwdZ * (topDist * 0.5),
          "#8c6742",
          1.5,
        );
      }

      // Concede madeira e feno após o tombo físico completo
      const gainedWood = Math.floor(Math.random() * 3) + 2;
      PlayerInventory.wood += gainedWood;
      const gainedHay = fTree.species === "bush" || Math.random() < 0.5 ? 1 : 0;
      if (gainedHay > 0) {
        PlayerInventory.hay += gainedHay;
        PlayerStats.hay = PlayerInventory.hay;
      }
      _env.ui?.showToast?.(
        `+${gainedWood} Madeira${gainedHay ? " · +1 Feno" : ""} (Total: ${PlayerInventory.wood} Mad)`,
      );
      syncPlayerStatsToPlayer();

      if (_env.scene) {
        _env.scene.remove(fTree.pivot);
      }
      fTree.pivot.remove(fTree.mesh);
      _fallingTrees.splice(i, 1);
    }
  }
}

/**
 * Ação de bater com a ferramenta em árvores ou pedras.
 * Árvores agora requerem 4 golpes de machado para tombar fisicamente!
 * @param {object} player
 * @param {'AXE'|'PICKAXE'} toolType
 * @param {Array<THREE.InstancedMesh>} [environmentInstancedMeshes]
 */
export function gatherResource(player, toolType, environmentInstancedMeshes) {
  const hit = performMeleeRaycast(player, environmentInstancedMeshes);
  if (!hit || hit.instanceId === undefined) return false;

  if (toolType === "AXE" && hit.object.name === "Trees") {
    const treeKey = `${hit.object.id}_${hit.instanceId}`;
    const hits = (_treeChopProgress.get(treeKey) || 0) + 1;

    const pt = hit.point || hit.object.userData?.items?.[hit.instanceId];

    if (hits < 4) {
      _treeChopProgress.set(treeKey, hits);
      playWoodChopSound();
      if (pt && _env.effects) {
        _env.effects.play("dust", pt.x, (pt.y ?? 0) + 0.8, pt.z, "#c29b67", 0.75);
      }
      _env.ui?.showToast?.(`Golpeando árvore... (${hits}/4 cortes)`);
      return true;
    }

    // 4º Golpe: tomba a árvore suavemente por gravidade
    _treeChopProgress.delete(treeKey);
    playWoodChopSound();

    _registerHarvestedInstance(hit.object, hit.instanceId);

    // Oculta a árvore instanciada imediatamente
    hit.object.getMatrixAt(hit.instanceId, _dummyMatrix);
    _dummyMatrix.scale(_zeroScale);
    hit.object.setMatrixAt(hit.instanceId, _dummyMatrix);
    hit.object.instanceMatrix.needsUpdate = true;

    // Dispara a árvore tombando em direção oposta ao jogador
    _spawnFallingTree(hit.object, hit.instanceId, player, pt);
    _env.ui?.showToast?.(`Árvore caindo! (4/4)`);
    return true;
  } else if (toolType === "PICKAXE" && hit.object.name === "Rocks") {
    const gainedStone = Math.floor(Math.random() * 2) + 1;
    PlayerInventory.stone += gainedStone;
    const bonusClay = Math.random() < 0.35 ? 1 : 0;
    if (bonusClay > 0) {
      PlayerInventory.clay = (PlayerInventory.clay || 0) + bonusClay;
    }
    playStoneMineSound();

    _registerHarvestedInstance(hit.object, hit.instanceId);

    hit.object.getMatrixAt(hit.instanceId, _dummyMatrix);
    _dummyMatrix.scale(_zeroScale);
    hit.object.setMatrixAt(hit.instanceId, _dummyMatrix);
    hit.object.instanceMatrix.needsUpdate = true;

    const pt = hit.point || hit.object.userData?.items?.[hit.instanceId];
    if (pt && _env.effects) {
      _env.effects.play("star", pt.x, (pt.y ?? 0) + 0.5, pt.z, "#d8dbd6", 0.95);
    }
    const bonusText = bonusClay > 0 ? " · +1 Barro" : "";
    _env.ui?.showToast?.(`+${gainedStone} Pedra${bonusText} (Pedras: ${PlayerInventory.stone})`);
    syncPlayerStatsToPlayer();
    return true;
  } else if ((toolType === "SCYTHE" || !toolType) && (hit.object.name === "Hay" || hit.object.name === "Crops" || hit.object.name === "Clutter_HayMounds" || hit.object.name === "Farm_Crops")) {
    const gainedHay = Math.floor(Math.random() * 3) + 2;
    PlayerInventory.hay = (PlayerInventory.hay || 0) + gainedHay;

    _registerHarvestedInstance(hit.object, hit.instanceId);

    hit.object.getMatrixAt(hit.instanceId, _dummyMatrix);
    _dummyMatrix.scale(_zeroScale);
    hit.object.setMatrixAt(hit.instanceId, _dummyMatrix);
    hit.object.instanceMatrix.needsUpdate = true;

    // Ação virtuosa de sobrevivente: recua a corrupção do mundo
    if (typeof WorldDecay !== "undefined" && WorldDecay.decayLevel) {
      WorldDecay.decayLevel = Math.max(0, WorldDecay.decayLevel - 0.015);
    }

    const pt = hit.point || hit.object.userData?.items?.[hit.instanceId];
    if (pt && _env.effects) {
      _env.effects.play("dust", pt.x, (pt.y ?? 0) + 0.4, pt.z, "#e3c26a", 1.4);
    }
    _env.ui?.showToast?.(`🌾 Colheita com a Foice! +${gainedHay} Feno (Feno: ${PlayerInventory.hay}) · A terra floresce (-1.5% Corrupção)`);
    syncPlayerStatsToPlayer();
    return true;
  } else if ((toolType === "PICKAXE" || toolType === "AXE" || !toolType) && hit.object.name === "Clay") {
    const gainedClay = Math.floor(Math.random() * 3) + 2;
    PlayerInventory.clay = (PlayerInventory.clay || 0) + gainedClay;
    playStoneMineSound();

    _registerHarvestedInstance(hit.object, hit.instanceId);

    hit.object.getMatrixAt(hit.instanceId, _dummyMatrix);
    _dummyMatrix.scale(_zeroScale);
    hit.object.setMatrixAt(hit.instanceId, _dummyMatrix);
    hit.object.instanceMatrix.needsUpdate = true;

    const pt = hit.point || hit.object.userData?.items?.[hit.instanceId];
    if (pt && _env.effects) {
      _env.effects.play("dust", pt.x, (pt.y ?? 0) + 0.4, pt.z, "#9c5737", 1.8);
    }
    _env.ui?.showToast?.(`+${gainedClay} Barro recolhido (Total: ${PlayerInventory.clay})`);
    syncPlayerStatsToPlayer();
    return true;
  }
  return false;
}

// ============================================================================
// 11. Modo Construção: Catálogo de 10 Estruturas, Pool e Preview Holográfico
// ============================================================================
// Meias-dimensões (largura/2, profundidade/2) das construções grandes do jogador, para a checagem de sobreposição
const PLAYER_BUILD_FOOTPRINT = {
  HOUSE: [3.9, 3.4],
  CABIN: [3.1, 2.8],
  BARN: [4.4, 3.8],
  BLACKSMITH_SHED: [2.9, 2.6],
  CORRAL: [3.4, 3.4],
};

export const BUILD_COSTS = {
  HAY_BALE: {
    hay: 10,
    label: "Bloco de Feno",
    desc: "Fardo de feno bruto: custa 10 de feno e rende 50 quando ceifado com a Foice.",
    category: "VILA",
    icon: "🌾",
  },
  CABIN: {
    wood: 12,
    stone: 4,
    label: "Cabana Rústica",
    desc: "Refúgio de caçador com paredes de toras de carvalho e teto inclinado.",
    category: "VILA",
    icon: "⛺",
  },
  HOUSE: {
    wood: 20,
    stone: 10,
    label: "Casa de Enxaimel",
    desc: "Residência nobre de dois pisos com mobília, cama, lareira e baú.",
    category: "VILA",
    icon: "🏠",
  },
  CORRAL: {
    wood: 10,
    hay: 5,
    label: "Curral de Cavalos",
    desc: "Cercado resistente com porteira frontal e cocho de feno para montarias.",
    category: "DEFESA",
    icon: "🐎",
  },
  BARN: {
    wood: 18,
    stone: 6,
    hay: 8,
    label: "Celeiro / Depósito",
    desc: "Galpão amplo com base de cantaria, teto de palha e fardos armazenados.",
    category: "DEFESA",
    icon: "🛖",
  },
  WATCHTOWER: {
    wood: 22,
    stone: 8,
    label: "Torre de Vigia",
    desc: "Alta torre de sentinela com escadaria e plataforma com parapeito elevado.",
    category: "DEFESA",
    icon: "🏰",
  },
  WALL_GATE: {
    wood: 14,
    stone: 4,
    label: "Paliçada com Portão",
    desc: "Muralha de toras afiadas fortificadas com portal de entrada e vigas.",
    category: "DEFESA",
    icon: "🛡️",
  },
  BLACKSMITH_SHED: {
    wood: 15,
    stone: 12,
    label: "Forja do Ferreiro",
    desc: "Oficina rústica com fornalha de pedra, bigorna de ferro e bancada.",
    category: "DEFESA",
    icon: "⚒️",
  },
  WELL: {
    wood: 6,
    stone: 14,
    label: "Poço de Cantaria",
    desc: "Poço circular de pedra esculpida com roldana de madeira e balde suspenso.",
    category: "VILA",
    icon: "🪣",
  },
  TORCH_POST: {
    wood: 4,
    hay: 2,
    torches: 1,
    label: "Poste de Iluminação",
    desc: "Poste alto de madeira com suporte de ferro forjado e tocha permanente (exige 1 tocha no inventário).",
    category: "VILA",
    icon: "🏮",
  },
  CAMPFIRE: {
    wood: 6,
    stone: 6,
    label: "Fogueira de Acampamento",
    desc: "Círculo de pedras com brasas ardentes e troncos rústicos para assento.",
    category: "VILA",
    icon: "🔥",
  },
  STONE_WALL_SMALL: {
    wood: 0,
    stone: 6,
    clay: 0,
    label: "Muro Pequeno de Pedra",
    desc: "Mureta sólida de alvenaria de pedra lavrada com arremate superior nivelado.",
    category: "DEFESA",
    icon: "🧱",
  },
  STONE_WALL_LARGE: {
    wood: 4,
    stone: 16,
    clay: 0,
    label: "Muralha Grande de Pedra",
    desc: "Alta muralha fortificada como as da cidade, com passadiço elevado, parapeito e ameias.",
    category: "DEFESA",
    icon: "🏰",
  },
  CLAY_WALL_SMALL: {
    wood: 1,
    stone: 0,
    clay: 6,
    hay: 2,
    label: "Muro Pequeno de Barro",
    desc: "Muro baixo de taipa e blocos de adobe de barro cozido com reforço de fibras.",
    category: "DEFESA",
    icon: "🧱",
  },
  CLAY_WALL_LARGE: {
    wood: 4,
    stone: 0,
    clay: 14,
    hay: 4,
    label: "Muralha Grande de Barro",
    desc: "Imponente muralha de barro batido e taipa de pilão com passadiço e ameias de argila.",
    category: "DEFESA",
    icon: "🛖",
  },
};

export const CRAFT_DURABILITY = {
  makeshift_spear: 10,
  makeshift_club: 15,
};

const _playerBuildingsPool = [];
const _buildOffset = new THREE.Vector3();
const _buildEuler = new THREE.Euler();

function _buildPlayerHouseMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x77796d, roughness: 0.95, flatShading: true });
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xd9cca9, roughness: 0.88, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4e3620, roughness: 0.92, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6e3d2c, roughness: 0.9, flatShading: true });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x7a5b3a, roughness: 0.9, flatShading: true });
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x93302a, roughness: 0.95, flatShading: true });
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd4b055, roughness: 0.9, flatShading: true });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.5, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffe29a, roughness: 0.3, transparent: true, opacity: 0.85 });

  // 1. Fundação maciça de pedra com degrau frontal de entrada
  const found = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.2, 4.6), stoneMat);
  found.position.set(0, -1.5, 0);
  found.castShadow = false; // fundação enterrada: só gerava sombra chapada no próprio chão
  found.receiveShadow = true;
  group.add(found);

  const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.7), stoneMat);
  step1.position.set(0, 0.08, 2.45);
  group.add(step1);

  // 2. Piso de tábuas de madeira no interior
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 4.0), floorMat);
  floor.position.set(0, 0.06, 0);
  group.add(floor);

  // Tapete rústico de tear na entrada
  const rug = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 2.0), rugMat);
  rug.position.set(0, 0.13, 0.3);
  group.add(rug);

  // 3. Paredes de Enxaimel (Half-Timbered): reboco + vigas de carvalho aparentes
  // Parede Traseira (-Z)
  const backW = new THREE.Mesh(new THREE.BoxGeometry(4.9, 3.1, 0.22), plasterMat);
  backW.position.set(0, 1.6, -2.0);
  backW.castShadow = true;
  group.add(backW);

  // Parede Esquerda (-X)
  const leftW = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.1, 4.1), plasterMat);
  leftW.position.set(-2.4, 1.6, 0);
  leftW.castShadow = true;
  group.add(leftW);

  // Parede Direita (+X)
  const rightW = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.1, 4.1), plasterMat);
  rightW.position.set(2.4, 1.6, 0);
  rightW.castShadow = true;
  group.add(rightW);

  // Fachada Frontal com vão de porta aberta (+Z)
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(1.65, 3.1, 0.22), plasterMat);
  frontL.position.set(-1.62, 1.6, 2.0);
  frontL.castShadow = true;
  group.add(frontL);

  const frontR = new THREE.Mesh(new THREE.BoxGeometry(1.65, 3.1, 0.22), plasterMat);
  frontR.position.set(1.62, 1.6, 2.0);
  frontR.castShadow = true;
  group.add(frontR);

  const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.85, 0.24), timberMat);
  doorHeader.position.set(0, 2.72, 2.0);
  group.add(doorHeader);

  // Vigamento Enxaimel estrutural aparente nos 4 cantos e beirais
  for (const cx of [-2.45, 2.45]) {
    for (const cz of [-2.05, 2.05]) {
      const cornerPost = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.2, 0.26), timberMat);
      cornerPost.position.set(cx, 1.6, cz);
      group.add(cornerPost);
    }
  }
  // Viga cinta superior perimetral
  const beamFront = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.2, 0.26), timberMat);
  beamFront.position.set(0, 3.15, 2.05);
  group.add(beamFront);
  const beamBack = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.2, 0.26), timberMat);
  beamBack.position.set(0, 3.15, -2.05);
  group.add(beamBack);

  // Janelas medievais com batentes e vidro âmbar nas laterais
  for (const sx of [-2.42, 2.42]) {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.9), glassMat);
    glass.position.set(sx, 1.7, 0);
    group.add(glass);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 1.05), timberMat);
    frame.position.set(sx, 1.7, 0);
    group.add(frame);
    // Venezianas/contraventuras de madeira abertas
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.45), timberMat);
    shutter.position.set(sx + (sx > 0 ? 0.12 : -0.12), 1.7, 0.65);
    shutter.rotation.y = sx > 0 ? -0.4 : 0.4;
    group.add(shutter);
  }

  // 4. Telhado de duas águas medieval (Gable Roof) com beirais pronunciados
  const roofPitch = 1.6;
  const roofRun = 2.75;
  const roofLen = Math.hypot(roofRun, roofPitch);
  const roofAng = Math.atan2(roofPitch, roofRun);

  const roofGroup = new THREE.Group();
  roofGroup.name = "HouseRoofGroup";
  group.add(roofGroup);
  group.roofGroup = roofGroup;

  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(roofLen + 0.35, 0.16, 4.7), roofMat);
    slope.position.set(side * (roofRun * 0.5), 3.1 + roofPitch * 0.5, 0);
    slope.rotation.z = -side * roofAng;
    slope.castShadow = true;
    roofGroup.add(slope);
  }
  // Cumeeira central reforçada
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 4.8), timberMat);
  ridge.position.set(0, 3.1 + roofPitch + 0.05, 0);
  roofGroup.add(ridge);

  // Frontões triangulares (Oitões) na frente e trás
  for (const fz of [-2.02, 2.02]) {
    const gable = new THREE.Mesh(new THREE.ConeGeometry(2.7, roofPitch, 4), plasterMat);
    gable.position.set(0, 3.1 + roofPitch * 0.46, fz);
    gable.rotation.y = Math.PI / 4;
    roofGroup.add(gable);
  }

  // Chaminé de pedra lateral
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.8, 0.7), stoneMat);
  chimney.position.set(-1.8, 2.5, -1.5);
  chimney.castShadow = true;
  group.add(chimney);
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.15, 0.85), stoneMat);
  chimneyCap.position.set(-1.8, 4.95, -1.5);
  group.add(chimneyCap);

  // 5. Interior Aconchegante Mobiliado (Cama rústica, Mesa de carvalho, Baú, Lareira)
  // Cama com colchão de palha e travesseiro
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 2.0), timberMat);
  bedFrame.position.set(-1.6, 0.25, 0.9);
  group.add(bedFrame);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 1.85), hayMat);
  mattress.position.set(-1.6, 0.48, 0.9);
  group.add(mattress);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.45), plasterMat);
  pillow.position.set(-1.6, 0.58, 1.55);
  group.add(pillow);

  // Mesa rústica e banco
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.6), timberMat);
  tableTop.position.set(1.5, 0.82, -0.6);
  group.add(tableTop);
  for (const tx of [1.1, 1.9]) {
    for (const tz of [-1.2, 0.0]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.76, 0.1), timberMat);
      leg.position.set(tx, 0.42, tz);
      group.add(leg);
    }
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 1.4), timberMat);
  bench.position.set(0.95, 0.26, -0.6);
  group.add(bench);

  // Baú de madeira e ferro no canto
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.55), timberMat);
  chest.position.set(1.7, 0.35, 1.5);
  group.add(chest);
  const chestBands = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.57, 0.14), ironMat);
  chestBands.position.set(1.7, 0.35, 1.5);
  group.add(chestBands);

  group.visible = false;
  group.userData = { type: "HOUSE", collidersRegistered: false };
  return group;
}

function _buildPlayerCabinMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x77796d, roughness: 0.95, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4e3620, roughness: 0.92, flatShading: true });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2915, roughness: 0.95, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6e3d2c, roughness: 0.9, flatShading: true });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x7a5b3a, roughness: 0.9, flatShading: true });
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x2a5435, roughness: 0.95, flatShading: true });

  // Fundação baixa de pedra
  const found = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 3.2), stoneMat);
  found.position.set(0, 0.1, 0);
  found.castShadow = false;
  group.add(found);

  // Piso de tábuas
  const floor = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 2.9), floorMat);
  floor.position.set(0, 0.25, 0);
  group.add(floor);

  // Paredes de toras de carvalho
  const backW = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 0.26), logMat);
  backW.position.set(0, 1.35, -1.35);
  backW.castShadow = true;
  group.add(backW);

  const leftW = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.2, 2.9), logMat);
  leftW.position.set(-1.7, 1.35, 0);
  leftW.castShadow = true;
  group.add(leftW);

  const rightW = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.2, 2.9), logMat);
  rightW.position.set(1.7, 1.35, 0);
  rightW.castShadow = true;
  group.add(rightW);

  // Fachada com vão de porta
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.26), logMat);
  frontL.position.set(-1.15, 1.35, 1.35);
  frontL.castShadow = true;
  group.add(frontL);

  const frontR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.26), logMat);
  frontR.position.set(1.15, 1.35, 1.35);
  frontR.castShadow = true;
  group.add(frontR);

  const header = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.28), timberMat);
  header.position.set(0, 2.2, 1.35);
  group.add(header);

  // Telhado inclinado de duas águas
  const roofGroup = new THREE.Group();
  roofGroup.name = "CabinRoofGroup";
  group.add(roofGroup);
  group.roofGroup = roofGroup;

  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 3.4), roofMat);
    slope.position.set(side * 1.0, 2.8, 0);
    slope.rotation.z = -side * 0.48;
    slope.castShadow = true;
    roofGroup.add(slope);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 3.5), timberMat);
  ridge.position.set(0, 3.25, 0);
  roofGroup.add(ridge);

  // Interior: cama rústica de campanha, banqueta e tapete de caça
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd4b055, roughness: 0.9, flatShading: true });
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.8), timberMat);
  bedFrame.position.set(-1.0, 0.35, -0.4);
  group.add(bedFrame);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 1.65), hayMat);
  mattress.position.set(-1.0, 0.52, -0.4);
  group.add(mattress);

  const rug = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 1.2), rugMat);
  rug.position.set(0, 0.31, 0);
  group.add(rug);

  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 6), timberMat);
  stool.position.set(0.9, 0.48, -0.6);
  group.add(stool);

  group.visible = false;
  group.userData = { type: "CABIN", collidersRegistered: false };
  return group;
}

function _buildPlayerBarnMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e6e66, roughness: 0.95, flatShading: true });
  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0x543b23, roughness: 0.9, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.92, flatShading: true });
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xdfbe60, roughness: 0.9, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a4530, roughness: 0.88, flatShading: true });

  // Base reforçada de cantaria
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.6, 5.0), stoneMat);
  base.position.set(0, 0.25, 0);
  base.castShadow = true;
  group.add(base);

  // Paredes altas de celeiro
  const backW = new THREE.Mesh(new THREE.BoxGeometry(5.9, 3.5, 0.25), woodPlankMat);
  backW.position.set(0, 2.1, -2.3);
  backW.castShadow = true;
  group.add(backW);

  const leftW = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 4.6), woodPlankMat);
  leftW.position.set(-2.9, 2.1, 0);
  leftW.castShadow = true;
  group.add(leftW);

  const rightW = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 4.6), woodPlankMat);
  rightW.position.set(2.9, 2.1, 0);
  rightW.castShadow = true;
  group.add(rightW);

  // Frente com grande vão de carga
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.5, 0.25), woodPlankMat);
  frontL.position.set(-1.95, 2.1, 2.3);
  frontL.castShadow = true;
  group.add(frontL);

  const frontR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.5, 0.25), woodPlankMat);
  frontR.position.set(1.95, 2.1, 2.3);
  frontR.castShadow = true;
  group.add(frontR);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.32), timberMat);
  lintel.position.set(0, 3.5, 2.3);
  group.add(lintel);

  // Pilares mestres nos cantos
  for (const cx of [-2.95, 2.95]) {
    for (const cz of [-2.35, 2.35]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.8, 0.35), timberMat);
      post.position.set(cx, 2.1, cz);
      group.add(post);
    }
  }

  // Telhado alto de duas águas
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.16, 5.3), roofMat);
    slope.position.set(side * 1.55, 4.5, 0);
    slope.rotation.z = -side * 0.58;
    slope.castShadow = true;
    group.add(slope);
  }

  // Fardos de feno empilhados no interior
  for (let fx = -1.8; fx <= -0.8; fx += 0.9) {
    for (let fz = -1.4; fz <= 0.4; fz += 0.8) {
      const bale = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.7), hayMat);
      bale.position.set(fx, 0.75, fz);
      group.add(bale);
    }
  }

  group.visible = false;
  group.userData = { type: "BARN", collidersRegistered: false };
  return group;
}

function _buildPlayerWatchtowerMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x73746c, roughness: 0.95, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x46321d, roughness: 0.92, flatShading: true });
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x6e5132, roughness: 0.9, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x69392b, roughness: 0.9, flatShading: true });

  // 4 sapatas de pedra nas bases
  for (const px of [-1.3, 1.3]) {
    for (const pz of [-1.3, 1.3]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.55), stoneMat);
      foot.position.set(px, 0.25, pz);
      group.add(foot);

      // Pilares mestres subindo 6.2 metros
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6.2, 0.28), timberMat);
      post.position.set(px, 3.4, pz);
      post.castShadow = true;
      group.add(post);
    }
  }

  // Travessas horizontais de reforço
  for (const hy of [2.0, 4.2]) {
    const beamF = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.18), timberMat);
    beamF.position.set(0, hy, 1.3);
    group.add(beamF);
    const beamB = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.18), timberMat);
    beamB.position.set(0, hy, -1.3);
    group.add(beamB);
    const beamL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 2.8), timberMat);
    beamL.position.set(-1.3, hy, 0);
    group.add(beamL);
    const beamR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 2.8), timberMat);
    beamR.position.set(1.3, hy, 0);
    group.add(beamR);
  }

  // Plataforma superior de vigia (em y = 5.2m)
  const platform = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.18, 3.3), plankMat);
  platform.position.set(0, 5.2, 0);
  platform.castShadow = true;
  group.add(platform);

  // Parapeito de proteção com frestas de tiro
  const railF = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.95, 0.14), plankMat);
  railF.position.set(0, 5.75, 1.58);
  group.add(railF);
  const railB = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.95, 0.14), plankMat);
  railB.position.set(0, 5.75, -1.58);
  group.add(railB);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 3.1), plankMat);
  railL.position.set(-1.58, 5.75, 0);
  group.add(railL);
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 3.1), plankMat);
  railR.position.set(1.58, 5.75, 0);
  group.add(railR);

  // Telhadinho piramidal 4 águas no topo
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 4), roofMat);
  roof.position.set(0, 6.9, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Escada rústica inclinada na lateral traseira
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.6, 0.12), timberMat);
  ladder.position.set(0, 2.7, -1.55);
  ladder.rotation.x = 0.22;
  group.add(ladder);

  group.visible = false;
  group.userData = { type: "WATCHTOWER", collidersRegistered: false };
  return group;
}

function _buildPlayerWallGateMesh() {
  const group = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x48321e, roughness: 0.93, flatShading: true });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2915, roughness: 0.95, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x70706a, roughness: 0.95, flatShading: true });

  // Paliçada de estacas pontiagudas laterais
  const postGeo = new THREE.CylinderGeometry(0.12, 0.16, 3.2, 5);
  for (let x = -3.4; x <= -1.2; x += 0.28) {
    const post = new THREE.Mesh(postGeo, logMat);
    post.position.set(x, 1.6, 0);
    post.castShadow = true;
    group.add(post);
  }
  for (let x = 1.2; x <= 3.4; x += 0.28) {
    const post = new THREE.Mesh(postGeo, logMat);
    post.position.set(x, 1.6, 0);
    post.castShadow = true;
    group.add(post);
  }

  // Traves horizontais de amarração
  for (const hy of [0.9, 2.2]) {
    const railL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), timberMat);
    railL.position.set(-2.3, hy, -0.16);
    group.add(railL);
    const railR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), timberMat);
    railR.position.set(2.3, hy, -0.16);
    group.add(railR);
  }

  // Pilares do Portal Central
  for (const gx of [-1.15, 1.15]) {
    const gPost = new THREE.Mesh(new THREE.BoxGeometry(0.38, 3.8, 0.38), timberMat);
    gPost.position.set(gx, 1.9, 0);
    gPost.castShadow = true;
    group.add(gPost);

    const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), stoneMat);
    stoneBase.position.set(gx, 0.2, 0);
    group.add(stoneBase);
  }

  // Viga lintel superior e platibanda
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.32, 0.42), timberMat);
  lintel.position.set(0, 3.65, 0);
  group.add(lintel);

  // Portões de madeira entreabertos
  const gateL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.5, 0.12), timberMat);
  gateL.position.set(-0.6, 1.35, 0.2);
  gateL.rotation.y = -0.35;
  group.add(gateL);

  const gateR = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.5, 0.12), timberMat);
  gateR.position.set(0.6, 1.35, 0.2);
  gateR.rotation.y = 0.35;
  group.add(gateR);

  group.visible = false;
  group.userData = { type: "WALL_GATE", collidersRegistered: false };
  return group;
}

function _buildPlayerBlacksmithMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x686862, roughness: 0.95, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.92, flatShading: true });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.65, roughness: 0.45, flatShading: true });
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xff5511, emissive: 0xff3300, emissiveIntensity: 1.5 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a3426, roughness: 0.9, flatShading: true });

  // Piso rústico de pedras
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 3.8), stoneMat);
  floor.position.set(0, 0.1, 0);
  group.add(floor);

  // 4 Pilares de carvalho
  for (const px of [-1.9, 1.9]) {
    for (const pz of [-1.6, 1.6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.9, 0.24), timberMat);
      post.position.set(px, 1.5, pz);
      group.add(post);
    }
  }

  // Telhado inclinado de uma água
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.14, 4.1), roofMat);
  roof.position.set(0, 3.1, 0);
  roof.rotation.x = -0.14;
  roof.castShadow = true;
  group.add(roof);

  // Fornalha e chaminé de pedra no fundo
  const forge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.2), stoneMat);
  forge.position.set(1.1, 0.7, -1.0);
  group.add(forge);

  const coals = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.8), fireMat);
  coals.position.set(1.1, 1.28, -1.0);
  group.add(coals);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.6, 0.65), stoneMat);
  chimney.position.set(1.1, 2.6, -1.0);
  group.add(chimney);

  // Toco de tora com bigorna de ferro
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.65, 7), timberMat);
  stump.position.set(-0.6, 0.42, 0.2);
  group.add(stump);

  const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.34), ironMat);
  anvilBase.position.set(-0.6, 0.85, 0.2);
  group.add(anvilBase);

  const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 5), ironMat);
  anvilHorn.position.set(-0.85, 0.95, 0.2);
  anvilHorn.rotation.z = Math.PI / 2;
  group.add(anvilHorn);

  // Bancada de ferramentas e balde de têmpera
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 0.7), timberMat);
  bench.position.set(-1.1, 0.48, -1.1);
  group.add(bench);

  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.55, 6), timberMat);
  tub.position.set(0.1, 0.38, -1.1);
  group.add(tub);

  group.visible = false;
  group.userData = { type: "BLACKSMITH_SHED", collidersRegistered: false };
  return group;
}

function _buildPlayerWellMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x777872, roughness: 0.95, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.92, flatShading: true });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x225577, roughness: 0.1, metalness: 0.1 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6e3d2c, roughness: 0.9, flatShading: true });

  // Brocal cilíndrico de pedras
  const wellRim = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.85, 10, 1, true), stoneMat);
  wellRim.position.set(0, 0.42, 0);
  wellRim.castShadow = true;
  group.add(wellRim);

  const water = new THREE.Mesh(new THREE.CircleGeometry(1.05, 10), waterMat);
  water.position.set(0, 0.25, 0);
  water.rotation.x = -Math.PI / 2;
  group.add(water);

  // Pilares laterais de carvalho
  for (const sx of [-1.15, 1.15]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 0.18), timberMat);
    post.position.set(sx, 1.25, 0);
    group.add(post);
  }

  // Trave horizontal com roldana
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 0.16), timberMat);
  beam.position.set(0, 2.3, 0);
  group.add(beam);

  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 8), timberMat);
  spool.position.set(0, 2.1, 0);
  spool.rotation.z = Math.PI / 2;
  group.add(spool);

  // Balde suspenso
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.32, 6), timberMat);
  bucket.position.set(0, 1.35, 0);
  group.add(bucket);

  // Telhadinho de duas águas
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.8), roofMat);
    slope.position.set(side * 0.62, 2.7, 0);
    slope.rotation.z = -side * 0.52;
    slope.castShadow = true;
    group.add(slope);
  }

  group.visible = false;
  group.userData = { type: "WELL", collidersRegistered: false };
  return group;
}

function _buildPlayerTorchPostMesh() {
  const group = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x48321e, roughness: 0.92, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x73736c, roughness: 0.95, flatShading: true });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.6, roughness: 0.45 });
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xff7722, emissive: 0xff4400, emissiveIntensity: 2.0 });

  // Sapata de pedra
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), stoneMat);
  base.position.set(0, 0.2, 0);
  group.add(base);

  // Mastro vertical de madeira
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.2, 6), timberMat);
  post.position.set(0, 1.8, 0);
  post.castShadow = true;
  group.add(post);

  // Suporte de ferro forjado
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.08), ironMat);
  bracket.position.set(0.24, 3.1, 0);
  group.add(bracket);

  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.26, 6, 1, true), ironMat);
  basket.position.set(0.48, 3.25, 0);
  group.add(basket);

  // Tocha permanente com chama
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 5), fireMat);
  flame.position.set(0.48, 3.48, 0);
  group.add(flame);

  // Luz dinâmica da tocha construída (dobrada)
  const torchLight = new THREE.PointLight(0xffaa44, 4.4, 28, 1.8);
  torchLight.position.set(0.48, 3.55, 0);
  torchLight.castShadow = false;
  group.add(torchLight);

  group.visible = false;
  group.userData = { type: "TORCH_POST", collidersRegistered: false };
  return group;
}

function _buildPlayerCampfireMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e6e66, roughness: 0.95, flatShading: true });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.95, flatShading: true });
  const ashMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1.0 });
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xff6611, emissive: 0xff3300, emissiveIntensity: 2.2 });

  // Cinzas no solo
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.75, 8), ashMat);
  ash.position.set(0, 0.02, 0);
  ash.rotation.x = -Math.PI / 2;
  group.add(ash);

  // Círculo de pedras arredondadas
  const rockGeo = new THREE.DodecahedronGeometry(0.18, 0);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const r = new THREE.Mesh(rockGeo, stoneMat);
    r.position.set(Math.cos(ang) * 0.72, 0.12, Math.sin(ang) * 0.72);
    group.add(r);
  }

  // Lenhas em cone no centro
  const woodLogGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.75, 5);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const log = new THREE.Mesh(woodLogGeo, logMat);
    log.position.set(Math.cos(ang) * 0.18, 0.22, Math.sin(ang) * 0.18);
    log.rotation.z = 0.42;
    log.rotation.y = ang;
    group.add(log);
  }

  // Chama ardente
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 6), fireMat);
  flame.position.set(0, 0.38, 0);
  group.add(flame);

  // Luz suave da fogueira (dobrada)
  const fireLight = new THREE.PointLight(0xff8833, 4.8, 32, 1.8);
  fireLight.position.set(0, 0.55, 0);
  group.add(fireLight);

  // Dois troncos caídos de assento ao redor
  const seatGeo = new THREE.CylinderGeometry(0.2, 0.22, 1.6, 6);
  const seat1 = new THREE.Mesh(seatGeo, logMat);
  seat1.position.set(0, 0.2, -1.35);
  seat1.rotation.z = Math.PI / 2;
  group.add(seat1);

  const seat2 = new THREE.Mesh(seatGeo, logMat);
  seat2.position.set(0, 0.2, 1.35);
  seat2.rotation.z = Math.PI / 2;
  group.add(seat2);

  group.visible = false;
  group.userData = { type: "CAMPFIRE", collidersRegistered: false };
  return group;
}

function _buildStoneWallSmallMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e6e6a, roughness: 0.95, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x565652, roughness: 0.92, flatShading: true });

  // Corpo principal do muro (3.8m comprimento × 2.0m altura × 0.75m espessura)
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.0, 0.75), stoneMat);
  body.position.set(0, 1.0, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Pilares / contrafortes reforçados nas duas extremidades
  for (const px of [-1.8, 1.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.2, 0.95), capMat);
    post.position.set(px, 1.1, 0);
    post.castShadow = true;
    group.add(post);
  }

  // Platibanda / acabamento em cantaria chanfrada no topo
  const cap = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.2, 0.88), capMat);
  cap.position.set(0, 2.08, 0);
  cap.castShadow = true;
  group.add(cap);

  group.visible = false;
  group.userData = { type: "STONE_WALL_SMALL", collidersRegistered: false };
  return group;
}

function _buildStoneWallLargeMesh() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x686862, roughness: 0.96, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x4e4e4a, roughness: 0.92, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9, flatShading: true });

  // Fundação larga e resistente
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.8, 2.1), trimMat);
  foundation.position.set(0, 0.4, 0);
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  // Paredão maciço de cantaria (6.0m de comprimento, 4.4m até o passadiço, 1.8m espessura)
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6.0, 4.4, 1.8), stoneMat);
  wall.position.set(0, 3.0, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Passadiço de topo (caminho de ronda)
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.22, 1.82), trimMat);
  walkway.position.set(0, 5.25, 0);
  group.add(walkway);

  // Parapeito frontal defensivo (Z = +0.74)
  const parapetFront = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.85, 0.32), stoneMat);
  parapetFront.position.set(0, 5.75, 0.74);
  parapetFront.castShadow = true;
  group.add(parapetFront);

  // Ameias / merlões clássicos como as muralhas da cidade
  for (let m = -2; m <= 2; m++) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.36), trimMat);
    merlon.position.set(m * 1.35, 6.42, 0.74);
    merlon.castShadow = true;
    group.add(merlon);
  }

  // Guarda-corpo de madeira atrás (Z = -0.8)
  const railingBack = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.12, 0.12), timberMat);
  railingBack.position.set(0, 6.1, -0.8);
  group.add(railingBack);

  for (const rx of [-2.7, -0.9, 0.9, 2.7]) {
    const railPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), timberMat);
    railPost.position.set(rx, 5.75, -0.8);
    group.add(railPost);
  }

  // Escada de acesso de madeira na parte traseira
  for (const lx of [-0.4, 0.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5.6, 0.12), timberMat);
    rail.position.set(lx, 2.7, -1.02);
    rail.rotation.x = -0.16;
    group.add(rail);
  }
  for (let s = 1; s <= 9; s++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.08), timberMat);
    rung.position.set(0, s * 0.55, -0.95 + s * 0.08);
    group.add(rung);
  }

  group.visible = false;
  group.userData = { type: "STONE_WALL_LARGE", collidersRegistered: false };
  return group;
}

function _buildClayWallSmallMesh() {
  const group = new THREE.Group();
  const clayMat = new THREE.MeshStandardMaterial({ color: 0x9e5535, roughness: 0.96, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x82442a, roughness: 0.94, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4a321c, roughness: 0.9, flatShading: true });

  // Corpo do muro de adobe e barro (3.8m × 2.0m × 0.75m)
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.95, 0.75), clayMat);
  body.position.set(0, 1.0, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Vigas verticais de contenção de madeira embutidas
  for (const px of [-1.8, 0, 1.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 0.82), timberMat);
    post.position.set(px, 1.1, 0);
    post.castShadow = true;
    group.add(post);
  }

  // Cobertura de proteção contra chuva em barro cozido no topo
  const cap = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.18, 0.86), trimMat);
  cap.position.set(0, 2.05, 0);
  cap.castShadow = true;
  group.add(cap);

  group.visible = false;
  group.userData = { type: "CLAY_WALL_SMALL", collidersRegistered: false };
  return group;
}

function _buildClayWallLargeMesh() {
  const group = new THREE.Group();
  const clayMat = new THREE.MeshStandardMaterial({ color: 0x9a5232, roughness: 0.96, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x7c3f24, roughness: 0.94, flatShading: true });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x46301a, roughness: 0.9, flatShading: true });

  // Base reforçada de taipa
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.8, 2.1), trimMat);
  foundation.position.set(0, 0.4, 0);
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  // Muralha de taipa de pilão / barro batido (6.0m de comprimento, 4.4m até o passadiço, 1.8m espessura)
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6.0, 4.4, 1.8), clayMat);
  wall.position.set(0, 3.0, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Vigamentos horizontais de madeira estrutural
  for (const wy of [1.6, 3.4]) {
    const beamF = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.18, 0.14), timberMat);
    beamF.position.set(0, wy, 0.91);
    group.add(beamF);

    const beamB = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.18, 0.14), timberMat);
    beamB.position.set(0, wy, -0.91);
    group.add(beamB);
  }

  // Passadiço de topo (caminho de ronda)
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.22, 1.82), trimMat);
  walkway.position.set(0, 5.25, 0);
  group.add(walkway);

  // Parapeito frontal de barro (Z = +0.74)
  const parapetFront = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.85, 0.32), clayMat);
  parapetFront.position.set(0, 5.75, 0.74);
  parapetFront.castShadow = true;
  group.add(parapetFront);

  // Ameias de adobe no topo
  for (let m = -2; m <= 2; m++) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.36), trimMat);
    merlon.position.set(m * 1.35, 6.42, 0.74);
    merlon.castShadow = true;
    group.add(merlon);
  }

  // Guarda-corpo de toras atrás
  const railingBack = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.12, 0.12), timberMat);
  railingBack.position.set(0, 6.1, -0.8);
  group.add(railingBack);

  for (const rx of [-2.7, -0.9, 0.9, 2.7]) {
    const railPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), timberMat);
    railPost.position.set(rx, 5.75, -0.8);
    group.add(railPost);
  }

  // Escada de acesso de madeira na parte traseira
  for (const lx of [-0.4, 0.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5.6, 0.12), timberMat);
    rail.position.set(lx, 2.7, -1.02);
    rail.rotation.x = -0.16;
    group.add(rail);
  }
  for (let s = 1; s <= 9; s++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.08), timberMat);
    rung.position.set(0, s * 0.55, -0.95 + s * 0.08);
    group.add(rung);
  }

  group.visible = false;
  group.userData = { type: "CLAY_WALL_LARGE", collidersRegistered: false };
  return group;
}

// Bloco de feno criado pelo jogador (1 grupo leve: fardo + 2 cordas). Rende 50 de feno com a Foice.
function _buildHayBaleBlockMesh() {
  const group = new THREE.Group();
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd8ba5a, roughness: 0.9, flatShading: true });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a6d41, roughness: 1, flatShading: true });
  const bale = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.75, 0.82), hayMat);
  bale.position.y = 0.38;
  bale.castShadow = true;
  group.add(bale);
  for (const bx of [-0.32, 0.32]) {
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.77, 0.84), ropeMat);
    rope.position.set(bx, 0.38, 0);
    group.add(rope);
  }
  group.visible = false;
  group.userData = { type: "HAY_BALE", collidersRegistered: false, hayLeft: 50 };
  return group;
}

export function getPlayerBuildingsPool() {
  return _playerBuildingsPool;
}

export function buildStructureMeshByType(type) {
  switch (type) {
    case "HAY_BALE": return _buildHayBaleBlockMesh();
    case "CABIN": return _buildPlayerCabinMesh();
    case "HOUSE": return _buildPlayerHouseMesh();
    case "CORRAL": return _buildPlayerCorralMesh();
    case "BARN": return _buildPlayerBarnMesh();
    case "WATCHTOWER": return _buildPlayerWatchtowerMesh();
    case "WALL_GATE": return _buildPlayerWallGateMesh();
    case "BLACKSMITH_SHED": return _buildPlayerBlacksmithMesh();
    case "WELL": return _buildPlayerWellMesh();
    case "TORCH_POST": return _buildPlayerTorchPostMesh();
    case "CAMPFIRE": return _buildPlayerCampfireMesh();
    case "STONE_WALL_SMALL": return _buildStoneWallSmallMesh();
    case "STONE_WALL_LARGE": return _buildStoneWallLargeMesh();
    case "CLAY_WALL_SMALL": return _buildClayWallSmallMesh();
    case "CLAY_WALL_LARGE": return _buildClayWallLargeMesh();
    default: return _buildPlayerHouseMesh();
  }
}

// ----------------------------------------------------------------------------
// Preview Holográfico 3D da Construção (Hologram / Blueprint Preview)
// Suporta com precisão as 10 estruturas medievais!
// ----------------------------------------------------------------------------
let _buildPreviewGroup = null;
const _previewGroupsMap = new Map();
const _previewGreenMat = new THREE.MeshBasicMaterial({ color: 0x3cd070, transparent: true, opacity: 0.48, wireframe: false });
const _previewRedMat = new THREE.MeshBasicMaterial({ color: 0xf54a38, transparent: true, opacity: 0.48, wireframe: false });

function _getBuildPreviewGroup(scene = _env.scene) {
  if (_buildPreviewGroup || !scene) return _buildPreviewGroup;
  _buildPreviewGroup = new THREE.Group();
  _buildPreviewGroup.name = "BuildPreviewHologram";

  const allTypes = Object.keys(BUILD_COSTS);
  for (let i = 0; i < allTypes.length; i++) {
    const t = allTypes[i];
    const meshGroup = buildStructureMeshByType(t);
    meshGroup.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = _previewGreenMat;
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
    meshGroup.visible = false;
    _buildPreviewGroup.add(meshGroup);
    _previewGroupsMap.set(t, meshGroup);
  }

  _buildPreviewGroup.visible = false;
  scene.add(_buildPreviewGroup);
  return _buildPreviewGroup;
}

/**
 * Calcula a posição exata e orientação de construção considerando snapping de 15° para muralhas
 * e inversão de 180° para que portas de casas/cabanas fiquem viradas de frente para o jogador.
 */
export function calculateBuildingTransform(playerPos, playerRot, type = "HOUSE", customAngle = null, pool = _playerBuildingsPool) {
  const isWall = type.startsWith("STONE_WALL_") || type.startsWith("CLAY_WALL_") || type === "WALL_GATE";
  const isHouseType = type === "HOUSE" || type === "CABIN" || type === "BARN";
  const fwdDist = ["TORCH_POST", "CAMPFIRE", "WELL", "HAY_BALE"].includes(type)
    ? 2.6
    : ["CABIN", "CORRAL", "BLACKSMITH_SHED", "STONE_WALL_SMALL", "CLAY_WALL_SMALL"].includes(type)
      ? 3.8
      : 5.0;

  const baseRotY = typeof playerRot === "number" ? playerRot : playerRot?.y ?? 0;
  _buildEuler.set(0, baseRotY, 0);
  _buildOffset.set(0, 0, fwdDist).applyEuler(_buildEuler);

  let bx = (playerPos.x ?? 0) + _buildOffset.x;
  let bz = (playerPos.z ?? 0) + _buildOffset.z;

  const STEP_15 = Math.PI / 12; // 15 graus = 0.261799 rad
  let rotY = customAngle !== null ? customAngle : baseRotY;

  if (isWall) {
    // Quantiza o ângulo da muralha em múltiplos de 15 graus
    rotY = Math.round(rotY / STEP_15) * STEP_15;

    const wallLen = (type.includes("LARGE") || type.includes("GATE")) ? 6.0 : 3.8;
    let bestDistSq = 3.6 * 3.6;
    let snapSocket = null;

    const list = Array.isArray(pool) && pool.length > 0 ? pool : _playerBuildingsPool;
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        const other = list[i];
        if (!other || !other.visible) continue;
        const oType = other.userData?.type || "";
        if (!oType.startsWith("STONE_WALL_") && !oType.startsWith("CLAY_WALL_") && oType !== "WALL_GATE") continue;
        const oLen = (oType.includes("LARGE") || oType.includes("GATE")) ? 6.0 : 3.8;
        const oX = other.position.x;
        const oZ = other.position.z;
        const oY = other.rotation.y;

        const hL = oLen * 0.5;
        const cos = Math.cos(oY);
        const sin = Math.sin(oY);
        const s1X = oX + cos * hL;
        const s1Z = oZ - sin * hL;
        const s2X = oX - cos * hL;
        const s2Z = oZ + sin * hL;

        const d1Sq = (bx - s1X) ** 2 + (bz - s1Z) ** 2;
        if (d1Sq < bestDistSq) {
          bestDistSq = d1Sq;
          snapSocket = { x: s1X, z: s1Z, refAngle: oY };
        }
        const d2Sq = (bx - s2X) ** 2 + (bz - s2Z) ** 2;
        if (d2Sq < bestDistSq) {
          bestDistSq = d2Sq;
          snapSocket = { x: s2X, z: s2Z, refAngle: oY };
        }
      }
    }

    if (snapSocket) {
      // Cola na extremidade da outra muralha e projeta a nova no ângulo selecionado de 15° em 15°
      bx = snapSocket.x + Math.cos(rotY) * (wallLen * 0.5);
      bz = snapSocket.z - Math.sin(rotY) * (wallLen * 0.5);
    }
  } else if (isHouseType) {
    // A fachada com porta está em +Z local. Giramos 180° para a porta ficar virada de frente para o jogador.
    rotY = rotY + Math.PI;
  }

  const by = _env.world ? _env.world.heightAt(bx, bz) : playerPos.y ?? 0;
  return { bx, by, bz, rotY };
}

/**
 * Atualiza posição, rotação e visual translúcido do holograma 3D de construção.
 */
export function updateBuildPreview(playerPos, playerRot, active, type = "HOUSE", customAngle = null) {
  const preview = _getBuildPreviewGroup(_env.scene);
  if (!preview) return;

  if (!active) {
    preview.visible = false;
    for (const grp of _previewGroupsMap.values()) {
      grp.visible = false;
    }
    return;
  }

  const cost = BUILD_COSTS[type] || BUILD_COSTS.HOUSE;
  const canAfford =
    PlayerInventory.wood >= (cost.wood || 0) &&
    (cost.stone ? PlayerInventory.stone >= cost.stone : true) &&
    (cost.hay ? PlayerInventory.hay >= cost.hay : true) &&
    (cost.clay ? (PlayerInventory.clay || 0) >= cost.clay : true) &&
    (cost.torches ? (PlayerInventory.torches || 0) >= cost.torches : true);

  const activeMat = canAfford ? _previewGreenMat : _previewRedMat;

  const { bx, by, bz, rotY } = calculateBuildingTransform(playerPos, playerRot, type, customAngle, _playerBuildingsPool);

  preview.position.set(bx, by, bz);
  preview.rotation.y = rotY;
  preview.visible = true;

  for (const [t, grp] of _previewGroupsMap.entries()) {
    if (t === type) {
      grp.visible = true;
      grp.traverse((obj) => {
        if (obj.isMesh) obj.material = activeMat;
      });
    } else {
      grp.visible = false;
    }
  }
}

function _buildPlayerCorralMesh() {
  const group = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x5c4028, roughness: 0.92, flatShading: true });
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd8b458, roughness: 0.9, flatShading: true });

  const postGeo = new THREE.CylinderGeometry(0.11, 0.13, 1.5, 6);
  const railHGeo = new THREE.BoxGeometry(5.2, 0.1, 0.09);
  const railSideGeo = new THREE.BoxGeometry(0.09, 0.1, 5.2);
  const railGateGeo = new THREE.BoxGeometry(1.65, 0.1, 0.09);

  for (const [px, pz] of [
    [-2.5, -2.5], [0, -2.5], [2.5, -2.5],
    [-2.5, 0], [2.5, 0],
    [-2.5, 2.5], [-0.9, 2.5], [0.9, 2.5], [2.5, 2.5],
  ]) {
    const post = new THREE.Mesh(postGeo, timberMat);
    post.position.set(px, 0.65, pz);
    post.castShadow = true;
    group.add(post);
  }

  for (const ry of [0.52, 1.05]) {
    const backRail = new THREE.Mesh(railHGeo, timberMat);
    backRail.position.set(0, ry, -2.5);
    group.add(backRail);

    const leftRail = new THREE.Mesh(railSideGeo, timberMat);
    leftRail.position.set(-2.5, ry, 0);
    group.add(leftRail);

    const rightRail = new THREE.Mesh(railSideGeo, timberMat);
    rightRail.position.set(2.5, ry, 0);
    group.add(rightRail);

    const frontL = new THREE.Mesh(railGateGeo, timberMat);
    frontL.position.set(-1.7, ry, 2.5);
    group.add(frontL);

    const frontR = new THREE.Mesh(railGateGeo, timberMat);
    frontR.position.set(1.7, ry, 2.5);
    group.add(frontR);
  }

  // Cocho de feno interno para os cavalos
  const trough = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.65), timberMat);
  trough.position.set(-1.2, 0.22, -1.5);
  group.add(trough);

  const hayPile = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.3, 0.5), hayMat);
  hayPile.position.set(-1.2, 0.48, -1.5);
  group.add(hayPile);

  group.visible = false;
  group.userData = { type: "CORRAL", collidersRegistered: false };
  return group;
}

export function createPlayerBuildingsPool(scene = _env.scene, world = _env.world, countPerType = 3) {
  if (_playerBuildingsPool.length > 0 || !scene) return _playerBuildingsPool;
  const types = Object.keys(BUILD_COSTS);
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const qty = ["TORCH_POST", "CAMPFIRE", "WELL"].includes(t) ? 5 : countPerType;
    for (let j = 0; j < qty; j++) {
      const b = buildStructureMeshByType(t);
      scene.add(b);
      _playerBuildingsPool.push(b);
    }
  }
  return _playerBuildingsPool;
}

export const BUILDING_BOUNDS = {
  HAY_BALE: { w: 1.4, d: 1.0, h: 0.8, y: 0.4 },
  CABIN: { w: 3.6, d: 3.0, h: 2.8, y: 1.4 },
  HOUSE: { w: 5.0, d: 4.4, h: 3.8, y: 1.9 },
  CORRAL: { w: 5.2, d: 5.2, h: 1.5, y: 0.75 },
  BARN: { w: 6.0, d: 4.8, h: 4.5, y: 2.25 },
  WATCHTOWER: { w: 3.2, d: 3.2, h: 6.8, y: 3.4 },
  WALL_GATE: { w: 5.2, d: 1.2, h: 3.4, y: 1.7 },
  BLACKSMITH_SHED: { w: 4.2, d: 3.4, h: 3.0, y: 1.5 },
  WELL: { w: 2.4, d: 2.4, h: 2.4, y: 1.2 },
  TORCH_POST: { w: 0.9, d: 0.9, h: 3.4, y: 1.7 },
  CAMPFIRE: { w: 1.8, d: 1.8, h: 0.9, y: 0.45 },
  STONE_WALL_SMALL: { w: 3.8, d: 0.9, h: 2.3, y: 1.15 },
  CLAY_WALL_SMALL: { w: 3.8, d: 0.9, h: 2.3, y: 1.15 },
  STONE_WALL_LARGE: { w: 6.0, d: 1.8, h: 6.8, y: 3.4 },
  CLAY_WALL_LARGE: { w: 6.0, d: 1.8, h: 6.8, y: 3.4 },
};

function _registerBuildingColliders(building, world = _env.world) {
  if (!building || !world) return;
  const bx = building.position.x;
  const by = building.position.y;
  const bz = building.position.z;
  const ry = building.rotation.y;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const toW = (lx, lz) => ({
    x: bx + lx * cos + lz * sin,
    z: bz - lx * sin + lz * cos,
  });

  building.userData.registeredBoxes = building.userData.registeredBoxes || [];
  building.userData.registeredFloors = building.userData.registeredFloors || [];
  const addBox = (cx, cz, width, depth, ry, bottom, top, flags = {}) => {
    const box = world.addOrientedBox(cx, cz, width, depth, ry, bottom, top, flags);
    if (box) {
      box.buildingRef = building;
      building.userData.registeredBoxes.push(box);
    }
    return box;
  };
  const addFloor = (cx, cz, width, depth, ry, y) => {
    const floor = world.addOrientedFloor?.(cx, cz, width, depth, ry, y);
    if (floor) {
      floor.buildingRef = building;
      building.userData.registeredFloors.push(floor);
    }
    return floor;
  };

  const type = building.userData.type;

  if (type === "HOUSE") {
    const top = by + 3.6;
    const bottom = by - 2.5;
    const pBack = toW(0, -2.0);
    const pLeft = toW(-2.36, 0);
    const pRight = toW(2.36, 0);
    const pFrontL = toW(-1.85, 2.0);
    const pFrontR = toW(1.85, 2.0);

    // Registra piso interno e degrau frontal no world.floors para caminhar suavemente
    addFloor(bx, bz, 4.8, 4.0, ry, by + 0.08);
    const pStep = toW(0, 2.45);
    addFloor(pStep.x, pStep.z, 2.2, 0.9, ry, by + 0.08);

    addBox(pBack.x, pBack.z, 5.0, 0.34, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pLeft.x, pLeft.z, 0.34, 4.2, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pRight.x, pRight.z, 0.34, 4.2, ry, bottom, top, { move: true, shot: true, cam: false });
    // Paredes frontais com vão de porta amplo (2.4m) livre de colisão
    addBox(pFrontL.x, pFrontL.z, 1.25, 0.34, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pFrontR.x, pFrontR.z, 1.25, 0.34, ry, bottom, top, { move: true, shot: true, cam: false });

    // Registra cama para repouso
    const bedPos = toW(-1.6, 0.9);
    building.userData.bed = { x: bedPos.x, y: by + 0.45, z: bedPos.z };
    building.userData.isResidence = true;
    building.userData.hx = 2.4;
    building.userData.hz = 2.0;
  } else if (type === "CORRAL") {
    const top = by + 1.5;
    const bottom = by - 1.0;
    const pBack = toW(0, -2.5);
    const pLeft = toW(-2.5, 0);
    const pRight = toW(2.5, 0);
    const pFrontL = toW(-1.7, 2.5);
    const pFrontR = toW(1.7, 2.5);

    addFloor(bx, bz, 5.0, 5.0, ry, by + 0.04);

    addBox(pBack.x, pBack.z, 5.2, 0.28, ry, bottom, top, { move: true, shot: false, cam: false });
    addBox(pLeft.x, pLeft.z, 0.28, 5.2, ry, bottom, top, { move: true, shot: false, cam: false });
    addBox(pRight.x, pRight.z, 0.28, 5.2, ry, bottom, top, { move: true, shot: false, cam: false });
    addBox(pFrontL.x, pFrontL.z, 1.65, 0.28, ry, bottom, top, { move: true, shot: false, cam: false });
    addBox(pFrontR.x, pFrontR.z, 1.65, 0.28, ry, bottom, top, { move: true, shot: false, cam: false });
  } else if (type === "CABIN") {
    const top = by + 2.8;
    const bottom = by - 1.0;
    const pBack = toW(0, -1.35);
    const pLeft = toW(-1.7, 0);
    const pRight = toW(1.7, 0);
    const pFrontL = toW(-1.35, 1.35);
    const pFrontR = toW(1.35, 1.35);

    addFloor(bx, bz, 3.5, 2.9, ry, by + 0.25);
    const pStep = toW(0, 1.5);
    addFloor(pStep.x, pStep.z, 1.8, 0.7, ry, by + 0.15);

    addBox(pBack.x, pBack.z, 3.6, 0.3, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pLeft.x, pLeft.z, 0.3, 2.9, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pRight.x, pRight.z, 0.3, 2.9, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pFrontL.x, pFrontL.z, 0.9, 0.3, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pFrontR.x, pFrontR.z, 0.9, 0.3, ry, bottom, top, { move: true, shot: true, cam: false });

    // Registra cama de campanha para repouso
    const bedPos = toW(-1.0, -0.4);
    building.userData.bed = { x: bedPos.x, y: by + 0.45, z: bedPos.z };
    building.userData.isResidence = true;
    building.userData.hx = 1.7;
    building.userData.hz = 1.45;
  } else if (type === "BARN") {
    const top = by + 4.5;
    const bottom = by - 1.5;
    const pBack = toW(0, -2.3);
    const pLeft = toW(-2.9, 0);
    const pRight = toW(2.9, 0);
    const pFrontL = toW(-2.1, 2.3);
    const pFrontR = toW(2.1, 2.3);

    addFloor(bx, bz, 5.8, 4.6, ry, by + 0.1);

    addBox(pBack.x, pBack.z, 6.0, 0.35, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pLeft.x, pLeft.z, 0.35, 4.8, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pRight.x, pRight.z, 0.35, 4.8, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pFrontL.x, pFrontL.z, 1.5, 0.35, ry, bottom, top, { move: true, shot: true, cam: false });
    addBox(pFrontR.x, pFrontR.z, 1.5, 0.35, ry, bottom, top, { move: true, shot: true, cam: false });
  } else if (type === "WATCHTOWER") {
    const top = by + 6.8;
    const bottom = by - 1.0;
    // 4 postes estruturais
    for (const px of [-1.3, 1.3]) {
      for (const pz of [-1.3, 1.3]) {
        const p = toW(px, pz);
        addBox(p.x, p.z, 0.6, 0.6, ry, bottom, top, { move: true, shot: false, cam: false });
      }
    }
  } else if (type === "WALL_GATE") {
    const top = by + 3.4;
    const bottom = by - 1.0;
    const pLeft = toW(-2.3, 0);
    const pRight = toW(2.3, 0);
    addBox(pLeft.x, pLeft.z, 2.4, 0.38, ry, bottom, top, { move: true, shot: true, cam: true });
    addBox(pRight.x, pRight.z, 2.4, 0.38, ry, bottom, top, { move: true, shot: true, cam: true });
  } else if (type === "BLACKSMITH_SHED") {
    const top = by + 3.0;
    const bottom = by - 1.0;
    const pForge = toW(1.1, -1.0);
    const pBench = toW(-1.1, -1.1);
    const pAnvil = toW(-0.6, 0.2);
    addBox(pForge.x, pForge.z, 1.5, 1.3, ry, bottom, top, { move: true, shot: true, cam: true });
    addBox(pBench.x, pBench.z, 1.7, 0.8, ry, bottom, top, { move: true, shot: false, cam: false });
    addBox(pAnvil.x, pAnvil.z, 0.7, 0.7, ry, bottom, top, { move: true, shot: false, cam: false });
  } else if (type === "WELL") {
    const top = by + 2.4;
    const bottom = by - 1.0;
    addBox(bx, bz, 2.3, 2.3, ry, bottom, top, { move: true, shot: false, cam: false });
  } else if (type === "TORCH_POST") {
    const top = by + 3.4;
    const bottom = by - 1.0;
    addBox(bx, bz, 0.55, 0.55, ry, bottom, top, { move: true, shot: false, cam: false });
  } else if (type === "HAY_BALE") {
    addBox(bx, bz, 1.3, 0.9, ry, by - 0.4, by + 0.8, { move: true, shot: false, cam: false });
  } else if (type === "CAMPFIRE") {
    const top = by + 0.9;
    const bottom = by - 0.5;
    addBox(bx, bz, 1.6, 1.6, ry, bottom, top, { move: true, shot: false, cam: false });
  } else if (type === "STONE_WALL_SMALL" || type === "CLAY_WALL_SMALL") {
    const top = by + 2.3;
    const bottom = by - 1.0;
    addBox(bx, bz, 3.8, 0.85, ry, bottom, top, { move: true, shot: true, cam: false });
  } else if (type === "STONE_WALL_LARGE" || type === "CLAY_WALL_LARGE") {
    const top = by + 6.8;
    const bottom = by - 1.5;
    addBox(bx, bz, 6.0, 1.85, ry, bottom, top, { move: true, shot: true, cam: false });
    addFloor(bx, bz, 6.0, 1.8, ry, by + 5.25);
  }
  building.userData.collidersRegistered = true;
}

export function destroyBuilding(building, world = _env.world, scene = _env.scene, effects = _env.effects) {
  if (!building) return false;
  if (building.userData._footprint) {
    _releaseFootprint(building.userData._footprint);
    building.userData._footprint = null;
  }

  // 1. Desativa todos os colisores orientados (OBBs) registrados para esta construção
  if (building.userData.registeredBoxes && building.userData.registeredBoxes.length > 0) {
    for (let i = 0; i < building.userData.registeredBoxes.length; i++) {
      const b = building.userData.registeredBoxes[i];
      if (b) {
        b.active = false;
        b.move = false;
        b.shot = false;
        b.cam = false;
      }
    }
  }

  // Desativa qualquer colisor residual associado a esta construção
  if (world?.boxColliders) {
    for (let i = 0; i < world.boxColliders.length; i++) {
      const b = world.boxColliders[i];
      if (b && b.buildingRef === building) {
        b.active = false;
        b.move = false;
        b.shot = false;
        b.cam = false;
      }
    }
  }

  // 2. Remove e desativa pisos registrados
  if (building.userData.registeredFloors && building.userData.registeredFloors.length > 0) {
    for (let i = 0; i < building.userData.registeredFloors.length; i++) {
      const f = building.userData.registeredFloors[i];
      if (f) {
        f.active = false;
        if (world?.floors) {
          const idx = world.floors.indexOf(f);
          if (idx !== -1) world.floors.splice(idx, 1);
        }
      }
    }
  }
  if (world?.floors) {
    for (let i = world.floors.length - 1; i >= 0; i--) {
      const f = world.floors[i];
      if (f && f.buildingRef === building) {
        f.active = false;
        world.floors.splice(i, 1);
      }
    }
  }

  // 3. Efeitos de demolição (explosão de poeira e som de quebra)
  const bx = building.position.x;
  const by = building.position.y;
  const bz = building.position.z;
  const fx = effects || _env.effects;
  if (fx?.play) {
    fx.play("dust", bx, by + 1.2, bz, "#cdbb97", 2.2);
    fx.play("smoke", bx, by + 0.8, bz, "#8c8273", 1.8);
    fx.play("dust", bx - 1.2, by + 0.5, bz + 1.2, "#a67d4b", 1.5);
    fx.play("dust", bx + 1.2, by + 0.5, bz - 1.2, "#a67d4b", 1.5);
  }
  playWoodChopSound();

  // 4. Apaga quaisquer luzes internas e oculta
  building.traverse((child) => {
    if (child.isLight) {
      child.intensity = 0;
      child.visible = false;
    }
  });

  building.visible = false;
  building.userData.collidersRegistered = false;
  if (building.userData.registeredBoxes) building.userData.registeredBoxes.length = 0;
  if (building.userData.registeredFloors) building.userData.registeredFloors.length = 0;
  if (building.userData.bed) delete building.userData.bed;

  return true;
}

/**
 * Constroi uma estrutura no mundo se houver recursos.
 * @param {THREE.Vector3|{x:number,y?:number,z:number}} playerPos
 * @param {THREE.Euler|{y:number}|number} playerRot
 * @param {string} type
 * @param {Array<THREE.Object3D>} [playerBuildingsPool]
 */
export function buildStructure(playerPos, playerRot, type = "HOUSE", playerBuildingsPool = _playerBuildingsPool, customAngle = null) {
  const cost = BUILD_COSTS[type];
  if (!cost) return false;

  if (
    PlayerInventory.wood >= (cost.wood || 0) &&
    (cost.stone ? PlayerInventory.stone >= cost.stone : true) &&
    (cost.hay ? PlayerInventory.hay >= cost.hay : true) &&
    (cost.clay ? (PlayerInventory.clay || 0) >= cost.clay : true) &&
    (cost.torches ? (PlayerInventory.torches || 0) >= cost.torches : true)
  ) {
    const pool =
      playerBuildingsPool && playerBuildingsPool.length > 0
        ? playerBuildingsPool
        : createPlayerBuildingsPool(_env.scene, _env.world);

    // Construções grandes não podem nascer dentro de outras (registro global de pegadas)
    const _fp = PLAYER_BUILD_FOOTPRINT[type];
    if (_fp) {
      const _t = calculateBuildingTransform(playerPos, playerRot, type, customAngle, pool);
      if (!_canPlaceFootprint(_t.bx, _t.bz, _fp[0], _fp[1], _t.rotY, 1.4)) {
        _env.ui?.showToast?.("Espaço ocupado: afaste-se de outras construções para erguer aqui.");
        return false;
      }
    }

    // Pega estrutura do pool ou cria se o pool estiver esgotado
    let building = pool.find((b) => b.userData.type === type && !b.visible);
    if (!building) {
      building = buildStructureMeshByType(type);
      if (_env.scene) _env.scene.add(building);
      pool.push(building);
    }

    if (cost.wood) PlayerInventory.wood -= cost.wood;
    if (cost.stone) PlayerInventory.stone -= cost.stone;
    if (cost.clay) PlayerInventory.clay = Math.max(0, (PlayerInventory.clay || 0) - cost.clay);
    if (cost.torches) PlayerInventory.torches = Math.max(0, (PlayerInventory.torches || 0) - cost.torches);
    if (cost.hay) {
      PlayerInventory.hay -= cost.hay;
      PlayerStats.hay = PlayerInventory.hay;
    }

    const { bx, by, bz, rotY } = calculateBuildingTransform(playerPos, playerRot, type, customAngle, pool);

    building.position.set(bx, by, bz);
    building.rotation.y = rotY;
    building.visible = true;
    if (PLAYER_BUILD_FOOTPRINT[type]) {
      const fp = PLAYER_BUILD_FOOTPRINT[type];
      building.userData._footprint = _reserveFootprint(bx, bz, fp[0], fp[1], rotY, "player", `player-${type}`, 1.4);
    }
    if (type === "HAY_BALE") {
      building.userData.hayLeft = 50; // bloco novo: 50 de feno, volta a escala cheia (reuso do pool)
      building.scale.set(1, 1, 1);
    }

    // Limpa árvores e pedras do terreno dentro da área da construção
    _env.world?.clearObstaclesInRadius?.(bx, bz, 4.8);

    // Registra colisões e pisos no mundo físico
    _registerBuildingColliders(building, _env.world);

    if (_env.effects) {
      _env.effects.play("dust", bx, by + 0.6, bz, "#cdbb97", 1.6);
    }
    playWoodChopSound();
    syncPlayerStatsToPlayer();
    return building;
  }
  return false;
}

export function getPlayerResidences() {
  return (_playerBuildingsPool || []).filter((b) => b.visible && b.userData.isResidence);
}

/**
 * Diálogo de trabalho com NPCs (Ferreiro/Fazendeiro).
 * @param {'FARMER'|'BLACKSMITH'|'STONE'} npcType
 */
export function sellResourcesToNPC(npcType) {
  if (npcType === "FARMER" && PlayerInventory.hay >= 5) {
    PlayerInventory.hay -= 5;
    PlayerStats.hay = PlayerInventory.hay;
    PlayerInventory.gold += 10; // Vende feno
    _env.audio?.coin?.();
    syncPlayerStatsToPlayer();
    return true;
  } else if (npcType === "BLACKSMITH" && PlayerInventory.wood >= 10) {
    PlayerInventory.wood -= 10;
    PlayerInventory.gold += 25; // Vende lenha para a fornalha
    _env.audio?.coin?.();
    syncPlayerStatsToPlayer();
    return true;
  } else if (npcType === "STONE" && PlayerInventory.stone >= 5) {
    PlayerInventory.stone -= 5;
    PlayerInventory.gold += 15; // Vende pedras brutas/minério
    _env.audio?.coin?.();
    syncPlayerStatsToPlayer();
    return true;
  }
  return false;
}

// ============================================================================
// 12. Sistema de Missões Dinâmicas (Estilo GTA em Mundo Procedural — Zero-GC)
// ============================================================================
// Variáveis de reuso para cálculos de distância de missões
const _missionTargetPos = new THREE.Vector3();
const _playerPos = new THREE.Vector3();
const _waypointLookAt = new THREE.Vector3();

export const MissionState = {
  activeId: null,
  step: 0,
  targetNPC: null,
  targetLocation: null,
  timer: 0,
  title: "",
  objectiveText: "",
};

// Banco de dados dinâmico de missões ativas/disponíveis
export const ActiveMissions = [];

let _waypointMarker = null;
let _waypointBeamTex = null;

function _ensureWaypointMarker(scene = _env.scene) {
  if (_waypointMarker) {
    if (scene && _waypointMarker.parent !== scene) scene.add(_waypointMarker);
    return _waypointMarker;
  }
  if (!scene || typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Feixe vertical com núcleo brilhante dourado e bordas suaves (AdditiveBlending)
  const hGrad = ctx.createLinearGradient(0, 0, 64, 0);
  hGrad.addColorStop(0.0, "rgba(255, 210, 90, 0.0)");
  hGrad.addColorStop(0.28, "rgba(255, 215, 95, 0.45)");
  hGrad.addColorStop(0.5, "rgba(255, 248, 195, 0.98)");
  hGrad.addColorStop(0.72, "rgba(255, 215, 95, 0.45)");
  hGrad.addColorStop(1.0, "rgba(255, 210, 90, 0.0)");
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 64, 256);

  ctx.globalCompositeOperation = "destination-in";
  const vGrad = ctx.createLinearGradient(0, 0, 0, 256);
  vGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.0)");
  vGrad.addColorStop(0.25, "rgba(255, 255, 255, 0.45)");
  vGrad.addColorStop(0.88, "rgba(255, 255, 255, 0.95)");
  vGrad.addColorStop(1.0, "rgba(255, 255, 255, 1.0)");
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 64, 256);

  _waypointBeamTex = new THREE.CanvasTexture(canvas);
  _waypointBeamTex.generateMipmaps = false;

  // Caso de Borda 5.2: Único PlaneGeometry (2 triângulos) com AdditiveBlending e depthWrite: false
  const geo = new THREE.PlaneGeometry(2.4, 18);
  const mat = new THREE.MeshBasicMaterial({
    map: _waypointBeamTex,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  _waypointMarker = new THREE.Mesh(geo, mat);
  _waypointMarker.name = "MissionWaypointPillar";
  _waypointMarker.visible = false;
  _waypointMarker.renderOrder = 10;
  scene.add(_waypointMarker);
  return _waypointMarker;
}

/**
 * Posiciona o Pilar de Luz leve no destino da missão (Zero-GC).
 * @param {THREE.Vector3|{x:number,y?:number,z:number}} targetPos
 */
export function spawnWaypointMarker(targetPos) {
  if (!targetPos) return null;
  const tx = targetPos.x ?? 0;
  const tz = targetPos.z ?? 0;
  const ty = _env.world ? _env.world.heightAt(tx, tz) : targetPos.y ?? 0;

  if (!MissionState.targetLocation) {
    MissionState.targetLocation = new THREE.Vector3(tx, ty, tz);
  } else if (MissionState.targetLocation.set) {
    MissionState.targetLocation.set(tx, ty, tz);
  } else {
    MissionState.targetLocation = new THREE.Vector3(tx, ty, tz);
  }

  const marker = _ensureWaypointMarker(_env.scene);
  if (marker) {
    marker.position.set(tx, ty + 8.5, tz);
    marker.visible = true;
  }
  return marker;
}

/**
 * Remove/oculta o Pilar de Luz de objetivo ativo.
 */
export function removeWaypointMarker() {
  if (_waypointMarker) {
    _waypointMarker.visible = false;
  }
  MissionState.targetLocation = null;
}

/**
 * Caso de Borda 5.2: Gira o único PlaneGeometry do Pilar de Luz para sempre encarar o jogador (lookAt em X/Z).
 */
export function updateWaypointBillboard(playerPos, now = performance.now()) {
  if (!_waypointMarker || !_waypointMarker.visible || !playerPos) return;

  // Se o objetivo seguir um NPC vivo (ex: Bandido ou Devedor), mantém o marcador sincronizado
  if (MissionState.targetNPC) {
    const npcEntity = _extractNPCEntity(MissionState.targetNPC);
    const npcObj = _extractNPCRoot(MissionState.targetNPC);
    if (npcEntity && npcEntity.alive) {
      const gy = _env.world ? _env.world.heightAt(npcEntity.x, npcEntity.z) : 0;
      _waypointMarker.position.set(npcEntity.x, gy + 8.5, npcEntity.z);
      if (MissionState.targetLocation?.set) {
        MissionState.targetLocation.set(npcEntity.x, gy, npcEntity.z);
      }
    } else if (npcObj && !npcObj.userData?.isDead) {
      _waypointMarker.position.set(npcObj.position.x, npcObj.position.y + 8.5, npcObj.position.z);
      if (MissionState.targetLocation?.set) {
        MissionState.targetLocation.set(npcObj.position.x, npcObj.position.y, npcObj.position.z);
      }
    }
  }

  const px = playerPos.x ?? playerPos.position?.x ?? 0;
  const pz = playerPos.z ?? playerPos.position?.z ?? 0;
  _waypointLookAt.set(px, _waypointMarker.position.y, pz);
  _waypointMarker.lookAt(_waypointLookAt);
  _waypointMarker.material.opacity = 0.72 + Math.sin(now * 0.005) * 0.18;
}

function showMissionCompleteUI(message = "Missão Concluída!") {
  _env.audio?.coin?.();
  _env.music?.playDiscovery?.();
  if (_env.effects && _env.player) {
    _env.effects.play(
      "glint",
      _env.player.x,
      (_env.player.root?.position?.y ?? 0) + 1.85,
      _env.player.z,
      "#ffe38a",
      1.6,
    );
  }
  _env.ui?.showToast?.(message);
  _env.ui?.setMissionStatus?.(null);
}

function _resolveCityAnchors(cityAnchors) {
  if (cityAnchors && (cityAnchors.farms?.length || cityAnchors.houses?.length)) {
    return cityAnchors;
  }
  const fromSettlement = _env.settlement?.cityData?.anchors;
  if (fromSettlement && (fromSettlement.farms?.length || fromSettlement.houses?.length)) {
    return fromSettlement;
  }
  const fromChunk = _env.activeCities?.get?.("0_0")?.anchors;
  if (fromChunk && (fromChunk.farms?.length || fromChunk.houses?.length)) {
    return fromChunk;
  }
  return {
    seed: 1,
    farms: [
      new THREE.Vector3(-31, 0, 0),
      new THREE.Vector3(-35, 0, 7),
      new THREE.Vector3(-27, 0, -6),
    ],
    houses: [
      new THREE.Vector3(-14, 0, -10),
      new THREE.Vector3(14, 0, -10),
      new THREE.Vector3(-14, 0, 12),
      new THREE.Vector3(14, 0, 12),
      new THREE.Vector3(-20, 0, -22),
      new THREE.Vector3(20, 0, -22),
    ],
    taverns: [new THREE.Vector3(-19, 0, -20)],
    blacksmiths: [new THREE.Vector3(13, 0, -22)],
    gates: [new THREE.Vector3(0, 0, -43), new THREE.Vector3(38, 0, 0)],
  };
}

function _registerMissionRecord(mission) {
  const existingIdx = ActiveMissions.findIndex((m) => m.id === mission.id);
  if (existingIdx >= 0) {
    ActiveMissions[existingIdx] = mission;
  } else {
    ActiveMissions.push(mission);
  }
  return mission;
}

/**
 * Inicia uma missão gerada proceduralmente e configura os marcadores de bússola e luz.
 */
export function startMission(mission) {
  if (!mission) return false;
  if (MissionState.activeId && MissionState.activeId !== mission.id) {
    failActiveMission("Missão anterior cancelada.");
  }
  _registerMissionRecord(mission);
  mission.status = "ACTIVE";
  MissionState.activeId = mission.id;
  MissionState.step = 1;
  MissionState.targetNPC = mission.targetNPC || null;
  MissionState.title = mission.title || "Missão";
  MissionState.objectiveText = mission.objectiveText || mission.title || "";
  MissionState.timer = 0;

  if (mission.destination) {
    MissionState.targetLocation = new THREE.Vector3(
      mission.destination.x ?? 0,
      mission.destination.y ?? 0,
      mission.destination.z ?? 0,
    );
  }

  mission.onStart?.();
  _env.ui?.setMissionStatus?.(MissionState);
  syncPlayerStatsToPlayer();
  return true;
}

/**
 * Caso de Borda 5.3: Cancela/Fracassa imediatamente a missão ativa (ex: morte do Mission Giver).
 */
export function failActiveMission(reason = "Missão Fracassada!") {
  if (!MissionState.activeId) return false;
  const mission = ActiveMissions.find((m) => m.id === MissionState.activeId);
  if (mission) {
    mission.status = "FAILED";
    const tRoot = _extractNPCRoot(mission.targetNPC);
    if (tRoot?.userData) {
      tRoot.userData.isMissionDebtor = false;
      tRoot.userData.isBountyBoss = false;
    }
  }
  PlayerInventory.hasQuestItem = false;
  MissionState.activeId = null;
  MissionState.step = 0;
  MissionState.targetNPC = null;
  MissionState.title = "";
  MissionState.objectiveText = "";
  removeWaypointMarker();
  _env.ui?.setMissionStatus?.(null);
  if (reason) _env.ui?.showToast?.(reason);
  return true;
}

function _handleMissionOnNPCDeath(deadRoot, deadEntity) {
  if (!MissionState.activeId) return;
  const mission = ActiveMissions.find((m) => m.id === MissionState.activeId);
  if (!mission || mission.status !== "ACTIVE") return;

  const giverRoot = _extractNPCRoot(mission.giver);
  const giverEntity = _extractNPCEntity(mission.giver);
  const targetRoot = _extractNPCRoot(mission.targetNPC);
  const targetEntity = _extractNPCEntity(mission.targetNPC);

  // Caso de Borda 5.3: Se o jogador matar o NPC que deu a missão (ou que deveria receber)
  if ((giverRoot && deadRoot === giverRoot) || (giverEntity && deadEntity === giverEntity)) {
    failActiveMission("Missão Fracassada! O contato da missão foi morto.");
    return;
  }

  // Se for a missão "A Cobrança" (DEBT) e o jogador matar o devedor em vez de usar os Punhos
  if (
    mission.type === "DEBT" &&
    ((targetRoot && deadRoot === targetRoot) || (targetEntity && deadEntity === targetEntity))
  ) {
    failActiveMission("Missão Fracassada! Você matou o devedor (use apenas os Punhos).");
    return;
  }

  // Se for a missão "Caça ao Bandido" (BOUNTY) e o bandido-alvo morreu
  if (
    mission.type === "BOUNTY" &&
    ((targetRoot && deadRoot === targetRoot) || (targetEntity && deadEntity === targetEntity))
  ) {
    mission.onComplete?.();
    mission.status = "COMPLETED";
    MissionState.activeId = null;
    MissionState.targetNPC = null;
    MissionState.title = "";
    MissionState.objectiveText = "";
    showMissionCompleteUI(`Missão Concluída: ${mission.title}! +${mission.rewardGold} Moedas · +${mission.rewardCha} CAR`);
  }
}

/**
 * 1. Template: Entrega de Suprimentos (DELIVER)
 * Gera uma missão de entrega dinamicamente usando as âncoras da cidade.
 * @param {Object} giverNpc - NPC que entrega a missão.
 * @param {Object} cityAnchors - Âncoras procedurais geradas na seed atual.
 */
export function generateDeliveryMission(giverNpc, cityAnchors) {
  const anchors = _resolveCityAnchors(cityAnchors);
  const pool = anchors.farms?.length ? anchors.farms : anchors.houses;
  const targetIndex = Math.floor(Math.random() * pool.length);
  const rawAnchor = pool[targetIndex];
  const destinationAnchor = new THREE.Vector3(rawAnchor.x ?? -31, rawAnchor.y ?? 0, rawAnchor.z ?? 0);

  const mission = {
    id: "DELIVERY_01",
    type: "DELIVER",
    title: "Entrega de Suprimentos",
    objectiveText: "Leve os suprimentos até a fazenda marcada no mapa",
    giver: giverNpc,
    giverId: giverNpc?.name || "MERCHANT_01",
    anchorId: `FARM_${targetIndex}`,
    regionSeed: anchors.seed ?? 1,
    destination: destinationAnchor,
    rewardGold: 30,
    rewardCha: 2,
    status: "AVAILABLE", // AVAILABLE, ACTIVE, COMPLETED, FAILED
    onStart: () => {
      PlayerInventory.hasQuestItem = true;
      MissionState.targetLocation = destinationAnchor;
      spawnWaypointMarker(destinationAnchor); // Cria um pilar de luz leve no destino
    },
    onComplete: () => {
      PlayerInventory.hasQuestItem = false;
      PlayerStats.gold += 30;
      PlayerInventory.gold = PlayerStats.gold;
      if (_env.player) _env.player.coins = PlayerStats.gold;
      PlayerStats.cha += 2;
      removeWaypointMarker();
      syncPlayerStatsToPlayer();
    },
  };

  return _registerMissionRecord(mission);
}

/**
 * 2. Template: A Cobrança (DEBT — Estilo GTA)
 * O Estalajadeiro/Mercador manda cobrar um NPC específico em uma âncora de residência (houses[5] ou similar).
 * O jogador pode bater nele apenas com os Punhos até ele largar o dinheiro, ou pagar a dívida por ele (+Carisma).
 */
export function generateDebtMission(giverNpc, cityAnchors) {
  const anchors = _resolveCityAnchors(cityAnchors);
  const houses = anchors.houses?.length ? anchors.houses : [new THREE.Vector3(16, 0, -12)];
  const targetIndex = houses.length > 5 ? 5 : Math.floor(Math.random() * houses.length);
  const rawAnchor = houses[targetIndex];
  const destinationAnchor = new THREE.Vector3(rawAnchor.x ?? 16, rawAnchor.y ?? 0, rawAnchor.z ?? -12);

  let debtorNpc = null;

  const mission = {
    id: "DEBT_01",
    type: "DEBT",
    title: "A Cobrança",
    objectiveText: "Cobre o devedor com os Punhos (Slot 1) ou pague a dívida (E)",
    giver: giverNpc,
    giverId: giverNpc?.name || "MERCHANT_01",
    anchorId: `HOUSE_${targetIndex}`,
    regionSeed: anchors.seed ?? 1,
    destination: destinationAnchor,
    targetNPC: null,
    rewardGold: 40,
    rewardCha: 1,
    status: "AVAILABLE",
    onStart: () => {
      if (_env.npcs?.spawnMissionNPC) {
        debtorNpc = _env.npcs.spawnMissionNPC("villager", destinationAnchor.x + 1.4, destinationAnchor.z + 1.4, {
          slotKey: "DEBTOR_NPC",
          name: "Simão, o Devedor",
          title: "Devedor da Taverna",
          cloth: "#6e5239",
          maxHealth: 10,
          isDebtor: true,
          task: "Devedor da Estalagem (use Punhos ou E)",
        });
        mission.targetNPC = debtorNpc.root;
        MissionState.targetNPC = debtorNpc.root;
      }
      spawnWaypointMarker(destinationAnchor);
    },
    onComplete: () => {
      const root = _extractNPCRoot(mission.targetNPC);
      if (root?.userData) {
        root.userData.isMissionDebtor = false;
      }
      PlayerStats.gold += 40;
      PlayerInventory.gold = PlayerStats.gold;
      if (_env.player) _env.player.coins = PlayerStats.gold;
      PlayerStats.cha += 1;
      removeWaypointMarker();
      syncPlayerStatsToPlayer();
    },
  };

  return _registerMissionRecord(mission);
}

/**
 * Gatilho chamado pelo sistema de combate quando o jogador acerta o Devedor com os Punhos (Slot 1).
 */
export function notifyMissionFistHit(npc) {
  if (!MissionState.activeId) return false;
  const mission = ActiveMissions.find((m) => m.id === MissionState.activeId);
  if (!mission || mission.status !== "ACTIVE" || mission.type !== "DEBT") return false;

  const obj = _extractNPCRoot(npc);
  const npcEntity = _extractNPCEntity(npc);
  const targetRoot = _extractNPCRoot(mission.targetNPC);
  if (!obj || (targetRoot && obj !== targetRoot && !obj.userData?.isMissionDebtor)) return false;

  // Garante que os punhos não matem o devedor durante a cobrança
  if (npcEntity && npcEntity.health < 2) {
    npcEntity.health = 2;
    npcEntity.alive = true;
    obj.userData.isDead = false;
  }

  obj.userData.debtPunches = (obj.userData.debtPunches || 0) + 1;
  if (obj.userData.debtPunches >= 2) {
    obj.userData.isMissionDebtor = false;
    if (npcEntity) {
      npcEntity.task = "Pagou a dívida da taverna!";
      spawnLoot({ x: npcEntity.x, z: npcEntity.z }, 10);
    }
    mission.onComplete?.();
    mission.status = "COMPLETED";
    MissionState.activeId = null;
    MissionState.targetNPC = null;
    MissionState.title = "";
    MissionState.objectiveText = "";
    showMissionCompleteUI("Dívida cobrada no punho! Simão entregou o saco de moedas (+40 Ouro)!");
    return true;
  } else {
    _env.ui?.showToast?.("Simão: 'Ai! Mais um soco e eu entrego as moedas!'");
    return true;
  }
}

/**
 * Alternativa moral na missão "A Cobrança": o jogador paga a dívida pelo camponês (-20 Ouro, +4 Carisma).
 */
export function payDebtorMission(npc) {
  if (!MissionState.activeId) return false;
  const mission = ActiveMissions.find((m) => m.id === MissionState.activeId);
  if (!mission || mission.status !== "ACTIVE" || mission.type !== "DEBT") return false;

  if (_env.player) PlayerStats.gold = _env.player.coins;
  if (PlayerStats.gold < 20) return false;

  PlayerStats.gold -= 20;
  PlayerInventory.gold = PlayerStats.gold;
  if (_env.player) _env.player.coins = PlayerStats.gold;
  PlayerStats.cha = Math.min(20, PlayerStats.cha + 4);

  const obj = _extractNPCRoot(npc || mission.targetNPC);
  const npcEntity = _extractNPCEntity(npc || mission.targetNPC);
  if (obj?.userData) {
    obj.userData.isMissionDebtor = false;
    obj.userData.state = "CHEERING";
  }
  if (npcEntity) {
    npcEntity.cheeringTimer = 8.0;
    npcEntity.task = "Dívida perdoada pelo benfeitor!";
  }

  removeWaypointMarker();
  mission.status = "COMPLETED";
  MissionState.activeId = null;
  MissionState.targetNPC = null;
  MissionState.title = "";
  MissionState.objectiveText = "";
  syncPlayerStatsToPlayer();
  showMissionCompleteUI("Missão Concluída! Você quitou a dívida do camponês (-20 Ouro · +4 Carisma)!");
  return true;
}

/**
 * 3. Template: Roubo de Montaria (HORSE_THEFT)
 * Localiza o curral próximo à muralha leste, marca um Cavalo Puro-Sangue e pede para levá-lo à floresta.
 */
export function generateHorseTheftMission(giverNpc, cityAnchors) {
  const anchors = _resolveCityAnchors(cityAnchors);
  const corralAnchor = new THREE.Vector3(34, 0, -18);
  const forestDestination = new THREE.Vector3(78, 0, 32);

  const mission = {
    id: "HORSE_THEFT_01",
    type: "HORSE_THEFT",
    title: "Roubo de Montaria",
    objectiveText: "Furte o Cavalo Puro-Sangue na muralha leste (use Feno G ou Furtividade U)",
    giver: giverNpc,
    giverId: giverNpc?.name || "NOBLE_01",
    anchorId: "EAST_WALL_CORRAL",
    regionSeed: anchors.seed ?? 1,
    corralLocation: corralAnchor,
    destination: forestDestination,
    targetHorse: null,
    rewardGold: 60,
    rewardCha: 1,
    status: "AVAILABLE",
    onStart: () => {
      if (_env.horses?.spawnHorse) {
        const horse = _env.horses.spawnHorse(corralAnchor.x, corralAnchor.z, {
          wild: false,
          stay: true,
          isMissionHorse: true,
          name: "Cavalo Puro-Sangue",
          title: "Montaria Real",
          task: "Puro-Sangue (Alvo de Missão)",
          home: { x: corralAnchor.x, z: corralAnchor.z, r: 5 },
        });
        mission.targetHorse = horse;
      }
      MissionState.step = 1;
      MissionState.targetLocation = corralAnchor;
      spawnWaypointMarker(corralAnchor);
    },
    onComplete: () => {
      if (mission.targetHorse) {
        mission.targetHorse.isMissionHorse = false;
        mission.targetHorse.tamed = true;
      }
      PlayerStats.gold += 60;
      PlayerInventory.gold = PlayerStats.gold;
      if (_env.player) _env.player.coins = PlayerStats.gold;
      PlayerStats.cha += 1;
      removeWaypointMarker();
      syncPlayerStatsToPlayer();
    },
  };

  return _registerMissionRecord(mission);
}

/**
 * 4. Template: Caça ao Bandido (BOUNTY)
 * O Capitão da Guarda marca um ponto no mato fora da cidade com um Bandido de alta Força e Constituição.
 */
export function generateBountyMission(giverNpc, cityAnchors) {
  const anchors = _resolveCityAnchors(cityAnchors);
  const angle = Math.random() * Math.PI * 2;
  const dist = 54;
  let bx = Math.round(Math.cos(angle) * dist);
  let bz = Math.round(Math.sin(angle) * dist);
  if (_env.world?.isBlockedAt?.(bx, bz, 1.2)) {
    bx = 52;
    bz = -48;
  }
  const campLocation = new THREE.Vector3(bx, 0, bz);

  const mission = {
    id: "BOUNTY_01",
    type: "BOUNTY",
    title: "Caça ao Bandido",
    objectiveText: "Elimine o Líder dos Bandidos acampado fora das muralhas",
    giver: giverNpc,
    giverId: giverNpc?.name || "GUARD_CAPTAIN",
    anchorId: `WILDERNESS_CAMP_${bx}_${bz}`,
    regionSeed: anchors.seed ?? 1,
    destination: campLocation,
    targetNPC: null,
    rewardGold: 65,
    rewardCha: 2,
    status: "AVAILABLE",
    onStart: () => {
      if (_env.npcs?.spawnMissionNPC) {
        const bandit = _env.npcs.spawnMissionNPC("villager", campLocation.x, campLocation.z, {
          slotKey: "BOUNTY_BOSS",
          name: "Roderick, o Degolador",
          title: "Líder dos Bandidos",
          cloth: "#3d2222",
          hair: "#161210",
          isBandit: true,
          isBountyBoss: true,
          maxHealth: 12,
          meleeRange: 2.1,
          meleeDamage: 2,
          str: 16,
          con: 16,
          task: "Procurado pela Guarda (Alvo)",
        });
        mission.targetNPC = bandit.root;
        MissionState.targetNPC = bandit.root;
      }
      spawnWaypointMarker(campLocation);
    },
    onComplete: () => {
      const root = _extractNPCRoot(mission.targetNPC);
      if (root?.userData) {
        root.userData.isBountyBoss = false;
      }
      PlayerStats.gold += 65;
      PlayerInventory.gold = PlayerStats.gold;
      if (_env.player) _env.player.coins = PlayerStats.gold;
      PlayerStats.cha += 2;
      removeWaypointMarker();
      syncPlayerStatsToPlayer();
    },
  };

  return _registerMissionRecord(mission);
}

// ============================================================================
// 13. Loop de Checagem Leve de Missões (updateMissionProgress — 2x por segundo)
// ============================================================================
let missionCheckTimer = 0;

/**
 * Avalia o progresso da missão ativa apenas 2 vezes por segundo (0.5s), mantendo Zero-GC.
 * @param {THREE.Object3D|object} player
 * @param {number} [dt=0.016]
 */
export function updateMissionProgress(player, dt = 0.016) {
  if (!MissionState.activeId || !player) return;

  // Otimização: Só checa progresso de distância 2 vezes por segundo (não a 60 FPS)
  missionCheckTimer += dt;
  if (missionCheckTimer < 0.5) return;
  missionCheckTimer = 0;

  const mission = ActiveMissions.find((m) => m.id === MissionState.activeId);
  if (!mission || mission.status !== "ACTIVE") return;

  const posSource = player.position || player.root?.position || player;
  const px = posSource.x ?? player.x ?? 0;
  const pz = posSource.z ?? player.z ?? 0;
  const py = posSource.y ?? (_env.world ? _env.world.heightAt(px, pz) : 0);
  _playerPos.set(px, py, pz);

  if (mission.type === "DELIVER") {
    const loc = MissionState.targetLocation || mission.destination;
    if (!loc) return;
    const ty = _env.world ? _env.world.heightAt(loc.x, loc.z) : loc.y ?? py;
    _missionTargetPos.set(loc.x, ty, loc.z);

    // Chegou a 4 metros do destino (4^2 = 16)
    const dx = _playerPos.x - _missionTargetPos.x;
    const dz = _playerPos.z - _missionTargetPos.z;
    if (dx * dx + dz * dz < 16 || _playerPos.distanceToSquared(_missionTargetPos) < 16) {
      mission.onComplete();
      mission.status = "COMPLETED";
      MissionState.activeId = null;
      MissionState.title = "";
      MissionState.objectiveText = "";
      showMissionCompleteUI("Entrega de Suprimentos Concluída! +30 Moedas · +2 Carisma");
    }
  } else if (mission.type === "BOUNTY") {
    const targetObj = _extractNPCRoot(MissionState.targetNPC || mission.targetNPC);
    const targetEntity = _extractNPCEntity(MissionState.targetNPC || mission.targetNPC);
    const isDead = Boolean(targetObj?.userData?.isDead || (targetEntity && !targetEntity.alive));
    if (isDead) {
      mission.onComplete();
      mission.status = "COMPLETED";
      MissionState.activeId = null;
      MissionState.targetNPC = null;
      MissionState.title = "";
      MissionState.objectiveText = "";
      showMissionCompleteUI("Caça ao Bandido Concluída! +65 Moedas · +2 Carisma");
    }
  } else if (mission.type === "HORSE_THEFT") {
    const mountedHorse = _env.player?.mounted || player.userData?.mount || null;
    const isOnHorse = Boolean(mountedHorse || player.userData?.isRiding);

    if (MissionState.step === 1 && isOnHorse) {
      MissionState.step = 2;
      MissionState.objectiveText = "Leve o Cavalo Puro-Sangue até o esconderijo na floresta!";
      MissionState.targetLocation = mission.destination;
      spawnWaypointMarker(mission.destination);
      _env.ui?.setMissionStatus?.(MissionState);
      _env.ui?.showToast?.("Montaria furtada! Galope até o pilar de luz na floresta!");
    }

    if (isOnHorse && mission.destination) {
      const dx = _playerPos.x - mission.destination.x;
      const dz = _playerPos.z - mission.destination.z;
      if (dx * dx + dz * dz < 25) {
        mission.onComplete();
        mission.status = "COMPLETED";
        MissionState.activeId = null;
        MissionState.title = "";
        MissionState.objectiveText = "";
        showMissionCompleteUI("Roubo de Montaria Concluído! +60 Moedas · +1 Carisma");
      }
    }
  }
}

