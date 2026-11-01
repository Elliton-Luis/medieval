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
      for (const callback of this.onUnlock) callback();
    }
    if (this.context.state === "suspended") this.context.resume();
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

  // Passos: um sopro curto e abafado + uma batida grave. Corrida soa mais forte.
  step(run, strength = 1) {
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

  // Golpe no ar conforme o tipo da arma.
  weaponSwing(kind = "slash", heavy = false) {
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
}
