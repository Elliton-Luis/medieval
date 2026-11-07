import * as THREE from "three";
import { KINGDOM_NAME, locationAt } from "./kingdom.js";
import { drawWeaponIcon } from "./weapondata.js";
import { PlayerStats, getEvilPercent } from "./rpg.js";
import { CultState } from "./cult.js";
import { WorldDecay } from "./decay.js";

export class GameUI {
  constructor(renderer) {
    this.renderer = renderer;
    this.fps = document.getElementById("fps");
    this.clock = document.getElementById("clock");
    this.dayIndicator = document.getElementById("day-indicator");
    this.chunks = document.getElementById("chunk-count");
    this.coordinates = document.getElementById("coordinates");
    this.health = document.getElementById("health");
    this.healthNum = document.getElementById("health-num");
    this.coins = document.getElementById("coins");
    this.potions = document.getElementById("potions");
    this.evilFill = document.getElementById("evil-bar-fill");
    this.evilVal = document.getElementById("evil-val");
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
    this.dialogueClay = document.getElementById("dialogue-clay");
    this.dialogueHay = document.getElementById("dialogue-hay");
    this.dialogueEyebrow = document.getElementById("dialogue-eyebrow");
    this._dialogueActiveTab = "all";
    this.toast = document.getElementById("toast");
    this._toastStack = [];
    this._activeToast = null;
    this._toastTimeout = null;
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
    this.buildClay = document.getElementById("build-clay");
    this.buildHay = document.getElementById("build-hay");
    this.buildClose = document.getElementById("build-close");
    this.buildTabs = document.getElementById("build-tabs");
    this.buildPlaceItemBtn = document.getElementById("build-place-item-btn");
    this.buildDestroyBtn = document.getElementById("build-destroy-btn");
    this.demolishHud = document.getElementById("demolish-hud");
    this.demolishTargetName = document.getElementById("demolish-target-name");
    this.demolishTargetHint = document.getElementById("demolish-target-hint");
    this.demolishConfirmBtn = document.getElementById("demolish-confirm-btn");
    this.demolishCancelBtn = document.getElementById("demolish-cancel-btn");
    this._buildActiveTab = "all";
    this.onBuildClose = null;

    this.candleText = document.getElementById("candle-text");
    this.candleCount = document.getElementById("candle-count");
    this.candleStat = document.getElementById("candle-stat");
    this.hayCount = document.getElementById("hay-count");
    this.woodCount = document.getElementById("wood-count");
    this.stoneCount = document.getElementById("stone-count");
    this.clayCount = document.getElementById("clay-count");
    this.toggleResourcesBtn = document.getElementById("toggle-resources-btn");
    this.resourcesDrawer = document.getElementById("vitals-resources-drawer");
    if (this.toggleResourcesBtn && this.resourcesDrawer) {
      const isExpanded = localStorage.getItem("puris_resources_expanded") === "1";
      this.resourcesDrawer.hidden = !isExpanded;
      this.toggleResourcesBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      this.toggleResourcesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.resourcesDrawer.hidden = !this.resourcesDrawer.hidden;
        const expanded = !this.resourcesDrawer.hidden;
        this.toggleResourcesBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
        try {
          localStorage.setItem("puris_resources_expanded", expanded ? "1" : "0");
        } catch {}
      });
    }
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
      if (event.code === "Escape" && !event.repeat) {
        if (this.dialoguePanel && !this.dialoguePanel.hidden) {
          event.preventDefault();
          event.stopPropagation();
          this.closeDialogue();
          return;
        }
      }
      if ((event.code === "KeyC" || event.code === "Escape") && !event.repeat) {
        if (this.buildPanel && !this.buildPanel.hidden) {
          event.preventDefault();
          event.stopPropagation();
          this.closeBuildHub();
        }
      }
    });
    document.getElementById("dialogue-close").addEventListener("click", () => this.closeDialogue());

    if (this.buildPanel) {
      this.buildPanel.addEventListener("mousedown", (e) => e.stopPropagation());
      this.buildPanel.addEventListener("mouseup", (e) => e.stopPropagation());
      this.buildPanel.addEventListener("click", (e) => {
        e.stopPropagation();
        if (e.target === this.buildPanel) {
          this.closeBuildHub();
        }
      });
    }

    if (this.demolishHud) {
      this.demolishHud.addEventListener("mousedown", (e) => e.stopPropagation());
      this.demolishHud.addEventListener("mouseup", (e) => e.stopPropagation());
      this.demolishHud.addEventListener("click", (e) => e.stopPropagation());
    }
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
    if (this.dayIndicator) {
      const curDay = WorldDecay?.daysPassed ?? 1;
      this.dayIndicator.textContent = `Dia ${curDay}`;
    }
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
      const face = window.__game?.npcLife?.portrait?.(nearestNPC);
      if (face) {
        // mesmo rosto do menu de conversa (cacheado: não redesenha a cada atualização)
        if (this._nearFace !== face) {
          this._nearFace = face;
          this.nearbyPortrait.style.backgroundImage = `url("${face}")`;
          this.nearbyPortrait.style.backgroundSize = "cover";
          this.nearbyPortrait.style.backgroundPosition = "center";
          this.nearbyPortrait.style.imageRendering = "auto";
        }
      } else {
        const frame = PORTRAIT_FRAMES[nearestNPC.roleKey] || PORTRAIT_FRAMES.villager;
        this.nearbyPortrait.style.backgroundPosition = `${-frame.x * 34}px ${-frame.y * 34}px`;
      }
    } else {
      this.nearbyCard.hidden = true;
    }
    const evilPercent = getEvilPercent();
    if (this.evilFill) this.evilFill.style.width = `${evilPercent}%`;
    if (this.evilVal) this.evilVal.textContent = `${evilPercent}%`;
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

  // Atualiza a barrinha animada de cooldown / recarga / carregamento na mira
  setCooldownBar(visible, percent, isCharging = false) {
    if (!this.reticleCooldownWrap) {
      this.reticleCooldownWrap = document.getElementById("reticle-cooldown");
      this.reticleCooldownFill = document.getElementById("reticle-cooldown-fill");
    }
    if (!this.reticleCooldownWrap || !this.reticleCooldownFill) return;

    if (!visible || percent <= 0.005) {
      this.reticleCooldownWrap.classList.remove("active");
    } else {
      this.reticleCooldownWrap.classList.add("active");
      const pct = Math.max(0, Math.min(100, percent * 100));
      this.reticleCooldownFill.style.width = `${pct}%`;
      this.reticleCooldownFill.classList.toggle("charging", Boolean(isCharging));
    }
  }

  // Atualiza marcador visual de alvo sobre o ser mirado (HUD 3D Lock-On)
  updateLockMarker(assistPos, visible, camera) {
    if (!this.lockMarker) {
      this.lockMarker = document.getElementById("aim-lock-marker");
      if (!this.lockMarker) {
        this.lockMarker = document.createElement("div");
        this.lockMarker.id = "aim-lock-marker";
        this.lockMarker.innerHTML = `
          <div class="lock-bracket tl"></div>
          <div class="lock-bracket tr"></div>
          <div class="lock-bracket bl"></div>
          <div class="lock-bracket br"></div>
          <div class="lock-diamond"></div>
        `;
        document.body.appendChild(this.lockMarker);
      }
    }
    if (!visible || !assistPos || !camera) {
      this.lockMarker.style.display = "none";
      return;
    }

    if (!this._projVec) this._projVec = new THREE.Vector3();
    this._projVec.copy(assistPos).project(camera);
    if (this._projVec.z > 1.0) {
      this.lockMarker.style.display = "none";
      return;
    }

    const halfW = window.innerWidth * 0.5;
    const halfH = window.innerHeight * 0.5;
    const screenX = Math.round(this._projVec.x * halfW + halfW);
    const screenY = Math.round(-this._projVec.y * halfH + halfH);

    this.lockMarker.style.display = "block";
    this.lockMarker.style.left = `${screenX}px`;
    this.lockMarker.style.top = `${screenY}px`;
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

  showBuildHub(catalog, playerInventory, onSelectCallback, onPlaceItemCallback, onDestroyCallback) {
    if (!this.buildPanel) return;

    this._buildActiveTab = "all";
    if (this.buildWood) this.buildWood.textContent = String(playerInventory?.wood ?? 0);
    if (this.buildStone) this.buildStone.textContent = String(playerInventory?.stone ?? 0);
    if (this.buildClay) this.buildClay.textContent = String(playerInventory?.clay ?? 0);
    if (this.buildHay) this.buildHay.textContent = String(playerInventory?.hay ?? 0);

    if (this.buildTabs) {
      const tabs = this.buildTabs.querySelectorAll(".build-tab");
      tabs.forEach((tab) => {
        tab.onclick = () => {
          const targetTab = tab.getAttribute("data-tab") || "all";
          if (targetTab === "destroy") {
            this.closeBuildHub();
            onDestroyCallback?.();
            return;
          }
          tabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          this._buildActiveTab = targetTab;
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

    if (this.buildDestroyBtn) {
      this.buildDestroyBtn.onclick = () => {
        this.closeBuildHub();
        onDestroyCallback?.();
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

  setDemolishHud(visible, targetName = "", isSelected = false, onConfirm = null, onCancel = null) {
    if (!this.demolishHud) return;
    if (!visible) {
      this.demolishHud.hidden = true;
      return;
    }
    this.demolishHud.hidden = false;
    if (this.demolishTargetName) {
      this.demolishTargetName.textContent = targetName || "Nenhuma construção sob a mira";
    }
    if (this.demolishTargetHint) {
      this.demolishTargetHint.textContent = isSelected
        ? "Clique no botão DELETAR ou aperte [E / Espaço / Delete] para destruir."
        : "Aponte para sua construção e clique com botão esquerdo ou aperte [E] para SELECIONAR.";
    }
    if (this.demolishConfirmBtn) {
      this.demolishConfirmBtn.disabled = !isSelected;
      if (onConfirm) this.demolishConfirmBtn.onclick = onConfirm;
    }
    if (this.demolishCancelBtn) {
      if (onCancel) this.demolishCancelBtn.onclick = onCancel;
    }
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
      const hasClay = (inv.clay || 0) >= (item.clay || 0);
      const hasHay = (inv.hay || 0) >= (item.hay || 0);
      const canAfford = hasWood && hasStone && hasClay && hasHay;

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
      if (item.clay) {
        const tag = document.createElement("span");
        tag.className = `cost-tag ${hasClay ? "ok" : "missing"}`;
        tag.textContent = `☲ ${item.clay} Barro (${inv.clay || 0})`;
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
      const safeH = Math.max(0, Math.floor(health));
      const safeMax = Math.max(1, Math.floor(maxHealth));
      if (this.healthNum) this.healthNum.textContent = `${safeH}/${safeMax}`;
      if (safeMax <= 20) {
        this.health.innerHTML = "♥".repeat(safeH) + `<span class="lost">${"♥".repeat(Math.max(0, safeMax - safeH))}</span>`;
      } else {
        const heartsDisplay = Math.min(20, safeH);
        this.health.innerHTML = "♥".repeat(heartsDisplay) + ` <span style="color:#ffcc44;font-size:12px;font-weight:700;">+${safeH - heartsDisplay}</span>`;
      }
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
      if (this.clayCount) this.clayCount.textContent = String(inv.clay ?? 0);
    }
    if (this.rpgStats) {
      const armPct = equip ? Math.round((equip.armorNegationChance || 0) * 100) : 0;
      const wepLv = equip ? equip.weaponLevel || 1 : 1;
      const tm = stats.isTemplar && stats.getTemplarMods ? stats.getTemplarMods() : null;
      const templarTag = stats.isTemplar
        ? stats.hasBrokenVow
          ? " · ⚠VOTO QUEBRADO"
          : tm && tm.weak > 0
            ? ` · ⚔TEMPLÁRIO enfraquecendo (dano ${Math.round(tm.dmg * 100)}%)`
            : " · ⚔TEMPLÁRIO +25% dano · +20% vida · +vel"
        : "";
      const extra = templarTag + (armPct > 0 ? ` · ARM ${armPct}%` : "") + (wepLv > 1 ? ` · ARMA Nv.${wepLv}` : "") + (equip?.blessingActive ? " · ✦BÊNÇÃO" : "");
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

  setPlayerInventoryDisplay(coins, wood, stone, hay, clay) {
    if (this.dialogueCoins) this.dialogueCoins.textContent = String(coins ?? 0);
    if (this.dialogueWood) this.dialogueWood.textContent = String(wood ?? 0);
    if (this.dialogueStone) this.dialogueStone.textContent = String(stone ?? 0);
    if (this.dialogueClay) this.dialogueClay.textContent = String(clay ?? 0);
    if (this.dialogueHay) this.dialogueHay.textContent = String(hay ?? 0);
  }

  showDialogue(title, body, actions, meta = {}) {
    this.dialogueTitle.textContent = title;
    this.dialogueBody.textContent = body;
    if (this.dialogueRole) this.dialogueRole.textContent = meta.role || "Cidadão";
    if (this.dialogueEyebrow) this.dialogueEyebrow.textContent = meta.eyebrow || "CALDERA · CONVERSA";

    const chat = meta.chat || null;
    this._applyChatMode(chat, actions, title, body);

    if (this.dialoguePortrait && chat && chat.portrait) {
      // rosto humano procedural (canvas -> dataURL), reconhecível por pessoa
      this.dialoguePortrait.classList.add("face");
      this.dialoguePortrait.style.backgroundImage = `url("${chat.portrait}")`;
      this.dialoguePortrait.style.backgroundSize = "cover";
      this.dialoguePortrait.style.backgroundPosition = "center";
      this.dialoguePortrait.style.backgroundColor = "#0a0f0c";
      this.dialoguePortrait.style.borderColor = "#d2a969";
    } else if (this.dialoguePortrait) {
      this.dialoguePortrait.classList.remove("face");
      if (meta.customPortrait) {
        this.dialoguePortrait.style.backgroundImage = `url("${meta.customPortrait}")`;
        this.dialoguePortrait.style.backgroundPosition = "center";
        this.dialoguePortrait.style.backgroundSize = "contain";
        this.dialoguePortrait.style.backgroundColor = "#0a0610";
        this.dialoguePortrait.style.borderColor = "#aa33ff";
      } else {
        this.dialoguePortrait.style.backgroundImage = 'url("./assets/sprites/kenney-roguelike/roguelikeChar_transparent.png")';
        this.dialoguePortrait.style.backgroundSize = "1836px 406px";
        this.dialoguePortrait.style.backgroundColor = "#17211b";
        this.dialoguePortrait.style.borderColor = "#d2a96988";
        const frame = PORTRAIT_FRAMES[meta.roleKey] || PORTRAIT_FRAMES.villager;
        this.dialoguePortrait.style.backgroundPosition = `${-frame.x * 34}px ${-frame.y * 34}px`;
      }
    }

    if (meta.funds) {
      this.setPlayerInventoryDisplay(meta.funds.coins, meta.funds.wood, meta.funds.stone, meta.funds.hay, meta.funds.clay);
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

  // ----- Menu pessoal de NPC: abas Conversa (primária) / Ações -----
  _ensureChatDom() {
    if (this._chatDom) return this._chatDom;
    const panel = this.dialoguePanel;
    const actionsSection = panel.querySelector(".dialogue-actions-section");
    const speakerInfo = panel.querySelector(".dialogue-speaker-info");
    const tabs = document.createElement("nav");
    tabs.className = "dialogue-maintabs";
    tabs.hidden = true;
    const mk = (id, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dialogue-maintab";
      b.textContent = label;
      b.dataset.tab = id;
      b.addEventListener("click", () => this._setMainTab(id));
      tabs.append(b);
      return b;
    };
    const chatTab = mk("chat", "💬 Conversa");
    const actTab = mk("actions", "⚙ Ações");
    const chat = document.createElement("section");
    chat.className = "dialogue-chat";
    chat.hidden = true;
    const log = document.createElement("div");
    log.className = "chat-log";
    log.addEventListener("click", () => this._finishTyping());
    const qs = document.createElement("div");
    qs.className = "chat-questions";
    chat.append(log, qs);
    const persona = document.createElement("div");
    persona.className = "dialogue-persona";
    persona.hidden = true;
    const age = document.createElement("span");
    age.className = "persona-chip";
    const mood = document.createElement("span");
    mood.className = "persona-chip mood";
    const trust = document.createElement("span");
    trust.className = "persona-trust";
    trust.innerHTML = '<span class="tl"></span><i><b></b></i>';
    persona.append(age, mood, trust);
    speakerInfo?.append(persona);
    panel.insertBefore(tabs, actionsSection);
    panel.insertBefore(chat, actionsSection);
    this._chatDom = { tabs, chatTab, actTab, chat, log, qs, persona, age, mood, trust, actionsSection };
    return this._chatDom;
  }

  _setMainTab(tab) {
    const d = this._ensureChatDom();
    this._npcTab = tab;
    this.dialoguePanel.classList.toggle("tab-actions", tab === "actions");
    d.chat.hidden = tab !== "chat";
    d.actionsSection.style.display = tab === "actions" ? "" : "none";
    d.chatTab.classList.toggle("active", tab === "chat");
    d.actTab.classList.toggle("active", tab === "actions");
  }

  _updatePersona(chat) {
    const d = this._chatDom;
    if (!d || !chat) return;
    d.persona.hidden = false;
    if (chat.age) d.age.textContent = `${chat.age} anos`;
    if (chat.mood) d.mood.textContent = `Humor: ${chat.mood}`;
    d.trust.querySelector(".tl").textContent = `Confiança: ${chat.trustLabel || ""}`;
    d.trust.querySelector("b").style.width = `${Math.max(2, Math.min(100, chat.trust ?? 0))}%`;
  }

  _applyChatMode(chat, actions, title, body) {
    const panel = this.dialoguePanel;
    if (!chat) {
      panel.classList.remove("chat-mode", "tab-actions");
      if (this._chatDom) {
        this._chatDom.tabs.hidden = true;
        this._chatDom.chat.hidden = true;
        this._chatDom.persona.hidden = true;
        this._chatDom.actionsSection.style.display = "";
      }
      this._chatKey = null;
      return;
    }
    const d = this._ensureChatDom();
    panel.classList.add("chat-mode");
    d.tabs.hidden = false;
    this._updatePersona(chat);
    const fresh = this._chatKey !== chat.key;
    if (fresh) {
      this._chatKey = chat.key;
      d.log.replaceChildren();
      this._finishTyping();
    }
    // perguntas prontas (sempre atualizadas: podem surgir novas, como "Alguém está doente?")
    if (chat.questions) {
      d.qs.replaceChildren();
      for (const q of chat.questions) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `chat-q ${q.id === "bye" ? "bye" : ""}`;
        b.textContent = q.label;
        b.addEventListener("click", () => {
          this._finishTyping(); // clicar durante a digitação conclui a fala e já faz a pergunta
          this.addChatLine("you", q.label);
          this.onChatAsk?.(q.id, q.label);
        });
        d.qs.append(b);
      }
    }
    if (fresh) {
      if (chat.greeting) this.addChatLine("npc", chat.greeting.t, chat.greeting.n);
      this._setMainTab("chat"); // a Conversa é a aba principal
    } else {
      if (chat.say) this.addChatLine("npc", chat.say, "");
      this._setMainTab(this._npcTab || "chat");
    }
  }

  addChatLine(who, text, gesture = "") {
    const d = this._ensureChatDom();
    this._finishTyping();
    const line = document.createElement("div");
    line.className = `chat-line ${who}`;
    if (gesture) {
      const g = document.createElement("span");
      g.className = "gesture";
      g.textContent = gesture;
      line.append(g);
    }
    const span = document.createElement("span");
    line.append(span);
    d.log.append(line);
    if (who === "you") {
      span.textContent = text;
    } else {
      // efeito de digitação rápido (clique para pular)
      let i = 0;
      this._chatBusy = true;
      this._typing = { span, text, finish: () => { span.textContent = text; } };
      const step = () => {
        i = Math.min(text.length, i + 2);
        span.textContent = text.slice(0, i);
        d.log.scrollTop = d.log.scrollHeight;
        if (i >= text.length) this._finishTyping();
      };
      this._typingTimer = window.setInterval(step, 16);
    }
    d.log.scrollTop = d.log.scrollHeight;
  }

  _finishTyping() {
    if (this._typingTimer) { window.clearInterval(this._typingTimer); this._typingTimer = null; }
    if (this._typing) { this._typing.finish(); this._typing = null; }
    this._chatBusy = false;
    if (this._chatDom) this._chatDom.log.scrollTop = this._chatDom.log.scrollHeight;
  }

  /** Resposta do NPC a uma pergunta: atualiza humor/confiança/retrato e mostra a fala. */
  chatReply(res, closeAfter = false) {
    if (!this._chatDom) return;
    this._updatePersona(res);
    if (res.portrait && this.dialoguePortrait) this.dialoguePortrait.style.backgroundImage = `url("${res.portrait}")`;
    this.addChatLine("npc", res.t, res.n || "");
    if (res.questions) {
      // reconstrói perguntas sem trocar a conversa
      const d = this._chatDom;
      d.qs.replaceChildren();
      for (const q of res.questions) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `chat-q ${q.id === "bye" ? "bye" : ""}`;
        b.textContent = q.label;
        b.addEventListener("click", () => {
          this._finishTyping(); // clicar durante a digitação conclui a fala e já faz a pergunta
          this.addChatLine("you", q.label);
          this.onChatAsk?.(q.id, q.label);
        });
        d.qs.append(b);
      }
    }
    if (closeAfter) window.setTimeout(() => this.closeDialogue(), 1700);
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
    this._finishTyping();
    this._chatKey = null;
    this.dialoguePanel.hidden = true;
    this.onDialogClose?.();
  }

  showToast(message, customDuration) {
    if (!message) return;
    const now = performance.now();
    // Duração padrão: 10 segundos (10000ms), conforme regra de retenção do jogador
    const duration = typeof customDuration === "number" && customDuration > 0 ? customDuration : 10000;

    if (!this._toastStack) {
      this._toastStack = [];
      this._activeToast = null;
    }

    // Se já havia um toast na tela, calcula quanto tempo sobrou, pausa e empilha
    if (this._activeToast) {
      window.clearTimeout(this._toastTimeout);
      const elapsed = now - this._activeToast.startedAt;
      const remaining = Math.max(0, this._activeToast.remainingMs - elapsed);
      if (remaining > 200) {
        this._activeToast.remainingMs = remaining;
        this._toastStack.push(this._activeToast);
      }
    }

    // O novo popup entra no topo com seus 10s
    this._activeToast = {
      message,
      remainingMs: duration,
      startedAt: now,
    };

    this._displayActiveToast();
  }

  _displayActiveToast() {
    if (!this._activeToast || !this.toast) {
      if (this.toast) this.toast.classList.remove("visible");
      return;
    }

    this.toast.textContent = this._activeToast.message;
    this.toast.classList.add("visible");
    this._activeToast.startedAt = performance.now();

    window.clearTimeout(this._toastTimeout);
    this._toastTimeout = window.setTimeout(() => {
      this._onToastExpired();
    }, this._activeToast.remainingMs);
  }

  _onToastExpired() {
    // Quando o popup superior termina, retoma o anterior com o resto de tempo que tinha
    if (this._toastStack && this._toastStack.length > 0) {
      this._activeToast = this._toastStack.pop();
      this._displayActiveToast();
    } else {
      this._activeToast = null;
      if (this.toast) this.toast.classList.remove("visible");
    }
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
