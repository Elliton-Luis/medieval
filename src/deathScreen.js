// Tela de morte medieval ("PERECESTE"): câmera lenta, cor sépia, vinheta, sino distante,
// texto gótico e renascimento. Módulo independente: só HTML/CSS sobre o canvas.
//
// Uso:
//   const death = new DeathScreen({ container, canvas, audio, cameraRig, input, onRespawn });
//   death.start({ coinsLost: 12 });   // quando a vida chega a zero
//   death.update(realDt);             // todo quadro, com o tempo real
//   dt = realDt * death.timeScale;    // câmera lenta para o resto do jogo

const FONT_URL = "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Almendra:wght@700&display=swap";

const TIMELINE = {
  slowMo: 1.6, // até chegar a 20% da velocidade
  fade: 3.2, // cor some, vinheta fecha
  camera: 4,
  title: 1,
  line: 2,
  subtitle: 2.7,
  coins: 4.7,
  prompt: 5.8,
};

const CSS = `
.wasted-layer { position: absolute; inset: 0; z-index: 8; pointer-events: none; display: none; }
.wasted-layer.on { display: block; }
.wasted-vignette { position: absolute; inset: 0; opacity: 0; background: radial-gradient(ellipse at center, transparent 28%, rgba(8,4,2,.55) 58%, #000 100%); }
.wasted-grain { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; mix-blend-mode: overlay; image-rendering: pixelated; }
.wasted-content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 5vw; }
.wasted-title { margin: 0; font-family: "Cinzel Decorative", "Almendra", "Old English Text MT", Georgia, "Times New Roman", serif; font-weight: 900; font-size: clamp(46px, 10vw, 128px); line-height: 1.05; letter-spacing: .07em; color: #9a1015; -webkit-text-stroke: 1.5px #c9a24a; paint-order: stroke fill; text-shadow: 0 5px 28px rgba(0,0,0,.9), 0 0 40px rgba(160,16,22,.4); opacity: 0; transform: scale(.88); transition: opacity 1.7s ease, transform 4s ease-out; }
.wasted-title.show { opacity: 1; transform: scale(1.04); }
.wasted-line { position: relative; width: min(620px, 62vw); height: 2px; margin: 22px 0 20px; background: linear-gradient(90deg, transparent, #c9a24a 14%, #e3c06a 50%, #c9a24a 86%, transparent); transform: scaleX(0); transform-origin: left center; transition: transform 1.3s cubic-bezier(.2,.7,.2,1); box-shadow: 0 0 10px rgba(201,162,74,.35); }
.wasted-line.show { transform: scaleX(1); }
.wasted-line::after { content: ""; position: absolute; left: 50%; top: 50%; width: 9px; height: 9px; background: #e3c06a; transform: translate(-50%, -50%) rotate(45deg); box-shadow: 0 0 12px rgba(227,192,106,.6); }
.wasted-subtitle { margin: 0; font-family: Georgia, "Times New Roman", serif; font-style: italic; font-size: clamp(18px, 2.7vw, 34px); letter-spacing: .06em; color: #d6b266; text-shadow: 0 2px 14px rgba(0,0,0,.9); opacity: 0; transition: opacity 1.5s ease; }
.wasted-subtitle.show { opacity: 1; }
.wasted-coins { margin: 30px 0 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(14px, 1.5vw, 19px); letter-spacing: .08em; color: #cdbb94; text-shadow: 0 2px 10px rgba(0,0,0,.9); opacity: 0; transition: opacity 1.2s ease; }
.wasted-coins.show { opacity: .9; }
.wasted-prompt { margin: 38px 0 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(13px, 1.4vw, 17px); letter-spacing: .2em; text-transform: uppercase; color: #e6d3a0; text-shadow: 0 2px 10px rgba(0,0,0,.9); opacity: 0; }
.wasted-prompt.show { animation: wasted-blink 2.2s ease-in-out infinite; }
@keyframes wasted-blink { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
.wasted-black { position: absolute; inset: 0; background: #000; opacity: 0; transition: opacity .9s ease; }
.wasted-black.show { opacity: 1; }
#game.wasted .hud-top-left, #game.wasted > .place, #game.wasted > .radar, #game.wasted > .vitals, #game.wasted > .hotbar, #game.wasted > .nearby-card,
#game.wasted > .controls-card, #game.wasted > .readout, #game.wasted > .prompt, #game.wasted > .toast, #game.wasted > .reticle, #game.wasted > .notice { opacity: 0 !important; pointer-events: none; transition: opacity .6s; }
`;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => t * t * (3 - 2 * t);

