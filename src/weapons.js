import * as THREE from "three";
import { makeSkinnedMaterial } from "./skins.js";
import { segmentHit } from "./hitboxes.js";
import { WEAPON_LIST, WEAPONS_BY_ID, SLOTS, STARTER_WEAPONS, AMMO_LABELS, AMMO_SHOP, buildWeaponModel } from "./weapondata.js";
import {
  PlayerEquipment,
  PlayerInventory,
  BUILD_COSTS,
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
    this.currentId = "fists";
    this.slot = 0;
    this.lastInSlot = {};
    this.cooldown = 0;
    this.buffered = 0;
    this.charging = false;
    this.chargeTime = 0;
    this.buildMode = false;
    this.selectedBuildType = "HOUSE";
    this.ammo = { bolts: 8, arrows: 12, bombs: 3, knives: 0, oil: 0 };
    this.projectiles = [];
    this._cursor = 0;
    this.firePool = createFirePool(scene);
    this.playerBuildingsPool = createPlayerBuildingsPool(scene, world);
    this._createWeaponModels();
    this._createProjectilePool(24);
    this._createTrajectoryDots(scene);
    this._createThrownSpear(scene);
    this._createMusketTracer(scene);
    this._nearbyNPCs = [];
    this.equip("fists", false);
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
    this.models.shortsword = this.player.sword;

    const crossbow = (scale) => {
      const g = new THREE.Group();
      g.position.set(0, 0.27 * scale, 0);
      g.scale.setScalar(scale);
      socket.add(g);
      addMesh(g, new THREE.BoxGeometry(0.16, 0.78, 0.17), wood, 0, 0.15, 0);
      addMesh(g, new THREE.BoxGeometry(0.96, 0.095, 0.14), iron, 0, 0.57, 0);
      addMesh(g, new THREE.BoxGeometry(0.78, 0.035, 0.04), brass, 0, 0.54, 0.08);
      addMesh(g, new THREE.BoxGeometry(0.15, 0.32, 0.14), darkWood, 0, -0.27, 0.03);
      return g;
    };
    this.models.lightcrossbow = crossbow(1);
    this.models.heavycrossbow = crossbow(1.22);
    addMesh(this.models.heavycrossbow, new THREE.BoxGeometry(1.1, 0.06, 0.18), brass, 0, 0.5, 0);

    const bow = (scale) => {
      const g = new THREE.Group();
      g.rotation.y = -Math.PI / 2;
      g.scale.setScalar(scale);
      socket.add(g);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.55, 0), new THREE.Vector3(0.3, -0.32, 0),
        new THREE.Vector3(0.42, 0.05, 0), new THREE.Vector3(0.3, 0.42, 0),
        new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(-0.3, 0.42, 0),
        new THREE.Vector3(-0.42, 0.05, 0), new THREE.Vector3(-0.3, -0.32, 0),
        new THREE.Vector3(0, -0.55, 0),
      ]);
      addMesh(g, new THREE.TubeGeometry(curve, 20, 0.055, 5, false), wood, 0, 0, 0);
      const stringGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.55, 0.035), new THREE.Vector3(0, 0.62, 0.035)]);
      g.add(new THREE.Line(stringGeometry, new THREE.LineBasicMaterial({ color: "#d5c8a5" })));
      return g;
    };
    this.models.shortbow = bow(1);
    this.models.longbow = bow(1.3);

    const bomb = new THREE.Group();
    bomb.position.set(0, -0.1, 0);
    socket.add(bomb);
    addMesh(bomb, new THREE.IcosahedronGeometry(0.27, 1), darkWood, 0, 0.12, 0);
    addMesh(bomb, new THREE.CylinderGeometry(0.045, 0.055, 0.2, 5), cloth, 0, 0.43, 0);
    addMesh(bomb, new THREE.SphereGeometry(0.055, 5, 4), brass, 0, 0.55, 0);
    this.models.firebomb = bomb;

    // armas de corte, contusão e haste: construídas em weapondata.js
    for (const def of WEAPON_LIST) {
      if (this.models[def.id] || def.type === "fists") continue;
      const model = buildWeaponModel(def.id);
      if (!model) continue;
      if (def.id === "oilpot") model.position.set(0, -0.1, 0);
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
      const arrow = new THREE.Group();
      const arrowShaft = addMesh(arrow, shaftGeometry, arrowWood, 0, 0, 0);
      arrowShaft.rotation.x = Math.PI / 2;
      const arrowTip = addMesh(arrow, arrowTipGeometry, brass, 0, 0, 0.48);
      arrowTip.rotation.x = Math.PI / 2;
      const feathers = addMesh(arrow, featherGeometry, cloth, 0, 0, -0.34);
      feathers.rotation.z = 0.28;
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
    if (selection > 0) {
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
    if (wheel !== 0) {
      if (this.buildMode) {
        const types = [...Object.keys(BUILD_COSTS), "PLACE_ITEM"];
        const curIdx = types.indexOf(this.selectedBuildType || "HOUSE");
        this.selectedBuildType = types[(curIdx + (wheel > 0 ? 1 : types.length - 1)) % types.length];
        this._announceBuildMode();
      } else {
        this.cycle(wheel);
      }
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
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
      } else {
        this.torchLight.intensity = 0;
      }
    }

    if (this.buildMode) {
      this._cancelCharge();
      updateBuildPreview(
        this.player.root.position,
        this.player.model?.rotation?.y ?? 0,
        true,
        this.selectedBuildType || "HOUSE",
      );
      if ((this.input.consumeAttackPressed() || this.input.consumeInteractPressed?.()) && !dead) {
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
    );
  }

  closeBuildHub() {
    this.buildHubOpen = false;
    this.buildMode = false;
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
    this.input.setModalOpen(false);
    updateBuildPreview(this.player.root.position, 0, false);
    this.ui.showToast("Modo Construção encerrado.");
    this._refreshWeaponHud();
  }

  startBuildMode(type = "HOUSE") {
    this.buildHubOpen = false;
    this.buildMode = true;
    this.selectedBuildType = type;
    this.input.setModalOpen(false);
    this._announceBuildMode();
    try {
      this.input.canvas?.requestPointerLock?.();
    } catch (_) {}
  }

  _announceBuildMode() {
    const type = this.selectedBuildType || "HOUSE";
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
    if (cost.hay) parts.push(`${cost.hay} Feno`);
    const costStr = parts.join(", ");

    const label = `${(cost.label || type).toLocaleUpperCase("pt-BR")} (${costStr})`;
    this.ui.setWeapon("MODO CONSTRUÇÃO (C)", label);
    this.ui.showToast(`Construir: ${cost.label || type} · [Clique/E] Erguer · [C] Abrir Catálogo · [Roda] Trocar`);
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
        })
      );
      flameSprite.scale.set(0.38, 0.52, 1);
      flameSprite.position.y = 0.32;

      const candleLight = new THREE.PointLight(0xffb866, 2.8, 16, 1.8);
      candleLight.position.set(0, 0.35, 0);

      candleGroup.add(wax, wick, flameSprite, candleLight);
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
      let placed;
      if (isNearWall) {
        placed = torchSys?.addTorch?.(targetX, py + 0.3, targetZ, -forwardX, -forwardZ, false);
      } else {
        placed = torchSys?.addTorch?.(targetX, ground + 1.6, targetZ, 0, 0, true);
      }
      this.effects.play("star", targetX, py, targetZ, "#ffa834", 1.2);
      this.audio.weaponSwing?.("chop", false);
      this.ui.showToast("Tocha fixada! Pressione E para recolher.");

      if (def.id === "torch") {
        this.unlock("torch", false);
        this.selectSlot(1);
      } else if (PlayerInventory.torches > 0) {
        PlayerInventory.torches--;
      }

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
          if (item.torchSource?.group) item.torchSource.group.parent?.remove(item.torchSource.group);
          if (item.torchSource?.sprite) item.torchSource.sprite.parent?.remove(item.torchSource.sprite);
          this.unlock("torch", false);
          this.equip("torch", false);
          this.ui.showToast("Tocha recolhida de volta ao inventário!");
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
    const built = buildStructure(
      this.player.root.position,
      this.player.model.rotation,
      type,
      this.playerBuildingsPool,
    );
    if (built) {
      this.ui.showToast(`✦ ${cost.label || type} erguido com sucesso no reino!`);
      this._announceBuildMode();
    } else {
      const parts = [];
      if (cost.wood) parts.push(`${cost.wood} Madeira (tens ${PlayerInventory.wood})`);
      if (cost.stone) parts.push(`${cost.stone} Pedra (tens ${PlayerInventory.stone})`);
      if (cost.hay) parts.push(`${cost.hay} Feno (tens ${PlayerInventory.hay})`);
      this.ui.showToast(`Recursos insuficientes! Precisas de: ${parts.join(" · ")}`);
    }
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
      this._consumeDurability(def);
      if (def.id === "torch") {
        this._igniteWithTorch(cameraYaw);
      } else if (def.toolType === "AXE" || def.toolType === "PICKAXE") {
        gatherResource(this.player, def.toolType, this.world.environmentInstancedMeshes);
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
      if (!npc.alive || npc.controlled) continue;
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
      if (!npc.alive || !npc.root.visible || npc.controlled) continue;
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
      if (!npc.alive || !npc.root.visible || npc.controlled) continue;
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

  // Equipa uma arma pelo id.
  equip(id, announce = true) {
    const def = WEAPONS_BY_ID[id];
    if (!def || !this.owned.has(id)) return false;
    this._cancelCharge();
    this.currentId = id;
    this.slot = def.slot - 1;
    this.lastInSlot[this.slot] = id;
    for (const [key, model] of Object.entries(this.models)) {
      if (key === "spear" && model.userData?.isThrown) {
        model.visible = false;
      } else {
        model.visible = key === id;
      }
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
    this.cooldown = Math.max(this.cooldown, 0.18);
    this._refreshWeaponHud();
    if (announce) this.ui.showToast(`${def.name}${def.hands === 2 ? " · duas mãos" : ""}`);
    return true;
  }

  // Teclas 1-9: escolhe o slot; apertar de novo alterna entre as armas dele (estilo GTA).
  selectSlot(number) {
    const index = number - 1;
    const owned = SLOTS[index].filter((id) => this.owned.has(id));
    if (owned.length === 0) {
      this.ui.showToast(`Nenhuma arma no slot ${number}`);
      return;
    }
    let id;
    if (this.slot === index && owned.length > 1) id = owned[(owned.indexOf(this.currentId) + 1) % owned.length];
    else id = owned.includes(this.lastInSlot[index]) ? this.lastInSlot[index] : owned[0];
    this.equip(id);
  }

  // Roda do mouse: percorre todas as armas que você tem.
  cycle(step) {
    const order = WEAPON_LIST.filter((w) => this.owned.has(w.id)).map((w) => w.id);
    if (order.length < 2) return;
    const next = (order.indexOf(this.currentId) + step + order.length) % order.length;
    this.equip(order[next]);
  }

  unlock(id, quiet = false) {
    const def = WEAPONS_BY_ID[id];
    if (!def || this.owned.has(id)) return false;
    this.owned.add(id);
    this._refreshWeaponHud();
    if (!quiet) this.ui.showToast(`Nova arma: ${def.name} (slot ${def.slot})`);
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
    const entries = SLOTS.map((ids, index) => {
      const owned = ids.filter((id) => this.owned.has(id));
      const shown = owned.includes(this.lastInSlot[index]) ? this.lastInSlot[index] : owned[0] || null;
      const shownDef = shown ? WEAPONS_BY_ID[shown] : null;
      return {
        id: shown,
        name: shownDef ? shownDef.name : "",
        count: owned.length,
        ammo: shownDef ? (shownDef.ammo ? String(this.ammo[shownDef.ammo]) : "∞") : "",
        empty: shownDef ? Boolean(shownDef.ammo) && this.ammo[shownDef.ammo] <= 0 : true,
      };
    });
    this.ui.setHotbar(this.slot, entries);
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
    else this.audio.weaponSwing("stab", false);
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
      if (!npc.alive || !npc.root.visible || npc.controlled) continue;
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
        if (!npc.alive || !npc.root.visible || npc.controlled) continue;
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
      if (!npc.alive || npc.controlled) continue;
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
