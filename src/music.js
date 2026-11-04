import { VILLAGES, locationAt } from "./kingdom.js";
import { WorldDecay } from "./decay.js";
import { ActiveGhostTowns } from "./ghostTowns.js";
import { CULT_CAMP_GROUPS } from "./cult.js";

// ============================================================================
// Catálogo de Trilhas Sonoras do Puris
// Formatos: OGG / MP3 / WAV com carregamento dinâmico sob demanda (Zero-Leak).
// ============================================================================
export const TRACK_CATALOG = {
  // Exploração Geral (Dia)
  explore: {
    mp3: "audio/music/exploration.mp3",
    ogg: "audio/music/ambient_calm_day_2.ogg",
    title: "Exploração Geral",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Exploração Ativa pelo Mundo Aberto (Dia)",
  },
  // Planícies e Pradarias Abertas
  grass: {
    mp3: "audio/music/ambient_calm_day.mp3",
    ogg: "audio/music/ambient_calm_day_2.ogg",
    title: "Ambiente Calmo (Dia)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Planícies, Pradarias e Campos Abertos",
  },
  // Cidades e Vilarejos
  town: {
    mp3: "audio/music/town_calm_day.mp3",
    altMp3: "audio/music/town_day_calm.mp3",
    title: "Cidade Calma (Dia)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Cidades, Vilarejos, Mercados e Feiras",
  },
  // Florestas e Bosques
  forest: {
    mp3: "audio/music/ambient_day_forest.mp3",
    title: "Ambiente Dia (Floresta)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Florestas, Matas e Bosques",
  },
  // Ermos Profundos e Matas Muito Densas
  deep_forest: {
    mp3: "audio/music/ambient_day_dense.mp3",
    title: "Ambiente Dia Muito Denso",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Ermos Profundos, Montanhas e Selvas Fechadas",
  },
  // Exploração Noturna (Anoitecer até a Meia-Noite)
  night: {
    ogg: "audio/music/ambient_dense_night.ogg",
    mp3: "audio/music/ambient_dense_night.ogg",
    title: "Ambiente Denso (Noite)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Exploração Noturna e Primeiras Horas da Noite",
  },
  // Madrugada Sombria (00h às 05h)
  late_night: {
    ogg: "audio/music/ambient_dense_dawn.ogg",
    mp3: "audio/music/ambient_dense_dawn.ogg",
    title: "Ambiente Denso (Madrugada)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Madrugada Sombria e Alta Noite (00h às 05h)",
  },
  // Tavernas e Estalagens
  tavern: {
    ogg: "audio/music/generic_calm.ogg",
    mp3: "audio/music/generic_calm.ogg",
    title: "Genérica Calma (Tavernas & Estalagens)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Tavernas, Estalagens e Interiores Acolhedores",
  },
  // Igrejas e Catedrais Sagradas
  church: {
    ogg: "audio/music/generic_calm.ogg",
    mp3: "audio/music/generic_calm.ogg",
    title: "Genérica Calma (Serenidade Sacra)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Igrejas, Catedrais e Altar Sagrado",
  },
  // Tensão / Monstros e Predadores à Espreita
  tension: {
    ogg: "audio/music/tense_escalating.ogg",
    mp3: "audio/music/tense_escalating.ogg",
    title: "Tensa Escalando",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Monstros, Criaturas Sombrias e Ameaça Iminente (< 35m)",
  },
  // Alias de compatibilidade para intro.js
  tense: {
    ogg: "audio/music/tense_escalating.ogg",
    mp3: "audio/music/tense_escalating.ogg",
    title: "Tensa Escalando",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Tensão Cinematográfica",
  },
  // Combate Leve (Procurado Nível 1 e 2)
  wanted_low: {
    mp3: "audio/music/battle_light.mp3",
    title: "Batalha Menos Séria",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Combate Leve e Procurado Nível 1 a 2",
  },
  // Combate Médio (Procurado Nível 3)
  wanted_mid: {
    mp3: "audio/music/battle_fast.mp3",
    title: "Batalha Animada",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Combate Intenso e Procurado Nível 3",
  },
  // Combate Geral (compatibilidade retroativa)
  wanted: {
    mp3: "audio/music/battle_fast.mp3",
    title: "Batalha Animada",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Combate Geral",
  },
  // Perseguição Máxima (Procurado Nível 4 e 5)
  chase: {
    mp3: "audio/music/battle_serious.mp3",
    title: "Batalha Séria",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Perseguição Implacável e Nível de Procurado 4 a 5",
  },
  // Vilas Fantasmas e Acampamentos do Demiurgo
  cult_camp: {
    mp3: "audio/music/ghost_town_demiurge_camp.mp3",
    title: "Vila Fantasma & Acampamento do Demiurgo",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Vilas Fantasmas em Ruínas e Acampamentos Hereges",
  },
  // Dia de Eclipse e Cataclismo do Demiurgo
  eclipse: {
    mp3: "audio/music/evil_end.mp3",
    title: "O Fim Maligno",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Dia do Eclipse Solar e Cataclismo do Demiurgo",
  },
  // Descobertas e Segredos
  discovery: {
    mp3: "audio/music/discovery.mp3",
    title: "Descoberta",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Tesouros, Descobertas e Conclusão de Missões",
  },
  // Tela de Perecimento / Derrota
  defeat: {
    ogg: "audio/music/defeat_2.ogg",
    wav: "audio/music/defeat.wav",
    title: "Trilha de Derrota",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Morte do Personagem e Tela de Perecimento",
  },
};

