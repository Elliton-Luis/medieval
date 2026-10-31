import { KINGDOM_NAME, locationAt } from "./kingdom.js";
import { drawWeaponIcon } from "./weapondata.js?v=13";

export class GameUI {
  constructor(renderer) {
    this.renderer = renderer;
    this.fps = document.getElementById("fps");
    this.clock = document.getElementById("clock");
    this.chunks = document.getElementById("chunk-count");
    this.coordinates = document.getElementById("coordinates");
    this.health = document.getElementById("health");
    this.healthNum = document.getElementById("health-num");
    this.coins = document.getElementById("coins");
    this.potions = document.getElementById("potions");
    this.weaponName = document.getElementById("weapon-name");
    this.weaponAmmo = document.getElementById("weapon-ammo");
    this.nearbyCard = document.getElementById("nearby-card");
    this.nearbyPortrait = document.getElementById("nearby-portrait");
    this.nearbyTask = document.getElementById("nearby-task");
    this.nearbyName = document.getElementById("nearby-name");
    this.nearbyRole = document.getElementById("nearby-role");
    this.nearbyHealth = document.getElementById("nearby-health");
    this.nearbyHealthFill = document.getElementById("nearby-health-fill");
    this.notice = document.getElementById("notice");
    this.loading = document.getElementById("loading");
    this.dialoguePanel = document.getElementById("dialogue-panel");
    this.dialogueTitle = document.getElementById("dialogue-title");
    this.dialogueBody = document.getElementById("dialogue-body");
    this.dialogueActions = document.getElementById("dialogue-actions");
    this.toast = document.getElementById("toast");
    this.location = document.getElementById("location");
    this.locationLabel = document.getElementById("location-label");
    // 9 slots de arma com ícones desenhados em canvas
    this.slotsRoot = document.getElementById("slots");
    this.slots = [];
    for (let i = 0; i < 9; i++) {
      const el = document.createElement("button");
      el.className = "slot none";
      el.type = "button";
      el.innerHTML = `<kbd>${i + 1}</kbd><canvas width="92" height="92"></canvas><span class="ammo"></span><em class="multi"></em>`;
      this.slotsRoot.append(el);
      this.slots.push({ el, canvas: el.querySelector("canvas"), ammo: el.querySelector(".ammo"), multi: el.querySelector(".multi"), shown: undefined, active: false });
    }
    this.chargeBar = document.getElementById("charge-bar");
    this.chargeFill = document.getElementById("charge-fill");
    this.controls = document.getElementById("controls-card");
    this.prompt = document.getElementById("prompt");
    this.candleText = document.getElementById("candle-text");
    this.candleCount = document.getElementById("candle-count");
    this.candleStat = document.getElementById("candle-stat");
    this.hayCount = document.getElementById("hay-count");
    this.woodCount = document.getElementById("wood-count");
    this.stoneCount = document.getElementById("stone-count");
    this.rpgStats = document.getElementById("rpg-stats");
    this.staminaFill = document.getElementById("stamina-fill");
    this.staminaBar = document.getElementById("stamina-bar");
    this.stealthTag = document.getElementById("stealth-tag");
    this._stealth = false;
    this.wanted = document.getElementById("wanted");
    this.wantedBlock = document.getElementById("wanted-block");
    this.reticle = document.getElementById("reticle");
    this.hitmark = document.getElementById("hitmark");
    this._reticleGap = -1;
    this._reticleMode = "";
    this._reticleTarget = false;
    this._hitTimeout = 0;
    this._lastLocation = "";
    if (this.locationLabel) this.locationLabel.textContent = KINGDOM_NAME.toLocaleUpperCase("pt-BR");
    this.onDialogAction = null;
    this.onDialogClose = null;
    this._timeSinceUpdate = 0;
    this._frames = 0;
    this._lastFrameTime = performance.now();
    this._smoothedFps = 0;
    this._noticeExpired = false;
    window.setTimeout(() => {
      this._noticeExpired = true;
      this.notice.classList.add("hidden");
    }, 7000);
    document.addEventListener("game-pointer-lock", (event) => {
      if (event.detail) this.notice.classList.add("hidden");
      else if (!this._noticeExpired) this.notice.classList.remove("hidden");
    });
    window.setTimeout(() => this.controls?.classList.add("hidden"), 16000);
    window.addEventListener("keydown", (event) => {
      if ((event.code === "KeyK" || event.code === "F1") && !event.repeat) {
        event.preventDefault();
        this.controls?.classList.toggle("hidden");
      }
    });
    document.getElementById("dialogue-close").addEventListener("click", () => this.closeDialogue());
  }

