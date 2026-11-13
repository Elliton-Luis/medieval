// ============================================================================
// perfGovernor.js — governador de desempenho: busca MANTER 60 FPS mesmo no pior cenário.
//
// Técnica dos jogos de console antigos e de hoje (resolução dinâmica + LOD agressivo + orçamento de quadro):
// quando o quadro estoura o orçamento (16,7 ms) o jogo desce de NÍVEL, trocando um pouco de qualidade por
// velocidade em várias alavancas ao mesmo tempo (resolução, sombras, distância de desenho, LOD, taxa de
// animação dos NPCs). Quando há folga sustentada, sobe devagar. Histerese para não oscilar:
//   - desce rápido: média do intervalo entre quadros > 18,2 ms por ~1 s (emergência > 30 ms: desce 2 níveis);
//   - sobe devagar: trabalho do quadro < 9 ms e intervalo ~16,7 ms por 8 s+, com "backoff" se voltar a piorar;
//   - depois de qualquer troca, segura 2,5 s antes de reavaliar.
// ?perf=0..5 trava um nível; ?perf=off desliga. Em window.__perf: level, force(n), stats.
// ============================================================================

export const PERF_LEVELS = [
  // scale = fração da altura de render | shadow = lado do mapa | shadowEvery = 1 (sempre contínuo para evitar piscamentos)
  // lod/view = multiplicam as distâncias de LOD / de desenho | npc = multiplica o corte de taxa de animação dos NPCs
  { name: "Máxima", scale: 1.0, shadow: 1024, shadowEvery: 1, lod: 1.0, view: 1.0, npc: 1.0 },
  { name: "Alta", scale: 0.92, shadow: 1024, shadowEvery: 1, lod: 0.9, view: 0.92, npc: 1.0 },
  { name: "Média", scale: 0.85, shadow: 512, shadowEvery: 1, lod: 0.8, view: 0.85, npc: 1.3 },
  { name: "Baixa", scale: 0.75, shadow: 512, shadowEvery: 1, lod: 0.7, view: 0.75, npc: 1.6 },
  { name: "Mínima", scale: 0.67, shadow: 512, shadowEvery: 1, lod: 0.6, view: 0.65, npc: 2.0 },
  { name: "Emergência", scale: 0.67, shadow: 512, shadowEvery: 1, lod: 0.55, view: 0.55, npc: 3.0 },
];

export class PerfGovernor {
  /** apply(level, cfg) é chamado a cada troca de nível (main.js liga as alavancas). */
  constructor(apply) {
    this.apply = apply;
    this.level = 0;
    this.avgInterval = 16.7;
    this.avgWork = 8;
    this._slow = 0;
    this._fast = 0;
    this._hold = 3; // espera inicial: o jogo está carregando shaders e chunks
    this._upWait = 8;
    this._lastDown = -1e9;
    this._lastUp = -1e9;
    this._clock = 0;
    this.enabled = true;
    this.fixed = false;
    const p = typeof location !== "undefined" ? new URLSearchParams(location.search).get("perf") : null;
    if (p === "off") this.enabled = false;
    else if (p !== null && Number.isFinite(Number(p))) {
      this.fixed = true;
      this.level = Math.max(0, Math.min(PERF_LEVELS.length - 1, Math.round(Number(p))));
    }
    if (typeof window !== "undefined") window.__perf = this;
  }

  get cfg() {
    return PERF_LEVELS[this.level];
  }

  /** Aplica o nível atual (chamar uma vez depois de ligar as alavancas). */
  init() {
    this.apply(this.level, this.cfg);
  }

  force(level) {
    this.level = Math.max(0, Math.min(PERF_LEVELS.length - 1, Math.round(level)));
    this.fixed = true;
    this.apply(this.level, this.cfg);
  }

  /** intervalMs = tempo entre quadros; workMs = tempo gasto pelo JS no quadro; skip = pausa/cutscene/aba oculta. */
  update(intervalMs, workMs, skip = false) {
    if (!this.enabled || this.fixed) return;
    if (skip || (typeof document !== "undefined" && document.hidden)) {
      this._slow = 0;
      this._fast = 0;
      return;
    }
    const dtS = Math.min(intervalMs, 100) / 1000;
    this._clock += dtS;
    this.avgInterval += (Math.min(intervalMs, 100) - this.avgInterval) * 0.08;
    this.avgWork += (workMs - this.avgWork) * 0.08;
    if (this._hold > 0) {
      this._hold -= dtS;
      return;
    }

    // DESCER: abaixo de ~55 FPS sustentado (ou emergência)
    if (this.avgInterval > 18.2) this._slow += dtS;
    else this._slow = Math.max(0, this._slow - dtS * 2);
    if (this.level < PERF_LEVELS.length - 1 && (this._slow > 1.0 || this.avgInterval > 30)) {
      const step = this.avgInterval > 30 ? 2 : 1;
      if (this._clock - this._lastUp < 12) this._upWait = Math.min(60, this._upWait * 2); // subiu e piorou: backoff
      this._set(this.level + step);
      this._lastDown = this._clock;
      this._slow = 0;
      this._fast = 0;
      return;
    }

    // SUBIR: folga sustentada (trabalho do quadro baixo e 60 FPS cravados)
    if (this.avgWork < 9 && this.avgInterval < 17.4) this._fast += dtS;
    else this._fast = Math.max(0, this._fast - dtS);
    if (this.level > 0 && this._fast > this._upWait) {
      this._lastUp = this._clock;
      this._set(this.level - 1);
      this._fast = 0;
    }
  }

  _set(level) {
    this.level = Math.max(0, Math.min(PERF_LEVELS.length - 1, level));
    this._hold = 2.5;
    this.apply(this.level, this.cfg);
  }
}