/**
 * Créditos e licenças das músicas homologadas no projeto.
 */
export function getMusicCredits() {
  return [
    { track: "Exploração Geral", file: "audio/music/exploration.mp3", role: "Exploração Ativa pelo Mundo Aberto", license: "Uso Livre" },
    { track: "Ambiente Calmo (Dia)", file: "audio/music/ambient_calm_day.mp3 & ambient_calm_day_2.ogg", role: "Pradarias e Planícies Abertas", license: "Uso Livre" },
    { track: "Cidade Calma (Dia)", file: "audio/music/town_calm_day.mp3 & town_day_calm.mp3", role: "Cidades, Vilarejos e Mercados", license: "Uso Livre" },
    { track: "Ambiente Dia Floresta", file: "audio/music/ambient_day_forest.mp3", role: "Florestas e Bosques", license: "Uso Livre" },
    { track: "Ambiente Dia Muito Denso", file: "audio/music/ambient_day_dense.mp3", role: "Ermos Profundos e Montanhas", license: "Uso Livre" },
    { track: "Ambiente Denso Noite", file: "audio/music/ambient_dense_night.ogg", role: "Exploração Noturna", license: "Uso Livre" },
    { track: "Ambiente Denso Madrugada", file: "audio/music/ambient_dense_dawn.ogg", role: "Madrugada Sombria (00h às 05h)", license: "Uso Livre" },
    { track: "Genérica Calma", file: "audio/music/generic_calm.ogg", role: "Tavernas, Estalagens e Serenidade Sacra nas Igrejas", license: "Uso Livre" },
    { track: "Tensa Escalando", file: "audio/music/tense_escalating.ogg", role: "Ameaça Iminente e Monstros Próximos (< 35m)", license: "Uso Livre" },
    { track: "Batalha Menos Séria", file: "audio/music/battle_light.mp3", role: "Combate Leve (Procurado 1-2)", license: "Uso Livre" },
    { track: "Batalha Animada", file: "audio/music/battle_fast.mp3", role: "Combate Intenso (Procurado 3)", license: "Uso Livre" },
    { track: "Batalha Séria", file: "audio/music/battle_serious.mp3", role: "Perseguição Máxima (Procurado 4-5)", license: "Uso Livre" },
    { track: "Vila Fantasma & Acampamento do Demiurgo", file: "audio/music/ghost_town_demiurge_camp.mp3", role: "Cidades Fantasmas e Acampamentos Cultistas", license: "Uso Livre" },
    { track: "O Fim Maligno", file: "audio/music/evil_end.mp3", role: "Dia do Eclipse e Cataclismo do Demiurgo", license: "Uso Livre" },
    { track: "Descoberta", file: "audio/music/discovery.mp3", role: "Conclusão de Missões e Tesouros Encontrados", license: "Uso Livre" },
    { track: "Trilha de Derrota", file: "audio/music/defeat_2.ogg & defeat.wav", role: "Tela de Perecimento e Morte", license: "Uso Livre" },
  ];
}

