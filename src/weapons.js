import { createArrowGeometry, getArrowMaterial } from "./arrowKit.js";
import { scytheSweep, updateHay } from "./hay.js";
import * as THREE from "three";
import { makeSkinnedMaterial } from "./skins.js";
import { segmentHit } from "./hitboxes.js";
import { WEAPON_LIST, WEAPONS_BY_ID, SLOTS, STARTER_WEAPONS, AMMO_LABELS, AMMO_SHOP, buildWeaponModel, updateTorchFx } from "./weapondata.js";
import {
  PlayerEquipment,
  PlayerInventory,
  BUILD_COSTS,
  BUILDING_BOUNDS,
  destroyBuilding,
  createFirePool,
  igniteTarget,
  updateFirePool,
  updateMusketReload,
  gatherResource,
  createPlayerBuildingsPool,
  buildStructure,
  updateBuildPreview,
  syncPlayerStatsToPlayer,
} from "./rpg.js";

const MAX_THROW = 26;
const DOT_COUNT = 26;
const CHARGE_TIME = 0.9;

function addMesh(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

export class WeaponSystem {
  constructor(scene, player, input, combat, effects, ui, world, npcs, aim, cameraRig, explosions, audio) {
    this.aim = aim;
    this.cameraRig = cameraRig;
    this.explosions = explosions;
    this.audio = audio;
    this._yaw = 0;
    this._launch = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
    this._dummy = new THREE.Object3D();
    this.scene = scene;
    this.player = player;
    this.input = input;
    this.combat = combat;
    this.effects = effects;
    this.ui = ui;
    this.world = world;
    this.npcs = npcs;
    this.fire = null;
    this.owned = new Set(STARTER_WEAPONS);
    // A tocha é compartilhada e fica na mão sempre
    this.owned.add("torch");
    PlayerInventory.torches = Math.max(1, PlayerInventory.torches || 1);
    this.currentId = "fists";
    this.slot = 0;
    this.lastInSlot = { 0: "fists", 1: "axe", 2: "pickaxe" };
    // Hotbar de 9 slots em mãos
    this.hotbarSlots = ["fists", "axe", "pickaxe", null, null, null, null, null, null];
    this.cooldown = 0;
    this._maxCooldown = 0;
    this.buffered = 0;
    this.charging = false;
    this.chargeTime = 0;
    this.buildMode = false;
    this.buildAngle = 0;
    this._buildTurnAccum = 0;
    this._keyRotCooldown = 0;
    this.selectedBuildType = "HOUSE";
    this.selectedDemolishTarget = null;
    this.hoveredDemolishTarget = null;
    this.ammo = { bolts: 8, arrows: 12, bombs: 3, knives: 0, oil: 0 };
    this.projectiles = [];
    this._cursor = 0;
    this.firePool = createFirePool(scene);
    this.playerBuildingsPool = createPlayerBuildingsPool(scene, world);
    this._demolishHighlightGroup = this._createDemolishHighlight(scene);
    this._createWeaponModels();
    this._createProjectilePool(24);
    this._createTrajectoryDots(scene);
    this._createThrownSpear(scene);
    this._createMusketTracer(scene);
    this._nearbyNPCs = [];
    this._hotbarEntriesCache = [];
    for (let i = 0; i < 9; i++) {
      this._hotbarEntriesCache.push({ id: null, name: "", count: 0, ammo: "", empty: true });
    }
    this.equip("fists", false);
  }

  assignHotbarSlot(slotIndex, weaponId) {
    if (slotIndex < 0 || slotIndex >= 9) return;
    for (let i = 0; i < 9; i++) {
      if (this.hotbarSlots[i] === weaponId) this.hotbarSlots[i] = null;
    }
    this.hotbarSlots[slotIndex] = weaponId;
    this._refreshWeaponHud();
  }

  unassignHotbarSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= 9) return;
    this.hotbarSlots[slotIndex] = null;
    this._refreshWeaponHud();
  }

  get currentWeapon() {
    return WEAPONS_BY_ID[this.currentId];
  }

  _createWeaponModels() {
    const wood = makeSkinnedMaterial("leather", "#593b27", 0, 0.9);
    const darkWood = makeSkinnedMaterial("leather", "#342a22", 0, 0.92);
    const iron = makeSkinnedMaterial("metal", "#93968b", 0.45, 0.56);
    const brass = makeSkinnedMaterial("metal", "#b4965d", 0.56, 0.45);
    const cloth = makeSkinnedMaterial("fabric", "#8e4c3c", 0, 0.9);
    const socket = this.player.handSocket;
    this.models = Object.create(null);
    // a espada curta antiga do jogador (player.sword) é substituída pelo modelo novo de weapondata.js
    if (this.player.sword) this.player.sword.visible = false;

    // Besta: modelo em weapondata.js; a escala do corpo da balestra pesada fica a cargo do construtor
    const crossbow = (id, scale) => {
      const g = buildWeaponModel(id);
      g.position.set(0, 0.27 * scale, 0);
      g.scale.setScalar(scale);
      socket.add(g);
      return g;
    };
    this.models.lightcrossbow = crossbow("lightcrossbow", 1);
    this.models.heavycrossbow = crossbow("heavycrossbow", 1.22);

    // Arcos: a curva é construída em +X; o grupo gira -90° para a frente do arco apontar para +Z
    const bow = (id, scale) => {
      const g = buildWeaponModel(id);
      g.rotation.y = -Math.PI / 2;
      g.scale.setScalar(scale);
      socket.add(g);
      return g;
    };
    this.models.shortbow = bow("shortbow", 1);
    this.models.longbow = bow("longbow", 1.3);

    const bomb = buildWeaponModel("firebomb");
    bomb.position.set(0, -0.1, 0);
    socket.add(bomb);
    this.models.firebomb = bomb;

    // armas de corte, contusão e haste: construídas em weapondata.js
    for (const def of WEAPON_LIST) {
      if (this.models[def.id] || def.type === "fists") continue;
      const model = buildWeaponModel(def.id);
      if (!model) continue;
      if (def.id === "oilpot") model.position.set(0, -0.1, 0);
      // Ferramentas com cabeça no plano XY (gume em +X): giram -90° em Y (como os arcos) para o gume apontar
      // SEMPRE para a frente do personagem, em repouso, andando e nos arcos de golpe.
      if (def.id === "axe" || def.id === "pickaxe" || def.id === "scythe") model.rotation.y = -Math.PI / 2;
      if (def.weaponType) {
        model.userData.type = def.weaponType;
        model.userData.isThrown = false;
        model.userData.isReloading = false;
        model.userData.reloadEndTime = 0;
        model.userData.nextShot = 0;
      }
      socket.add(model);
      this.models[def.id] = model;
    }
    for (const model of Object.values(this.models)) model.visible = false;

    // Luz dinâmica da tocha empunhada pelo jogador (THREE.PointLight dobrada: 64m de alcance e intensidade dobrada)
    this.torchLight = new THREE.PointLight("#ffb45a", 0, 64.0, 1.3);
    this.torchLight.castShadow = false;
    this.torchLight.position.set(0, 0.78, 0);
    if (this.models.torch) {
      this.models.torch.add(this.torchLight);
    }

    // Luz compartilhada única e estática para velas colocadas no chão (Zero Shader Recompilation)
    this.sharedPlacedCandleLight = new THREE.PointLight(0xffb866, 0, 16.0, 1.8);
    this.sharedPlacedCandleLight.castShadow = false;
    this.sharedPlacedCandleLight.visible = true;
    this.sharedPlacedCandleLight.position.set(0, -9999, 0);
    this.scene.add(this.sharedPlacedCandleLight);
  }

  _createThrownSpear(scene) {
    const spearMesh = buildWeaponModel("spear") || new THREE.Group();
    spearMesh.rotation.x = Math.PI / 2;
    const wrapper = new THREE.Group();
    wrapper.add(spearMesh);
    wrapper.visible = false;
    wrapper.userData = {
      isThrown: false,
      isLootable: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      gravity: 14,
    };
    scene.add(wrapper);
    this.thrownSpear = wrapper;
  }

  _createMusketTracer(scene) {
    const positions = new Float32Array(6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xf2ebd9,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    this.musketTracer = { line, positions, mat, timer: 0 };
  }

  _createProjectilePool(capacity) {
    const arrowWood = makeSkinnedMaterial("leather", "#795431", 0, 0.9);
    const steel = makeSkinnedMaterial("metal", "#abb0a5", 0.55, 0.48);
    const brass = makeSkinnedMaterial("metal", "#bb9657", 0.6, 0.45);
    const bombMat = makeSkinnedMaterial("leather", "#35312b", 0, 0.95);
    const cloth = makeSkinnedMaterial("fabric", "#b88745", 0, 0.88);
    const clay = makeSkinnedMaterial("leather", "#a65c3c", 0, 0.9);
    const shaftGeometry = new THREE.CylinderGeometry(0.026, 0.026, 0.8, 4);
    const boltShaftGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.62, 4);
    const arrowTipGeometry = new THREE.ConeGeometry(0.08, 0.22, 4);
    const featherGeometry = new THREE.BoxGeometry(0.18, 0.08, 0.06);
    const bombGeometry = new THREE.IcosahedronGeometry(0.19, 0);
    const fuseGeometry = new THREE.CylinderGeometry(0.025, 0.03, 0.16, 4);
    this.projectiles.length = 0;

    for (let i = 0; i < capacity; i++) {
      const root = new THREE.Group();
      const bolt = new THREE.Group();
      const boltShaft = addMesh(bolt, boltShaftGeometry, arrowWood, 0, 0, 0);
      boltShaft.rotation.x = Math.PI / 2;
      const boltTip = addMesh(bolt, arrowTipGeometry, steel, 0, 0, 0.38);
      boltTip.rotation.x = Math.PI / 2;
      // flecha de verdade: haste + ponta de aço + 3 penas numa malha só (arrowKit), +Z para frente
      const arrow = new THREE.Group();
      const arrowMesh = new THREE.Mesh(createArrowGeometry(), getArrowMaterial());
      arrowMesh.scale.setScalar(1.2);
      arrow.add(arrowMesh);
      const bomb = new THREE.Group();
      addMesh(bomb, bombGeometry, bombMat, 0, 0, 0);
      addMesh(bomb, fuseGeometry, cloth, 0, 0.22, 0);
      const knife = new THREE.Group();
      addMesh(knife, new THREE.BoxGeometry(0.035, 0.014, 0.3), steel, 0, 0, 0.12);
      addMesh(knife, new THREE.BoxGeometry(0.04, 0.03, 0.14), arrowWood, 0, 0, -0.12);
      const oil = new THREE.Group();
      const pot = addMesh(oil, new THREE.SphereGeometry(0.16, 7, 5), clay, 0, 0, 0);
      pot.scale.y = 1.1;
      addMesh(oil, new THREE.CylinderGeometry(0.04, 0.04, 0.08, 5), cloth, 0, 0.2, 0);
      root.add(bolt, arrow, bomb, knife, oil);
      for (const part of [bolt, arrow, bomb, knife, oil]) part.visible = false;
      root.visible = false;
      this.scene.add(root);
      this.projectiles.push({ root, variants: { bolt, arrow, bomb, knife, oil }, active: false, type: "", x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, damage: 0, life: 0, fuse: 0, fuseFx: 0, radius: 0, color: "#ffffff" });
    }
  }

  _createTrajectoryDots(scene) {
    this.dots = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.075, 6, 4),
      new THREE.MeshBasicMaterial({ color: "#f6dca4", transparent: true, opacity: 0.85, depthWrite: false }),
      DOT_COUNT,
    );
    this.dots.frustumCulled = false;
    this.dots.visible = false;
    this.dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.dots);
  }

  update(dt, cameraYaw) {
    this._yaw = cameraYaw;
    const now = performance.now();
    updateHay(dt); // fardos do mundo voltam no dia seguinte

    if (this.input.consumeBuildModePressed?.()) {
      if (this.buildHubOpen || (this.ui.buildPanel && !this.ui.buildPanel.hidden)) {
        this.closeBuildHub();
      } else if (this.buildMode) {
        this.exitBuildMode();
      } else {
        this.openBuildHub();
      }
    }

    if (this.buildHubOpen || (this.ui.buildPanel && !this.ui.buildPanel.hidden)) {
      updateBuildPreview(this.player.root.position, 0, false);
      return;
    }

    const selection = this.input.consumeWeaponSelection();
    if (selection >= 0) {
      if (this.buildMode) {
        const types = Object.keys(BUILD_COSTS);
        if (selection >= 1 && selection <= types.length) {
          this.selectedBuildType = types[selection - 1];
          this._announceBuildMode();
        }
      } else {
        this.selectSlot(selection);
      }
    }

    const wheel = this.input.consumeWheelStep();
    if (this.buildMode) {
      if (this.selectedBuildType === "DESTROY") {
        // No modo demolição a câmera é livre para permitir olhar em 360° e mirar nas construções
        if (this.cameraRig) this.cameraRig.frozen = false;
      } else {
        // No modo de construção, a câmera permanece travada e o jogador gira a construção em passos de 15°
        if (this.cameraRig) this.cameraRig.frozen = true;
        const STEP_15 = Math.PI / 12;

        // Scroll da roda do mouse roda a construção em 15°
        if (wheel !== 0) {
          this.buildAngle += (wheel > 0 ? 1 : -1) * STEP_15;
        }

        // Teclas Q e E (ou setas Esquerda/Direita) giram a construção em 15°
        if (this._keyRotCooldown > 0) this._keyRotCooldown -= dt;
        if (this._keyRotCooldown <= 0) {
          if (this.input.isKeyPressed?.("KeyQ") || this.input.isKeyPressed?.("ArrowLeft")) {
            this.buildAngle -= STEP_15;
            this._keyRotCooldown = 0.16;
          } else if (this.input.isKeyPressed?.("KeyE") || this.input.isKeyPressed?.("ArrowRight")) {
            this.buildAngle += STEP_15;
            this._keyRotCooldown = 0.16;
          }
        }

        // Movimento do mouse enquanto a câmera está travada
        const lookX = this.cameraRig?._smoothLookX || 0;
        if (Math.abs(lookX) > 0.12) {
          this._buildTurnAccum += lookX;
          if (Math.abs(this._buildTurnAccum) > 0.75) {
            this.buildAngle -= Math.sign(this._buildTurnAccum) * STEP_15;
            this._buildTurnAccum = 0;
          }
        }
      }
    } else {
      if (wheel !== 0) {
        this.cycle(wheel);
      }
    }

    this.cooldown = Math.max(0, this.cooldown - dt);

    // Animação da barra de cooldown / carregamento na mira
    let cdVisible = false;
    let cdPercent = 0;
    let isCharging = false;
    if (this.charging && this.chargeTime > 0) {
      cdVisible = true;
      isCharging = true;
      cdPercent = Math.min(1.0, this.chargeTime / 0.85);
    } else if (this.cooldown > 0 && this._maxCooldown > 0.04) {
      cdVisible = true;
      isCharging = false;
      cdPercent = Math.max(0, Math.min(1.0, this.cooldown / this._maxCooldown));
    }
    this.ui?.setCooldownBar?.(cdVisible, cdPercent, isCharging);
    const def = this.currentWeapon;
    const dead = this.player.knockedOut || this.player.dead;
    this.player.isHoldingSecondary = Boolean(this.aim && this.aim.active);

    updateFirePool(this.firePool, now, dt, this.combat);
    if (this.models.musket) {
      updateMusketReload(this.models.musket, now);
    }
    this._updateThrownSpear(dt);
    this._updateMusketTracer(dt);

    // Atualiza a cintilação e intensidade da luz da tocha equipada
    if (this.torchLight) {
      const isTorchActive = this.currentId === "torch" && !dead;
      if (isTorchActive) {
        // Cintilação viva com iluminação dobrada (~14.5 a 16.5 de intensidade)
        this.torchLight.intensity = 15.0 + Math.sin(now * 0.012) * 0.9 + Math.cos(now * 0.027) * 0.6;
        // fogo da tocha: cones, línguas, halo e brasas animados (inequivocamente fogo, não lâmpada/cajado)
        updateTorchFx(this.models.torch, now * 0.001);
      } else {
        this.torchLight.intensity = 0;
      }
    }

    if (this.buildMode) {
      this._cancelCharge();
      if (this.selectedBuildType === "DESTROY") {
        updateBuildPreview(this.player.root.position, 0, false);
        this._updateDemolishMode(dt, cameraYaw);
        this._updateTrajectory(def);
        this._updateProjectiles(dt);
        return;
      }
      if (this.ui?.demolishHud && !this.ui.demolishHud.hidden) {
        this.ui.setDemolishHud(false);
      }
      if (this._demolishHighlightGroup) {
        this._demolishHighlightGroup.visible = false;
      }
      updateBuildPreview(
        this.player.root.position,
        this.player.model?.rotation?.y ?? 0,
        true,
        this.selectedBuildType || "HOUSE",
        this.buildAngle,
      );
      if ((this.input.consumeAttackPressed() || this.input.consumeInteractPressed?.() || this.input.isKeyPressed?.("Space")) && !dead) {
        if (this.selectedBuildType === "PLACE_ITEM") {
          this._tryPlaceHeldItem();
        } else {
          this._tryBuildInMode();
        }
      }
      this._updateTrajectory(def);
      this._updateProjectiles(dt);
      return;
    } else {
      updateBuildPreview(this.player.root.position, 0, false);
      if (this.ui?.demolishHud && !this.ui.demolishHud.hidden) {
        this.ui.setDemolishHud(false);
      }
      if (this._demolishHighlightGroup) {
        this._demolishHighlightGroup.visible = false;
      }
    }

    if (def.id === "spear" && this.models.spear?.userData?.isThrown) {
      this.models.spear.visible = false;
      if (this.input.consumeAttackPressed() && !dead) {
        this.ui.showToast("Lança arremessada! Aproxime-se dela (~2m) e aperte E para recuperá-la.");
      }
    } else if (def.id === "spear" && this.aim.active) {
      this._cancelCharge();
      if (this.input.consumeAttackPressed() && !dead) {
        this.player.cancelBlock();
        this._throwSpear(cameraYaw);
      }
    } else if (def.type === "musket") {
      this._cancelCharge();
      if (this.input.consumeAttackPressed() && !dead) {
        this.player.cancelBlock();
        this._fireMusket(cameraYaw, now);
      }
    } else if (def.type === "fists" || def.type === "melee") {
      this._updateMelee(dt, def, cameraYaw, dead);
    } else {
      this._cancelCharge();
      if (this.input.consumeAttackPressed() && !dead) {
        this.player.cancelBlock();
        this._attack(cameraYaw);
      }
    }

    this._updateTrajectory(def);
    this._updateProjectiles(dt);

    // Atualização da PointLight única e fixa para velas no solo (Zero Shader Recompilation)
    if (this.sharedPlacedCandleLight) {
      const px = this.player.x;
      const pz = this.player.z;
      let nearestCandle = null;
      let minCandleDistSq = 144; // 12m

      if (this.placedItems && this.placedItems.length > 0) {
        for (let i = 0; i < this.placedItems.length; i++) {
          const item = this.placedItems[i];
          if (item.id !== "candle") continue;
          const dx = item.x - px;
          const dz = item.z - pz;
          const dSq = dx * dx + dz * dz;
          if (dSq < minCandleDistSq) {
            minCandleDistSq = dSq;
            nearestCandle = item;
          }
        }
      }

      if (nearestCandle) {
        const flicker = 0.88 + 0.12 * Math.sin(now * 0.012);
        this.sharedPlacedCandleLight.position.set(nearestCandle.x, nearestCandle.y + 0.35, nearestCandle.z);
        this.sharedPlacedCandleLight.intensity = 2.4 * flicker;
      } else {
        this.sharedPlacedCandleLight.intensity = 0;
        this.sharedPlacedCandleLight.position.set(0, -9999, 0);
      }
    }
  }

  // Corpo a corpo: toque = golpe (combo nas leves); segurar = ataque carregado nas pesadas.
  _updateMelee(dt, def, cameraYaw, dead) {
    const pressed = this.input.consumeAttackPressed();
    if (dead) {
      this._cancelCharge();
      return;
    }
    if (def.charge) {
      if (pressed && this.cooldown <= 0 && !this.charging) {
        this.charging = true;
        this.chargeTime = 0;
        this.player.cancelBlock();
      }
      if (this.charging) {
        this.chargeTime += dt;
        const ratio = Math.min(1, this.chargeTime / CHARGE_TIME);
        this.player.chargePose = ratio;
        this.ui.setCharge(this.chargeTime > 0.2 ? ratio : null);
        if (!this.input.attackHeld || this.chargeTime >= CHARGE_TIME * 1.25) {
          const strength = this.chargeTime < 0.28 ? 0 : ratio;
          this._cancelCharge();
          this._swing(def, cameraYaw, strength);
        }
      }
      return;
    }
    if (pressed) this.buffered = 0.2;
    else this.buffered = Math.max(0, this.buffered - dt);
    const wants = this.buffered > 0 || this.input.attackHeld;
    if (wants && this.cooldown <= 0) {
      this.buffered = 0;
      this._swing(def, cameraYaw, 0);
    }
  }

  openBuildHub() {
    this.buildHubOpen = true;
    this.buildMode = false;
    this.selectedDemolishTarget = null;
    this.hoveredDemolishTarget = null;
    if (this._demolishHighlightGroup) this._demolishHighlightGroup.visible = false;
    this.ui?.setDemolishHud?.(false);
    updateBuildPreview(this.player.root.position, 0, false);
    this.input.setModalOpen(true);

    this.ui.onBuildClose = () => {
      this.closeBuildHub();
    };

    this.ui.showBuildHub(
      BUILD_COSTS,
      PlayerInventory,
      (selectedType) => {
        this.startBuildMode(selectedType);
      },
      () => {
        this.startBuildMode("PLACE_ITEM");
      },
      () => {
        this.startBuildMode("DESTROY");
      },
    );
  }

  closeBuildHub() {
    this.buildHubOpen = false;
    this.buildMode = false;
    this.selectedDemolishTarget = null;
    this.hoveredDemolishTarget = null;
    if (this._demolishHighlightGroup) this._demolishHighlightGroup.visible = false;
    this.ui?.setDemolishHud?.(false);
    if (this.cameraRig) this.cameraRig.frozen = false;
    this.ui.closeBuildHub();
    this.input.setModalOpen(false);
    updateBuildPreview(this.player.root.position, 0, false);
    this._refreshWeaponHud();
    try {
      this.input.canvas?.requestPointerLock?.();
    } catch (_) {}
  }

  exitBuildMode() {
    this.buildMode = false;
    this.buildHubOpen = false;
    this.selectedDemolishTarget = null;
    this.hoveredDemolishTarget = null;
    if (this._demolishHighlightGroup) this._demolishHighlightGroup.visible = false;
    this.ui?.setDemolishHud?.(false);
    if (this.cameraRig) this.cameraRig.frozen = false;
    this.input.setModalOpen(false);
    updateBuildPreview(this.player.root.position, 0, false);
    this.ui.showToast("Modo Construção encerrado. Câmera liberada.");
    this._refreshWeaponHud();
  }

  startBuildMode(type = "HOUSE") {
    this.buildHubOpen = false;
    this.buildMode = true;
    this.selectedBuildType = type;
    this.selectedDemolishTarget = null;
    this.hoveredDemolishTarget = null;
    this.buildAngle = Math.round((this.player.model?.rotation?.y ?? 0) / (Math.PI / 12)) * (Math.PI / 12);
    if (this.cameraRig) {
      this.cameraRig.frozen = type !== "DESTROY";
    }
    this.input.setModalOpen(false);
    this._announceBuildMode();
    try {
      this.input.canvas?.requestPointerLock?.();
    } catch (_) {}
  }

  _announceBuildMode() {
    const type = this.selectedBuildType || "HOUSE";
    if (type === "DESTROY") {
      this.ui.setWeapon("MODO CONSTRUÇÃO (C)", "🔨 MODO DEMOLIÇÃO");
      this.ui.showToast("Modo Demolição ativado! Aponte para sua construção e clique com botão esquerdo ou aperte [E] para SELECIONAR.");
      return;
    }
    if (type === "PLACE_ITEM") {
      const label = `FIXAR ${this.currentWeapon.name.toLocaleUpperCase("pt-BR")} NA PAREDE/CHÃO [E]`;
      this.ui.setWeapon("MODO CONSTRUÇÃO (C)", label);
      this.ui.showToast(`Modo: ${label} · [C] Catálogo · [Clique/E] Fixar`);
      return;
    }

    const cost = BUILD_COSTS[type] || BUILD_COSTS.HOUSE;
    const parts = [];
    if (cost.wood) parts.push(`${cost.wood} Mad`);
    if (cost.stone) parts.push(`${cost.stone} Ped`);
    if (cost.clay) parts.push(`${cost.clay} Barro`);
    if (cost.torches) parts.push(`${cost.torches} Tocha (Tens ${PlayerInventory.torches || 0})`);
    if (cost.hay) parts.push(`${cost.hay} Feno`);
    const costStr = parts.join(", ");

    const label = `${(cost.label || type).toLocaleUpperCase("pt-BR")} (${costStr})`;
    this.ui.setWeapon("MODO CONSTRUÇÃO (C)", label);
    this.ui.showToast(`Construir: ${cost.label || type} · [Mouse/Wheel/Q/E] Rodar 15° · [Clique/E] Erguer · [C] Catálogo`);
  }

  _tryPlaceHeldItem() {
    const def = this.currentWeapon;
    const isCandleActive = Boolean(this.candle && (this.candle.equipped || this.candle.lit));
    const hasCandleInInv = Boolean(this.candle && this.candle.count > 0);
    const hasTorchInInv = (PlayerInventory.torches || 0) > 0;

    if (def.id === "fists" && !isCandleActive && !hasCandleInInv && !hasTorchInInv) {
      this.ui.showToast("Equipe uma tocha, vela (V) ou arma para fixar no cenário!");
      return;
    }

    const forwardX = -Math.sin(this._yaw);
    const forwardZ = -Math.cos(this._yaw);
    const px = this.player.x;
    const pz = this.player.z;
    const py = (this.player.root?.position?.y ?? 0) + 1.2;

    const reach = 2.4;
    const targetX = px + forwardX * reach;
    const targetZ = pz + forwardZ * reach;
    const isNearWall = this.world.isBlockedAt(targetX, targetZ, 0.45);
    const ground = this.world.heightAt(targetX, targetZ);

    this.placedItems = this.placedItems || [];
    const torchSys = this.torches || this.houses?.torches;

    // 1. Fixar Vela (se estiver com vela ativa ou no inventário)
    if (isCandleActive || (def.id === "fists" && hasCandleInInv && !hasTorchInInv)) {
      if (!this.candle || this.candle.count <= 0) {
        this.ui.showToast("Você não possui mais velas no inventário!");
        return;
      }
      const placeY = isNearWall ? py - 0.2 : ground;

      const candleGroup = new THREE.Group();
      candleGroup.name = "PlacedCandle";

      const waxMat = new THREE.MeshStandardMaterial({ color: 0xefe4c8, roughness: 0.9, flatShading: true });
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.22, 8), waxMat);
      wax.position.y = 0.11;
      wax.castShadow = true;

      const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.04, 4),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      wick.position.y = 0.23;

      const flameSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: torchSys?.glow || this.candle?.torches?.glow,
          color: "#ffd08a",
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false, // Perfora a neblina escura noturna
        })
      );
      flameSprite.scale.set(0.38, 0.52, 1);
      flameSprite.position.y = 0.32;

      candleGroup.add(wax, wick, flameSprite);
      candleGroup.position.set(targetX, placeY, targetZ);
      this.scene.add(candleGroup);

      this.candle.count--;
      if (this.candle.count <= 0) {
        this.candle.equipped = false;
        this.candle.lit = false;
        if (this.candle.mesh) this.candle.mesh.visible = false;
      }
      this.candle._sync?.();

      this.effects.play("glint", targetX, placeY + 0.3, targetZ, "#ffe48f", 1.2);
      this.audio.coin?.();
      this.ui.showToast("Vela de sebo colocada! Pressione E para recolher.");
      this.placedItems.push({
        id: "candle",
        name: "Vela de Sebo",
        x: targetX,
        y: placeY,
        z: targetZ,
        model: candleGroup,
      });
      return;
    }

    // 2. Fixar Tocha
    if (def.id === "torch" || (def.id === "fists" && hasTorchInInv)) {
      if (def.id !== "torch" && (PlayerInventory.torches || 0) <= 0) {
        this.ui.showToast("Sem tochas no inventário! Crie no menu de artesanato (I).");
        return;
      }
      const torchColor = PlayerInventory.torchColor || "orange";
      let placed;
      if (isNearWall) {
        placed = torchSys?.addTorch?.(targetX, py + 0.3, targetZ, -forwardX, -forwardZ, false, torchColor, true, true);
      } else {
        placed = torchSys?.addTorch?.(targetX, ground + 1.6, targetZ, 0, 0, true, torchColor, true, true);
      }
      this.effects.play("star", targetX, py, targetZ, "#ffa834", 1.2);
      this.audio.weaponSwing?.("chop", false);

      if (def.id === "torch") {
        this.unlock("torch", false);
        PlayerInventory.torches = Math.max(0, (PlayerInventory.torches || 1) - 1);
        this.selectSlot(1);
      } else {
        PlayerInventory.torches = Math.max(0, (PlayerInventory.torches || 0) - 1);
      }

      this.ui.showToast(`Tocha fixada! Restam ${PlayerInventory.torches} no alforje. [E] Recolher.`);

      this.placedItems.push({
        id: "torch",
        name: "Tocha",
        x: targetX,
        y: py,
        z: targetZ,
        torchSource: placed,
      });
      return;
    }

    // Fixa Arma na Parede / Expositor
    const placeY = isNearWall ? py : ground + 0.5;

    const model = buildWeaponModel(def.id);
    if (model) {
      model.position.set(targetX, placeY, targetZ);
      model.rotation.y = this._yaw + Math.PI / 2;
      if (isNearWall) {
        model.rotation.z = Math.PI / 4;
      }
      this.scene.add(model);
      this.effects.play("star", targetX, placeY, targetZ, "#ffe082", 1.1);
      this.audio.weaponSwing?.("slash", false);
      this.ui.showToast(`${def.name} fixada! Pressione E para recolher.`);

      this.placedItems.push({
        id: def.id,
        name: def.name,
        x: targetX,
        y: placeY,
        z: targetZ,
        model,
        durability: this.durability?.[def.id],
      });

      // Remove a arma equipada
      this.owned.delete(def.id);
      this.selectSlot(1);
    }
  }

  tryPickupPlacedItem() {
    if (!this.placedItems || this.placedItems.length === 0) return false;
    const px = this.player.x;
    const pz = this.player.z;
    const py = (this.player.root?.position?.y ?? 0) + 1.0;

    for (let i = 0; i < this.placedItems.length; i++) {
      const item = this.placedItems[i];
      const dx = item.x - px;
      const dz = item.z - pz;
      if (dx * dx + dz * dz < 2.3 * 2.3) {
        this.placedItems.splice(i, 1);
        if (item.id === "torch") {
          const torchSys = this.gameEnv?.torches || this.torchSystem;
          if (torchSys?.removeTorch) {
            torchSys.removeTorch(item.torchSource);
          } else {
            if (item.torchSource?.group) item.torchSource.group.parent?.remove(item.torchSource.group);
            if (item.torchSource?.sprite) item.torchSource.sprite.parent?.remove(item.torchSource.sprite);
            if (item.torchSource?.pointLight) item.torchSource.pointLight.parent?.remove(item.torchSource.pointLight);
          }
          this.unlock("torch", false);
          PlayerInventory.torches = (PlayerInventory.torches || 0) + 1;
          this.equip("torch", false);
          this.ui.showToast(`Tocha recolhida de volta ao inventário! (Total: ${PlayerInventory.torches})`);
        } else if (item.id === "candle") {
          if (item.model) item.model.parent?.remove(item.model);
          if (this.candle) {
            this.candle.count++;
            this.candle._sync?.();
          }
          this.ui.showToast("Vela recolhida de volta ao inventário!");
        } else {
          if (item.model) item.model.parent?.remove(item.model);
          this.unlock(item.id, false);
          if (item.durability !== undefined) this.setWeaponDurability(item.id, item.durability);
          this.equip(item.id, false);
          this.ui.showToast(`${item.name} recolhida para o alforje!`);
        }
        this.audio.weaponSwing?.("chop", false);
        this.effects.play("glint", item.x, py, item.z, "#ffd970", 1.0);
        return true;
      }
    }
    return false;
  }

  _tryBuildInMode() {
    const type = this.selectedBuildType || "HOUSE";
    const cost = BUILD_COSTS[type] || BUILD_COSTS.HOUSE;

    if (cost.torches && (PlayerInventory.torches || 0) < cost.torches) {
      this.ui.showToast(`Faltam tochas no inventário! (Tens ${PlayerInventory.torches || 0}, precisas de ${cost.torches}). Crie no menu de artesanato (I).`);
      return;
    }

    const built = buildStructure(
      this.player.root.position,
      this.player.model.rotation,
      type,
      this.playerBuildingsPool,
      this.buildAngle,
    );
    if (built) {
      this.ui.showToast(`✦ ${cost.label || type} erguido com sucesso no reino!`);
      this._announceBuildMode();
    } else {
      const parts = [];
      if (cost.wood) parts.push(`${cost.wood} Madeira (tens ${PlayerInventory.wood})`);
      if (cost.stone) parts.push(`${cost.stone} Pedra (tens ${PlayerInventory.stone})`);
      if (cost.clay) parts.push(`${cost.clay} Barro (tens ${PlayerInventory.clay || 0})`);
      if (cost.torches) parts.push(`${cost.torches} Tocha (tens ${PlayerInventory.torches || 0})`);
      if (cost.hay) parts.push(`${cost.hay} Feno (tens ${PlayerInventory.hay})`);
      this.ui.showToast(`Recursos insuficientes! Precisas de: ${parts.join(" · ")}`);
    }
  }

  _createDemolishHighlight(scene) {
    if (!scene) return null;
    const group = new THREE.Group();
    group.name = "DemolishHighlight";

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xff3333,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });
    const lineBox = new THREE.LineSegments(edgesGeo, lineMat);
    group.add(lineBox);

    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xff1111,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fillBox = new THREE.Mesh(boxGeo, fillMat);
    group.add(fillBox);

    group.visible = false;
    scene.add(group);
    return group;
  }

  _updateDemolishHighlight(target, isSelected) {
    if (!this._demolishHighlightGroup) return;
    if (!target) {
      this._demolishHighlightGroup.visible = false;
      return;
    }

    const type = target.userData?.type || "DEFAULT";
    const bounds = BUILDING_BOUNDS[type] || { w: 2.2, d: 2.2, h: 2.0, y: 1.0 };
    const now = performance.now();

    const bx = target.position ? target.position.x : target.x;
    const by = (target.position ? target.position.y : target.y) + bounds.y;
    const bz = target.position ? target.position.z : target.z;
    const ry = target.rotation ? target.rotation.y : (this._yaw || 0);

    this._demolishHighlightGroup.position.set(bx, by, bz);
    this._demolishHighlightGroup.rotation.y = ry;
    this._demolishHighlightGroup.scale.set(bounds.w * 1.05, bounds.h * 1.05, bounds.d * 1.05);

    const lineBox = this._demolishHighlightGroup.children[0];
    const fillBox = this._demolishHighlightGroup.children[1];

    if (isSelected) {
      const pulse = 0.72 + 0.28 * Math.sin(now * 0.016);
      if (lineBox) {
        lineBox.material.color.setHex(0xff1818);
        lineBox.material.opacity = pulse;
      }
      if (fillBox) {
        fillBox.material.color.setHex(0xff2222);
        fillBox.material.opacity = 0.22 * pulse;
      }
    } else {
      const pulse = 0.65 + 0.35 * Math.sin(now * 0.008);
      if (lineBox) {
        lineBox.material.color.setHex(0xffa834);
        lineBox.material.opacity = pulse;
      }
      if (fillBox) {
        fillBox.material.color.setHex(0xff8811);
        fillBox.material.opacity = 0.12 * pulse;
      }
    }

    this._demolishHighlightGroup.visible = true;
  }

  _updateDemolishMode(dt, cameraYaw) {
    if (this.cameraRig) this.cameraRig.frozen = false;

    // Se o alvo selecionado não estiver mais visível, reseta a seleção
    if (this.selectedDemolishTarget && !this.selectedDemolishTarget.visible && !this.selectedDemolishTarget.model) {
      this.selectedDemolishTarget = null;
    }

    const px = this.player.x;
    const pz = this.player.z;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);

    const buildings = (this.playerBuildingsPool || []).filter((b) => b.visible);
    let bestCandidate = null;
    let bestScore = Infinity;

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const dx = b.position.x - px;
      const dz = b.position.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 32) continue;

      const dot = (dx * forwardX + dz * forwardZ) / Math.max(0.001, dist);
      if (dot < 0.55) continue;

      const score = dist * (2.0 - dot);
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = b;
      }
    }

    if (this.placedItems && this.placedItems.length > 0) {
      for (let i = 0; i < this.placedItems.length; i++) {
        const item = this.placedItems[i];
        const dx = item.x - px;
        const dz = item.z - pz;
        const dist = Math.hypot(dx, dz);
        if (dist > 10) continue;
        const dot = (dx * forwardX + dz * forwardZ) / Math.max(0.001, dist);
        if (dot < 0.65) continue;
        const score = dist * (2.0 - dot);
        if (score < bestScore) {
          bestScore = score;
          bestCandidate = item;
        }
      }
    }

    this.hoveredDemolishTarget = bestCandidate;
    const activeTarget = this.selectedDemolishTarget || this.hoveredDemolishTarget;
    const isSelected = Boolean(this.selectedDemolishTarget);

    this._updateDemolishHighlight(activeTarget, isSelected);

    // Texto descritivo para a interface
    let targetText = "Nenhuma construção sob a mira";
    if (this.selectedDemolishTarget) {
      const type = this.selectedDemolishTarget.userData?.type;
      const cost = BUILD_COSTS[type];
      const name = cost?.label || this.selectedDemolishTarget.name || type || "Construção";
      targetText = `[SELECIONADO] ${name}`;
    } else if (this.hoveredDemolishTarget) {
      const type = this.hoveredDemolishTarget.userData?.type;
      const cost = BUILD_COSTS[type];
      const name = cost?.label || this.hoveredDemolishTarget.name || type || "Construção";
      targetText = `Mirando em: ${name}`;
    }

    this.ui.setDemolishHud(
      true,
      targetText,
      isSelected,
      () => this._demolishSelectedTarget(),
      () => this._clearDemolishSelection(),
    );

    // Entrada do teclado/mouse para selecionar e destruir
    const attackPressed = this.input.consumeAttackPressed?.();
    const interactPressed = this.input.consumeInteractPressed?.();
    const spacePressed = this.input.isKeyPressed?.("Space");
    const deletePressed = this.input.isKeyPressed?.("Delete") || this.input.isKeyPressed?.("Backspace");
    const cancelPressed = this.input.isKeyPressed?.("Escape") || this.input.consumeBlockPressed?.();

    if (cancelPressed) {
      this._clearDemolishSelection();
      return;
    }

    if (deletePressed && this.selectedDemolishTarget) {
      this._demolishSelectedTarget();
      return;
    }

    if (attackPressed || interactPressed || spacePressed) {
      if (this.selectedDemolishTarget) {
        if (!this.hoveredDemolishTarget || this.hoveredDemolishTarget === this.selectedDemolishTarget) {
          this._demolishSelectedTarget();
        } else {
          this.selectedDemolishTarget = this.hoveredDemolishTarget;
          this.audio?.weaponSwing?.("chop", false);
        }
      } else if (this.hoveredDemolishTarget) {
        this.selectedDemolishTarget = this.hoveredDemolishTarget;
        this.audio?.weaponSwing?.("chop", false);
        const type = this.selectedDemolishTarget.userData?.type;
        const cost = BUILD_COSTS[type];
        const name = cost?.label || this.selectedDemolishTarget.name || type || "Construção";
        this.ui.showToast(`✦ ${name} selecionada! Clique no botão DELETAR ou aperte [E / Delete / Espaço] para destruir.`);
      }
    }
  }

  _clearDemolishSelection() {
    if (this.selectedDemolishTarget) {
      this.selectedDemolishTarget = null;
      this.ui.showToast("Seleção cancelada.");
    }
    if (this._demolishHighlightGroup) this._demolishHighlightGroup.visible = false;
  }

  _demolishSelectedTarget() {
    const target = this.selectedDemolishTarget;
    if (!target) return;

    if (target.model || target.torchSource || target.id) {
      const idx = this.placedItems ? this.placedItems.indexOf(target) : -1;
      if (idx !== -1) this.placedItems.splice(idx, 1);

      if (target.torchSource) {
        const torchSys = this.gameEnv?.torches || this.torchSystem;
        if (torchSys?.removeTorch) {
          torchSys.removeTorch(target.torchSource);
        } else {
          if (target.torchSource.group) target.torchSource.group.parent?.remove(target.torchSource.group);
          if (target.torchSource.sprite) target.torchSource.sprite.parent?.remove(target.torchSource.sprite);
          if (target.torchSource.pointLight) target.torchSource.pointLight.parent?.remove(target.torchSource.pointLight);
        }
      }
      if (target.model) target.model.parent?.remove(target.model);

      this.effects?.play("dust", target.x, target.y + 0.3, target.z, "#cdbb97", 1.2);
      this.effects?.play("smoke", target.x, target.y + 0.3, target.z, "#8c8273", 1.0);
      this.audio?.weaponSwing?.("chop", false);
      this.ui.showToast(`✦ ${target.name || "Item fixado"} deletado com sucesso!`);
    } else {
      const type = target.userData?.type;
      const cost = BUILD_COSTS[type];
      const name = cost?.label || type || "Construção";
      destroyBuilding(target, this.world, this.scene, this.effects);
      this.ui.showToast(`💥 ${name} foi demolida e removida do reino!`);
    }

    this.selectedDemolishTarget = null;
    this.hoveredDemolishTarget = null;
    if (this._demolishHighlightGroup) this._demolishHighlightGroup.visible = false;
    this.ui.setDemolishHud(true, "Construção demolida com sucesso!", false);
  }

  setWeaponDurability(id, amount) {
    this.durability = this.durability || {};
    this.durability[id] = amount;
    this._refreshWeaponHud();
  }

  _consumeDurability(def) {
    if (!def.isImprovised) return;
    this.durability = this.durability || {};
    const cur = this.durability[def.id] !== undefined ? this.durability[def.id] : (def.durability || 10);
    const next = cur - 1;
    this.durability[def.id] = next;

    if (next <= 0) {
      delete this.durability[def.id];
      this.owned.delete(def.id);
      this.effects.play("dust", this.player.x, this.player.root.position.y + 1.2, this.player.z, "#a67d4b", 1.4);
      this.audio.weaponSwing?.("chop", false);
      this.ui.showToast(`💥 ${def.name} quebrou com o impacto!`);
      this.selectSlot(1); // Retorna aos punhos
    } else {
      this._refreshWeaponHud();
    }
  }

  _swing(def, cameraYaw, charge) {
    this._lastYaw = cameraYaw;
    this.player._lastGatherYaw = cameraYaw;
    if (this.combat.attackMelee(cameraYaw, def, charge)) {
      this.cooldown = this.combat.attackCooldown;
      this._maxCooldown = Math.max(this.cooldown, def.cooldown || 0.35);
      this._consumeDurability(def);
      if (def.id === "torch") {
        this._igniteWithTorch(cameraYaw);
      } else if (def.toolType === "AXE" || def.toolType === "PICKAXE") {
        gatherResource(this.player, def.toolType, this.world.environmentInstancedMeshes);
      } else if (def.toolType === "SCYTHE") {
        scytheSweep(this.player, cameraYaw, def, { effects: this.effects, audio: this.audio, ui: this.ui });
      }
    }
  }

  _igniteWithTorch(cameraYaw) {
    const now = performance.now();
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const px = this.player.x;
    const pz = this.player.z;
    const py = this.player.root.position.y + 1.1;

    // 1. Spatial Hash Grid O(1): Verifica apenas NPCs na célula local à frente do golpe da tocha
    const npcs = this.npcs.queryNearby
      ? this.npcs.queryNearby(px, pz, 3.2, this._nearbyNPCs)
      : this.npcs.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      if (!npc.alive || (npc.controlled && this.player.mounted === npc)) continue;
      const dx = npc.x - px;
      const dz = npc.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.8 || dist < 0.001) continue;
      if ((dx / dist) * forwardX + (dz / dist) * forwardZ < 0.35) continue;
      igniteTarget(npc.root, { x: npc.x, y: npc.root.position.y + 0.9, z: npc.z }, this.firePool, now);
      this.fire?.igniteNear?.(npc.x, npc.z, 2.0);
      return;
    }

    // 2. Verifica obstáculos/árvores (InstancedMesh) à frente da tocha e acopla fogo temporário estático
    const hitX = px + forwardX * 1.9;
    const hitZ = pz + forwardZ * 1.9;
    if (this.world.isBlockedAt(hitX, hitZ, 0.45)) {
      igniteTarget({ isNPC: false }, { x: hitX, y: py, z: hitZ }, this.firePool, now);
    }
    this.fire?.igniteNear?.(hitX, hitZ, 2.2);
  }

  _throwSpear(cameraYaw) {
    const spearModel = this.models.spear;
    if (!spearModel || spearModel.userData.isThrown) return;
    spearModel.userData.isThrown = true;
    spearModel.visible = false;

    const fakeWeapon = { barrel: 0.75, speed: 34, gravity: 14, arc: false, type: "throw" };
    const launch = this._solveLaunch(fakeWeapon, 0, this._launch);
    const ts = this.thrownSpear;
    const d = ts.userData;
    d.isThrown = true;
    d.isLootable = false;
    d.x = launch.x;
    d.y = launch.y;
    d.z = launch.z;
    d.vx = launch.vx;
    d.vy = launch.vy;
    d.vz = launch.vz;

    ts.position.set(d.x, d.y, d.z);
    ts.rotation.set(-Math.atan2(d.vy, Math.hypot(d.vx, d.vz)), Math.atan2(d.vx, d.vz), 0);
    ts.visible = true;

    this.player.faceYaw = cameraYaw + Math.PI;
    this.player.faceTimer = 0.5;
    this.player.startAttack(3, 0.32);
    this.audio.weaponSwing("stab", true);
    this._refreshWeaponHud();
  }

  _updateThrownSpear(dt) {
    const ts = this.thrownSpear;
    if (!ts || !ts.visible) return;
    const d = ts.userData;
    if (d.isLootable) return;

    const prevX = d.x;
    const prevY = d.y;
    const prevZ = d.z;
    d.vy -= d.gravity * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;

    // Verifica colisão com NPCs no trajeto da lança usando Spatial Hash Grid
    const npcs = this.npcs.queryNearby
      ? this.npcs.queryNearby(d.x, d.z, 3.0, this._nearbyNPCs)
      : this.npcs.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      if (!npc.alive || !npc.root.visible || (npc.controlled && this.player.mounted === npc)) continue;
      const zone = segmentHit(npc, prevX, prevY, prevZ, d.x, d.y, d.z, 0.14);
      if (!zone) continue;
      const headshot = zone === "head";
      const dmg = Math.round((headshot ? 6 : 3) * PlayerEquipment.getWeaponMult());
      const spd = Math.max(0.001, Math.hypot(d.vx, d.vz));
      this.combat.damageNPC(npc, dmg, d.vx / spd, d.vz / spd, "#ffe09a", 1.25, 5.2, 0, headshot);
      d.vx = 0;
      d.vy = 0;
      d.vz = 0;
      d.y = this.world.heightAt(d.x, d.z) + 0.18;
      d.isLootable = true;
      ts.position.set(d.x, d.y, d.z);
      return;
    }

    const ground = this.world.heightAt(d.x, d.z);
    if (d.y <= ground + 0.12 || this.world.isBlockedAtHeight(d.x, d.y, d.z, 0.1)) {
      d.vx = 0;
      d.vy = 0;
      d.vz = 0;
      d.y = Math.max(ground + 0.12, d.y);
      d.isLootable = true;
      ts.position.set(d.x, d.y, d.z);
      this.effects.play("star", d.x, d.y + 0.2, d.z, "#d8cfba", 0.55);
      return;
    }

    ts.position.set(d.x, d.y, d.z);
    ts.rotation.set(-Math.atan2(d.vy, Math.hypot(d.vx, d.vz)), Math.atan2(d.vx, d.vz), 0);
  }

  tryPickupSpear() {
    const ts = this.thrownSpear;
    if (!ts || !ts.visible || !ts.userData.isLootable) return false;
    const dx = ts.userData.x - this.player.x;
    const dz = ts.userData.z - this.player.z;
    if (dx * dx + dz * dz > 2.4 * 2.4) return false;

    ts.visible = false;
    ts.userData.isLootable = false;
    ts.userData.isThrown = false;
    if (this.models.spear) {
      this.models.spear.userData.isThrown = false;
      if (this.currentId === "spear") this.models.spear.visible = true;
    }
    this.audio.weaponSwing("stab", false);
    this.ui.showToast("Lança recuperada!");
    this._refreshWeaponHud();
    return true;
  }

  _fireMusket(cameraYaw, now = performance.now()) {
    const musketModel = this.models.musket;
    if (musketModel && (musketModel.userData.isReloading || now < (musketModel.userData.nextShot || 0))) {
      this.ui.showToast("Recarregando mosquete...");
      return;
    }
    const def = WEAPONS_BY_ID.musket;
    this._muzzle(def, this._launch);
    const startX = this._launch.x;
    const startY = this._launch.y;
    const startZ = this._launch.z;

    const aim = this.aim;
    const useAssist = Boolean(aim.assistEnabled && aim.assistTarget && (aim.active || aim.origin.distanceTo(aim.assistPoint) < 34));
    const targetPt = useAssist ? aim.assistPoint : aim.point;

    let dirX = targetPt.x - startX;
    let dirY = targetPt.y - startY;
    let dirZ = targetPt.z - startZ;
    const len = Math.max(0.001, Math.hypot(dirX, dirY, dirZ));
    dirX /= len;
    dirY /= len;
    dirZ /= len;

    const maxDist = 85;
    let endX = startX + dirX * maxDist;
    let endY = startY + dirY * maxDist;
    let endZ = startZ + dirZ * maxDist;

    // Hitscan Raycast nos NPCs vivos ao longo do raio do mosquete
    let bestT = maxDist;
    let hitNPC = null;
    let hitHead = false;
    for (let i = 0; i < this.npcs.npcs.length; i++) {
      const npc = this.npcs.npcs[i];
      if (!npc.alive || !npc.root.visible || (npc.controlled && this.player.mounted === npc)) continue;
      const toNpcX = npc.x - startX;
      const toNpcZ = npc.z - startZ;
      const proj = toNpcX * dirX + toNpcZ * dirZ;
      if (proj < 0 || proj > bestT) continue;
      const px = startX + dirX * proj;
      const py = startY + dirY * proj;
      const pz = startZ + dirZ * proj;
      const zone = segmentHit(npc, px - dirX * 0.6, py - dirY * 0.6, pz - dirZ * 0.6, px + dirX * 0.6, py + dirY * 0.6, pz + dirZ * 0.6, 0.14);
      if (zone) {
        bestT = proj;
        hitNPC = npc;
        hitHead = zone === "head";
      }
    }

    endX = startX + dirX * bestT;
    endY = startY + dirY * bestT;
    endZ = startZ + dirZ * bestT;

    if (hitNPC) {
      const dmg = Math.round((hitHead ? def.damage * 2 : def.damage) * PlayerEquipment.getWeaponMult());
      this.combat.damageNPC(hitNPC, dmg, dirX, dirZ, "#ffd995", hitHead ? 1.4 : 1.15, 5.5, 0, hitHead);
      this.effects.play("star", endX, endY, endZ, "#ffd995", 1.1);
    } else {
      this.houses?.hitAt(endX, endY, endZ, 0.25, def.damage);
      this.effects.play("smoke", endX, endY, endZ, "#d8cfba", 0.8);
    }

    // Linha temporal de fumaça (Tracer) do mosquete (Zero-GC)
    const tr = this.musketTracer;
    if (tr) {
      tr.positions[0] = startX;
      tr.positions[1] = startY;
      tr.positions[2] = startZ;
      tr.positions[3] = endX;
      tr.positions[4] = endY;
      tr.positions[5] = endZ;
      tr.line.geometry.attributes.position.needsUpdate = true;
      tr.mat.opacity = 0.88;
      tr.line.visible = true;
      tr.timer = 0.28;
    }

    this.player.faceYaw = cameraYaw + Math.PI;
    this.player.faceTimer = 0.6;
    this.player.firePoseTimer = 0.45;
    this.player.kick(1.25);
    this.aim.kick(def.kick);
    this.cameraRig.kick(def.recoil);
    this.cameraRig.addShake(0.18);
    this.effects.play("flame", startX, startY, startZ, "#ffae42", 0.95);
    this.effects.play("smoke", startX, startY + 0.1, startZ, "#dfd8c8", 1.45);
    this.audio.shot("musket");

    if (musketModel) {
      musketModel.userData.isReloading = true;
      musketModel.userData.reloadEndTime = now + 3500;
      musketModel.userData.nextShot = now + 3500;
    }
    this.cooldown = 3.5;
    this._maxCooldown = 3.5;
  }

  _updateMusketTracer(dt) {
    const tr = this.musketTracer;
    if (!tr || !tr.line.visible) return;
    tr.timer -= dt;
    if (tr.timer <= 0) {
      tr.line.visible = false;
    } else {
      tr.mat.opacity = Math.max(0, (tr.timer / 0.28) * 0.88);
    }
  }

  _cancelCharge() {
    if (!this.charging && this.player.chargePose === 0) return;
    this.charging = false;
    this.chargeTime = 0;
    this.player.chargePose = 0;
    this.ui.setCharge(null);
  }

  // Retorna todas as armas possuídas em ordem canônica estrita (slots 1 a 9)
  getOwnedWeaponsList() {
    if ((PlayerInventory.torches || 0) > 0 || !this.owned.has("torch")) {
      this.owned.add("torch");
    }
    const list = [];
    for (const def of WEAPON_LIST) {
      if (this.owned.has(def.id) && !list.includes(def.id)) {
        list.push(def.id);
      }
    }
    if (!list.includes("fists")) list.unshift("fists");
    if (!list.includes("torch")) list.splice(1, 0, "torch");
    return list;
  }

  // Equipa uma arma pelo id.
  equip(id, announce = true) {
    if (id === "torch") {
      this.owned.add("torch");
      PlayerInventory.torches = Math.max(1, PlayerInventory.torches || 1);
    }
    const def = WEAPONS_BY_ID[id];
    if (!def) return false;
    if (!this.owned.has(id)) {
      if (id === "fists" || id === "torch") this.owned.add(id);
      else return false;
    }
    this._cancelCharge();
    this.currentId = id;
    this.slot = def.slot - 1;
    this.lastInSlot[this.slot] = id;

    // Atualiza visibilidade dos modelos 3D na mão do personagem
    for (const [key, model] of Object.entries(this.models)) {
      if (key === "spear" && model.userData?.isThrown) {
        model.visible = false;
      } else {
        model.visible = (key === id);
      }
    }

    if (id === "torch" && this.models.torch) {
      this.models.torch.visible = true;
      if (this.torchLight) this.torchLight.intensity = 38.0;
    } else if (this.torchLight) {
      this.torchLight.intensity = 0;
    }

    const player = this.player;
    player.weaponId = id;
    player.weaponGrip = def.grip;
    player.twoHanded = def.hands === 2;
    player.weaponWeight = def.weight;
    player.canBlock = def.hands === 1;
    player.aimStyle = def.type === "bow" || def.type === "crossbow" || def.type === "musket" ? "long" : def.type === "throw" || def.id === "spear" ? "throw" : "melee";
    if (!player.canBlock) player.cancelBlock();
    player.faceYaw = this._yaw + Math.PI;
    player.faceTimer = 0.25;
    this.cooldown = Math.max(this.cooldown, 0.15);
    this._refreshWeaponHud();
    if (announce) this.ui.showToast(`${def.name}${def.hands === 2 ? " · duas mãos" : ""}`);
    return true;
  }

  // Teclas 0-9: escolhe o slot ou alterna armas do mesmo slot
  selectSlot(number) {
    // Tecla 0: Atalho direto para a Tocha mágica (ou Punhos se já estiver com ela)
    if (number === 0) {
      if (this.currentId === "torch") {
        this.equip("fists");
      } else {
        this.equip("torch");
      }
      return;
    }

    const slotIndex = number - 1;
    if (slotIndex < 0 || slotIndex >= 9) return;

    // Obtém todas as armas canônicas deste slot
    const slotWeapons = SLOTS[slotIndex] || [];
    // Armas possuídas pelo jogador neste slot
    const ownedInSlot = slotWeapons.filter((id) => this.owned.has(id));

    // No slot 1, garante tocha se houver tochas no inventário
    if (number === 1 && !ownedInSlot.includes("torch")) {
      ownedInSlot.push("torch");
      this.owned.add("torch");
    }

    if (ownedInSlot.length === 0) {
      const slotLabels = [
        "Punhos / Tocha",
        "Machados / Lâminas",
        "Picareta",
        "Espadas / Maças",
        "Armas de Duas Mãos",
        "Lanças / Alabardas",
        "Arcos",
        "Bestas / Mosquete",
        "Arremesso / Bombas",
      ];
      this.ui.showToast(`Slot [${number}] vazio · Sem ${slotLabels[slotIndex] || "armas"} no inventário`);
      return;
    }

    // Se já estiver empunhando uma arma deste mesmo slot, alterna para a próxima arma possuída
    if (ownedInSlot.includes(this.currentId) && ownedInSlot.length > 1) {
      const curIdx = ownedInSlot.indexOf(this.currentId);
      const nextId = ownedInSlot[(curIdx + 1) % ownedInSlot.length];
      this.lastInSlot[slotIndex] = nextId;
      this.equip(nextId);
      return;
    }

    // Caso contrário, equipa a arma favorita ou a primeira disponível do slot
    const prefId = this.lastInSlot[slotIndex];
    const targetId = (prefId && ownedInSlot.includes(prefId)) ? prefId : ownedInSlot[0];
    this.lastInSlot[slotIndex] = targetId;
    this.equip(targetId);
  }

  // Roda do mouse: percorre estritamente em ordem todas as armas possuídas
  cycle(step) {
    const list = this.getOwnedWeaponsList();
    if (list.length <= 1) return;
    let curIdx = list.indexOf(this.currentId);
    if (curIdx < 0) curIdx = 0;
    const nextIdx = (curIdx + (step > 0 ? 1 : list.length - 1)) % list.length;
    this.equip(list[nextIdx]);
  }

  unlock(id, quiet = false) {
    const def = WEAPONS_BY_ID[id];
    if (!def) return false;
    const wasOwned = this.owned.has(id);
    this.owned.add(id);

    // Regra: as armas pegas já devem ir para a mão, a menos que todos os 9 slots estejam cheios.
    // A tocha é a única que fica compartilhada e fica com a mão, sempre, independente de quantas tochas.
    let slotAssigned = -1;
    const existingSlot = this.hotbarSlots.indexOf(id);

    if (existingSlot >= 0) {
      slotAssigned = existingSlot;
    } else {
      // Procura primeiro slot vago entre os 9
      const freeIdx = this.hotbarSlots.indexOf(null);
      if (freeIdx >= 0) {
        this.hotbarSlots[freeIdx] = id;
        slotAssigned = freeIdx;
      } else if (id === "torch") {
        // A tocha fica na mão sempre
        if (!this.hotbarSlots.includes("torch")) {
          this.hotbarSlots[0] = "torch";
          slotAssigned = 0;
        }
      }
    }

    if (slotAssigned >= 0) {
      this.equip(id, false);
      this._refreshWeaponHud();
      if (!quiet) this.ui.showToast(`Arma equipada na mão: ${def.name} (Slot ${slotAssigned + 1})`);
    } else {
      this._refreshWeaponHud();
      if (!quiet && !wasOwned) {
        this.ui.showToast(`Arma guardada no alforje: ${def.name} (9 slots cheios)`);
      }
    }

    return true;
  }

  // Armas à venda no armeiro (as que ainda não são suas), da mais barata à mais cara.
  shopWeapons() {
    return WEAPON_LIST.filter((w) => w.price > 0 && !this.owned.has(w.id)).sort((a, b) => a.price - b.price);
  }

  purchase(id, customPrice = null) {
    const def = WEAPONS_BY_ID[id];
    if (!def || this.owned.has(id)) return false;
    const finalPrice = customPrice !== null ? customPrice : def.price;
    if (this.player.coins < finalPrice) {
      this.ui.showToast(`${def.name} custa ${finalPrice} moedas`);
      return false;
    }
    this.player.coins -= finalPrice;
    PlayerInventory.gold = this.player.coins;
    if (id === "shortsword" || id === "longsword" || id === "greatsword") {
      PlayerInventory.hasSword = true;
    }
    this.unlock(id);
    this.equip(id, false);
    syncPlayerStatsToPlayer(this.player, this.ui);
    return true;
  }

  serialize() {
    return { owned: [...this.owned], ammo: { ...this.ammo }, current: this.currentId };
  }

  restore(data) {
    if (!data) return;
    if (Array.isArray(data.owned)) {
      for (const id of data.owned) if (WEAPONS_BY_ID[id]) this.owned.add(id);
    }
    Object.assign(this.ammo, data.ammo || {});
    if (data.current && this.owned.has(data.current)) this.equip(data.current, false);
    else this._refreshWeaponHud();
  }

  _refreshWeaponHud() {
    const def = this.currentWeapon;
    const spearThrown = def.id === "spear" && this.models.spear?.userData?.isThrown;
    const durVal = this.durability?.[def.id] !== undefined ? this.durability[def.id] : def.durability;
    const ammoText = spearThrown
      ? "NO CHÃO (E RECUPERA)"
      : def.isImprovised
        ? `DURABILIDADE: ${durVal}/${def.maxDurability || 10}`
        : def.toolType === "AXE"
          ? "FERRAMENTA · CORTAR ÁRVORES"
          : def.toolType === "PICKAXE"
            ? "FERRAMENTA · MINERAR PEDRAS"
            : def.type === "musket"
              ? "PÓLVORA (RECARGA 3.5S)"
              : def.ammo
                ? `${this.ammo[def.ammo]} ${AMMO_LABELS[def.ammo]}`
                : def.type === "fists"
                  ? "SEM ARMA"
                  : "CORPO A CORPO";
    this.ui.setWeapon(def.name.toLocaleUpperCase("pt-BR"), ammoText);

    // Reutiliza cache estático para Zero-GC ao trocar armas
    for (let index = 0; index < 9; index++) {
      const ids = SLOTS[index];
      let ownedCount = 0;
      let firstOwned = null;
      let hasPreferred = false;
      const pref = this.lastInSlot[index];

      for (let j = 0; j < ids.length; j++) {
        const id = ids[j];
        if (this.owned.has(id)) {
          ownedCount++;
          if (!firstOwned) firstOwned = id;
          if (id === pref) hasPreferred = true;
        }
      }

      const shown = hasPreferred ? pref : firstOwned;
      const shownDef = shown ? WEAPONS_BY_ID[shown] : null;
      const entry = this._hotbarEntriesCache[index];
      entry.id = shown;
      entry.name = shownDef ? shownDef.name : "";
      entry.count = ownedCount;
      entry.ammo = shownDef ? (shownDef.ammo ? String(this.ammo[shownDef.ammo]) : "∞") : "";
      entry.empty = shownDef ? Boolean(shownDef.ammo) && this.ammo[shownDef.ammo] <= 0 : true;
    }
    this.ui.setHotbar(this.slot, this._hotbarEntriesCache);
  }

  buyAmmo(type, amount) {
    if (!(type in this.ammo) || amount <= 0) return false;
    this.ammo[type] += amount;
    this._refreshWeaponHud();
    return true;
  }

  // Ponto de saída do projétil: na ponta da arma, do lado da mão.
  _muzzle(weapon, out) {
    const forwardX = -Math.sin(this._yaw);
    const forwardZ = -Math.cos(this._yaw);
    const rightX = Math.cos(this._yaw);
    const rightZ = -Math.sin(this._yaw);
    const reach = weapon.barrel ?? 0.7;
    out.x = this.player.x + forwardX * reach + rightX * 0.3;
    out.y = this.player.root.position.y + (weapon.arc || weapon.type === "throw" ? 1.55 : 1.32);
    out.z = this.player.z + forwardZ * reach + rightZ * 0.3;
    return out;
  }

  // Resolve a velocidade inicial para o projétil cruzar o ponto da mira.
  _solveLaunch(weapon, spread, out) {
    this._muzzle(weapon, out);
    const aim = this.aim;
    const useAssist = Boolean(aim.assistEnabled && aim.assistTarget && (aim.active || aim.origin.distanceTo(aim.assistPoint) < 28));
    let tx = useAssist ? aim.assistPoint.x : aim.point.x;
    let ty = useAssist ? aim.assistPoint.y : aim.point.y;
    let tz = useAssist ? aim.assistPoint.z : aim.point.z;
    if (weapon.arc) {
      const dx = tx - out.x;
      const dz = tz - out.z;
      const flat = Math.hypot(dx, dz);
      if (flat > MAX_THROW) {
        tx = out.x + (dx / flat) * MAX_THROW;
        tz = out.z + (dz / flat) * MAX_THROW;
        ty = this.world.heightAt(tx, tz) + 0.2;
      }
    }
    let dx = tx - out.x;
    let dz = tz - out.z;
    let dy = ty - out.y;
    let flat = Math.hypot(dx, dz);
    if (flat < 0.65 && !useAssist) {
      const direction = aim.direction;
      dx = direction.x;
      dz = direction.z;
      dy = direction.y * 3;
      flat = Math.max(0.001, Math.hypot(dx, dz));
    }
    let angle = Math.atan2(dx, dz);
    if (spread > 0) angle += (Math.random() + Math.random() - 1) * spread;
    const speed = weapon.arc ? 0 : weapon.speed;
    let flight = weapon.arc ? Math.min(1.7, Math.max(0.45, flat / weapon.speed)) : Math.max(0.001, flat / speed);
    let vy;
    if (flight > 3.2) vy = dy / flight;
    else vy = (dy + 0.5 * weapon.gravity * flight * flight) / flight;
    if (spread > 0) vy += (Math.random() + Math.random() - 1) * spread * (weapon.arc ? 8 : weapon.speed);
    const horizontal = weapon.arc ? flat / flight : speed;
    out.vx = Math.sin(angle) * horizontal;
    out.vz = Math.cos(angle) * horizontal;
    out.vy = vy;
    return out;
  }

  _updateTrajectory(weapon) {
    const show = Boolean(weapon.arc) && this.aim.active && this.ammoAvailable(weapon) && !this.player.knockedOut;
    if (!show) {
      if (this.dots.visible) this.dots.visible = false;
      return;
    }
    const launch = this._solveLaunch(weapon, 0, this._launch);
    let x = launch.x;
    let y = launch.y;
    let z = launch.z;
    let vy = launch.vy;
    const step = 0.06;
    let count = 0;
    for (let i = 0; i < 40 && count < DOT_COUNT; i++) {
      x += launch.vx * step;
      z += launch.vz * step;
      vy -= weapon.gravity * step;
      y += vy * step;
      const ground = this.world.heightAt(x, z) + 0.12;
      const landed = y <= ground;
      if (landed) y = ground;
      if (i % 2 === 0 || landed) {
        this._dummy.position.set(x, y, z);
        this._dummy.scale.setScalar(landed ? 2.6 : 0.9);
        this._dummy.updateMatrix();
        this.dots.setMatrixAt(count++, this._dummy.matrix);
      }
      if (landed) break;
    }
    this._dummy.scale.setScalar(0);
    this._dummy.updateMatrix();
    for (let i = count; i < DOT_COUNT; i++) this.dots.setMatrixAt(i, this._dummy.matrix);
    this.dots.instanceMatrix.needsUpdate = true;
    this.dots.visible = true;
  }

  ammoAvailable(weapon) {
    return !weapon.ammo || this.ammo[weapon.ammo] > 0;
  }

  // Armas de disparo e de arremesso.
  _attack(cameraYaw) {
    this._lastYaw = cameraYaw;
    const weapon = this.currentWeapon;
    if (this.cooldown > 0) return;
    if (this.ammo[weapon.ammo] <= 0) {
      this.ui.showToast(`Sem ${AMMO_LABELS[weapon.ammo].toLowerCase()}. Visite o armeiro.`);
      this.cooldown = 0.3;
      return;
    }
    this.cooldown = weapon.cooldown;
    this._maxCooldown = weapon.cooldown;
    this.ammo[weapon.ammo]--;
    this.player.faceYaw = cameraYaw + Math.PI;
    this.player.faceTimer = 0.6;
    this.player.firePoseTimer = weapon.type === "throw" ? 0.18 : 0.45;
    if (weapon.type === "throw") this.player.startAttack(3, 0.3);
    else this.player.kick(weapon.type === "crossbow" ? 1 : 0.8);
    // No quadril o tiro abre mais do que mirando; com assist aim travado, o tiro é certeiro.
    const spread = this.aim.assistLocked ? 0 : this.aim.active ? weapon.spread * 0.25 : weapon.spread * 1.4;
    const launch = this._solveLaunch(weapon, spread, this._launch);
    const startX = launch.x;
    const startY = launch.y;
    const startZ = launch.z;

    if (weapon.type === "bow") this.effects.play("star", startX, startY, startZ, "#9dbb75", 0.4);
    else if (weapon.type === "crossbow") this.effects.play("star", startX, startY, startZ, "#d5d0a7", 0.45);
    if (weapon.type === "bow") this.audio.shot("bow");
    else if (weapon.type === "crossbow") this.audio.shot("crossbow");
    else this.audio.weaponSwing("stab", false, weapon.id);
    this.aim.kick(weapon.kick);
    if (weapon.recoil) this.cameraRig.kick(weapon.recoil);
    if (weapon.id === "heavycrossbow") this.cameraRig.addShake(0.1);

    const projectile = this._acquireProjectile();
    projectile.active = true;
    projectile.stuck = false;
    projectile.type = weapon.projectile;
    projectile.x = startX;
    projectile.y = startY;
    projectile.z = startZ;
    projectile.vx = launch.vx;
    projectile.vy = launch.vy;
    projectile.vz = launch.vz;
    projectile.gravity = weapon.gravity;
    projectile.damage = weapon.damage;
    projectile.life = weapon.arc ? (weapon.fuse || 4) : 4;
    projectile.fuse = weapon.fuse || 0;
    projectile.fuseFx = 0;
    projectile.radius = weapon.radius || 0;
    projectile.color = weapon.color;
    projectile.spin = 0;
    projectile.root.position.set(startX, startY, startZ);
    projectile.root.rotation.set(0, Math.atan2(projectile.vx, projectile.vz), 0);
    projectile.root.visible = true;
    for (const key of Object.keys(projectile.variants)) projectile.variants[key].visible = key === weapon.projectile;
    if (weapon.projectile === "bomb") this.effects.play("flame", startX, startY + 0.2, startZ, "#f3a751", 0.4);
    this._refreshWeaponHud();
  }

  _acquireProjectile() {
    for (let attempt = 0; attempt < this.projectiles.length; attempt++) {
      const index = (this._cursor + attempt) % this.projectiles.length;
      if (!this.projectiles[index].active) {
        this._cursor = (index + 1) % this.projectiles.length;
        return this.projectiles[index];
      }
    }
    const projectile = this.projectiles[this._cursor];
    this._cursor = (this._cursor + 1) % this.projectiles.length;
    return projectile;
  }

  _updateProjectiles(dt) {
    for (let i = 0; i < this.projectiles.length; i++) {
      const projectile = this.projectiles[i];
      if (!projectile.active) continue;
      projectile.life -= dt;
      if (projectile.type === "bomb") {
        this._updateBomb(projectile, dt);
        continue;
      }
      if (projectile.type === "oil") {
        this._updateOil(projectile, dt);
        continue;
      }
      if (projectile.stuck) {
        if (projectile.life <= 0) this._deactivate(projectile);
        continue;
      }
      if (projectile.life <= 0) {
        this._deactivate(projectile);
        continue;
      }

      const speed = Math.hypot(projectile.vx, projectile.vy, projectile.vz);
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.4));
      const sub = dt / steps;
      let ended = false;
      for (let step = 0; step < steps && !ended; step++) {
        const prevX = projectile.x;
        const prevY = projectile.y;
        const prevZ = projectile.z;
        projectile.vy -= projectile.gravity * sub;
        projectile.x += projectile.vx * sub;
        projectile.y += projectile.vy * sub;
        projectile.z += projectile.vz * sub;
        ended = this._projectileHit(projectile, prevX, prevY, prevZ);
      }
      if (ended) continue;
      projectile.root.position.set(projectile.x, projectile.y, projectile.z);
      projectile.root.rotation.set(-Math.atan2(projectile.vy, Math.hypot(projectile.vx, projectile.vz)), Math.atan2(projectile.vx, projectile.vz), 0);
    }
  }

  // Retorna true quando o projétil terminou nesta posição.
  _projectileHit(projectile, prevX, prevY, prevZ) {
    const npcs = this.npcs.queryNearby
      ? this.npcs.queryNearby(projectile.x, projectile.z, 2.5, this._nearbyNPCs)
      : this.npcs.npcs;
    for (let n = 0; n < npcs.length; n++) {
      const npc = npcs[n];
      if (!npc.alive || !npc.root.visible || (npc.controlled && this.player.mounted === npc)) continue;
      const zone = segmentHit(npc, prevX, prevY, prevZ, projectile.x, projectile.y, projectile.z, 0.06);
      if (!zone) continue;
      const headshot = zone === "head";
      const amount = headshot ? projectile.damage * 2 : projectile.damage;
      const speed = Math.max(0.001, Math.hypot(projectile.vx, projectile.vz));
      const force = projectile.type === "bolt" ? 3.4 : 2.6;
      this.combat.damageNPC(npc, amount, projectile.vx / speed, projectile.vz / speed, projectile.color, headshot ? 1.3 : 1.05, force, 0, headshot);
      this.effects.play("star", projectile.x, projectile.y, projectile.z, projectile.color, 0.85);
      this._deactivate(projectile);
      return true;
    }

    if (this.combat?.farmAnimals) {
      const animals = this.combat.farmAnimals.getNearbyAnimals(projectile.x, projectile.z, 1.2, this._nearbyNPCs);
      for (let a = 0; a < animals.length; a++) {
        const animal = animals[a];
        if (!animal.active || animal.state === "dead") continue;
        const killed = animal.takeDamage(projectile.damage, this.player);
        this.effects.play("star", projectile.x, projectile.y, projectile.z, projectile.color, 0.85);
        this.audio.hit(killed);
        this._deactivate(projectile);
        return true;
      }
    }

    this.houses?.hitAt(projectile.x, projectile.y, projectile.z, 0.12, projectile.damage);
    const ground = this.world.heightAt(projectile.x, projectile.z);
    const hitGround = projectile.y <= ground + 0.05;
    if (hitGround || this.world.isBlockedAtHeight(projectile.x, projectile.y, projectile.z, 0.06)) {
      this.effects.play("star", projectile.x, Math.max(projectile.y, ground + 0.3), projectile.z, projectile.color, 0.5);
      // Flechas, virotes e facas ficam cravados por alguns segundos.
      projectile.stuck = true;
      projectile.life = 5;
      if (hitGround) projectile.y = ground + 0.05;
      projectile.root.position.set(projectile.x, projectile.y, projectile.z);
      return true;
    }
    if (projectile.life <= 0) {
      this._deactivate(projectile);
      return true;
    }
    return false;
  }

  _updateBomb(projectile, dt) {
    projectile.fuse -= dt;
    projectile.fuseFx -= dt;
    if (projectile.fuseFx <= 0) {
      projectile.fuseFx = 0.05 + Math.max(0, projectile.fuse) * 0.1;
      this.effects.play("flame", projectile.x, projectile.y + 0.24, projectile.z, "#f39b48", 0.3);
    }

    projectile.vy -= projectile.gravity * dt;
    const nextX = projectile.x + projectile.vx * dt;
    const nextZ = projectile.z + projectile.vz * dt;
    const nextY = projectile.y + projectile.vy * dt;
    if (this.world.isBlockedAtHeight(nextX, projectile.y, projectile.z, 0.2)) projectile.vx *= -0.4;
    else projectile.x = nextX;
    if (this.world.isBlockedAtHeight(projectile.x, projectile.y, nextZ, 0.2)) projectile.vz *= -0.4;
    else projectile.z = nextZ;
    projectile.y = nextY;

    const ground = this.world.heightAt(projectile.x, projectile.z) + 0.19;
    if (projectile.y <= ground) {
      projectile.y = ground;
      if (projectile.vy < -1.4) {
        projectile.vy = -projectile.vy * 0.42;
        projectile.vx *= 0.62;
        projectile.vz *= 0.62;
        this.effects.play("smoke", projectile.x, ground + 0.1, projectile.z, "#cdbb97", 0.5);
      } else {
        projectile.vy = 0;
        const friction = Math.exp(-5 * dt);
        projectile.vx *= friction;
        projectile.vz *= friction;
      }
    }
    projectile.spin += dt * Math.hypot(projectile.vx, projectile.vz) * 1.6;
    projectile.root.position.set(projectile.x, projectile.y, projectile.z);
    projectile.root.rotation.set(projectile.spin, Math.atan2(projectile.vx, projectile.vz), 0);

    if (projectile.fuse <= 0) this._detonate(projectile);
  }

  // Pote de óleo: quebra no primeiro contato e deixa uma poça em chamas.
  _updateOil(projectile, dt) {
    projectile.vy -= projectile.gravity * dt;
    const px = projectile.x;
    const py = projectile.y;
    const pz = projectile.z;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.z += projectile.vz * dt;
    projectile.spin += dt * 9;
    projectile.root.position.set(projectile.x, projectile.y, projectile.z);
    projectile.root.rotation.set(projectile.spin, projectile.spin * 0.6, 0);
    projectile.life -= dt;

    let hit = false;
    const ground = this.world.heightAt(projectile.x, projectile.z);
    if (projectile.y <= ground + 0.15 || this.world.isBlockedAtHeight(projectile.x, projectile.y, projectile.z, 0.18) || projectile.life <= 0) hit = true;
    if (!hit) {
      const candidates = this.npcs.queryNearby
        ? this.npcs.queryNearby(projectile.x, projectile.z, 2.5, this._nearbyNPCs)
        : this.npcs.npcs;
      for (const npc of candidates) {
        if (!npc.alive || !npc.root.visible || (npc.controlled && this.player.mounted === npc)) continue;
        if (segmentHit(npc, px, py, pz, projectile.x, projectile.y, projectile.z, 0.15)) {
          hit = true;
          break;
        }
      }
    }
    if (!hit) return;
    const y = Math.max(ground, projectile.y);
    this.effects.play("smoke", projectile.x, y + 0.3, projectile.z, "#cdbb97", 1.2);
    this.effects.play("flame", projectile.x, y + 0.4, projectile.z, "#ff9a3a", 1.3);
    this.audio.glass();
    this.fire?.addPatch(projectile.x, projectile.z, projectile.radius || 2.8, 9);
    this.horses?.scare(projectile.x, projectile.z, 14);
    this._deactivate(projectile);
  }

  _detonate(projectile) {
    const { x, y, z, radius } = projectile;
    this.explosions.trigger(x, y, z, radius);
    this.horses?.scare(x, z, 34);
    this.houses?.hitAt(x, y, z, radius * 0.8, 3);
    this.audio.explosion(Math.hypot(x - this.player.x, z - this.player.z));

    let kills = 0;
    const npcs = this.npcs.queryNearby
      ? this.npcs.queryNearby(x, z, radius + 0.5, this._nearbyNPCs)
      : this.npcs.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      if (!npc.alive || (npc.controlled && this.player.mounted === npc)) continue;
      const dx = npc.x - x;
      const dz = npc.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance > radius) continue;
      const falloff = 1 - distance / radius;
      const inverse = 1 / Math.max(0.001, distance);
      const damage = Math.max(1, Math.ceil(projectile.damage * falloff));
      const dirX = distance < 0.05 ? Math.random() - 0.5 : dx * inverse;
      const dirZ = distance < 0.05 ? Math.random() - 0.5 : dz * inverse;
      if (this.combat.damageNPC(npc, damage, dirX, dirZ, "#f1ad5b", 1.15, 6 + 16 * falloff, 1 + 2.6 * falloff, false, true)) kills++;
    }

    // O estouro também empurra o jogador que estiver perto.
    const dx = this.player.x - x;
    const dz = this.player.z - z;
    const distance = Math.hypot(dx, dz);
    if (distance < radius * 1.1 && !this.player.knockedOut) {
      const falloff = 1 - distance / (radius * 1.1);
      const inverse = 1 / Math.max(0.001, distance);
      this.player.vx += dx * inverse * 9 * falloff;
      this.player.vz += dz * inverse * 9 * falloff;
      if (falloff > 0.45 && this.player.grounded) {
        this.player.verticalSpeed = 4.5 * falloff;
        this.player.grounded = false;
      }
    }

    // bomba incendiária: o estouro deixa chamas no chão e acende o que for inflamável
    if (this.fire) {
      this.fire.addPatch(x, z, 2.2, 6);
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        this.fire.addPatch(x + Math.cos(angle) * radius * 0.45, z + Math.sin(angle) * radius * 0.45, 1.5, 5);
      }
      this.fire.igniteNear(x, z, radius * 0.7);
    }

    this.ui.showToast(kills > 0 ? `Bomba detonada · ${kills} derrotado${kills > 1 ? "s" : ""}` : "Bomba detonada");
    this._deactivate(projectile);
  }

  _deactivate(projectile) {
    projectile.active = false;
    projectile.stuck = false;
    projectile.root.visible = false;
  }
}
