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
const FADE_OUT_DURATION = 2.2; // Fade-out suave da música saindo (silêncio antes da próxima)
const FADE_IN_DURATION = 2.2;  // Fade-in suave da nova música
const FADE_URGENT_OUT = 0.6;   // Fade-out rápido para entrada imediata de combate
const FADE_URGENT_IN = 0.8;    // Fade-in rápido de combate
const HOLD = 6.0;              // Tempo de sustentação contínua (6s) para confirmar mudança de bioma calmo
const MIN_TRACK_STAY = 40.0;   // Tempo mínimo que uma música ambiente toca (40s) para manter a imersão
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
    this._combatCooldown = 0;

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
    const initialKey = this.override || this._detect();
    this.context = initialKey;
    this._switchTo(initialKey, true);
  }

  _urlFor(key) {
    const entry = TRACK_CATALOG[key] || TRACK_CATALOG.explore;
    if (SUPPORTS_VORBIS && entry.ogg) return entry.ogg;
    return entry.mp3 || entry.ogg || entry.wav || TRACK_CATALOG.explore.mp3;
  }

  _ensureTrackNodes(track) {
    if (!track || !this.audio || !this.audio.context || !this.audio.musicBus) return;
    if (!track.source) {
      try {
        track.source = this.audio.context.createMediaElementSource(track.element);
        track.gain = this.audio.context.createGain();
        track.gain.gain.setValueAtTime(track.currentVolume ?? 0, this.audio.context.currentTime);
        track.source.connect(track.gain).connect(this.audio.musicBus);
      } catch (_) {}
    }
  }

  _safePlay(track) {
    if (!track || !track.element) return;
    this._ensureTrackNodes(track);
    if (!track.element.paused && track._isPlaying) return;
    track._isPlaying = true;
    try {
      track._playPromise = track.element.play();
      if (track._playPromise && track._playPromise.catch) {
        track._playPromise.catch(() => {
          track._isPlaying = false;
        });
      }
    } catch (_) {
      track._isPlaying = false;
    }
  }

  _safePause(track) {
    if (!track || !track.element) return;
    track._isPlaying = false;
    this._applyTrackVolume(track, 0);
    const elem = track.element;
    if (track._playPromise) {
      track._playPromise
        .then(() => {
          try { elem.pause(); } catch (_) {}
        })
        .catch(() => {
          try { elem.pause(); } catch (_) {}
        });
      track._playPromise = null;
    } else {
      try { elem.pause(); } catch (_) {}
    }
  }

  _silenceAllExcept(trackA = null, trackB = null) {
    for (const [_, track] of this.tracks.entries()) {
      if (track !== trackA && track !== trackB) {
        if (track.currentVolume > 0) {
          this._applyTrackVolume(track, 0);
        }
        if (!track.element.paused || track._isPlaying) {
          this._safePause(track);
        }
      }
    }
  }

  /**
   * Carregamento Sob Demanda: Instancia a faixa na Web Audio API apenas quando solicitada.
   */
  _track(key) {
    let track = this.tracks.get(key);
    if (track) {
      this._ensureTrackNodes(track);
      return track;
    }

    const url = this._urlFor(key);
    const element = new Audio(url);
    element.loop = true;
    element.preload = "auto";

    track = {
      key,
      element,
      source: null,
      gain: null,
      currentVolume: 0,
      evictAt: 0,
      _isPlaying: false,
      _playPromise: null,
    };
    this._ensureTrackNodes(track);
    this.tracks.set(key, track);
    return track;
  }

  _applyTrackVolume(track, vol) {
    if (!track) return;
    const clamped = Math.max(0, Math.min(1, vol));
    track.currentVolume = clamped;
    this._ensureTrackNodes(track);
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

    if (urgent) {
      // Interrupção urgente (luta/caça/override): corta imediatamente qualquer faixa anterior
      if (this.fadingOutTrack) {
        this._safePause(this.fadingOutTrack);
        this.fadingOutTrack = null;
      }
      if (this.current && this.current.key !== key) {
        this._safePause(this.current);
        this.current = null;
      }
      const next = this._track(key);
      this.current = next;
      this.currentKey = key;
      this.targetKey = key;
      this._applyTrackVolume(next, 0);
      try { next.element.currentTime = 0; } catch (_) {}
      this._safePlay(next);
      this.fadePhase = "fading_in";
      this.startVolume = 0;
      this.phaseTimer = 0;
      this.phaseDuration = FADE_URGENT_IN;
      this._trackStartedTime = this.time;
      this._silenceAllExcept(this.current);
      return;
    }

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
      this.phaseDuration = FADE_IN_DURATION;
      this._silenceAllExcept(this.current);
      return;
    }

    // Se já estivermos no meio de um fade-out suave para o silêncio:
    // Apenas atualizamos o targetKey! A faixa saindo continua descendo até 0 antes que a nova comece.
    if (this.fadePhase === "fading_out") {
      this.targetKey = key;
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
      this.phaseDuration = FADE_OUT_DURATION;
      this._silenceAllExcept(this.fadingOutTrack);
    } else {
      // Se não havia faixa tocando, inicia direto o fade in na nova faixa
      if (this.current) {
        this._safePause(this.current);
        this.current = null;
      }
      const next = this._track(key);
      this.current = next;
      this.currentKey = key;
      this.fadingOutTrack = null;
      this._applyTrackVolume(next, 0);
      try { next.element.currentTime = 0; } catch (_) {}
      this._safePlay(next);
      this.fadePhase = "fading_in";
      this.startVolume = 0;
      this.phaseTimer = 0;
      this.phaseDuration = FADE_IN_DURATION;
      this._trackStartedTime = this.time;
      this._silenceAllExcept(this.current);
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
    for (const [k, track] of this.tracks.entries()) {
      this._safePause(track);
    }
    this.fadingOutTrack = null;
    this.current = null;
    this.fadePhase = "idle";
  }

  resumeAfterDefeat() {
    this.pausedForDefeat = false;
    this.fadePhase = "idle";
    this.fadingOutTrack = null;
    this.current = null;
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

  _isCombatOrHuntActive() {
    if (!this.player) return false;
    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;

    // 1. Procurado nível 1 a 5 (Guarda Real ativamente em perseguição/combate)
    if ((this.npcs?.wanted ?? 0) >= 1) {
      this._combatCooldown = 4.5;
      return true;
    }

    // 2. Dano sofrido ou desferido em combate recente (< 5.5s)
    if (this.player.lastCombatTime && (performance.now() - this.player.lastCombatTime) < 5500) {
      this._combatCooldown = 4.5;
      return true;
    }

    // 3. Inimigos atacando ou perseguindo o jogador por perto (< 26m)
    if (this.npcs?.npcs) {
      for (let i = 0; i < this.npcs.npcs.length; i++) {
        const n = this.npcs.npcs[i];
        if (!n || !n.alive || !n.root || !n.root.visible) continue;
        if (n.state === "attack" || n.state === "chase" || n.alerted) {
          const dx = n.x - px;
          const dz = n.z - pz;
          if (dx * dx + dz * dz < 26 * 26) {
            this._combatCooldown = 4.5;
            return true;
          }
        }
      }
    }

    // 4. Feras em perseguição ou investida (< 32m)
    if (this.beasts?.beasts) {
      for (let i = 0; i < this.beasts.beasts.length; i++) {
        const b = this.beasts.beasts[i];
        if (!b || !b.alive || !b.root || !b.root.visible) continue;
        if (b.state === "chase" || b.state === "charge" || b.state === "attacking") {
          const dx = b.x - px;
          const dz = b.z - pz;
          if (dx * dx + dz * dz < 32 * 32) {
            this._combatCooldown = 4.5;
            return true;
          }
        }
      }
    }

    // 5. Cultistas em combate ativo (< 28m)
    if (this.cultistsPool) {
      for (let i = 0; i < this.cultistsPool.length; i++) {
        const c = this.cultistsPool[i];
        if (!c || !c.alive || !c.root || !c.root.visible) continue;
        if (c.userData?.state === "ATTACKING" || c.hostile) {
          const dx = c.x - px;
          const dz = c.z - pz;
          if (dx * dx + dz * dz < 28 * 28) {
            this._combatCooldown = 4.5;
            return true;
          }
        }
      }
    }

    // Mantém a música de combate estável durante o cooldown sem oscilar (anti-flapping)
    if (this._combatCooldown > 0) {
      return true;
    }

    return false;
  }

  _detect() {
    // 1. Eclipse Solar Maligno e Cataclismo do Demiurgo (Prioridade Total)
    if (this._isEclipseOrCataclysm()) {
      return "eclipse";
    }

    // 2. LUTA / CAÇA: ÚNICA SITUAÇÃO COM AUTORIZAÇÃO DE SOBREPOR SUBITAMENTE A MÚSICA
    if (this._isCombatOrHuntActive()) {
      const wanted = this.npcs?.wanted ?? 0;
      if (wanted >= 4) return "chase";
      if (wanted >= 2) return "wanted_mid";
      return "wanted_low";
    }

    // 3. Vilas Fantasmas Amaldiçoadas & Acampamentos do Demiurgo
    if (this._isGhostTownOrCultCampNearby()) {
      return "cult_camp";
    }

    // 4. Interiores Sagrados ou Boêmios (Igreja e Taverna)
    if (this.player.sittingInChurch || this.player.inHouse?.type === "church") {
      return "church";
    }
    const inHouseType = this.player.inHouse?.type;
    if (inHouseType === "tavern" || inHouseType === "inn") {
      return "tavern";
    }

    // 5. Ciclo Noturno: Madrugada Sombria (00h às 05h) vs Noite Geral
    if (this.dayNight && this.dayNight.isNight) {
      // Progress de 0.0 a ~0.22 corresponde à madrugada in-game (00:00 às 05:15)
      if (this.dayNight.progress >= 0 && this.dayNight.progress < 0.22) {
        return "late_night";
      }
      return "night";
    }

    // 6. Cidades, Vilas e Mercados Diurnos
    if (this._isInCity()) {
      return "town";
    }

    // 7. Matas Fechadas e Bosques
    if (this.trees >= 18) return "deep_forest";
    if (this.trees >= 7) return "forest";

    // 8. Pradarias Abertas vs Exploração Ativa
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
    if (this._combatCooldown > 0) {
      this._combatCooldown = Math.max(0, this._combatCooldown - dt);
    }
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
      this._silenceAllExcept(this.fadingOutTrack);

      if (progress >= 1) {
        // Silêncio completo atingido pela faixa anterior!
        if (this.fadingOutTrack) {
          this._safePause(this.fadingOutTrack);
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
          this._safePlay(next);
          this.fadePhase = "fading_in";
          this.phaseTimer = 0;
          this.phaseDuration = FADE_IN_DURATION;
          this.startVolume = 0;
          this._trackStartedTime = this.time;
          this._silenceAllExcept(this.current);
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
          this._safePlay(this.current);
        }
      }
      this._silenceAllExcept(this.current);
      if (progress >= 1) {
        if (this.current) this._applyTrackVolume(this.current, 1);
        this.fadePhase = "idle";
      }
    } else if (this.fadePhase === "idle") {
      if (this.current) {
        if (this.current.currentVolume !== 1) this._applyTrackVolume(this.current, 1);
        if (this.current.element.paused) {
          this._safePlay(this.current);
        }
      }
      this._silenceAllExcept(this.current);
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
        if (!track.element.paused || track._isPlaying) {
          this._safePause(track);
        }
      }

      // Descarrega da memória (Eviction) após 16 segundos sem uso
      if (!isAllowedPlaying && track.evictAt && this.time >= track.evictAt) {
        try {
          this._safePause(track);
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
    const isCombat = detected === "chase" || detected === "wanted_mid" || detected === "wanted_low" || detected === "eclipse";
    const currentActiveOrTarget = this.targetKey || this.context;
    const isCurrentlyCombat = currentActiveOrTarget === "chase" || currentActiveOrTarget === "wanted_mid" || currentActiveOrTarget === "wanted_low" || currentActiveOrTarget === "eclipse";

    // 1. A ÚNICA MÚSICA QUE PODE SOBRESCREVER (MUDAR DO NADA) É A DE LUTA / CAÇA!
    const urgent = isCombat && !isCurrentlyCombat;
    if (urgent) {
      if (!isCurrentlyCombat && currentActiveOrTarget) {
        this._savedAmbientTrack = currentActiveOrTarget;
      }
      this.context = detected;
      this.pending = null;
      this._switchTo(detected, true);
      return;
    }

    // 2. A MÚSICA DE LUTA SÓ DEVE TOCAR ENQUANTO A LUTA ESTIVER ACONTECENDO!
    // Quando a luta finda, transiciona de volta à faixa ambiente salva.
    if (isCurrentlyCombat && !isCombat) {
      const returnTrack = this._savedAmbientTrack || detected;
      this.context = returnTrack;
      this.pending = null;
      this._switchTo(returnTrack, false);
      return;
    }

    if (detected === currentActiveOrTarget) {
      this.pending = null;
      return;
    }

    // 3. FAIXAS AMBIENTES: NUNCA SOBRESCREVEM DO NADA.
    // Exigem estabilidade no bioma (HOLD >= 6s) e tempo mínimo de permanência (MIN_TRACK_STAY >= 40s).
    if (this.pending !== detected) {
      this.pending = detected;
      this.pendingTime = 0;
    }

    this.pendingTime += 0.4;
    const timeSinceStarted = this.time - (this._trackStartedTime || 0);

    const canSwitchCalm = this.pendingTime >= HOLD && timeSinceStarted >= MIN_TRACK_STAY;
    const isTransitioning = this.fadePhase === "fading_out" || this.fadePhase === "fading_in";
    if (isTransitioning) return;

    if (canSwitchCalm) {
      this.context = detected;
      this.pending = null;
      this._switchTo(detected, false);
    }
  }
}
