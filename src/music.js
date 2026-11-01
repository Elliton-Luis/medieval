import { VILLAGES, locationAt } from "./kingdom.js";

// ============================================================================
// Catálogo de Trilhas Sonoras Medievais Homologadas (OpenGameArt CC0 / CC-BY)
// Formatos: OGG (Vorbis 112k, decodificação rápida e sem engasgos) com fallback MP3.
// ============================================================================
export const TRACK_CATALOG = {
  // Exploração (Dia): The Bard's Tale / The Old Tower Inn
  explore: {
    ogg: "audio/explore.ogg",
    mp3: "audio/explore.mp3",
    title: "The Bard's Tale",
    artist: "RandomMind",
    license: "CC0 Public Domain",
    role: "Exploração Geral (Dia)",
  },
  // Exploração (Dia): GrassLands Theme
  grass: {
    ogg: "audio/DST-GrassLands.ogg",
    mp3: "audio/DST-GrassLands.mp3",
    title: "GrassLands Theme",
    artist: "Deceased Superior Technician",
    license: "CC0 Public Domain",
    role: "Planícies e Pradarias Abertas",
  },
  // Exploração (Noite / Tensão): Dark Forest Theme (por cynicmusic)
  night: {
    ogg: "audio/tense.ogg",
    mp3: "audio/tense.mp3",
    title: "Dark Forest Theme (Night & Tension)",
    artist: "cynicmusic (The Cynic Project)",
    license: "CC0 Public Domain",
    role: "Exploração Noturna e Tensão",
  },
  // Florestas e Matas Fechadas: Cathedral in the Forest
  forest: {
    ogg: "audio/forest_2.ogg",
    mp3: "audio/forest_2.ogg",
    title: "Cathedral in the Forest",
    artist: "OpenGameArt",
    license: "CC0 Public Domain",
    role: "Mata Fechada e Ermos Silenciosos",
  },
  // Cidades e Vilas: The Old Tower Inn / King's Feast / Minstrel Dance (RandomMind)
  town: {
    ogg: "audio/town.ogg",
    mp3: "audio/town.mp3",
    title: "The Old Tower Inn",
    artist: "RandomMind",
    license: "CC0 Public Domain",
    role: "Cidades, Vilarejos e Feiras",
  },
  // Tavernas e Estalagens: The Bard's Tale / Knight's Tale
  tavern: {
    ogg: "audio/explore.ogg",
    mp3: "audio/explore.mp3",
    title: "The Bard's Tale (Tavern Ambient)",
    artist: "RandomMind",
    license: "CC0 Public Domain",
    role: "Tavernas e Estalagens",
  },
  // Igrejas e Templários: Cathedral in the Forest (Sacred Choirs)
  church: {
    ogg: "audio/forest_2.ogg",
    mp3: "audio/forest_2.ogg",
    title: "Cathedral in the Forest (Holy Choir)",
    artist: "OpenGameArt",
    license: "CC0 Public Domain",
    role: "Igrejas, Catedrais e Altar Templário",
  },
  // Combate (Procurado Nível 1 a 3): Orcs Victorious / Medieval: Battle (Bobjt & RandomMind)
  wanted: {
    ogg: "audio/wanted.ogg",
    mp3: "audio/wanted.mp3",
    title: "Orcs Victorious / Medieval: Battle",
    artist: "Bobjt & RandomMind",
    license: "CC0 Public Domain",
    role: "Combate e Nível de Procurado 1-3",
  },
  // Perseguição Extrema (Nível 4 e 5): Heavy Battle Music / Raiders March
  chase: {
    ogg: "audio/tense.ogg",
    mp3: "audio/tense.mp3",
    title: "Heavy Battle Music / Raiders March",
    artist: "cynicmusic",
    license: "CC0 Public Domain",
    role: "Perseguição Máxima (Procurado Nível 4-5)",
  },
};

/**
 * Créditos e licenças das músicas homologadas no projeto.
 */
export function getMusicCredits() {
  return [
    { track: "GrassLands Theme", artist: "Deceased Superior Technician", source: "OpenGameArt.org", license: "CC0 Public Domain" },
    { track: "The Old Tower Inn", artist: "RandomMind", source: "OpenGameArt.org", license: "CC0 Public Domain" },
    { track: "The Bard's Tale", artist: "RandomMind", source: "OpenGameArt.org", license: "CC0 Public Domain" },
    { track: "Dark Forest Theme", artist: "cynicmusic (The Cynic Project)", source: "OpenGameArt.org", license: "CC0 Public Domain" },
    { track: "Cathedral in the Forest", artist: "OpenGameArt Community", source: "OpenGameArt.org", license: "CC0 Public Domain" },
    { track: "Orcs Victorious", artist: "Bobjt", source: "OpenGameArt.org", license: "CC0 Public Domain" },
    { track: "Battle Music (Alternative)", artist: "peastman", source: "OpenGameArt.org", license: "CC-BY 3.0" },
  ];
}