const SUPPORTS_VORBIS = typeof Audio !== "undefined" && Boolean(new Audio().canPlayType('audio/ogg; codecs="vorbis"'));
const FADE_OUT_DURATION = 2.0; // Fade-out suave da música saindo (silêncio antes da próxima)
const FADE_IN_DURATION = 2.0;  // Fade-in suave da nova música
const FADE_URGENT_OUT = 0.8;   // Fade-out para combate/perseguição
const FADE_URGENT_IN = 1.0;    // Fade-in para combate/perseguição
const HOLD = 5.0;              // Tempo de sustentação contínua (5s) para confirmar mudança de contexto
const MIN_TRACK_STAY = 28.0;   // Tempo mínimo que uma música toca (28s) para manter a imersão sem cortes frequentes
const OPEN_FIELD_NAMES = new Set(["Pradaria de Caldera", "Estrada Real"]);
const EVICTION_TIME = 16.0;    // Descarrega a faixa da RAM 16s após o término do fade-out

/**
 * Diretor de Música Dinâmica com Carregamento Sob Demanda e Descarregamento de Memória (Zero-Leak).
 * Garante rigorosamente UMA ÚNICA FAIXA por vez no mixer, eliminando qualquer overlap de músicas.
 */
export class MusicDirector {
  constructor({
    audio,
    world,
    player,
    npcs,
    dayNight = null,
    houses = null,
    monstersPool = null,
    cultistsPool = null,
    beasts = null,
    worldDecay = null,
    activeGhostTowns = null,
    activeCities = null,
  }) {
    this.audio = audio;
    this.world = world;
    this.player = player;
    this.npcs = npcs;
    this.dayNight = dayNight;
    this.houses = houses;
    this.monstersPool = monstersPool;
    this.cultistsPool = cultistsPool;
    this.beasts = beasts;
    this.worldDecay = worldDecay;
    this.activeGhostTowns = activeGhostTowns;
    this.activeCities = activeCities;

    this.tracks = new Map();
    this.current = null;
    this.currentKey = null;
    this.targetKey = null;
    this.fadingOutTrack = null;
    this.fadePhase = "idle"; // "idle" | "fading_out" | "fading_in"
    this.phaseTimer = 0;
    this.phaseDuration = FADE_IN_DURATION;
    this.startVolume = 0;
    this.context = "explore";
    this.pending = null;
    this.pendingTime = 0;
    this.timer = 0;
    this.started = false;
    this.treeTimer = 0;
    this.trees = 0;
    this.indoor = false;
    this.time = 0;
    this.override = null;
    this.pausedForDefeat = false;
    this._trackStartedTime = -999;
    this._threatActive = false;
    this._cityActive = false;
    this._ghostCampActive = false;

    // Pré-carrega o som de descoberta no construtor para evitar I/O no frame
    try {
      this._discoveryAudio = new Audio("audio/music/discovery.mp3");
      this._discoveryAudio.preload = "auto";
    } catch (_) {
      this._discoveryAudio = null;
    }

    audio.onUnlock.push(() => this.start());
    if (audio.context) this.start();
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.context = this._detect();
    this._switchTo(this.context);
  }

  _urlFor(key) {
    const entry = TRACK_CATALOG[key] || TRACK_CATALOG.explore;
    if (SUPPORTS_VORBIS && entry.ogg) return entry.ogg;
    return entry.mp3 || entry.ogg || entry.wav || TRACK_CATALOG.explore.mp3;
  }

  /**
   * Carregamento Sob Demanda: Instancia a faixa na Web Audio API apenas quando solicitada.
   */
  _track(key) {
    let track = this.tracks.get(key);
    if (track) return track;

    const audio = this.audio;
    const url = this._urlFor(key);
    const element = new Audio(url);
    element.loop = true;
    element.preload = "auto";

    let source = null;
    let gain = null;
    try {
      source = audio.context.createMediaElementSource(element);
      gain = audio.context.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(audio.musicBus);
    } catch (_) {
      // Fallback em caso de contexto indisponível
    }

    track = {
      key,
      element,
      source,
      gain,
      currentVolume: 0,
      evictAt: 0,
    };
    this.tracks.set(key, track);
    return track;
  }

  _applyTrackVolume(track, vol) {
    if (!track) return;
    const clamped = Math.max(0, Math.min(1, vol));
    track.currentVolume = clamped;
    if (track.gain && this.audio.context) {
      try {
        const param = track.gain.gain;
        param.cancelScheduledValues(this.audio.context.currentTime);
        param.setValueAtTime(clamped, this.audio.context.currentTime);
      } catch (_) {}
    }
    if (track.element) {
      try {
        track.element.volume = clamped;
      } catch (_) {}
    }
  }

