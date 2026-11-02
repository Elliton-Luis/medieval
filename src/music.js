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
    mp3: "audio/exploração.mp3",
    ogg: "audio/ambiente_calmo_dia_2.ogg",
    title: "Exploração Geral",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Exploração Ativa pelo Mundo Aberto (Dia)",
  },
  // Planícies e Pradarias Abertas
  grass: {
    mp3: "audio/ambiente_calmo_dia.mp3",
    ogg: "audio/ambiente_calmo_dia_2.ogg",
    title: "Ambiente Calmo (Dia)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Planícies, Pradarias e Campos Abertos",
  },
  // Cidades e Vilarejos
  town: {
    mp3: "audio/cidade_calma_dia.mp3",
    altMp3: "audio/cidade_dia_calmo.mp3",
    title: "Cidade Calma (Dia)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Cidades, Vilarejos, Mercados e Feiras",
  },
  // Florestas e Bosques
  forest: {
    mp3: "audio/ambiente_dia_floresta.mp3",
    title: "Ambiente Dia (Floresta)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Florestas, Matas e Bosques",
  },
  // Ermos Profundos e Matas Muito Densas
  deep_forest: {
    mp3: "audio/ambiente_dia_muito_denso.mp3",
    title: "Ambiente Dia Muito Denso",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Ermos Profundos, Montanhas e Selvas Fechadas",
  },
  // Exploração Noturna (Anoitecer até a Meia-Noite)
  night: {
    ogg: "audio/ambiente_denso_noite_2.ogg",
    mp3: "audio/ambiente_denso_noite_2.ogg",
    title: "Ambiente Denso (Noite)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Exploração Noturna e Primeiras Horas da Noite",
  },
  // Madrugada Sombria (00h às 05h)
  late_night: {
    ogg: "audio/ambiente_denso_madrugada.ogg",
    mp3: "audio/ambiente_denso_madrugada.ogg",
    title: "Ambiente Denso (Madrugada)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Madrugada Sombria e Alta Noite (00h às 05h)",
  },
  // Tavernas e Estalagens
  tavern: {
    ogg: "audio/generica_calma.ogg",
    mp3: "audio/generica_calma.ogg",
    title: "Genérica Calma (Tavernas & Estalagens)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Tavernas, Estalagens e Interiores Acolhedores",
  },
  // Igrejas e Catedrais Sagradas
  church: {
    ogg: "audio/generica_calma.ogg",
    mp3: "audio/generica_calma.ogg",
    title: "Genérica Calma (Serenidade Sacra)",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Igrejas, Catedrais e Altar Sagrado",
  },
  // Tensão / Monstros e Predadores à Espreita
  tension: {
    ogg: "audio/tensa_escalando.OGG",
    mp3: "audio/tensa_escalando.OGG",
    title: "Tensa Escalando",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Monstros, Criaturas Sombrias e Ameaça Iminente (< 35m)",
  },
  // Alias de compatibilidade para intro.js
  tense: {
    ogg: "audio/tensa_escalando.OGG",
    mp3: "audio/tensa_escalando.OGG",
    title: "Tensa Escalando",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Tensão Cinematográfica",
  },
  // Combate Leve (Procurado Nível 1 e 2)
  wanted_low: {
    mp3: "audio/batalha_menos_seria.mp3",
    title: "Batalha Menos Séria",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Combate Leve e Procurado Nível 1 a 2",
  },
  // Combate Médio (Procurado Nível 3)
  wanted_mid: {
    mp3: "audio/batalha_animada.mp3",
    title: "Batalha Animada",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Combate Intenso e Procurado Nível 3",
  },
  // Combate Geral (compatibilidade retroativa)
  wanted: {
    mp3: "audio/batalha_animada.mp3",
    title: "Batalha Animada",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Combate Geral",
  },
  // Perseguição Máxima (Procurado Nível 4 e 5)
  chase: {
    mp3: "audio/batalha_séria.mp3",
    title: "Batalha Séria",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Perseguição Implacável e Nível de Procurado 4 a 5",
  },
  // Vilas Fantasmas e Acampamentos do Demiurgo
  cult_camp: {
    mp3: "audio/vila_fantasma_e_acampamento_demiurgo.mp3",
    title: "Vila Fantasma & Acampamento do Demiurgo",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Vilas Fantasmas em Ruínas e Acampamentos Hereges",
  },
  // Dia de Eclipse e Cataclismo do Demiurgo
  eclipse: {
    mp3: "audio/o_fim_maligno.mp3",
    title: "O Fim Maligno",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Dia do Eclipse Solar e Cataclismo do Demiurgo",
  },
  // Descobertas e Segredos
  discovery: {
    mp3: "audio/descoberta.mp3",
    title: "Descoberta",
    artist: "Trilha Puris",
    license: "Uso Livre / Domínio Público",
    role: "Tesouros, Descobertas e Conclusão de Missões",
  },
  // Tela de Perecimento / Derrota
  defeat: {
    ogg: "audio/Derrota_2.ogg",
    wav: "audio/Derrota.wav",
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
    { track: "Exploração Geral", file: "audio/exploração.mp3", role: "Exploração Ativa pelo Mundo Aberto", license: "Uso Livre" },
    { track: "Ambiente Calmo (Dia)", file: "audio/ambiente_calmo_dia.mp3 & ambiente_calmo_dia_2.ogg", role: "Pradarias e Planícies Abertas", license: "Uso Livre" },
    { track: "Cidade Calma (Dia)", file: "audio/cidade_calma_dia.mp3 & cidade_dia_calmo.mp3", role: "Cidades, Vilarejos e Mercados", license: "Uso Livre" },
    { track: "Ambiente Dia Floresta", file: "audio/ambiente_dia_floresta.mp3", role: "Florestas e Bosques", license: "Uso Livre" },
    { track: "Ambiente Dia Muito Denso", file: "audio/ambiente_dia_muito_denso.mp3", role: "Ermos Profundos e Montanhas", license: "Uso Livre" },
    { track: "Ambiente Denso Noite", file: "audio/ambiente_denso_noite_2.ogg", role: "Exploração Noturna", license: "Uso Livre" },
    { track: "Ambiente Denso Madrugada", file: "audio/ambiente_denso_madrugada.ogg", role: "Madrugada Sombria (00h às 05h)", license: "Uso Livre" },
    { track: "Genérica Calma", file: "audio/generica_calma.ogg", role: "Tavernas, Estalagens e Serenidade Sacra nas Igrejas", license: "Uso Livre" },
    { track: "Tensa Escalando", file: "audio/tensa_escalando.OGG", role: "Ameaça Iminente e Monstros Próximos (< 35m)", license: "Uso Livre" },
    { track: "Batalha Menos Séria", file: "audio/batalha_menos_seria.mp3", role: "Combate Leve (Procurado 1-2)", license: "Uso Livre" },
    { track: "Batalha Animada", file: "audio/batalha_animada.mp3", role: "Combate Intenso (Procurado 3)", license: "Uso Livre" },
    { track: "Batalha Séria", file: "audio/batalha_séria.mp3", role: "Perseguição Máxima (Procurado 4-5)", license: "Uso Livre" },
    { track: "Vila Fantasma & Acampamento do Demiurgo", file: "audio/vila_fantasma_e_acampamento_demiurgo.mp3", role: "Cidades Fantasmas e Acampamentos Cultistas", license: "Uso Livre" },
    { track: "O Fim Maligno", file: "audio/o_fim_maligno.mp3", role: "Dia do Eclipse e Cataclismo do Demiurgo", license: "Uso Livre" },
    { track: "Descoberta", file: "audio/descoberta.mp3", role: "Conclusão de Missões e Tesouros Encontrados", license: "Uso Livre" },
    { track: "Trilha de Derrota", file: "audio/Derrota_2.ogg & Derrota.wav", role: "Tela de Perecimento e Morte", license: "Uso Livre" },
  ];
}

