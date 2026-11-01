// ============================================================================
// GameManager.js — O Coração do Jogo (Loop Centralizado & Time-Slicing)
// Único requestAnimationFrame central da aplicação.
// Delta com teto rígido (clamp de 0.05s) para evitar tunelamento de física.
// Time-Slicing inteligente: distribui atualizações pesadas de IA entre múltiplos quadros.
// ============================================================================

export const GAME_STATES = Object.freeze({
  BOOT: "BOOT",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  SLOW_MO: "SLOW_MO",
  ENDING: "ENDING",
});

export class GameManager {
  constructor() {
    this.state = GAME_STATES.BOOT;
    this.lastTime = performance.now();
    this.accumulatedTime = 0;
    this.timeScale = 1.0;
    this.maxDelta = 0.05; // Teto de 50ms para prevenir tunelamento de colisões

    // Time-Slicing para Inteligência Artificial (3 fatias de processamento)
    this.aiSliceIndex = 0;
    this.aiSliceCount = 3;

    this._updateCallbacks = [];
    this._renderCallbacks = [];
    this._animationFrameId = null;
    this._isRunning = false;

    this._tick = this._tick.bind(this);
  }

  /**
   * Inicia o único loop de renderização do jogo.
   */
  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this.state = GAME_STATES.RUNNING;
    this.lastTime = performance.now();
    this._animationFrameId = requestAnimationFrame(this._tick);
  }

  /**
   * Pausa o loop de execução.
   */
  stop() {
    if (!this._isRunning) return;
    this._isRunning = false;
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  /**
   * Registra um callback para ser executado no passo lógico de atualização.
   * @param {Function} fn (dt, timeSlicingInfo) => void
   */
  onUpdate(fn) {
    if (typeof fn === "function") this._updateCallbacks.push(fn);
  }

  /**
   * Registra um callback para ser executado no passo de renderização gráfica.
   * @param {Function} fn (alpha) => void
   */
  onRender(fn) {
    if (typeof fn === "function") this._renderCallbacks.push(fn);
  }

  /**
   * Ajusta a escala temporal para câmera lenta ou transições.
   * @param {number} scale
   */
  setTimeScale(scale) {
    this.timeScale = Math.max(0, Math.min(2.0, scale));
    if (this.timeScale < 0.99) this.state = GAME_STATES.SLOW_MO;
    else if (this.state === GAME_STATES.SLOW_MO) this.state = GAME_STATES.RUNNING;
  }

  setPaused(paused) {
    if (paused) {
      this.state = GAME_STATES.PAUSED;
    } else if (this.state === GAME_STATES.PAUSED) {
      this.state = GAME_STATES.RUNNING;
      this.lastTime = performance.now();
    }
  }

  _tick(now) {
    this._animationFrameId = requestAnimationFrame(this._tick);

    const elapsedRaw = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp rigoroso de 50ms para garantir integridade física
    const dt = Math.min(elapsedRaw, this.maxDelta) * this.timeScale;

    // Atualização do índice de Time-Slicing da IA (alterna 0, 1, 2)
    this.aiSliceIndex = (this.aiSliceIndex + 1) % this.aiSliceCount;
    const timeSliceInfo = {
      sliceIndex: this.aiSliceIndex,
      sliceCount: this.aiSliceCount,
      now,
    };

    if (this.state !== GAME_STATES.PAUSED) {
      for (let i = 0; i < this._updateCallbacks.length; i++) {
        this._updateCallbacks[i](dt, timeSliceInfo);
      }
    }

    for (let i = 0; i < this._renderCallbacks.length; i++) {
      this._renderCallbacks[i](dt);
    }
  }
}

export const GlobalGameManager = new GameManager();