  /**
   * Chaveia para uma nova faixa de música garantindo transição suave e ZERO overlap.
   * A faixa atual desce suavemente até o silêncio total antes que a próxima comece.
   */
  _switchTo(key, urgent = false) {
    if (!this.audio.context || this.pausedForDefeat) return;

    // Se já é a faixa atual e estamos estáveis ou subindo volume, nada a fazer
    if (this.currentKey === key && this.fadePhase !== "fading_out") return;

    // Se estávamos fazendo fade out da mesma faixa e ela foi solicitada de volta:
    // podemos reverter o fade de volta para fade-in a partir do volume atual
    if (this.fadingOutTrack && this.fadingOutTrack.key === key && this.fadePhase === "fading_out") {
      this.current = this.fadingOutTrack;
      this.currentKey = key;
      this.targetKey = key;
      this.fadingOutTrack = null;
      this.fadePhase = "fading_in";
      this.startVolume = this.current.currentVolume || 0;
      this.phaseTimer = 0;
      this.phaseDuration = urgent ? FADE_URGENT_IN : FADE_IN_DURATION;
      return;
    }

    this.targetKey = key;

    // Se já houver uma faixa ativa com som, iniciamos fade out suave nela primeiro
    if (this.current && this.current.currentVolume > 0.01) {
      this.fadingOutTrack = this.current;
      this.current = null;
      this.fadePhase = "fading_out";
      this.startVolume = this.fadingOutTrack.currentVolume;
      this.phaseTimer = 0;
      this.phaseDuration = urgent ? FADE_URGENT_OUT : FADE_OUT_DURATION;
      // Nenhuma outra faixa toca enquanto esta estiver diminuindo (overlap zero)
    } else {
      // Se não havia faixa tocando, inicia direto o fade in na nova faixa
      if (this.current) {
        this._applyTrackVolume(this.current, 0);
        try { this.current.element.pause(); } catch (_) {}
      }
      const next = this._track(key);
      this.current = next;
      this.currentKey = key;
      this.fadingOutTrack = null;
      this._applyTrackVolume(next, 0);
      try { next.element.currentTime = 0; } catch (_) {}
      next.element.play().catch(() => {});
      this.fadePhase = "fading_in";
      this.startVolume = 0;
      this.phaseTimer = 0;
      this.phaseDuration = urgent ? FADE_URGENT_IN : FADE_IN_DURATION;
      this._trackStartedTime = this.time;
    }
  }

  setOverride(key) {
    this.override = key;
    if (key) {
      this.context = key;
      this.pending = null;
      this._switchTo(key, true);
    } else {
      this.context = this._detect();
      this.pending = null;
      this._switchTo(this.context, true);
    }
  }

  pauseForDefeat() {
    this.pausedForDefeat = true;
    if (this.current) {
      this.fadingOutTrack = this.current;
      this.current = null;
      this.fadePhase = "fading_out";
      this.startVolume = this.fadingOutTrack.currentVolume || 1.0;
      this.phaseTimer = 0;
      this.phaseDuration = 0.5;
    }
    for (const [k, track] of this.tracks.entries()) {
      if (track !== this.fadingOutTrack) {
        this._applyTrackVolume(track, 0);
        try { track.element.pause(); } catch (_) {}
      }
    }
  }

  resumeAfterDefeat() {
    this.pausedForDefeat = false;
    this.fadePhase = "idle";
    this.fadingOutTrack = null;
    this.context = this._detect();
    this._switchTo(this.context, true);
  }

  playDiscovery() {
    if (!this._discoveryAudio) return;
    try {
      this._discoveryAudio.currentTime = 0;
      this._discoveryAudio.volume = Math.min(1, (this.audio?.settings?.music ?? 0.6) * 1.0);
      this._discoveryAudio.play().catch(() => {});
    } catch (_) {}
  }