const SUPPORTS_VORBIS = typeof Audio !== "undefined" && Boolean(new Audio().canPlayType('audio/ogg; codecs="vorbis"'));
const FADE = 2.0;
const HOLD = 2.5; // Tempo que um novo contexto calmo deve durar para disparar o crossfade
const OPEN_FIELD_NAMES = new Set(["Pradaria de Caldera", "Estrada Real"]);
const EVICTION_TIME = 16.0; // Descarrega a faixa da RAM 16s após o término do fade-out

/**
 * Diretor de Música Dinâmica com Carregamento Sob Demanda e Descarregamento de Memória (Zero-Leak).
 */
export class MusicDirector {
  constructor({ audio, world, player, npcs, dayNight = null, houses = null }) {
    this.audio = audio;
    this.world = world;
    this.player = player;
    this.npcs = npcs;
    this.dayNight = dayNight;
    this.houses = houses;

    this.tracks = new Map();
    this.current = null;
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
    return SUPPORTS_VORBIS ? entry.ogg : entry.mp3;
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
      stopAt: 0,
      evictAt: 0,
    };
    this.tracks.set(key, track);
    return track;
  }

  _ramp(track, target) {
    if (!track.gain || !this.audio.context) return;
    const param = track.gain.gain;
    const now = this.audio.context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + FADE);
  }

  _switchTo(key) {
    if (!this.audio.context) return;
    const next = this._track(key);
    if (this.current && this.current !== next) {
      this._ramp(this.current, 0);
      this.current.stopAt = this.time + FADE + 0.15;
      this.current.evictAt = this.time + FADE + EVICTION_TIME;
    }
    next.stopAt = 0;
    next.evictAt = 0;
    if (next.element.paused) {
      next.element.play().catch(() => {});
    }
    this._ramp(next, 1);
    this.current = next;
  }

  setOverride(key) {
    this.override = key;
    if (key) {
      this.context = key;
      this.pending = null;
      this._switchTo(key);
    } else {
      this.context = this._detect();
      this.pending = null;
      this._switchTo(this.context);
    }
  }

  _detect() {
    // 1. Procurado e Perseguição (Prioridade Máxima)
    const wanted = this.npcs?.wanted ?? 0;
    if (wanted >= 4) return "chase";
    if (wanted >= 1) return "wanted";

    const { x, z } = this.player;

    // 2. Interiores Sagrados ou Boêmios (Igreja e Taverna)
    if (this.player.sittingInChurch || this.player.inHouse?.type === "church") {
      return "church";
    }
    const inHouseType = this.player.inHouse?.type;
    if (inHouseType === "tavern" || inHouseType === "inn") {
      return "tavern";
    }

    // 3. Exploração Noturna (Noite e Tensão)
    if (this.dayNight && this.dayNight.isNight) {
      return "night";
    }

    // 4. Cidades e Vilarejos
    if (!OPEN_FIELD_NAMES.has(locationAt(x, z))) return "town";

    // 5. Florestas Densas
    if (this.trees >= 8) return "forest";

    // 6. Pradarias Abertas vs Exploração Geral
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
    if (!this.started || !this.audio.context) return;

    // Gerenciamento de Memória & Pausa de Faixas Inativas (Zero-Leak)
    for (const [key, track] of this.tracks.entries()) {
      if (track === this.current) continue;

      // 1. Pausa o elemento ao término do crossfade
      if (track.stopAt && this.time >= track.stopAt) {
        track.stopAt = 0;
        if (!track.element.paused) track.element.pause();
      }

      // 2. Descarrega da memória (Eviction) após 16 segundos sem uso
      if (track.evictAt && this.time >= track.evictAt) {
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
        this._switchTo(this.override);
      }
      return;
    }

    const detected = this._detect();
    if (detected === this.context) {
      this.pending = null;
      return;
    }

    // O procurado ou perseguição mudam a música instantaneamente; outros contextos exigem estabilidade
    const urgent =
      detected === "chase" ||
      detected === "wanted" ||
      this.context === "chase" ||
      this.context === "wanted" ||
      detected === "church" ||
      detected === "tavern";

    if (this.pending !== detected) {
      this.pending = detected;
      this.pendingTime = 0;
    }

    this.pendingTime += 0.4;
    if (urgent || this.pendingTime >= HOLD) {
      this.context = detected;
      this.pending = null;
      this._switchTo(detected);
    }
  }
}
