const CSS = `
.pause-layer { position: absolute; inset: 0; z-index: 999999; display: none; place-items: center; background: radial-gradient(ellipse at center, #0b0f0dcc, #050706f0); pointer-events: auto; }
.pause-layer.on { display: grid; }
.pause-card { width: min(540px, calc(100vw - 36px)); padding: 32px 36px 28px; border: 2px solid #d2a969aa; border-radius: 8px; background: linear-gradient(145deg, #202922fa, #111813fd); box-shadow: 0 24px 90px #000e, 0 0 25px rgba(210, 169, 105, 0.2); color: #eee4cc; }
.pause-card h2 { margin: 0 0 6px; font: 900 34px Georgia, serif; letter-spacing: .12em; color: #f3ead2; }
.pause-card p { margin: 0 0 24px; color: #d6b266; font: italic 16px Georgia, serif; }
.pause-row { display: grid; gap: 10px; margin-bottom: 22px; }
.pause-row label { display: flex; justify-content: space-between; font: 700 15px ui-monospace, monospace; letter-spacing: .1em; text-transform: uppercase; color: #e0d3ab; }
.pause-vol-wrap { display: flex; align-items: center; gap: 8px; width: 100%; }
.pause-vol-wrap input[type=range] { flex: 1; accent-color: #d2a969; cursor: pointer; height: 8px; }
.pause-vol-btn { width: auto !important; margin: 0 !important; padding: 6px 12px !important; font: 700 13px ui-monospace, monospace !important; white-space: nowrap; border: 1px solid #d2a96988 !important; background: #1a251e !important; color: #f0e6cf !important; border-radius: 4px; cursor: pointer; user-select: none; transition: background 0.15s, border-color 0.15s; }
.pause-vol-btn:hover { background: #283a2f !important; border-color: #f0cf7a !important; color: #fff; }
.pause-toggle { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; margin-bottom: 20px; border: 1px solid #d2a96966; border-radius: 6px; background: #141c17dd; cursor: pointer; user-select: none; }
.pause-toggle:hover { border-color: #f0cf7a; background: #1a251eee; }
.pause-toggle span { font: 700 14px ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; color: #e0d3ab; }
.pause-toggle strong { font: 700 14px ui-monospace, monospace; letter-spacing: .1em; color: #82e08a; }
.pause-toggle.off strong { color: #ff6a55; }
.pause-card button { width: 100%; margin-top: 8px; padding: 15px; border: 1px solid #d2a969; background: #d2a96928; color: #fff4d6; font: 700 17px Georgia, serif; letter-spacing: .1em; cursor: pointer; border-radius: 4px; transition: background 0.15s, transform 0.1s; }
.pause-card button:hover { background: #d2a96950; transform: translateY(-1px); }
.pause-card small { display: block; margin-top: 16px; color: #c7b994b0; font: 13px ui-monospace, monospace; text-align: center; }
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
        <div class="pause-row">
          <label for="vol-music"><span>Música</span><span id="vol-music-n"></span></label>
          <div class="pause-vol-wrap">
            <button type="button" class="pause-vol-btn" id="vol-music-sub" title="Diminuir Música">🔉 -10%</button>
            <input id="vol-music" type="range" min="0" max="100" step="1">
            <button type="button" class="pause-vol-btn" id="vol-music-add" title="Aumentar Música">🔊 +10%</button>
          </div>
        </div>
        <div class="pause-row">
          <label for="vol-sfx"><span>Efeitos</span><span id="vol-sfx-n"></span></label>
          <div class="pause-vol-wrap">
            <button type="button" class="pause-vol-btn" id="vol-sfx-sub" title="Diminuir Efeitos">🔉 -10%</button>
            <input id="vol-sfx" type="range" min="0" max="100" step="1">
            <button type="button" class="pause-vol-btn" id="vol-sfx-add" title="Aumentar Efeitos">🔊 +10%</button>
          </div>
        </div>
        <div class="pause-toggle" id="aim-assist-row" role="switch" aria-checked="true" tabindex="0">
          <span>Assist. Mira (Ser mais próximo)</span>
          <strong id="aim-assist-state">ATIVADO</strong>
        </div>
        <button id="pause-continue" type="button">CONTINUAR</button>
        <button id="pause-debug" type="button" style="display: none;" aria-hidden="true">📊 TELA DE DEBUG F3 (ESTATÍSTICAS)</button>
        <button id="pause-cheats" type="button" style="display: none;" aria-hidden="true">🥔 CHEAT MENU (RECURSOS & ITENS)</button>
        <button id="pause-intro" type="button" style="margin-top: 8px; font-size: 14px; background: #281e1888; border-color: #c9a24a66;">VER INTRODUÇÃO</button>
        <button id="pause-reset-save" type="button" style="margin-top: 6px; font-size: 13px; background: #3f181888; border-color: #e0484888; color: #ffb0b0;">RESETAR SAVE (NOVO JOGO)</button>
        <small>T assist. mira · M música · Esc pausa</small>
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

    const updateMusic = (newVal) => {
      const clamped = Math.max(0, Math.min(100, Math.round(newVal)));
      music.value = String(clamped);
      audio.setMusicVolume(clamped / 100);
      show();
    };

    const updateSfx = (newVal, playSample = false) => {
      const clamped = Math.max(0, Math.min(100, Math.round(newVal)));
      sfx.value = String(clamped);
      audio.setSfxVolume(clamped / 100);
      show();
      if (playSample) audio.hit(false);
    };

    music.addEventListener("input", () => updateMusic(Number(music.value)));
    music.addEventListener("change", () => updateMusic(Number(music.value)));
    layer.querySelector("#vol-music-sub")?.addEventListener("click", () => updateMusic(Number(music.value) - 10));
    layer.querySelector("#vol-music-add")?.addEventListener("click", () => updateMusic(Number(music.value) + 10));

    sfx.addEventListener("input", () => updateSfx(Number(sfx.value)));
    sfx.addEventListener("change", () => updateSfx(Number(sfx.value), true));
    layer.querySelector("#vol-sfx-sub")?.addEventListener("click", () => updateSfx(Number(sfx.value) - 10, true));
    layer.querySelector("#vol-sfx-add")?.addEventListener("click", () => updateSfx(Number(sfx.value) + 10, true));

    layer.querySelector("#pause-continue").addEventListener("click", () => this.resume());
    layer.querySelector("#pause-debug")?.addEventListener("click", () => {
      this.resume();
      if (typeof window.toggleDebugScreen === "function") {
        window.toggleDebugScreen();
      }
    });
    layer.querySelector("#pause-cheats")?.addEventListener("click", () => {
      this._close();
      if (typeof window.openCheatModal === "function") {
        window.openCheatModal();
      } else if (window.CheatMenu && typeof window.CheatMenu.open === "function") {
        window.CheatMenu.open();
      }
    });
    layer.querySelector("#pause-intro")?.addEventListener("click", () => {
      this._close();
      this.onPlayIntro?.();
    });
    layer.querySelector("#pause-reset-save")?.addEventListener("click", () => {
      if (confirm("Tem certeza que deseja apagar todo o progresso do save e reiniciar o jogo?")) {
        try {
          localStorage.removeItem("gta-medieval-save-v1");
          localStorage.removeItem("gta-medieval-audio-v1");
        } catch (_) {}
        window.location.reload();
      }
    });
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
    const music = this.layer.querySelector("#vol-music");
    const sfx = this.layer.querySelector("#vol-sfx");
    const musicN = this.layer.querySelector("#vol-music-n");
    const sfxN = this.layer.querySelector("#vol-sfx-n");
    if (music && musicN) {
      const mv = Math.round((this.audio?.settings?.music ?? 0.6) * 100);
      music.value = String(mv);
      musicN.textContent = `${mv}%`;
    }
    if (sfx && sfxN) {
      const sv = Math.round((this.audio?.settings?.sfx ?? 0.85) * 100);
      sfx.value = String(sv);
      sfxN.textContent = `${sv}%`;
    }
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