  /**
   * Retorna metadados da faixa musical sendo reproduzida no momento para o painel de debug F3.
   */
  getCurrentTrackInfo() {
    const key = this.override || this.currentKey || this.context || "none";
    const catalog = TRACK_CATALOG[key];
    const isPlaying = Boolean(this.current && this.current.element && !this.current.element.paused);
    const title = catalog ? catalog.title : (key === "none" ? "Silêncio" : key);
    const file = catalog ? (catalog.mp3 || catalog.ogg || catalog.wav || "") : "";
    const fileName = file ? file.split("/").pop() : "";
    const curVol = (this.current ? (this.current.currentVolume ?? 0) : 0);
    const volumePct = Math.round(curVol * (this.audio?.settings?.music ?? 0.6) * 100);
    return {
      key,
      title,
      fileName,
      file,
      isPlaying,
      volumePct,
      role: catalog?.role || "Ambiente",
      phase: this.fadePhase,
    };
  }

  _isThreatNearby() {
    if (!this.player) return false;
    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    // Histerese anti-flapping: ativa aos 28m, só desativa ao se afastar além dos 42m
    const threshold = this._threatActive ? 42 : 28;
    const thresholdSq = threshold * threshold;

    let found = false;

    // 1. Feras (lobos, wendigos, etc.)
    if (this.beasts?.beasts) {
      for (let i = 0; i < this.beasts.beasts.length; i++) {
        const b = this.beasts.beasts[i];
        if (!b || !b.mesh || !b.mesh.visible || b.dead) continue;
        const dx = b.mesh.position.x - px;
        const dz = b.mesh.position.z - pz;
        if (dx * dx + dz * dz < thresholdSq) {
          found = true;
          break;
        }
      }
    }

    // 2. Monstros do MonstersPool (Ghouls, Lobisomens, etc.)
    if (!found && this.monstersPool) {
      for (let i = 0; i < this.monstersPool.length; i++) {
        const m = this.monstersPool[i];
        if (!m || !m.root || !m.root.visible || m.dead || m.isDead) continue;
        const dx = m.root.position.x - px;
        const dz = m.root.position.z - pz;
        if (dx * dx + dz * dz < thresholdSq) {
          found = true;
          break;
        }
      }
    }

    // 3. Cultistas hostis
    if (!found && this.cultistsPool) {
      for (let i = 0; i < this.cultistsPool.length; i++) {
        const c = this.cultistsPool[i];
        if (!c || !c.root || !c.root.visible || c.isDead) continue;
        const dx = c.root.position.x - px;
        const dz = c.root.position.z - pz;
        if (dx * dx + dz * dz < thresholdSq) {
          found = true;
          break;
        }
      }
    }

    this._threatActive = found;
    return found;
  }

  _isGhostTownOrCultCampNearby() {
    if (!this.player) return false;
    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;

    // Histerese anti-flapping para vilas fantasmas e acampamentos cultistas
    const townThreshold = this._ghostCampActive ? 68 : 48;
    const campThreshold = this._ghostCampActive ? 56 : 38;

    let found = false;
    // Cidades Fantasmas (ActiveGhostTowns)
    const towns = this.activeGhostTowns || ActiveGhostTowns;
    if (towns && towns.length > 0) {
      const sq = townThreshold * townThreshold;
      for (let i = 0; i < towns.length; i++) {
        const t = towns[i];
        if (!t?.center) continue;
        const dx = px - t.center.x;
        const dz = pz - t.center.z;
        if (dx * dx + dz * dz < sq) {
          found = true;
          break;
        }
      }
    }

    // Acampamentos Cultistas (CULT_CAMP_GROUPS)
    if (!found && CULT_CAMP_GROUPS && CULT_CAMP_GROUPS.length > 0) {
      const sq = campThreshold * campThreshold;
      for (let i = 0; i < CULT_CAMP_GROUPS.length; i++) {
        const camp = CULT_CAMP_GROUPS[i];
        if (!camp) continue;
        const dx = px - camp.position.x;
        const dz = pz - camp.position.z;
        if (dx * dx + dz * dz < sq) {
          found = true;
          break;
        }
      }
    }

    this._ghostCampActive = found;
    return found;
  }

  _isEclipseOrCataclysm() {
    const decay = this.worldDecay || WorldDecay;
    if (decay?.isEclipse) return true;
    if (typeof window !== "undefined" && window.__demiurgeCataclysmActive) return true;
    return false;
  }

