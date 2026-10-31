const CSS = `
.damage-flash { position: absolute; inset: 0; z-index: 3; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at center, rgba(120,0,0,0) 38%, rgba(200,12,12,.55) 78%, rgba(150,0,0,.9) 100%); }
.lowhp-vignette { position: absolute; inset: 0; z-index: 3; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(60,0,0,.65) 100%); }
#game.lowhp #world-canvas { filter: saturate(.55) contrast(1.06) brightness(.94); }
`;

// Efeitos de tela de dano: flash vermelho nas bordas, vida baixa (tela dessaturada) e batimento cardíaco.
export class DamageFx {
  constructor({ container, audio, player }) {
    this.container = container;
    this.audio = audio;
    this.player = player;
    this.flashValue = 0;
    this.beatTimer = 0;
    this.low = false;
    if (!document.getElementById("damagefx-style")) {
      const style = document.createElement("style");
      style.id = "damagefx-style";
      style.textContent = CSS;
      document.head.append(style);
    }
    this.flashEl = document.createElement("div");
    this.flashEl.className = "damage-flash";
    this.vignetteEl = document.createElement("div");
    this.vignetteEl.className = "lowhp-vignette";
    container.append(this.flashEl, this.vignetteEl);
  }

  flash(strength = 1) {
    this.flashValue = Math.min(1, Math.max(this.flashValue, strength));
  }

  update(dt) {
    const player = this.player;
    if (this.flashValue > 0.001) {
      this.flashValue = Math.max(0, this.flashValue - dt * 2.6);
      this.flashEl.style.opacity = this.flashValue.toFixed(3);
    } else if (this.flashEl.style.opacity !== "0") {
      this.flashEl.style.opacity = "0";
    }

    // vida baixa: 40% ou menos (e ainda vivo)
    const low = player.health > 0 && !player.dead && player.health <= Math.max(1, Math.ceil(player.maxHealth * 0.4));
    if (low !== this.low) {
      this.low = low;
      this.container.classList.toggle("lowhp", low);
      if (!low) this.vignetteEl.style.opacity = "0";
    }
    if (low) {
      const critical = player.health <= 1;
      const period = critical ? 0.78 : 1.05;
      this.beatTimer -= dt;
      if (this.beatTimer <= 0) {
        this.beatTimer = period;
        this.audio.heartbeat(critical ? 1 : 0.75);
        this.pulse = 1;
      }
      this.pulse = Math.max(0, (this.pulse || 0) - dt * 2.2);
      this.vignetteEl.style.opacity = (0.45 + this.pulse * 0.45).toFixed(3);
    } else {
      this.beatTimer = 0;
    }
  }
}