export const DEATH_MESSAGES = {
  GOOD: [
    "O Senhor teve misericórdia de ti.",
    "A luz divina guia teus passos de volta.",
    "Tua alma pura recusa as sombras."
  ],
  EVIL: [
    "O Demiurgo diz que não finalizastes tua missão.",
    "A matéria ainda te aprisiona ao tormento da carne.",
    "O abismo te cospe de volta ao caos dos viventes."
  ],
  NEUTRAL: [
    "ó vil e desditoso miserável.",
    "Tua carne pereceu sob o peso da terra.",
    "O fôlego da vida esvaiu-se no pó."
  ]
};

export class DeathScreen {
  constructor({ container, canvas, audio, cameraRig, input, onRespawn, music = null }) {
    this.container = container;
    this.canvas = canvas;
    this.audio = audio;
    this.cameraRig = cameraRig;
    this.input = input;
    this.onRespawn = onRespawn;
    this.music = music;
    this.state = "idle";
    this.time = 0;
    this.scale = 1;
    this.grainTimer = 0;
    this._shown = {};
    this._defeatAudio = null;
    this._onKey = (event) => this._wake(event);

    this._injectAssets();
    this._build();
  }

  get active() {
    return this.state !== "idle";
  }

  get timeScale() {
    return this.scale;
  }

  _injectAssets() {
    if (!document.getElementById("wasted-style")) {
      const style = document.createElement("style");
      style.id = "wasted-style";
      style.textContent = CSS;
      document.head.append(style);
    }
    if (!document.getElementById("wasted-font")) {
      const link = document.createElement("link");
      link.id = "wasted-font";
      link.rel = "stylesheet";
      link.href = FONT_URL;
      document.head.append(link);
    }
    // pré-carrega a fonte para o título não piscar com a fonte reserva
    document.fonts?.load('900 64px "Cinzel Decorative"').catch(() => {});
  }

  _build() {
    const layer = document.createElement("div");
    layer.className = "wasted-layer";
    layer.setAttribute("aria-live", "assertive");
    layer.innerHTML = `
      <div class="wasted-vignette"></div>
      <canvas class="wasted-grain" width="320" height="180"></canvas>
      <div class="wasted-content">
        <h1 class="wasted-title">PERECESTE</h1>
        <div class="wasted-line"></div>
        <p class="wasted-subtitle">ó vil e desditoso miserável</p>
        <p class="wasted-coins"></p>
        <p class="wasted-prompt">Pressiona qualquer tecla para despertar na igreja</p>
      </div>
      <div class="wasted-black"></div>`;
    this.container.append(layer);
    this.layer = layer;
    this.vignette = layer.querySelector(".wasted-vignette");
    this.grain = layer.querySelector(".wasted-grain");
    this.grainContext = this.grain.getContext("2d");
    this.grainData = this.grainContext.createImageData(320, 180);
    this.title = layer.querySelector(".wasted-title");
    this.line = layer.querySelector(".wasted-line");
    this.subtitle = layer.querySelector(".wasted-subtitle");
    this.coins = layer.querySelector(".wasted-coins");
    this.prompt = layer.querySelector(".wasted-prompt");
    this.black = layer.querySelector(".wasted-black");
  }

  start({ coinsLost = 0, morality = 0, customTitle = null, customSubtitle = null } = {}) {
    if (this.state !== "idle") return;
    this.state = "dying";
    this.time = 0;
    this.scale = 1;
    this._shown = {};

    if (customTitle && this.title) {
      this.title.textContent = customTitle;
    } else if (this.title) {
      this.title.textContent = "PERECESTE";
    }

    if (customSubtitle && this.subtitle) {
      this.subtitle.textContent = customSubtitle;
    } else {
      let messages = DEATH_MESSAGES.NEUTRAL;
      if (morality >= 20) messages = DEATH_MESSAGES.GOOD;
      else if (morality <= -20) messages = DEATH_MESSAGES.EVIL;
      this.subtitle.textContent = messages[Math.floor(Math.random() * messages.length)];
    }

    this.coins.textContent = coinsLost > 0
      ? `Perdeste ${coinsLost} ${coinsLost === 1 ? "moeda" : "moedas"} de ouro`
      : "Nada tinhas a perder";
    this.layer.classList.add("on");
    this.container.classList.add("wasted");
    this.cameraRig.frozen = true;
    this.input?.setModalOpen(true);
    this.music?.pauseForDefeat?.();
    this.audio.deathBell();
    this.audio.fadeWorld(1.6);
    try {
      if (!this._defeatAudio) {
        const canVorbis = typeof Audio !== "undefined" && Boolean(new Audio().canPlayType('audio/ogg; codecs="vorbis"'));
        this._defeatAudio = new Audio(canVorbis ? "audio/musicas/Derrota_2.ogg" : "audio/musicas/Derrota.wav");
        this._defeatAudio.preload = "auto";
      }
      this._defeatAudio.currentTime = 0;
      this._defeatAudio.volume = Math.min(1, (this.audio?.settings?.music ?? 0.6) * 1.05);
      this._defeatAudio.play().catch(() => {});
    } catch (_) {}
  }