  hideLoading() {
    this.loading.classList.add("done");
    window.setTimeout(() => this.loading.remove(), 800);
  }

  update(dt, clock, activeChunks, nearestNPC, playerX, playerZ) {
    this._frames++;
    this._timeSinceUpdate += dt;
    if (this._timeSinceUpdate < 0.15) return;
    const instantaneous = this._frames / this._timeSinceUpdate;
    this._smoothedFps = this._smoothedFps ? this._smoothedFps * 0.72 + instantaneous * 0.28 : instantaneous;
    this.fps.textContent = Math.round(this._smoothedFps).toString();
    this.clock.textContent = clock;
    this.chunks.textContent = `${activeChunks} REGIÕES`;
    this.coordinates.textContent = `X ${Math.round(playerX)} · Z ${Math.round(playerZ)}`;
    const place = locationAt(playerX, playerZ);
    if (place !== this._lastLocation) {
      this._lastLocation = place;
      this.location.textContent = place;
    }
    if (nearestNPC) {
      this.nearbyCard.hidden = false;
      const canInteract = nearestNPC.distanceSq < 3.8 * 3.8;
      this.nearbyTask.textContent = canInteract ? `${nearestNPC.task.toLocaleUpperCase("pt-BR")} · E` : nearestNPC.task.toLocaleUpperCase("pt-BR");
      this.nearbyName.textContent = nearestNPC.name;
      this.nearbyRole.textContent = nearestNPC.title;
      this.nearbyHealth.hidden = nearestNPC.health >= nearestNPC.maxHealth;
      this.nearbyHealthFill.style.width = `${Math.max(0, nearestNPC.health / nearestNPC.maxHealth) * 100}%`;
      const frame = PORTRAIT_FRAMES[nearestNPC.roleKey] || PORTRAIT_FRAMES.villager;
      this.nearbyPortrait.style.backgroundPosition = `${-frame.x * 34}px ${-frame.y * 34}px`;
    } else {
      this.nearbyCard.hidden = true;
    }
    this._frames = 0;
    this._timeSinceUpdate = 0;
    this._lastFrameTime = performance.now();
  }

  // spread em radianos: converte para pixels de acordo com o FOV da câmera.
  setReticle(visible, spread, onTarget, aiming, assistLocked = false) {
    const mode = !visible ? "off" : aiming ? "aim" : "hip";
    if (mode !== this._reticleMode) {
      this._reticleMode = mode;
      this.reticle.dataset.mode = mode;
    }
    if (onTarget !== this._reticleTarget) {
      this._reticleTarget = onTarget;
      this.reticle.classList.toggle("on-target", onTarget);
    }
    if (assistLocked !== this._reticleAssist) {
      this._reticleAssist = assistLocked;
      this.reticle.classList.toggle("assist-locked", assistLocked);
    }
    if (!visible) return;
    const gap = Math.round(6 + Math.tan(spread) * window.innerHeight * 1.05);
    if (gap !== this._reticleGap) {
      this._reticleGap = gap;
      this.reticle.style.setProperty("--gap", `${gap}px`);
    }
  }

  setCandle(text, count, lit) {
    if (!this.candleText) return;
    this.candleText.textContent = text;
    this.candleCount.textContent = String(count);
    this.candleStat.classList.toggle("lit", Boolean(lit));
  }

  // ratio 0..1, ou null para esconder (só aparece montado)
  setStamina(ratio) {
    if (!this.staminaBar) return;
    if (ratio === null) {
      if (!this.staminaBar.hidden) this.staminaBar.hidden = true;
      return;
    }
    this.staminaBar.hidden = false;
    this.staminaFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }

  setStealth(on) {
    if (on === this._stealth || !this.stealthTag) return;
    this._stealth = on;
    this.stealthTag.hidden = !on;
  }

  setPrompt(text) {
    if (!this.prompt) return;
    const finalText = text || this._missionBannerText || "";
    this.prompt.hidden = !finalText;
    if (finalText) this.prompt.textContent = finalText;
  }

  setMissionStatus(missionState) {
    if (missionState && missionState.activeId) {
      this._missionBannerText = `✦ ${missionState.title}: ${missionState.objectiveText || "Siga o marcador dourado"}`;
    } else {
      this._missionBannerText = "";
    }
    this.setPrompt("");
  }

  setWanted(level) {
    if (!this.wanted) return;
    this.wanted.textContent = level > 0 ? "⚔".repeat(level) : "—";
    this.wantedBlock.classList.toggle("alert", level > 0);
  }

