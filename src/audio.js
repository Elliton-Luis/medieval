// Efeitos sintetizados com Web Audio (nenhum arquivo externo). A música vem de audio/ (music.js).
// Dois barramentos separados: efeitos (sfx) e música (musicBus), com volume salvo no navegador.
const SETTINGS_KEY = "gta-medieval-audio-v1";

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (data && typeof data.music === "number" && typeof data.sfx === "number") return data;
  } catch { /* sem preferências salvas */ }
  return { music: 0.6, sfx: 0.85 };
}

export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.sfx = null;
    this.musicBus = null;
    this.noise = null;
    this.settings = loadSettings();
    this.musicMuted = false;
    this.musicIndoor = 1;
    this.onUnlock = [];
    this.sfxBuffers = new Map();
    this.beastStepBuffers = [];
    this._sfxLoadingStarted = false;
    const unlock = () => this._unlock();
    for (const type of ["pointerdown", "keydown", "mousedown", "click"]) window.addEventListener(type, unlock);
    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyM" && !event.repeat) this.toggleMusic();
    });
  }

  _unlock() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.context.destination);
      this.sfx = this.context.createGain();
      this.sfx.gain.value = this.settings.sfx;
      this.sfx.connect(this.master);
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = this.settings.music;
      this.musicBus.connect(this.master);
      const length = this.context.sampleRate;
      this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this._preloadSfx();
      for (const callback of this.onUnlock) callback();
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  _preloadSfx() {
    if (!this.context || this._sfxLoadingStarted) return;
    this._sfxLoadingStarted = true;

    const load = (name, url) => {
      fetch(encodeURI(url))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buf) => this.context.decodeAudioData(buf))
        .then((decoded) => {
          this.sfxBuffers.set(name, decoded);
        })
        .catch((err) => {
          console.warn(`[Audio] Falha ao carregar som ${url}:`, err);
        });
    };

    load("sword", "audio/efeitos sonoros/espada.wav");
    load("knife", "audio/efeitos sonoros/faca.wav");
    load("grassStep", "audio/efeitos sonoros/passos_grama.flac");
    load("wolfHowl", "audio/efeitos sonoros/lobo\u2044lobisomen.mp3");

    for (let i = 0; i < 8; i++) {
      const stepUrl = `audio/efeitos sonoros/passos_lobos\u2044lobisomens/${i}.ogg`;
      fetch(encodeURI(stepUrl))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buf) => this.context.decodeAudioData(buf))
        .then((decoded) => {
          this.beastStepBuffers.push(decoded);
        })
        .catch((err) => {
          console.warn(`[Audio] Falha ao carregar passo de fera ${i}:`, err);
        });
    }
  }

  playBuffer(buffer, volume = 1.0, pitchVariation = 0.05) {
    if (!this.context || !buffer || !this.sfx) return null;
    const t = this.context.currentTime;
    const src = this.context.createBufferSource();
    src.buffer = buffer;
    if (pitchVariation > 0) {
      src.playbackRate.value = 1.0 + (Math.random() * 2 - 1) * pitchVariation;
    }
    const gain = this.context.createGain();
    gain.gain.value = Math.max(0, volume);
    src.connect(gain).connect(this.sfx);
    src.start(t);
    return src;
  }

  playSword(heavy = false) {
    const buf = this.sfxBuffers.get("sword");
    if (buf) {
      this.playBuffer(buf, heavy ? 0.95 : 0.78, 0.08);
      return true;
    }
    return false;
  }

  playKnife() {
    const buf = this.sfxBuffers.get("knife");
    if (buf) {
      this.playBuffer(buf, 0.8, 0.1);
      return true;
    }
    return false;
  }

  playGrassStep(run = false, strength = 1.0) {
    const buf = this.sfxBuffers.get("grassStep");
    if (buf) {
      const vol = (run ? 0.75 : 0.48) * strength;
      this.playBuffer(buf, vol, 0.12);
      return true;
    }
    return false;
  }

  playWolfHowl(volume = 0.8, distance = 0) {
    const buf = this.sfxBuffers.get("wolfHowl");
    if (buf) {
      const distFactor = Math.max(0, 1 - distance / 95);
      if (distFactor <= 0.01) return false;
      this.playBuffer(buf, volume * distFactor, 0.04);
      return true;
    }
    return false;
  }

  playBeastStep(distance = 0) {
    if (this.beastStepBuffers.length === 0) return false;
    const distFactor = Math.max(0, 1 - distance / 70);
    if (distFactor <= 0.02) return false;
    const idx = Math.floor(Math.random() * this.beastStepBuffers.length);
    const buf = this.beastStepBuffers[idx];
    if (buf) {
      this.playBuffer(buf, 0.65 * distFactor, 0.08);
      return true;
    }
    return false;
  }

  _save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* ignorado */ }
  }

  applyMusicGain() {
    if (!this.musicBus) return;
    const target = this.musicMuted ? 0 : this.settings.music * this.musicIndoor;
    this.musicBus.gain.setTargetAtTime(target, this.context.currentTime, 0.35);
  }

  setMusicVolume(value) {
    this.settings.music = Math.max(0, Math.min(1, value));
    this._save();
    this.applyMusicGain();
  }

  setSfxVolume(value) {
    this.settings.sfx = Math.max(0, Math.min(1, value));
    this._save();
    if (this.sfx) this.sfx.gain.setTargetAtTime(this.settings.sfx, this.context.currentTime, 0.05);
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    this.applyMusicGain();
  }

  // Sino grave e distante da tela de morte; vai direto à saída, sem passar pelo volume do mundo.
  deathBell() {
    if (!this.context) return;
    const ctx = this.context;
    const out = ctx.createGain();
    out.gain.value = 0.55 * this.settings.sfx;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 1400;
    out.connect(tone).connect(ctx.destination);
    const strike = (delay, level) => {
      const t = ctx.currentTime + delay;
      // parciais inarmônicos de um sino grande
      for (const [mult, amp, decay] of [[1, 1, 7], [2.0, 0.55, 5.5], [2.76, 0.45, 4], [5.4, 0.22, 2.4], [8.93, 0.12, 1.4]]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 92 * mult;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(level * amp, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0004, t + decay);
        osc.connect(gain).connect(out);
        osc.start(t);
        osc.stop(t + decay + 0.1);
      }
    };
    strike(0.1, 0.8);
    strike(3.1, 0.5);
  }

  // O som do mundo some devagar (a música e os efeitos passam pelo volume principal).
  fadeWorld(seconds = 1.5) {
    if (!this.context) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0.03, this.context.currentTime, seconds / 3);
  }

  restoreWorld(seconds = 1) {
    if (!this.context) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0.55, this.context.currentTime, seconds / 3);
  }

  glass() {
    this._burst(0.16, 0.5, "highpass", 3500, 2000);
    this._tone("triangle", 1800, 900, 0.1, 0.18);
    this._burst(0.35, 0.22, "bandpass", 800, 300, 0.05);
  }

  // Gemido curto de dor: quatro variações (voz, formantes e curva de tom sorteados).
  pain() {
    if (!this.context) return;
    const ctx = this.context;
    const variants = [
      { f0: 190, f1: 130, formant: [650, 1150], len: 0.26, type: "sawtooth" },
      { f0: 240, f1: 160, formant: [760, 1300], len: 0.22, type: "sawtooth" },
      { f0: 150, f1: 100, formant: [520, 980], len: 0.32, type: "square" },
      { f0: 280, f1: 190, formant: [820, 1500], len: 0.2, type: "sawtooth" },
    ];
    const v = variants[Math.floor(Math.random() * variants.length)];
    const jitter = 0.92 + Math.random() * 0.16;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = v.type;
    osc.frequency.setValueAtTime(v.f0 * jitter, t);
    osc.frequency.exponentialRampToValueAtTime(v.f1 * jitter, t + v.len);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 22;
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.value = 6;
    vibrato.connect(vibratoGain).connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.34, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + v.len);
    const out = ctx.createGain();
    for (const f of v.formant) {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = f;
      filter.Q.value = 3.5;
      osc.connect(filter).connect(out);
    }
    out.connect(gain).connect(this.sfx);
    osc.start(t);
    vibrato.start(t);
    osc.stop(t + v.len + 0.05);
    vibrato.stop(t + v.len + 0.05);
    this._burst(0.06, 0.12, "bandpass", 1400, 600);
  }

  // Som do golpe recebido, conforme a arma.
  impact(type = "blade") {
    switch (type) {
      case "arrow":
        this._tone("triangle", 380, 140, 0.1, 0.3);
        this._burst(0.08, 0.3, "bandpass", 1800, 700);
        break;
      case "bolt":
        this._tone("square", 300, 90, 0.12, 0.3);
        this._burst(0.1, 0.4, "bandpass", 1400, 500);
        break;
      case "blunt":
      case "trample":
        this._tone("sine", 120, 40, 0.22, 0.6);
        this._burst(0.14, 0.45, "lowpass", 700, 120);
        break;
      case "blast":
        this._tone("sine", 90, 30, 0.4, 0.6);
        this._burst(0.3, 0.5, "lowpass", 1200, 100);
        break;
      case "burn":
        this._burst(0.35, 0.3, "bandpass", 2500, 1200);
        break;
      default: // lâmina
        this._burst(0.12, 0.45, "bandpass", 2600, 900);
        this._tone("sawtooth", 520, 180, 0.1, 0.25);
    }
  }

  heartbeat(strength = 1) {
    this._tone("sine", 62, 38, 0.13, 0.5 * strength);
    this._tone("sine", 56, 34, 0.15, 0.38 * strength, 0.2);
  }

  // Passos: som real de passos na grama/terra (passos_grama.flac) + batida grave de apoio.
  step(run, strength = 1) {
    if (this.playGrassStep(run, strength)) {
      if (this.context) {
        const v = (run ? 0.35 : 0.2) * strength;
        this._tone("sine", 95 + Math.random() * 20, 45, 0.07, v);
      }
      return;
    }
    if (!this.context) return;
    const v = (run ? 0.8 : 0.55) * strength * (0.8 + Math.random() * 0.4);
    this._burst(0.09, v, "lowpass", 650 + Math.random() * 450, 180);
    this._tone("sine", 105 + Math.random() * 25, 50, 0.09, v * 0.55);
  }

  land() {
    this._burst(0.14, 0.9, "lowpass", 600, 120);
    this._tone("sine", 85, 38, 0.14, 0.7);
  }

  _burst(duration, volume, filterType, freqStart, freqEnd, delay = 0) {
    if (!this.context || volume <= 0.001) return;
    const t = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freqStart, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(gain).connect(this.sfx);
    source.start(t, Math.random() * 0.5);
    source.stop(t + duration + 0.05);
  }

  _tone(type, freqStart, freqEnd, duration, volume, delay = 0) {
    if (!this.context || volume <= 0.001) return;
    const t = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.sfx);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  explosion(distance = 0) {
    const v = Math.max(0, 1 - distance / 120);
    this._tone("sine", 95, 28, 0.9, 0.95 * v);
    this._burst(1.5, 0.9 * v, "lowpass", 1400, 60);
    this._burst(0.35, 0.5 * v, "highpass", 1800, 600);
    this._burst(0.8, 0.35 * v, "bandpass", 500, 90, 0.18);
  }

  shot(kind) {
    if (kind === "musket") {
      this._burst(0.5, 0.8, "lowpass", 3200, 180);
      this._tone("sine", 140, 45, 0.25, 0.5);
    } else if (kind === "bow") {
      this._tone("triangle", 520, 150, 0.14, 0.28);
      this._burst(0.18, 0.18, "highpass", 2200, 1000);
    } else if (kind === "crossbow") {
      this._tone("square", 260, 80, 0.12, 0.2);
      this._burst(0.12, 0.35, "bandpass", 1600, 500);
    }
  }

  swing(heavy = false) {
    this._burst(heavy ? 0.28 : 0.2, heavy ? 0.28 : 0.2, "bandpass", 700, heavy ? 1800 : 2400);
  }

  // Golpe no ar conforme o tipo da arma (suporta samples reais de espada.wav e faca.wav).
  weaponSwing(kind = "slash", heavy = false, weaponId = null) {
    if (weaponId === "knife" || weaponId === "dagger" || weaponId === "knives" || kind === "knife") {
      if (this.playKnife()) return;
    }
    if (
      weaponId === "shortsword" ||
      weaponId === "longsword" ||
      weaponId === "greatsword" ||
      weaponId === "halberd" ||
      kind === "slash" ||
      kind === "blade"
    ) {
      if (this.playSword(heavy)) return;
    }

    const v = heavy ? 1.3 : 1;
    switch (kind) {
      case "punch": this._burst(0.12, 0.2 * v, "lowpass", 900, 250); break;
      case "stab": this._burst(0.11, 0.2 * v, "bandpass", 3000, 1800); break;
      case "chop": this._burst(0.3, 0.3 * v, "bandpass", 600, 1400); this._tone("sine", 140, 70, 0.2, 0.15 * v); break;
      case "smash": this._burst(0.36, 0.34 * v, "bandpass", 450, 1100); this._tone("sine", 100, 50, 0.3, 0.2 * v); break;
      default: this._burst(heavy ? 0.28 : 0.2, 0.26 * v, "bandpass", 700, heavy ? 1800 : 2400);
    }
  }

  hit(kill = false) {
    this._tone("sine", kill ? 150 : 210, 70, 0.12, 0.35);
    this._burst(0.08, 0.25, "lowpass", 1500, 300);
  }

  whistle() {
    this._tone("sine", 1700, 2500, 0.22, 0.2);
    this._tone("sine", 2500, 1800, 0.28, 0.18, 0.22);
  }

  neigh(strength = 1) {
    if (!this.context) return;
    const ctx = this.context;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.linearRampToValueAtTime(980, t + 0.18);
    osc.frequency.linearRampToValueAtTime(520, t + 0.55);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    filter.Q.value = 2.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.28 * strength, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.6);
    osc.connect(filter).connect(gain).connect(this.sfx);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  hoof(strength = 0.5) {
    this._burst(0.06, 0.35 + strength * 0.4, "lowpass", 420 + Math.random() * 200, 130);
    this._tone("sine", 78, 42, 0.07, 0.3 + strength * 0.3);
  }

  block() {
    this._tone("square", 900, 380, 0.09, 0.2);
    this._tone("triangle", 1500, 700, 0.12, 0.12);
    this._burst(0.07, 0.25, "highpass", 3000, 1500);
  }

  coin() {
    this._tone("triangle", 1250, 1900, 0.09, 0.14);
    this._tone("sine", 1900, 2400, 0.14, 0.08, 0.05);
  }

  coinDrop() {
    this._tone("triangle", 2200 + Math.random() * 600, 1800, 0.06, 0.05);
  }

  fuse() {
    this._burst(0.12, 0.08, "highpass", 4500, 3000);
  }

  metalDeflect() {
    this._tone("triangle", 2400, 1100, 0.14, 0.26);
    this._tone("sine", 3200, 1800, 0.18, 0.16, 0.02);
    this._burst(0.06, 0.22, "highpass", 3600, 1800);
  }

  woodChop() {
    this._tone("sine", 145, 58, 0.14, 0.42);
    this._burst(0.11, 0.34, "bandpass", 520, 240);
    this._burst(0.06, 0.18, "highpass", 1800, 900, 0.02);
  }

  stoneMine() {
    this._tone("triangle", 1850, 720, 0.12, 0.32);
    this._tone("sine", 2600, 1300, 0.15, 0.2, 0.015);
    this._burst(0.09, 0.3, "bandpass", 2200, 850);
  }

  // Canto gregoriano denso e épico para o final "Ira Dei" (Dies Irae / Coral da Cruzada Sagrada)
  playEpicChoir() {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    // Harmonia modal dórica sacra (Ré Menor / Dies Irae): Ré1 (73Hz), Lá1 (110Hz), Ré2 (146Hz), Fá2 (174Hz), Lá2 (220Hz), Ré3 (293Hz), Fá3 (349Hz), Lá3 (440Hz)
    const notes = [
      { f: 73.42, type: "sawtooth", gain: 0.18, cut: 320, dur: 9.5 },
      { f: 110.0, type: "sawtooth", gain: 0.22, cut: 450, dur: 9.5 },
      { f: 146.83, type: "triangle", gain: 0.28, cut: 750, dur: 9.2 },
      { f: 174.61, type: "sine", gain: 0.24, cut: 900, dur: 9.0 },
      { f: 220.0, type: "sine", gain: 0.32, cut: 1200, dur: 8.8 },
      { f: 293.66, type: "triangle", gain: 0.26, cut: 1600, dur: 8.5 },
      { f: 349.23, type: "sine", gain: 0.22, cut: 1900, dur: 8.2 },
      { f: 440.0, type: "sine", gain: 0.18, cut: 2400, dur: 8.0 },
    ];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const osc = ctx.createOscillator();
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.f, now);
      // LFO sutil para vibrato vocal humano
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.8 + i * 0.2;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = n.f * 0.008;
      lfo.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + n.dur);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(n.cut, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(n.gain, now + 1.2);
      gain.gain.setValueAtTime(n.gain, now + n.dur - 3.0);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.dur);

      osc.connect(filter).connect(gain).connect(this.sfx);
      osc.start(now);
      osc.stop(now + n.dur);
    }
  }

  choir() {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    // Acorde angelical maior (Dó - Mi - Sol - Dó oitava) com ataque suave de coro
    const freqs = [261.63, 329.63, 392.0, 523.25];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freqs[i], now);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 2.2);
      osc.connect(filter).connect(gain).connect(this.sfx);
      osc.start(now);
      osc.stop(now + 2.3);
    }
  }

  // Badalada solene do sino da igreja quando o jogador puxa a corda do campanário.
  churchBell() {
    if (!this.context) return;
    const ctx = this.context;
    const strike = (delay, baseFreq, ampScale) => {
      const t = ctx.currentTime + delay;
      for (const [mult, amp, decay] of [
        [1.0, 0.42, 3.8],
        [2.0, 0.28, 3.0],
        [2.4, 0.22, 2.3],
        [3.0, 0.14, 1.8],
        [4.2, 0.09, 1.2],
      ]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(baseFreq * mult, t);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(amp * ampScale, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0005, t + decay);
        osc.connect(gain).connect(this.sfx);
        osc.start(t);
        osc.stop(t + decay + 0.08);
      }
    };
    strike(0.0, 196.0, 1.0);
    strike(1.15, 146.83, 0.85);
  }

  // Som cristalino da pia de água benta ou do poço.
  holyWater() {
    this._burst(0.18, 0.16, "bandpass", 1900, 950);
    this._tone("sine", 880, 1320, 0.22, 0.14);
    this._tone("triangle", 1320, 1760, 0.28, 0.1, 0.08);
  }

  // Som de impacto grave, sussurro espectral e susto da Entidade de 6 Olhos (Web Audio API)
  supernaturalScare() {
    if (!this.context) return;
    const ctx = this.context;
    const t = ctx.currentTime;
    // Impacto sub-grave profundo com queda rápida
    this._tone("sawtooth", 90, 24, 1.4, 0.7);
    this._tone("sine", 60, 20, 1.8, 0.9);
    // Sussurro espectral e estalido
    this._burst(1.2, 0.65, "bandpass", 1600, 300);
    this._burst(0.4, 0.5, "highpass", 3200, 1200);

    // Acorde dissonante de órgão espectral (Tritonus)
    for (const freq of [110, 155.56, 220]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 1.8);
      osc.connect(gain).connect(this.sfx);
      osc.start(t);
      osc.stop(t + 1.85);
    }
  }

  // Som de folhear página e farfalhar pergaminho antigo
  bookPage() {
    if (!this.context) return;
    this._burst(0.24, 0.42, "bandpass", 950, 420);
    this._burst(0.12, 0.28, "highpass", 1600, 1100);
  }

  // Som contínuo de rugido e vento abissal da descida do Olho do Demiurgo
  demiurgeDescent() {
    if (!this.context) return;
    // Rugido descendente de baixa frequência
    this._tone("sawtooth", 140, 28, 2.2, 0.65);
    this._tone("triangle", 80, 22, 2.6, 0.85);
    this._burst(2.0, 0.7, "lowpass", 420, 90);
  }

  // Impacto cataclísmico do Olho Colossal chocando contra a terra
  colossalImpact() {
    if (!this.context) return;
    const ctx = this.context;
    const t = ctx.currentTime;
    // Sub-bass quake
    this._tone("sawtooth", 120, 15, 3.5, 1.0);
    this._tone("sine", 85, 12, 4.0, 1.0);
    this._burst(3.2, 0.95, "lowpass", 380, 40);
    this._burst(1.2, 0.8, "bandpass", 800, 180);
    // Acorde dissonante do cataclismo
    for (const f of [55, 77.78, 110, 155.56]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
      osc.connect(gain).connect(this.sfx);
      osc.start(t);
      osc.stop(t + 3.1);
    }
  }

  // Toque majestoso e solene da Trombeta do Apocalipse de São Miguel Arcanjo
  playTrumpetFanfare() {
    if (!this.context) return;
    const ctx = this.context;
    const t0 = ctx.currentTime;

    // Sequência de notas da fanfarra sacra triunfante
    const notes = [
      { f: 261.63, start: 0.0, dur: 0.32, gain: 0.35 },  // Dó4
      { f: 392.00, start: 0.32, dur: 0.32, gain: 0.38 }, // Sol4
      { f: 523.25, start: 0.64, dur: 0.45, gain: 0.42 }, // Dó5
      { f: 659.25, start: 1.09, dur: 0.45, gain: 0.42 }, // Mi5
      { f: 783.99, start: 1.54, dur: 5.5,  gain: 0.52 }, // Sol5 (Clímax solene prolongado)
      { f: 1046.50, start: 1.54, dur: 5.5, gain: 0.28 }, // Dó6 (Harmônico celestial)
    ];

    for (const n of notes) {
      const noteStart = t0 + n.start;
      const noteEnd = noteStart + n.dur;

      // 1. Oscilador dente-de-serra rico em harmônicos de metal
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(n.f, noteStart);

      // Vibrato nas notas mais longas
      if (n.dur > 1.0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(5.2, noteStart);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(n.f * 0.012, noteStart);
        lfo.connect(osc.frequency);
        lfo.start(noteStart);
        lfo.stop(noteEnd);
      }

      // 2. Filtro biquad para timbre metálico de trombeta de bronze/ouro
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2800, noteStart);
      filter.Q.value = 2.4;

      // 3. Envelope com ataque de sopro de metal rápido e sustain nobre
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.linearRampToValueAtTime(n.gain, noteStart + 0.06);
      if (n.dur > 1.0) {
        gain.gain.setValueAtTime(n.gain, noteEnd - 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      } else {
        gain.gain.setValueAtTime(n.gain * 0.9, noteEnd - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      }

      osc.connect(filter).connect(gain).connect(this.sfx);
      osc.start(noteStart);
      osc.stop(noteEnd);
    }
  }
}
