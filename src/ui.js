import { KINGDOM_NAME, locationAt } from "./kingdom.js";
import { drawWeaponIcon } from "./weapondata.js?v=17";

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
    this.dialogueRole = document.getElementById("dialogue-role");
    this.dialoguePortrait = document.getElementById("dialogue-portrait");
    this.dialogueBody = document.getElementById("dialogue-body");
    this.dialogueActions = document.getElementById("dialogue-actions");
    this.dialogueTabs = document.getElementById("dialogue-tabs");
    this.dialogueCoins = document.getElementById("dialogue-coins");
    this.dialogueWood = document.getElementById("dialogue-wood");
    this.dialogueStone = document.getElementById("dialogue-stone");
    this.dialogueHay = document.getElementById("dialogue-hay");
    this.dialogueEyebrow = document.getElementById("dialogue-eyebrow");
    this._dialogueActiveTab = "all";
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
    this.missionHud = document.getElementById("mission-hud");
    this.missionHudTitle = document.getElementById("mission-hud-title");
    this.missionHudDist = document.getElementById("mission-hud-dist");
    this.missionHudDesc = document.getElementById("mission-hud-desc");
    this._activeMissionState = null;

    // Hub Modal de Construção (Tecla C - 10 Obras)
    this.buildPanel = document.getElementById("build-panel");
    this.buildGrid = document.getElementById("build-grid");
    this.buildWood = document.getElementById("build-wood");
    this.buildStone = document.getElementById("build-stone");
    this.buildHay = document.getElementById("build-hay");
    this.buildClose = document.getElementById("build-close");
    this.buildTabs = document.getElementById("build-tabs");
    this.buildPlaceItemBtn = document.getElementById("build-place-item-btn");
    this._buildActiveTab = "all";
    this.onBuildClose = null;

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
    this._activeMissionState = missionState;
    if (missionState && missionState.activeId) {
      this._missionBannerText = `✦ ${missionState.title}: ${missionState.objectiveText || "Siga o marcador dourado"}`;
      if (this.missionHud) {
        this.missionHud.hidden = false;
        if (this.missionHudTitle) this.missionHudTitle.textContent = missionState.title || "MISSÃO";
        if (this.missionHudDesc) this.missionHudDesc.textContent = missionState.objectiveText || "Siga o marcador no minimapa";
      }
    } else {
      this._missionBannerText = "";
      if (this.missionHud) this.missionHud.hidden = true;
    }
    this.setPrompt("");
  }

  updateMissionHud(playerPos) {
    if (!this.missionHud || this.missionHud.hidden || !this._activeMissionState?.activeId || !playerPos) return;

    let targetX = null;
    let targetZ = null;
    const ms = this._activeMissionState;
    if (ms.targetLocation) {
      targetX = ms.targetLocation.x ?? 0;
      targetZ = ms.targetLocation.z ?? 0;
    } else if (ms.targetNPC) {
      const root = ms.targetNPC.root || ms.targetNPC;
      targetX = root.position ? root.position.x : root.x;
      targetZ = root.position ? root.position.z : root.z;
    }

    if (targetX !== null && targetZ !== null && this.missionHudDist) {
      const px = playerPos.x ?? playerPos.position?.x ?? 0;
      const pz = playerPos.z ?? playerPos.position?.z ?? 0;
      const dist = Math.round(Math.hypot(targetX - px, targetZ - pz));
      this.missionHudDist.textContent = `${dist}m`;
    }
  }

  showBuildHub(catalog, playerInventory, onSelectCallback, onPlaceItemCallback) {
    if (!this.buildPanel) return;

    this._buildActiveTab = "all";
    if (this.buildWood) this.buildWood.textContent = String(playerInventory?.wood ?? 0);
    if (this.buildStone) this.buildStone.textContent = String(playerInventory?.stone ?? 0);
    if (this.buildHay) this.buildHay.textContent = String(playerInventory?.hay ?? 0);

    if (this.buildTabs) {
      const tabs = this.buildTabs.querySelectorAll(".build-tab");
      tabs.forEach((tab) => {
        tab.onclick = () => {
          tabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          this._buildActiveTab = tab.getAttribute("data-tab") || "all";
          this._renderBuildGrid(catalog, playerInventory, this._buildActiveTab, onSelectCallback);
        };
      });
    }

    if (this.buildPlaceItemBtn) {
      this.buildPlaceItemBtn.onclick = () => {
        this.closeBuildHub();
        onPlaceItemCallback?.();
      };
    }

    if (this.buildClose) {
      this.buildClose.onclick = () => this.closeBuildHub();
    }

    this._renderBuildGrid(catalog, playerInventory, "all", onSelectCallback);
    this.buildPanel.hidden = false;
    document.exitPointerLock?.();
  }

  closeBuildHub() {
    if (!this.buildPanel || this.buildPanel.hidden) return;
    this.buildPanel.hidden = true;
    this.onBuildClose?.();
  }

  _renderBuildGrid(catalog, playerInventory, tab = "all", onSelectCallback) {
    if (!this.buildGrid) return;
    this.buildGrid.replaceChildren();

    const inv = playerInventory || { wood: 0, stone: 0, hay: 0 };
    const entries = Object.entries(catalog);

    for (let i = 0; i < entries.length; i++) {
      const [type, item] = entries[i];
      if (tab === "vila" && item.category !== "VILA") continue;
      if (tab === "defesa" && item.category !== "DEFESA") continue;

      const card = document.createElement("div");
      card.className = "build-card";

      const hasWood = (inv.wood || 0) >= (item.wood || 0);
      const hasStone = (inv.stone || 0) >= (item.stone || 0);
      const hasHay = (inv.hay || 0) >= (item.hay || 0);
      const canAfford = hasWood && hasStone && hasHay;

      if (!canAfford) card.classList.add("unaffordable");

      const head = document.createElement("div");
      head.className = "build-card-head";

      const iconBox = document.createElement("span");
      iconBox.className = "build-card-icon";
      iconBox.textContent = item.icon || "🏠";

      const titleWrap = document.createElement("div");
      titleWrap.className = "build-card-title-wrap";

      const title = document.createElement("h3");
      title.className = "build-card-title";
      title.textContent = item.label || type;

      const desc = document.createElement("p");
      desc.className = "build-card-desc";
      desc.textContent = item.desc || "";

      titleWrap.append(title, desc);
      head.append(iconBox, titleWrap);

      const costsRow = document.createElement("div");
      costsRow.className = "build-card-costs";

      if (item.wood) {
        const tag = document.createElement("span");
        tag.className = `cost-tag ${hasWood ? "ok" : "missing"}`;
        tag.textContent = `♣ ${item.wood} Mad (${inv.wood || 0})`;
        costsRow.append(tag);
      }
      if (item.stone) {
        const tag = document.createElement("span");
        tag.className = `cost-tag ${hasStone ? "ok" : "missing"}`;
        tag.textContent = `◆ ${item.stone} Ped (${inv.stone || 0})`;
        costsRow.append(tag);
      }
      if (item.hay) {
        const tag = document.createElement("span");
        tag.className = `cost-tag ${hasHay ? "ok" : "missing"}`;
        tag.textContent = `❖ ${item.hay} Feno (${inv.hay || 0})`;
        costsRow.append(tag);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "build-card-btn";
      btn.textContent = canAfford ? "PROJETAR & ERGUER" : "RECURSOS INSUFICIENTES";
      btn.onclick = () => {
        this.closeBuildHub();
        onSelectCallback?.(type);
      };

      card.append(head, costsRow, btn);
      this.buildGrid.append(card);
    }
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

  setPlayerInventoryDisplay(coins, wood, stone, hay) {
    if (this.dialogueCoins) this.dialogueCoins.textContent = String(coins ?? 0);
    if (this.dialogueWood) this.dialogueWood.textContent = String(wood ?? 0);
    if (this.dialogueStone) this.dialogueStone.textContent = String(stone ?? 0);
    if (this.dialogueHay) this.dialogueHay.textContent = String(hay ?? 0);
  }

  showDialogue(title, body, actions, meta = {}) {
    this.dialogueTitle.textContent = title;
    this.dialogueBody.textContent = body;
    if (this.dialogueRole) this.dialogueRole.textContent = meta.role || "Cidadão";
    if (this.dialogueEyebrow) this.dialogueEyebrow.textContent = meta.eyebrow || "CALDERA · CONVERSA";

    if (this.dialoguePortrait) {
      const frame = PORTRAIT_FRAMES[meta.roleKey] || PORTRAIT_FRAMES.villager;
      this.dialoguePortrait.style.backgroundPosition = `${-frame.x * 34}px ${-frame.y * 34}px`;
    }

    if (meta.funds) {
      this.setPlayerInventoryDisplay(meta.funds.coins, meta.funds.wood, meta.funds.stone, meta.funds.hay);
    }

    // Categorização inteligente em abas
    const tabs = [{ id: "all", label: "Tudo" }];
    const hasShop = actions.some((a) => a.id.startsWith("buy:") || a.id.startsWith("upgrade:") || a.id.startsWith("craft:") || a.id.startsWith("build:") || ["potion", "bread", "hay", "bolts", "arrows", "bombs", "knives", "oil", "candle"].includes(a.id));
    const hasWork = actions.some((a) => a.id.startsWith("sell:") || a.id.startsWith("train:") || a.id === "repair");
    const hasMissions = actions.some((a) => a.id.startsWith("mission:"));
    const hasChurch = actions.some((a) => a.id.startsWith("priest:") || a.id === "blessing" || a.id.startsWith("beggar:"));

    if (hasShop) tabs.push({ id: "shop", label: "Mercadorias" });
    if (hasWork) tabs.push({ id: "work", label: "Trabalho & Treino" });
    if (hasMissions) tabs.push({ id: "missions", label: "Missões" });
    if (hasChurch) tabs.push({ id: "church", label: "Graças & Ofertas" });

    // Renderiza abas se houver mais de uma categoria
    if (this.dialogueTabs) {
      this.dialogueTabs.replaceChildren();
      if (tabs.length > 2) {
        this.dialogueTabs.hidden = false;
        if (!tabs.some((t) => t.id === this._dialogueActiveTab)) {
          this._dialogueActiveTab = "all";
        }
        for (const tab of tabs) {
          const tabBtn = document.createElement("button");
          tabBtn.type = "button";
          tabBtn.className = `dialogue-tab ${tab.id === this._dialogueActiveTab ? "active" : ""}`;
          tabBtn.textContent = tab.label;
          tabBtn.addEventListener("click", () => {
            this._dialogueActiveTab = tab.id;
            this.dialogueTabs.querySelectorAll(".dialogue-tab").forEach((b) => b.classList.remove("active"));
            tabBtn.classList.add("active");
            this._renderDialogueActionsGrid(actions);
          });
          this.dialogueTabs.append(tabBtn);
        }
      } else {
        this.dialogueTabs.hidden = true;
        this._dialogueActiveTab = "all";
      }
    }

    this._renderDialogueActionsGrid(actions);
    this.dialoguePanel.hidden = false;
  }

  _renderDialogueActionsGrid(actions) {
    if (!this.dialogueActions) return;
    this.dialogueActions.replaceChildren();

    const activeTab = this._dialogueActiveTab || "all";

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const isClose = action.id === "close" || action.id === "scripture:close";

      // Filtra por aba ativa (exceto botão de fechar)
      if (!isClose && activeTab !== "all") {
        const isShop = action.id.startsWith("buy:") || action.id.startsWith("upgrade:") || action.id.startsWith("craft:") || action.id.startsWith("build:") || ["potion", "bread", "hay", "bolts", "arrows", "bombs", "knives", "oil", "candle"].includes(action.id);
        const isWork = action.id.startsWith("sell:") || action.id.startsWith("train:") || action.id === "repair";
        const isMission = action.id.startsWith("mission:");
        const isChurch = action.id.startsWith("priest:") || action.id === "blessing" || action.id.startsWith("beggar:");

        if (activeTab === "shop" && !isShop) continue;
        if (activeTab === "work" && !isWork) continue;
        if (activeTab === "missions" && !isMission) continue;
        if (activeTab === "church" && !isChurch) continue;
      }

      const card = document.createElement("button");
      card.type = "button";
      card.className = `dialogue-card-btn ${isClose ? "action-close" : ""}`;
      card.disabled = Boolean(action.disabled);

      // Ícone contextual em canvas ou glifo
      const iconBox = document.createElement("span");
      iconBox.className = "dialogue-card-icon";

      let iconGlyph = "✦";
      let weaponId = null;

      if (action.id.startsWith("buy:")) {
        weaponId = action.id.split(":")[1];
      } else if (action.id.startsWith("upgrade:weapon")) {
        weaponId = "longsword";
      } else if (action.id.startsWith("upgrade:armor")) {
        iconGlyph = "🛡";
      } else if (action.id === "potion") {
        iconGlyph = "⚗";
      } else if (action.id === "bread") {
        iconGlyph = "🍞";
      } else if (action.id === "hay") {
        iconGlyph = "🌾";
      } else if (action.id === "candle" || action.id === "craft:candle") {
        iconGlyph = "🕯";
      } else if (action.id === "craft:torch") {
        iconGlyph = "🔥";
      } else if (action.id.startsWith("build:house")) {
        iconGlyph = "🏠";
      } else if (action.id.startsWith("build:corral")) {
        iconGlyph = "🐎";
      } else if (action.id.startsWith("sell:")) {
        iconGlyph = "📦";
      } else if (action.id.startsWith("train:")) {
        iconGlyph = "⚡";
      } else if (action.id.startsWith("mission:")) {
        iconGlyph = "📜";
      } else if (action.id.startsWith("priest:") || action.id === "blessing") {
        iconGlyph = "✟";
      } else if (action.id.startsWith("beggar:")) {
        iconGlyph = "🤲";
      } else if (isClose) {
        iconGlyph = "✕";
      }

      if (weaponId) {
        const can = document.createElement("canvas");
        can.width = 46;
        can.height = 46;
        drawWeaponIcon(can, weaponId, true);
        iconBox.append(can);
      } else {
        iconBox.textContent = iconGlyph;
      }

      // Separa o título e detalhes de custo / benefícios (ex: "Nome · 35 moedas")
      const infoBox = document.createElement("div");
      infoBox.className = "dialogue-card-info";

      const parts = action.label.split("·");
      const titleSpan = document.createElement("span");
      titleSpan.className = "dialogue-card-title";
      titleSpan.textContent = parts[0]?.trim() || action.label;
      infoBox.append(titleSpan);

      if (parts.length > 1) {
        const subSpan = document.createElement("span");
        subSpan.className = "dialogue-card-sub";
        subSpan.textContent = parts.slice(1).join(" · ").trim();
        infoBox.append(subSpan);
      }

      // Badge visual de moedas / gratuito
      const rawText = action.label.toLowerCase();
      let badgeText = null;
      let isFree = false;

      if (rawText.includes("gratuito") || rawText.includes("grátis")) {
        badgeText = "GRATUITO";
        isFree = true;
      } else {
        const costMatch = action.label.match(/(\d+)\s*moedas/i);
        if (costMatch) badgeText = `◈ ${costMatch[1]} MOEDAS`;
      }

      if (badgeText) {
        const badge = document.createElement("span");
        badge.className = `dialogue-card-badge ${isFree ? "free" : ""}`;
        badge.textContent = badgeText;
        infoBox.append(badge);
      }

      card.append(iconBox, infoBox);
      card.addEventListener("click", () => this.onDialogAction?.(action.id));
      this.dialogueActions.append(card);
    }
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
