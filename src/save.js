import { PlayerStats, PlayerInventory } from "./rpg.js";
import { CultState } from "./cult.js";
import { getDemiurgeDiarySpotIndex } from "./demiurgeBook.js";
import { WorldDecay } from "./decay.js";

// ============================================================================
// Sistema de Salvamento & Autosave Periódico do Puris
// Salva inventário, stats, itens, ouro, progresso do mundo e posições.
// ============================================================================
const KEY = "rex-mundi-save-v1";
const LEGACY_KEY = "gta-medieval-save-v1";

/**
 * Serializa todo o estado relevante do jogador e do mundo para o formato do save.
 */
export function serializeGameState({ player, weapons, dayNight, candle }) {
  if (!player || player.dead || player.health <= 0) return null;

  return {
    coins: player.coins,
    health: player.health,
    potions: player.potions,
    weapons: weapons ? weapons.serialize() : null,
    progress: dayNight ? dayNight.progress : 0,
    x: player.x,
    z: player.z,
    candles: candle?.count ?? 0,
    demiurgeBookSpotIndex: typeof getDemiurgeDiarySpotIndex === "function" ? getDemiurgeDiarySpotIndex() : 0,
    decay: {
      daysPassed: WorldDecay?.daysPassed ?? 0,
      decayLevel: WorldDecay?.decayLevel ?? 0,
      isEclipse: Boolean(WorldDecay?.isEclipse),
      eclipsesExperienced: WorldDecay?.eclipsesExperienced || 0,
      eclipseDays: WorldDecay?.scheduledEclipseDays || [],
    },
    stats: {
      str: PlayerStats.str,
      con: PlayerStats.con,
      cha: PlayerStats.cha,
      spd: PlayerStats.spd,
      morality: PlayerStats.morality ?? 0,
      lastMessengerTier: PlayerStats.lastMessengerTier ?? 0,
      sacrifices: CultState?.sacrifices ?? 0,
      hay: PlayerInventory.hay,
      wood: PlayerInventory.wood,
      stone: PlayerInventory.stone,
      clay: PlayerInventory.clay || 0,
      torches: PlayerInventory.torches,
      hasSword: PlayerInventory.hasSword,
      hasDemiurgeDiary: Boolean(PlayerInventory.hasDemiurgeDiary),
      hasCollectedGroundBook: Boolean(PlayerInventory.hasCollectedGroundBook),
      discoveredBookPages: Array.isArray(PlayerInventory.discoveredBookPages)
        ? PlayerInventory.discoveredBookPages
        : [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 20],
      torchColor: PlayerInventory.torchColor || "orange",
      crystals: PlayerInventory.crystals || { green: 0, blue: 0, pink: 0, red: 0, white: 0, purple: 0 },
    },
  };
}

export function saveGame(game) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, ...game }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gerenciador de Salvamento Automático Periódico (Autosave).
 * Salva o estado do jogo a cada intervalo configurado durante o gameplay ativo,
 * com salvaguardas para não salvar durante cutscenes, morte ou no meio de quedas.
 */
export class AutoSaveManager {
  constructor({ interval = 60.0 } = {}) {
    this.interval = interval; // Intervalo padrão: a cada 60 segundos
    this.timer = 0;
    this.lastSaveTime = 0;
    this.enabled = true;
  }

  saveNow(env, notify = true) {
    if (!this.enabled) return false;
    const { player, ui } = env;
    if (!player || player.dead || player.health <= 0) return false;

    const data = serializeGameState(env);
    if (!data) return false;

    const success = saveGame(data);
    if (success) {
      this.timer = 0;
      this.lastSaveTime = Date.now();
      if (notify && ui?.showToast) {
        ui.showToast("✦ Progresso salvo automaticamente");
      }
      return true;
    }
    return false;
  }

  update(dt, env, isCutscene = false, isPaused = false) {
    if (!this.enabled || isPaused || isCutscene) return;
    const { player } = env;
    if (!player || player.dead || player.health <= 0) return;

    this.timer += dt;
    if (this.timer >= this.interval) {
      // Proteção: se o jogador estiver em queda rápida no ar, espera pousar
      if (player.verticalSpeed && Math.abs(player.verticalSpeed) > 4) {
        return;
      }
      this.saveNow(env, true);
    }
  }
}
