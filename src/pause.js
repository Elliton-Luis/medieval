const CSS = `
.pause-layer { position: absolute; inset: 0; z-index: 10; display: none; place-items: center; background: radial-gradient(ellipse at center, #0b0f0dcc, #050706f0); }
.pause-layer.on { display: grid; }
.pause-card { width: min(440px, calc(100vw - 36px)); padding: 28px 30px 24px; border: 2px solid #d2a96988; border-radius: 6px; background: linear-gradient(145deg, #202922f8, #111813f8); box-shadow: 0 20px 80px #000c; color: #eee4cc; }
.pause-card h2 { margin: 0 0 4px; font: 900 30px Georgia, serif; letter-spacing: .12em; color: #f3ead2; }
.pause-card p { margin: 0 0 22px; color: #d6b266; font: italic 15px Georgia, serif; }
.pause-row { display: grid; gap: 8px; margin-bottom: 20px; }
.pause-row label { display: flex; justify-content: space-between; font: 700 14px ui-monospace, monospace; letter-spacing: .1em; text-transform: uppercase; color: #e0d3ab; }
.pause-row input[type=range] { width: 100%; accent-color: #d2a969; cursor: pointer; }
.pause-toggle { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; margin-bottom: 18px; border: 1px solid #d2a96955; border-radius: 4px; background: #141c17cc; cursor: pointer; user-select: none; }
.pause-toggle:hover { border-color: #d2a969; background: #1a251ecc; }
.pause-toggle span { font: 700 13px ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; color: #e0d3ab; }
.pause-toggle strong { font: 700 13px ui-monospace, monospace; letter-spacing: .1em; color: #82e08a; }
.pause-toggle.off strong { color: #ff6a55; }
.pause-card button { width: 100%; margin-top: 6px; padding: 13px; border: 1px solid #d2a969; background: #d2a96922; color: #fff4d6; font: 700 16px Georgia, serif; letter-spacing: .1em; cursor: pointer; }
.pause-card button:hover { background: #d2a96940; }
.pause-card small { display: block; margin-top: 14px; color: #c7b994a0; font: 12px ui-monospace, monospace; text-align: center; }
`;

// Menu de pausa (Esc): volumes separados de música e efeitos + opção de Assist Aim. O jogo congela enquanto está aberto.
export class PauseMenu {
  constructor({ container, canvas, audio, input, aim }) {
    this.canvas = canvas;
    this.audio = audio;
    this.input = input;
    this.aim = aim;
    this.open = false;
    this.wasLocked = false;
    if (!document.getElementById("pause-style")) {
      const style = document.createElement("style");
      style.id = "pause-style";
      style.textContent = CSS;
      document.head.append(style);
    }
    const layer = document.createElement("div");
    layer.className = "pause-layer";
    layer.innerHTML = `
      <div class="pause-card" role="dialog" aria-modal="true" aria-label="Jogo pausado">
        <h2>PAUSADO</h2>
        <p>o reino aguarda o seu retorno</p>
        <div class="pause-row"><label for="vol-music"><span>Música</span><span id="vol-music-n"></span></label><input id="vol-music" type="range" min="0" max="100" step="1"></div>
        <div class="pause-row"><label for="vol-sfx"><span>Efeitos</span><span id="vol-sfx-n"></span></label><input id="vol-sfx" type="range" min="0" max="100" step="1"></div>
        <div class="pause-toggle" id="aim-assist-row" role="switch" aria-checked="true" tabindex="0">
          <span>Assist. Mira (Ser mais próximo)</span>
          <strong id="aim-assist-state">ATIVADO</strong>
        </div>
        <button id="pause-continue" type="button">CONTINUAR</button>
        <small>T alterna assist. mira · M música · Esc pausa</small>
      </div>`;
    container.append(layer);
    this.layer = layer;
    const music = layer.querySelector("#vol-music");
    const sfx = layer.querySelector("#vol-sfx");
    const musicN = layer.querySelector("#vol-music-n");
    const sfxN = layer.querySelector("#vol-sfx-n");
    const assistRow = layer.querySelector("#aim-assist-row");
    const assistState = layer.querySelector("#aim-assist-state");
    music.value = String(Math.round(audio.settings.music * 100));
    sfx.value = String(Math.round(audio.settings.sfx * 100));
    const show = () => {
      musicN.textContent = `${music.value}%`;
      sfxN.textContent = `${sfx.value}%`;
    };
    const syncAssist = () => {
      const on = Boolean(this.aim?.assistEnabled);
      assistState.textContent = on ? "ATIVADO" : "DESATIVADO";
      assistRow.classList.toggle("off", !on);
      assistRow.setAttribute("aria-checked", String(on));
    };
    show();
    syncAssist();
    if (this.aim) {
      this.aim.onAssistChange = () => syncAssist();
    }
    assistRow.addEventListener("click", () => {
      if (!this.aim) return;
      this.aim.toggleAssist();
      syncAssist();
    });
    assistRow.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!this.aim) return;
        this.aim.toggleAssist();
        syncAssist();
      }
    });
    music.addEventListener("input", () => { audio.setMusicVolume(Number(music.value) / 100); show(); });
    sfx.addEventListener("input", () => { audio.setSfxVolume(Number(sfx.value) / 100); show(); });
    // ao soltar o controle de efeitos toca um som de exemplo
    sfx.addEventListener("change", () => audio.hit(false));
    layer.querySelector("#pause-continue").addEventListener("click", () => this.resume());
    document.addEventListener("game-pointer-lock", (event) => this._onLock(event.detail));
  }

  _onLock(locked) {
    if (locked) {
      this.wasLocked = true;
      this._close();
    } else if (this.wasLocked && !this.input.modalOpen) {
      this._open();
    }
  }

  _open() {
    this.open = true;
    this.layer.classList.add("on");
  }

  _close() {
    this.open = false;
    this.layer.classList.remove("on");
  }

  resume() {
    this._close();
    this.canvas.requestPointerLock?.();
  }
}