  _reveal(name, element, at) {
    if (!this._shown[name] && this.time >= at) {
      this._shown[name] = true;
      element.classList.add("show");
    }
  }

  update(dt) {
    if (this.state === "idle") return;
    const T = TIMELINE;

    if (this.state === "dying" || this.state === "awaiting") {
      this.time += dt;
      this.scale = 1 + (0.2 - 1) * easeOut(clamp01(this.time / T.slowMo));
      const f = easeInOut(clamp01(this.time / T.fade));
      // a cor se perde até um sépia escuro
      this.canvas.style.filter = `sepia(${f.toFixed(3)}) grayscale(${(f * 0.3).toFixed(3)}) saturate(${(1 - 0.5 * f).toFixed(3)}) brightness(${(1 - 0.34 * f).toFixed(3)}) contrast(${(1 + 0.2 * f).toFixed(3)})`;
      this.vignette.style.opacity = String(f);
      this.grain.style.opacity = String(f * 0.3);
      this.cameraRig.deathBlend = easeInOut(clamp01(this.time / T.camera));
      this._animateGrain(dt);
      this._reveal("title", this.title, T.title);
      this._reveal("line", this.line, T.line);
      this._reveal("subtitle", this.subtitle, T.subtitle);
      this._reveal("coins", this.coins, T.coins);
      this._reveal("prompt", this.prompt, T.prompt);
      if (this.state === "dying" && this.time >= T.prompt) {
        this.state = "awaiting";
        window.addEventListener("keydown", this._onKey, true);
        window.addEventListener("mousedown", this._onKey, true);
      }
    } else if (this.state === "fadeout") {
      this.time += dt;
      this._animateGrain(dt);
      // tela toda preta: renasce na igreja e começa a clarear
      if (this.time >= 1.1) {
        this._reset();
        try {
          this.onRespawn?.();
        } catch (err) {
          console.error("Erro durante onRespawn:", err);
        }
        this.input?.setModalOpen(false);
        this.audio.restoreWorld(1.2);
        this.state = "hold";
        this.time = 0;
      }
    } else if (this.state === "hold") {
      this.time += dt;
      if (this.time >= 0.6) {
        this.black.classList.remove("show");
        this.state = "fadein";
        this.time = 0;
      }
    } else if (this.state === "fadein") {
      this.time += dt;
      if (this.time >= 1) {
        this.layer.classList.remove("on");
        this.container.classList.remove("wasted");
        this.state = "idle";
      }
    }
  }

  _wake(event) {
    if (this.state !== "awaiting") return;
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener("keydown", this._onKey, true);
    window.removeEventListener("mousedown", this._onKey, true);
    this.state = "fadeout";
    this.time = 0;
    this.black.classList.add("show");
  }

  // limpa tudo atrás da tela preta
  _reset() {
    if (this._defeatAudio) {
      try {
        this._defeatAudio.pause();
        this._defeatAudio.currentTime = 0;
      } catch (_) {}
    }
    this.music?.resumeAfterDefeat?.();
    this.canvas.style.filter = "";
    this.vignette.style.opacity = "0";
    this.grain.style.opacity = "0";
    for (const element of [this.title, this.line, this.subtitle, this.coins, this.prompt]) element.classList.remove("show");
    this.cameraRig.deathBlend = 0;
    this.cameraRig.frozen = false;
    this.scale = 1;
    this._shown = {};
  }

  _animateGrain(dt) {
    this.grainTimer -= dt;
    if (this.grainTimer > 0) return;
    this.grainTimer = 0.09;
    const data = this.grainData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = 90 + Math.random() * 120;
      data[i] = v;
      data[i + 1] = v * 0.92;
      data[i + 2] = v * 0.8;
      data[i + 3] = 255;
    }
    this.grainContext.putImageData(this.grainData, 0, 0);
  }
}
