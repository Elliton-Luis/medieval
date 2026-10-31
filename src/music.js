import { VILLAGES, locationAt } from "./kingdom.js";

// Música dinâmica a partir dos arquivos de audio/, com crossfade de 2 s.
// Cada faixa toca por <audio> (streaming, pouca memória) ligado ao barramento de música do Web Audio.
//
// Onde cada faixa entra, pelo nome do arquivo:
//   explore.mp3        mundo aberto em geral (arredores, estradas)
//   DST-GrassLands.mp3 planícies abertas, longe das vilas e sem mata fechada
//   forest_2.ogg       dentro da floresta (muitas árvores por perto)
//   town.mp3           dentro da capital e das vilas
//   wanted.mp3         procurado nível 1 a 3
//   chase.mp3          procurado nível 4 e 5; se o arquivo não existir, usa tense.mp3
const FILES = {
  explore: "audio/explore.mp3",
  grass: "audio/DST-GrassLands.mp3",
  forest: "audio/forest_2.ogg",
  town: "audio/town.mp3",
  wanted: "audio/wanted.mp3",
  chase: "audio/chase.mp3",
};
const CHASE_FALLBACK = "audio/tense.mp3";
const FADE = 2;
const HOLD = 2.5; // um contexto de "calma" precisa durar isso para trocar de faixa

const OPEN_FIELD_NAMES = new Set(["Pradaria de Caldera", "Estrada Real"]);

export class MusicDirector {
  constructor({ audio, world, player, npcs }) {
    this.audio = audio;
    this.world = world;
    this.player = player;
    this.npcs = npcs;
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
    this.chaseUrl = FILES.chase;
    this.time = 0;
    audio.onUnlock.push(() => this.start());
    if (audio.context) this.start();
  }

  async start() {
    if (this.started) return;
    this.started = true;
    // chase.mp3 pode não existir: nesse caso a tensão fica por conta do tense.mp3
    try {
      const response = await fetch(FILES.chase, { method: "HEAD" });
      if (!response.ok) this.chaseUrl = CHASE_FALLBACK;
    } catch {
      this.chaseUrl = CHASE_FALLBACK;
    }
    this.context = this._detect();
    this._switchTo(this.context);
  }

  _urlFor(key) {
    return key === "chase" ? this.chaseUrl : FILES[key];
  }

  _track(key) {
    let track = this.tracks.get(key);
    if (track) return track;
    const audio = this.audio;
    const element = new Audio(this._urlFor(key));
    element.loop = true;
    element.preload = "auto";
    const source = audio.context.createMediaElementSource(element);
    const gain = audio.context.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(audio.musicBus);
    track = { key, element, gain, stopAt: 0 };
    this.tracks.set(key, track);
    return track;
  }

  _ramp(track, target) {
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
      this.current.stopAt = this.time + FADE + 0.2;
    }
    next.stopAt = 0;
    if (next.element.paused) next.element.play().catch(() => {});
    this._ramp(next, 1);
    this.current = next;
  }

  _detect() {
    const wanted = this.npcs.wanted;
    if (wanted >= 4) return "chase";
    if (wanted >= 1) return "wanted";
    const { x, z } = this.player;
    if (!OPEN_FIELD_NAMES.has(locationAt(x, z))) return "town";
    if (this.trees >= 8) return "forest";
    let nearest = Infinity;
    for (const village of VILLAGES) nearest = Math.min(nearest, Math.hypot(x - village.x, z - village.z));
    nearest = Math.min(nearest, Math.hypot(x + 2, z + 20));
    return nearest > 75 ? "grass" : "explore";
  }

  _countTrees() {
    const { x, z } = this.player;
    let count = 0;
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

    // faixas que terminaram o fade-out são pausadas
    for (const track of this.tracks.values()) {
      if (track.stopAt && this.time >= track.stopAt) {
        track.stopAt = 0;
        track.element.pause();
      }
    }

    // dentro de casa a música abaixa
    const indoor = Boolean(this.player.inHouse);
    if (indoor !== this.indoor) {
      this.indoor = indoor;
      this.audio.musicIndoor = indoor ? 0.35 : 1;
      this.audio.applyMusicGain();
    }

    this.treeTimer -= dt;
    if (this.treeTimer <= 0) {
      this.treeTimer = 1;
      this.trees = this._countTrees();
    }

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.4;
    const wanted = this._detect();
    if (wanted === this.context) {
      this.pending = null;
      return;
    }
    // o procurado muda a música na hora; os demais contextos precisam se firmar
    const urgent = wanted === "chase" || wanted === "wanted" || this.context === "chase" || this.context === "wanted";
    if (this.pending !== wanted) {
      this.pending = wanted;
      this.pendingTime = 0;
    }
    this.pendingTime += 0.4;
    if (urgent || this.pendingTime >= HOLD) {
      this.context = wanted;
      this.pending = null;
      this._switchTo(wanted);
    }
  }
}