  _isInCity() {
    if (!this.player) return false;
    const { x, z } = this.player;
    if (!OPEN_FIELD_NAMES.has(locationAt(x, z))) return true;

    // Histerese anti-flapping para cidades procedurais (entra com 52m, sai com 75m)
    const threshold = this._cityActive ? 75 : 52;
    const thresholdSq = threshold * threshold;

    let found = false;
    if (this.activeCities) {
      for (const city of this.activeCities.values()) {
        if (!city?.center) continue;
        const dx = x - city.center.x;
        const dz = z - city.center.z;
        if (dx * dx + dz * dz < thresholdSq) {
          found = true;
          break;
        }
      }
    }
    this._cityActive = found;
    return found;
  }

  _detect() {
    // 1. Eclipse Solar Maligno e Cataclismo do Demiurgo (Prioridade Total)
    if (this._isEclipseOrCataclysm()) {
      return "eclipse";
    }

    // 2. Procurado e Perseguição (Combate Escalonado)
    const wanted = this.npcs?.wanted ?? 0;
    if (wanted >= 4) return "chase";
    if (wanted === 3) return "wanted_mid";
    if (wanted >= 1) return "wanted_low";

    // 3. Tensão Iminente: Feras, Lobisomens ou Cultistas à espreita (< 35m)
    if (this._isThreatNearby()) {
      return "tension";
    }

    // 4. Vilas Fantasmas Amaldiçoadas & Acampamentos do Demiurgo
    if (this._isGhostTownOrCultCampNearby()) {
      return "cult_camp";
    }

    // 5. Interiores Sagrados ou Boêmios (Igreja e Taverna)
    if (this.player.sittingInChurch || this.player.inHouse?.type === "church") {
      return "church";
    }
    const inHouseType = this.player.inHouse?.type;
    if (inHouseType === "tavern" || inHouseType === "inn") {
      return "tavern";
    }

    // 6. Ciclo Noturno: Madrugada Sombria (00h às 05h) vs Noite Geral
    if (this.dayNight && this.dayNight.isNight) {
      // Progress de 0.0 a ~0.22 corresponde à madrugada in-game (00:00 às 05:15)
      if (this.dayNight.progress >= 0 && this.dayNight.progress < 0.22) {
        return "late_night";
      }
      return "night";
    }

    // 7. Cidades, Vilas e Mercados Diurnos
    if (this._isInCity()) {
      return "town";
    }

    // 8. Matas Fechadas e Bosques
    if (this.trees >= 18) return "deep_forest";
    if (this.trees >= 7) return "forest";

    // 9. Pradarias Abertas vs Exploração Ativa
    const { x, z } = this.player;
    let nearest = Infinity;
    for (const village of VILLAGES) {
      nearest = Math.min(nearest, Math.hypot(x - village.x, z - village.z));
    }
    nearest = Math.min(nearest, Math.hypot(x + 2, z + 20));
    return nearest > 75 ? "grass" : "explore";
  }

  _countTrees() {
    const { x, z } = this.player;
    let count = 0;
    if (!this.world?.activeChunks) return 0;
    for (const chunk of this.world.activeChunks) {
      if (Math.abs(chunk.centerX - x) > 70 || Math.abs(chunk.centerZ - z) > 70) continue;
      for (const o of chunk.colliders) {
        if (o.kind === "tree" && (o.x - x) ** 2 + (o.z - z) ** 2 < 22 * 22) count++;
      }
    }
    return count;
  }

