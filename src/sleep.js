import { saveGame } from "./save.js";
import { PlayerStats, PlayerInventory } from "./rpg.js?v=17";

const CSS = `
.sleep-layer { position: absolute; inset: 0; z-index: 9; background: #000; opacity: 0; pointer-events: none; display: grid; place-content: center; text-align: center; transition: opacity 1.2s ease; }
.sleep-layer.on { opacity: 1; }
.sleep-layer span { color: #d6b266; font: italic clamp(18px, 2.4vw, 30px) Georgia, serif; letter-spacing: .08em; opacity: 0; transition: opacity 1s ease .5s; }
.sleep-layer.on span { opacity: .9; }
`;

// Dormir: a tela escurece, o tempo corre até o amanhecer, vida e fôlego voltam e o jogo é salvo.
export class SleepSystem {
  constructor({ container, input, player, npcs, dayNight, ui, audio, weapons, candle }) {
    this.input = input;
    this.player = player;
    this.npcs = npcs;
    this.dayNight = dayNight;
    this.ui = ui;
    this.audio = audio;
    this.weapons = weapons;
    this.candle = candle;
    this.state = "idle";
    this.time = 0;
    if (!document.getElementById("sleep-style")) {
      const style = document.createElement("style");
      style.id = "sleep-style";
      style.textContent = CSS;
      document.head.append(style);
    }
    this.layer = document.createElement("div");
    this.layer.className = "sleep-layer";
    this.layer.innerHTML = "<span>Repousas até o amanhecer…</span>";
    container.append(this.layer);
  }

  get active() {
    return this.state !== "idle";
  }

  get isNight() {
    return this.dayNight.daylight < 0.2;
  }

  trySleep(house) {
    if (this.state !== "idle") return false;
    if (this.npcs.wanted > 0) {
      this.ui.showToast("Não podes dormir enquanto és caçado");
      return false;
    }
    if (!this.isNight) {
      this.ui.showToast("Ainda não é hora de repousar");
      return false;
    }
    if (house.price > 0) {
      if (this.player.coins < house.price) {
        this.ui.showToast(`A cama custa ${house.price} moedas`);
        return false;
      }
      this.player.coins -= house.price;
    }
    this.state = "out";
    this.time = 0;
    this.layer.classList.add("on");
    this.input.setModalOpen(true);
    return true;
  }

  update(dt) {
    if (this.state === "idle") return;
    this.time += dt;
    if (this.state === "out" && this.time > 1.4) {
      this.dayNight.progress = 0.27;
      this.player.health = this.player.maxHealth;
      this.player.stamina = 100;
      saveGame({
        coins: this.player.coins,
        health: this.player.health,
        potions: this.player.potions,
        weapons: this.weapons.serialize(),
        progress: this.dayNight.progress,
        x: this.player.x,
        z: this.player.z,
        candles: this.candle?.count ?? 0,
        stats: {
          str: PlayerStats.str,
          con: PlayerStats.con,
          cha: PlayerStats.cha,
          spd: PlayerStats.spd,
          hay: PlayerInventory.hay,
          wood: PlayerInventory.wood,
          stone: PlayerInventory.stone,
          torches: PlayerInventory.torches,
          hasSword: PlayerInventory.hasSword,
        },
      });
      this.state = "hold";
      this.time = 0;
    } else if (this.state === "hold" && this.time > 2.2) {
      this.layer.classList.remove("on");
      this.state = "in";
      this.time = 0;
    } else if (this.state === "in" && this.time > 1.3) {
      this.state = "idle";
      this.input.setModalOpen(false);
      this.ui.showToast("Descansaste bem · vida restaurada · jogo salvo");
      this.ui.setVitals(this.player.health, this.player.maxHealth, this.player.coins, this.player.potions);
    }
  }
}