const SUPPORTS_VORBIS = typeof Audio !== "undefined" && Boolean(new Audio().canPlayType('audio/ogg; codecs="vorbis"'));
const FADE = 2.0;
const HOLD = 2.2; // Tempo que um novo contexto calmo deve durar para disparar o crossfade
const OPEN_FIELD_NAMES = new Set(["Pradaria de Caldera", "Estrada Real"]);
const EVICTION_TIME = 16.0; // Descarrega a faixa da RAM 16s após o término do fade-out

/**
 * Diretor de Música Dinâmica com Carregamento Sob Demanda e Descarregamento de Memória (Zero-Leak).
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
    if (!this.audio.context || this.pausedForDefeat) return;
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

  pauseForDefeat() {
    this.pausedForDefeat = true;
    if (this.current) {
      this._ramp(this.current, 0);
    }
  }

  resumeAfterDefeat() {
    this.pausedForDefeat = false;
    this.context = this._detect();
    this._switchTo(this.context);
  }

  playDiscovery() {
    try {
      const audio = new Audio("audio/descoberta.mp3");
      audio.volume = Math.min(1, (this.audio?.settings?.music ?? 0.6) * 1.0);
      audio.play().catch(() => {});
    } catch (_) {}
  }

  _isThreatNearby() {
    if (!this.player) return false;
    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;
    const maxDistSq = 35 * 35;

    // 1. Feras (lobos, wendigos, etc.)
    if (this.beasts?.beasts) {
      for (let i = 0; i < this.beasts.beasts.length; i++) {
        const b = this.beasts.beasts[i];
        if (!b || !b.mesh || !b.mesh.visible || b.dead) continue;
        const dx = b.mesh.position.x - px;
        const dz = b.mesh.position.z - pz;
        if (dx * dx + dz * dz < maxDistSq) return true;
      }
    }

    // 2. Monstros do MonstersPool (Ghouls, Lobisomens, etc.)
    if (this.monstersPool) {
      for (let i = 0; i < this.monstersPool.length; i++) {
        const m = this.monstersPool[i];
        if (!m || !m.root || !m.root.visible || m.dead || m.isDead) continue;
        const dx = m.root.position.x - px;
        const dz = m.root.position.z - pz;
        if (dx * dx + dz * dz < maxDistSq) return true;
      }
    }

    // 3. Cultistas hostis
    if (this.cultistsPool) {
      for (let i = 0; i < this.cultistsPool.length; i++) {
        const c = this.cultistsPool[i];
        if (!c || !c.root || !c.root.visible || c.isDead) continue;
        const dx = c.root.position.x - px;
        const dz = c.root.position.z - pz;
        if (dx * dx + dz * dz < maxDistSq) return true;
      }
    }

    return false;
  }

  _isGhostTownOrCultCampNearby() {
    if (!this.player) return false;
    const px = this.player.x ?? 0;
    const pz = this.player.z ?? 0;

    // Cidades Fantasmas (ActiveGhostTowns)
    const towns = this.activeGhostTowns || ActiveGhostTowns;
    if (towns && towns.length > 0) {
      for (let i = 0; i < towns.length; i++) {
        const t = towns[i];
        if (!t?.center) continue;
        const dx = px - t.center.x;
        const dz = pz - t.center.z;
        if (dx * dx + dz * dz < 55 * 55) return true;
      }
    }

    // Acampamentos Cultistas (CULT_CAMP_GROUPS)
    if (CULT_CAMP_GROUPS && CULT_CAMP_GROUPS.length > 0) {
      for (let i = 0; i < CULT_CAMP_GROUPS.length; i++) {
        const camp = CULT_CAMP_GROUPS[i];
        if (!camp) continue;
        const dx = px - camp.position.x;
        const dz = pz - camp.position.z;
        if (dx * dx + dz * dz < 45 * 45) return true;
      }
    }

    return false;
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

    if (this.activeCities) {
      for (const city of this.activeCities.values()) {
        if (!city?.center) continue;
        const dx = x - city.center.x;
        const dz = z - city.center.z;
        if (dx * dx + dz * dz < 60 * 60) return true;
      }
    }
    return false;
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

    // Urgências que mudam a música instantaneamente sem esperar HOLD
    const urgent =
      detected === "eclipse" ||
      detected === "chase" ||
      detected === "wanted_mid" ||
      detected === "wanted_low" ||
      detected === "tension" ||
      detected === "cult_camp" ||
      this.context === "chase" ||
      this.context === "wanted_mid" ||
      this.context === "wanted_low" ||
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