  update(dt) {
    this.time += dt;
    if (!this.started || !this.audio.context || this.pausedForDefeat) return;

    // -------------------------------------------------------------------------
    // MÁQUINA DE TRANSIÇÃO SUAVE (GARANTIA DE UMA ÚNICA FAIXA POR VEZ)
    // -------------------------------------------------------------------------
    if (this.fadePhase === "fading_out") {
      this.phaseTimer += dt;
      const progress = Math.min(1, this.phaseTimer / this.phaseDuration);
      const vol = Math.max(0, this.startVolume * (1 - progress));
      if (this.fadingOutTrack) {
        this._applyTrackVolume(this.fadingOutTrack, vol);
      }
      if (progress >= 1) {
        // Silêncio completo atingido pela faixa anterior!
        if (this.fadingOutTrack) {
          this._applyTrackVolume(this.fadingOutTrack, 0);
          try { this.fadingOutTrack.element.pause(); } catch (_) {}
          this.fadingOutTrack.evictAt = this.time + EVICTION_TIME;
          this.fadingOutTrack = null;
        }

        // Agora sim a próxima faixa pode começar a subir, sem nenhum overlap
        if (this.targetKey) {
          const next = this._track(this.targetKey);
          this.current = next;
          this.currentKey = this.targetKey;
          this._applyTrackVolume(next, 0);
          try { next.element.currentTime = 0; } catch (_) {}
          next.element.play().catch(() => {});
          this.fadePhase = "fading_in";
          this.phaseTimer = 0;
          this.phaseDuration = FADE_IN_DURATION;
          this.startVolume = 0;
          this._trackStartedTime = this.time;
        } else {
          this.fadePhase = "idle";
        }
      }
    } else if (this.fadePhase === "fading_in") {
      this.phaseTimer += dt;
      const progress = Math.min(1, this.phaseTimer / this.phaseDuration);
      const vol = Math.min(1, progress);
      if (this.current) {
        this._applyTrackVolume(this.current, vol);
        if (this.current.element.paused) {
          this.current.element.play().catch(() => {});
        }
      }
      if (progress >= 1) {
        if (this.current) this._applyTrackVolume(this.current, 1);
        this.fadePhase = "idle";
      }
    } else if (this.fadePhase === "idle") {
      if (this.current) {
        if (this.current.currentVolume !== 1) this._applyTrackVolume(this.current, 1);
        if (this.current.element.paused) {
          this.current.element.play().catch(() => {});
        }
      }
    }

    // -------------------------------------------------------------------------
    // TRAVA ANTI-OVERLAP TOTAL & DESCARREGAMENTO DE MEMÓRIA (ZERO-LEAK)
    // -------------------------------------------------------------------------
    for (const [key, track] of this.tracks.entries()) {
      const isAllowedPlaying =
        (this.fadePhase === "fading_out" && track === this.fadingOutTrack) ||
        ((this.fadePhase === "fading_in" || this.fadePhase === "idle") && track === this.current);

      if (!isAllowedPlaying) {
        if (track.currentVolume > 0) {
          this._applyTrackVolume(track, 0);
        }
        if (!track.element.paused) {
          try { track.element.pause(); } catch (_) {}
        }
      }

      // Descarrega da memória (Eviction) após 16 segundos sem uso
      if (!isAllowedPlaying && track.evictAt && this.time >= track.evictAt) {
        try {
          track.element.pause();
          track.element.removeAttribute("src");
          track.element.load();
          if (track.gain) track.gain.disconnect();
          if (track.source) track.source.disconnect();
        } catch (_) {}
        this.tracks.delete(key);
      }
    }

    // Abafamento acústico quando dentro de casas
    const indoor = Boolean(this.player.inHouse);
    if (indoor !== this.indoor) {
      this.indoor = indoor;
      this.audio.musicIndoor = indoor ? 0.35 : 1;
      this.audio.applyMusicGain();
    }

    this.treeTimer -= dt;
    if (this.treeTimer <= 0) {
      this.treeTimer = 1.0;
      this.trees = this._countTrees();
    }

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.4;

    if (this.override) {
      if (this.context !== this.override) {
        this.context = this.override;
        this._switchTo(this.override, true);
      }
      return;
    }

    const detected = this._detect();
    const currentActiveOrTarget = this.targetKey || this.context;
    if (detected === currentActiveOrTarget) {
      this.pending = null;
      return;
    }

    // Urgências reais de vida ou morte que sobrepõem faixas calmas
    const urgent = (detected === "eclipse" || detected === "chase") && this.context !== detected;

    if (this.pending !== detected) {
      this.pending = detected;
      this.pendingTime = 0;
    }

    this.pendingTime += 0.4;
    const timeSinceStarted = this.time - (this._trackStartedTime || 0);

    // Transição calma exige que a faixa atual tenha tocado pelo menos MIN_TRACK_STAY (28s)
    // e que o novo contexto tenha se mantido estável por pelo menos HOLD (5s)
    const canSwitchCalm = this.pendingTime >= HOLD && timeSinceStarted >= MIN_TRACK_STAY;

    // Se estiver no meio de um fade, evita chavear novamente a menos que seja perigo de vida (chase/eclipse)
    const isTransitioning = this.fadePhase === "fading_out" || this.fadePhase === "fading_in";
    if (isTransitioning && !urgent) return;

    if (urgent || canSwitchCalm) {
      this.context = detected;
      this.pending = null;
      this._switchTo(detected, urgent);
    }
  }
}