  hitMarker(kill = false, headshot = false) {
    const mark = this.hitmark;
    mark.classList.remove("show", "kill", "head");
    void mark.offsetWidth;
    mark.classList.add("show");
    if (kill) mark.classList.add("kill");
    if (headshot) mark.classList.add("head");
    window.clearTimeout(this._hitTimeout);
    this._hitTimeout = window.setTimeout(() => mark.classList.remove("show"), 260);
  }

  setVitals(health, maxHealth, coins, potions = 0) {
    const key = `${health}/${maxHealth}`;
    if (key !== this._lastHearts) {
      this._lastHearts = key;
      if (this.healthNum) this.healthNum.textContent = `${Math.max(0, health)}/${maxHealth}`;
      this.health.innerHTML = "♥".repeat(Math.max(0, health)) + `<span class="lost">${"♥".repeat(Math.max(0, maxHealth - health))}</span>`;
    }
    this.coins.textContent = String(coins);
    this.potions.textContent = String(potions);
  }

  setRPGStats(stats, equip = null, inv = null) {
    if (!stats) return;
    if (this.hayCount) this.hayCount.textContent = String(inv ? inv.hay : stats.hay ?? 0);
    if (inv) {
      if (this.woodCount) this.woodCount.textContent = String(inv.wood ?? 0);
      if (this.stoneCount) this.stoneCount.textContent = String(inv.stone ?? 0);
    }
    if (this.rpgStats) {
      const armPct = equip ? Math.round((equip.armorNegationChance || 0) * 100) : 0;
      const wepLv = equip ? equip.weaponLevel || 1 : 1;
      const extra = (armPct > 0 ? ` · ARM ${armPct}%` : "") + (wepLv > 1 ? ` · ARMA Nv.${wepLv}` : "") + (equip?.blessingActive ? " · ✦BÊNÇÃO" : "");
      const text = `FOR ${stats.str} · CON ${stats.con} · CAR ${stats.cha} · VEL ${stats.spd}${extra}`;
      if (this._lastRpgText !== text) {
        this._lastRpgText = text;
        this.rpgStats.textContent = text;
      }
    }
  }

  // Barra de slots: ícone, munição e destaque do slot ativo. entries[i] = { id, name, count, ammo, empty }.
  setHotbar(activeIndex, entries) {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const entry = entries[i];
      const active = i === activeIndex;
      slot.el.classList.toggle("active", active);
      slot.el.classList.toggle("none", !entry.id);
      slot.el.classList.toggle("empty", Boolean(entry.id) && entry.empty);
      if (entry.id !== slot.shown || active !== slot.active) {
        drawWeaponIcon(slot.canvas, entry.id, active);
        slot.shown = entry.id;
        slot.active = active;
      }
      if (slot.ammo.textContent !== entry.ammo) slot.ammo.textContent = entry.ammo;
      const multi = entry.count > 1 ? `⇄${entry.count}` : "";
      if (slot.multi.textContent !== multi) slot.multi.textContent = multi;
      slot.el.title = entry.name || "";
    }
  }

  // Carga do ataque pesado (0..1) ou null para esconder.
  setCharge(ratio) {
    if (!this.chargeBar) return;
    if (ratio === null) {
      if (!this.chargeBar.hidden) this.chargeBar.hidden = true;
      return;
    }
    this.chargeBar.hidden = false;
    this.chargeFill.style.width = `${Math.min(1, ratio) * 100}%`;
    this.chargeBar.classList.toggle("full", ratio >= 0.99);
  }

  setWeapon(name, ammoText) {
    this.weaponName.textContent = name;
    this.weaponAmmo.textContent = ammoText;
  }

  showDialogue(title, body, actions) {
    this.dialogueTitle.textContent = title;
    this.dialogueBody.textContent = body;
    this.dialogueActions.replaceChildren();
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.disabled = Boolean(action.disabled);
      button.addEventListener("click", () => this.onDialogAction?.(action.id));
      this.dialogueActions.append(button);
    }
    this.dialoguePanel.hidden = false;
  }

  closeDialogue() {
    if (this.dialoguePanel.hidden) return;
    this.dialoguePanel.hidden = true;
    this.onDialogClose?.();
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add("visible");
    window.clearTimeout(this._toastTimeout);
    this._toastTimeout = window.setTimeout(() => this.toast.classList.remove("visible"), 1700);
  }
}

const PORTRAIT_FRAMES = {
  guard: { x: 0, y: 11 },
  smith: { x: 1, y: 8 },
  merchant: { x: 0, y: 10 },
  farmer: { x: 0, y: 7 },
  villager: { x: 1, y: 9 },
  priest: { x: 0, y: 9 },
  beggar: { x: 1, y: 7 },
};
