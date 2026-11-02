// ============================================================================
// EventBus.js — Desacoplamento de Sistemas (Publish/Subscribe de Alta Performance)
// Elimina acoplamento direto entre Combate, Missões, Karma, UI e Finais do Jogo.
// Zero-GC: Handlers organizados por Maps e arrays reutilizados sem alocações.
// ============================================================================

export const GAME_EVENTS = Object.freeze({
  NPC_DIED: "NPC_DIED",
  CRIME_COMMITTED: "CRIME_COMMITTED",
  HERESY_RISEN: "HERESY_RISEN",
  HOLY_TRIUMPH: "HOLY_TRIUMPH",
  PLAYER_DAMAGED: "PLAYER_DAMAGED",
  EQUIPMENT_CHANGED: "EQUIPMENT_CHANGED",
  MISSION_UPDATED: "MISSION_UPDATED",
  DAY_PHASE_CHANGED: "DAY_PHASE_CHANGED",
  ANIMAL_SACRIFICED: "ANIMAL_SACRIFICED",
  NPC_SICK: "NPC_SICK",
  NPC_CURED: "NPC_CURED",
  BELL_RUNG: "BELL_RUNG",
  BELL_REPAIRED: "BELL_REPAIRED",
  CORRUPTION_CHANGED: "CORRUPTION_CHANGED",
});

class EventBusRegistry {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * Inscreve um callback para escutar um evento.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Função de desinscrição imediata
   */
  on(event, callback) {
    if (typeof callback !== "function") return () => {};
    let bucket = this._listeners.get(event);
    if (!bucket) {
      bucket = [];
      this._listeners.set(event, bucket);
    }
    bucket.push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Remove a inscrição de um callback.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const bucket = this._listeners.get(event);
    if (!bucket) return;
    const idx = bucket.indexOf(callback);
    if (idx !== -1) {
      bucket.splice(idx, 1);
    }
  }

  /**
   * Executa o callback apenas na primeira emissão do evento.
   * @param {string} event
   * @param {Function} callback
   */
  once(event, callback) {
    const off = this.on(event, (data) => {
      off();
      callback(data);
    });
  }

  /**
   * Publica um evento para todos os ouvintes inscritos.
   * @param {string} event
   * @param {*} [data]
   */
  emit(event, data) {
    const bucket = this._listeners.get(event);
    if (!bucket || bucket.length === 0) return;
    for (let i = 0; i < bucket.length; i++) {
      try {
        bucket[i](data);
      } catch (err) {
        console.error(`[EventBus] Erro ao processar evento "${event}":`, err);
      }
    }
  }

  /**
   * Limpa todos os ouvintes registrados.
   */
  clear() {
    this._listeners.clear();
  }
}

export const EventBus = new EventBusRegistry();
