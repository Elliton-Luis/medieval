import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeSkinnedMaterial } from "./skins.js";
import { buildPlayerArmor, mailTexture } from "./armorKit.js";
import { buildHumanoid, bendJoints, addBeard, addVikingHair, addTiredEyes, createPoseState, smoothPose } from "./humanoid.js";
import { PlayerStats } from "./rpg.js";

const ROLL_DURATION = 0.55;
const ROLL_SPEED = 9.5;
const LAND_TIME = 0.24;

// Vetores e estruturas auxiliares pré-alocados no escopo do módulo (Zero-GC no loop de jogo)
const _v1 = new THREE.Vector3();
const _moveResult = { x: 0, z: 0, hitX: false, hitZ: false };
const _qChain = new THREE.Quaternion();
const _qGuard = new THREE.Quaternion();
// Escudo em repouso: a face aponta para fora do antebraço (-X), como um escudo preso no braço esquerdo
const _qShieldRest = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);

function makePart(geometry, material, parent, x, y, z, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

// Reflexo "pre-baked" da armadura templária: faixas diagonais de brilho + pontos especulares pintados num canvas e
// usados como emissiveMap. Não depende de luz nem de env map: a placa sempre "brilha" sem custo extra de render.
let _templarSheen = null;
function templarSheenTexture() {
  if (_templarSheen) return _templarSheen;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 128, 128);
  const streaks = [[-20, 26, 0.55], [30, 12, 0.35], [70, 20, 0.5], [108, 8, 0.28]];
  for (const [x, w, a] of streaks) {
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, `rgba(255,235,230,${a})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.save();
    g.translate(64, 64);
    g.rotate(-0.5);
    g.translate(-64, -64);
    g.fillStyle = grad;
    g.fillRect(x, -40, w, 210);
    g.restore();
  }
  g.fillStyle = "rgba(255,240,235,0.9)";
  for (const [x, y] of [[22, 30], [90, 44], [58, 96], [104, 110]]) {
    g.beginPath();
    g.arc(x, y, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  _templarSheen = new THREE.CanvasTexture(c);
  _templarSheen.colorSpace = THREE.SRGBColorSpace;
  _templarSheen.wrapS = THREE.RepeatWrapping;
  _templarSheen.wrapT = THREE.RepeatWrapping;
  return _templarSheen;
}

function templarMaterial(color, emissive, glow, metalness = 0.8, roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true, emissive, emissiveMap: templarSheen(), emissiveIntensity: glow });
}
const templarSheen = templarSheenTexture;

export class Player {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.root.add(this.model);
    this.userData = this.root.userData;
    this.userData.isRiding = false;
    this.userData.mount = null;
    this.userData.state = "IDLE";
    this.position = this.root.position;
    this.children = this.model.children;
    this.x = CONFIG.player.startX;
    this.z = CONFIG.player.startZ;
    this.verticalOffset = 0;
    this.verticalSpeed = 0;
    this.vx = 0;
    this.vz = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.moveX = 0;
    this.moveZ = 0;
    this.speedRatio = 0;
    this.health = 5;
    this.maxHealth = 5;
    this.coins = 0;
    this.potions = 1;
    this.armorLevel = 0;
    this.attackTimer = 0;
    this.attackKind = 0;
    this.faceTimer = 0;
    this.faceYaw = 0;
    this.firePoseTimer = 0;
    this.aimPose = 0;
    this.aimStyle = "melee";
    this.weaponId = "fists";
    this.weaponGrip = "none";
    this.twoHanded = false;
    this.weaponWeight = 1;
    this.canBlock = true;
    this.chargePose = 0;
    this.attackLen = 0.36;
    this.recoil = 0;
    this.knockedOut = false;
    this.rolling = false;
    this.rollTimer = 0;
    this.rollCooldown = 0;
    this.rollX = 0;
    this.rollZ = 0;
    this.jumpBuffer = 0;
    this.landTimer = 0;
    this.dustTimer = 0;
    this.idleTime = 0;
    this.mounted = null;
    this.crouching = false;
    this.sitting = false;
    this.praying = false;
    this.sittingInChurch = false;
    this.sitPose = 0;
    this.prayPose = 0;
    this.seatYaw = 0;
    this.prayHealTimer = 0;
    this.invuln = 3.0; // Proteção contra dano inicial nos primeiros segundos
    this.staggerTimer = 0;
    this.crouchPose = 0;
    this.hitHeight = 1.85;
    this.stamina = 100;
    this.inHouse = null;
    this.dead = false;
    this.deathTime = 0;
    this.deathSide = 1;
    this.effects = null;
    this.audio = null;
    this._stepIndex = 0;
    this.radius = CONFIG.player.radius;
    this._move = { x: 0, z: 0, run: false };

    const cloth = makeSkinnedMaterial("fabric", "#455b50", 0, 0.92);
    const pants = makeSkinnedMaterial("fabric", "#3a3a36", 0, 0.95);
    const leather = makeSkinnedMaterial("leather", "#513b2b", 0, 1);
    const steel = makeSkinnedMaterial("metal", "#9a9b8d", 0.42, 0.54);
    const darkSteel = makeSkinnedMaterial("metal", "#626c68", 0.35, 0.64);
    const brightSteel = makeSkinnedMaterial("metal", "#c0c2b5", 0.58, 0.42);
    const heraldry = makeSkinnedMaterial("fabric", "#8b3d35", 0, 0.9);
    const skin = makeSkinnedMaterial("skin", "#c28e68", 0, 1);
    const hair = makeSkinnedMaterial("leather", "#3a281c", 0, 1);
    const gold = makeSkinnedMaterial("metal", "#b99352", 0.55, 0.5);
    // Paleta Templária: quase preto puxado para o vermelho-sangue, com brilho pre-baked e cruz vermelha de borda branca
    const tplPlate = templarMaterial("#1c080b", "#4a1016", 0.6);
    const tplDark = templarMaterial("#120507", "#2e0a0f", 0.45);
    const tplTrim = templarMaterial("#3b0f15", "#6a1a22", 0.75, 0.88, 0.24);
    const tplRed = new THREE.MeshStandardMaterial({ color: "#b3111b", roughness: 0.5, metalness: 0.2, flatShading: true, emissive: "#46040b", emissiveIntensity: 0.55 });
    const tplWhite = new THREE.MeshStandardMaterial({ color: "#f3eee4", roughness: 0.55, metalness: 0.1, flatShading: true, emissive: "#3a3836", emissiveIntensity: 0.3 });
    const tplCloth = new THREE.MeshStandardMaterial({ color: "#17060a", roughness: 0.85, metalness: 0.05, flatShading: true });
    this._tplMats = { heraldry, tplCloth };

    const body = buildHumanoid(this.model, {
      skin,
      shirt: cloth,
      sleeve: cloth,
      pants,
      boots: leather,
      hair,
      forearm: darkSteel,
    });
    Object.assign(this, body);
    this._pose = createPoseState();
    // Barba cheia (escura, igual ao cabelo)
    addBeard(this.head, hair, "viking");
    addVikingHair(this.head, hair);
    addTiredEyes(this.head, skin, hair);

    // Armadura do Jogador: peças detalhadas e mescladas (armorKit.js). Materiais do kit: com cor por vértice (oclusão falsa)
    const kitMat = (mat) => {
      const c = mat.clone();
      c.vertexColors = true;
      return c;
    };
    const mailTex = mailTexture();
    mailTex.repeat.set(3, 2);
    const kitMats = {
      cloth: kitMat(cloth),
      leather: kitMat(makeSkinnedMaterial("leather", "#ffffff", 0, 0.95)),
      gold: kitMat(makeSkinnedMaterial("metal", "#ffffff", 0.55, 0.45)),
      mail: new THREE.MeshStandardMaterial({ map: mailTex, color: "#ffffff", vertexColors: true, metalness: 0.5, roughness: 0.6, flatShading: true }),
      tplPlate: kitMat(tplPlate),
      tplDark: kitMat(tplDark),
      tplTrim: kitMat(tplTrim),
      tplRed: kitMat(tplRed),
      tplWhite: kitMat(tplWhite),
      tplCloth: kitMat(tplCloth),
    };
    const armor = buildPlayerArmor(kitMats, {
      model: this.model,
      head: this.head,
      leftArm: this.leftArm,
      rightArm: this.rightArm,
      leftForearm: this.leftForearm,
      rightForearm: this.rightForearm,
      leftLeg: this.leftLeg,
      rightLeg: this.rightLeg,
      leftKnee: this.leftKnee,
      rightKnee: this.rightKnee,
    });
    this.chestArmor = armor.chestArmor;
    this.armorPieces = armor.armorPieces;
    this.setArmorVisuals(0); // Inicia como Camponês (apenas túnica)

    // Escudo preso ao antebraço esquerdo. `shieldAnchor` fica no meio do antebraço e a face do escudo
    // é deslocada ao longo da própria normal (+Z local), então o braço/mão ficam ATRÁS do escudo
    // (alça) e nunca o atravessam. Em repouso a face aponta para fora; na guarda, `_updateShield`
    // gira o conjunto para a face ficar voltada para a frente.
    this.shield = new THREE.Group();
    this.shield.position.set(0, -0.15, 0);
    this.shield.quaternion.copy(_qShieldRest);
    this.leftForearm.add(this.shield);
    const SHIELD_OFFSET = 0.085; // distância da face ao eixo do antebraço (> raio do antebraço + metade da espessura)
    const shieldBody = makePart(new THREE.CylinderGeometry(0.22, 0.2, 0.045, 14), leather, this.shield, 0, 0, SHIELD_OFFSET);
    shieldBody.rotation.x = Math.PI / 2;
    shieldBody.scale.set(0.9, 1, 1.2);
    const shieldFace = makePart(new THREE.CylinderGeometry(0.19, 0.17, 0.02, 14), heraldry, this.shield, 0, 0, SHIELD_OFFSET + 0.03, false);
    this._shieldFace = shieldFace;
    shieldFace.rotation.x = Math.PI / 2;
    shieldFace.scale.set(0.9, 1, 1.2);
    const shieldRim = makePart(new THREE.TorusGeometry(0.2, 0.012, 5, 18), darkSteel, this.shield, 0, 0, SHIELD_OFFSET + 0.02, false);
    shieldRim.scale.set(0.9, 1.2, 1);
    makePart(new THREE.SphereGeometry(0.045, 8, 6), gold, this.shield, 0, 0, SHIELD_OFFSET + 0.05, false);
    const shieldGoldBar = makePart(new THREE.BoxGeometry(0.028, 0.4, 0.01), gold, this.shield, 0, 0, SHIELD_OFFSET + 0.042, false);
    // Escudo templário: cruz vermelha com bordas brancas sobre campo quase preto (só com armadura de placas)
    this._shieldPlain = [shieldGoldBar];
    this._shieldTemplar = [
      makePart(new THREE.BoxGeometry(0.12, 0.44, 0.012), tplWhite, this.shield, 0, 0, SHIELD_OFFSET + 0.043, false),
      makePart(new THREE.BoxGeometry(0.34, 0.12, 0.012), tplWhite, this.shield, 0, 0.04, SHIELD_OFFSET + 0.043, false),
      makePart(new THREE.BoxGeometry(0.07, 0.4, 0.016), tplRed, this.shield, 0, 0, SHIELD_OFFSET + 0.048, false),
      makePart(new THREE.BoxGeometry(0.3, 0.07, 0.016), tplRed, this.shield, 0, 0.04, SHIELD_OFFSET + 0.048, false),
    ];
    this._shieldRim = shieldRim;
    this._shieldRimMats = [darkSteel, tplTrim];
    for (const m of this._shieldTemplar) m.visible = false;
    // Alças atrás do escudo, abraçando o antebraço
    makePart(new THREE.BoxGeometry(0.02, 0.025, 0.07), leather, this.shield, 0, 0.1, SHIELD_OFFSET - 0.05, false);
    makePart(new THREE.BoxGeometry(0.02, 0.025, 0.07), leather, this.shield, 0, -0.08, SHIELD_OFFSET - 0.05, false);
    this.blocking = false;
    this.blockLocked = false;
    this.blockPose = 0;

    // manto: trapézio que se alarga na barra (mais natural que um retângulo)
    const cape = makePart(new THREE.CylinderGeometry(0.255, 0.33, 0.86, 4).rotateY(Math.PI / 4).scale(1, 1, 0.085), leather, this.model, 0, 1.06, -0.18, false);
    cape.rotation.x = -0.08;
    this.cape = cape;

    // Encaixe na mão direita: as armas ficam seguras pela mão, para fora do corpo.
    this.handSocket = new THREE.Group();
    this.handSocket.position.set(0, -0.27, 0.02);
    this.rightForearm.add(this.handSocket);
    this.sword = new THREE.Group();
    this.handSocket.add(this.sword);
    makePart(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6), leather, this.sword, 0, 0.02, 0, false);
    makePart(new THREE.BoxGeometry(0.3, 0.05, 0.07), gold, this.sword, 0, 0.14, 0, false);
    makePart(new THREE.BoxGeometry(0.075, 0.78, 0.028), brightSteel, this.sword, 0, 0.55, 0, false);
    makePart(new THREE.ConeGeometry(0.0525, 0.18, 4), brightSteel, this.sword, 0, 1.03, 0, false);
    makePart(new THREE.SphereGeometry(0.04, 6, 5), gold, this.sword, 0, -0.1, 0, false);

    // ========================================================================
    // Vestimenta Imponente do Demiurgo (Manto Negro, Capa Roxa/Vermelha e Máscara)
    // ========================================================================
    this.demiurgeGroup = new THREE.Group();
    this.demiurgeGroup.name = "DemiurgeAttireGroup";
    this.model.add(this.demiurgeGroup);

    // Paleta Sombria Nobre e Oculta (Estilo Baile Eyes Wide Shut)
    const matBlackRobe = new THREE.MeshStandardMaterial({
      color: 0x07050a,
      roughness: 0.88,
      metalness: 0.12,
      flatShading: true,
    });
    const matPurpleCloak = new THREE.MeshStandardMaterial({
      color: 0x240838,
      roughness: 0.72,
      metalness: 0.2,
      flatShading: true,
    });
    const matCrimsonTrim = new THREE.MeshStandardMaterial({
      color: 0x6e0d19,
      roughness: 0.65,
      metalness: 0.22,
      flatShading: true,
    });
    const matAntiqueGold = new THREE.MeshStandardMaterial({
      color: 0xc8982a,
      emissive: 0x664408,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.82,
      flatShading: true,
    });
    const matVenetianPorcelain = new THREE.MeshStandardMaterial({
      color: 0xf2ece4,
      roughness: 0.28,
      metalness: 0.15,
      flatShading: true,
    });
    const matVoidBlack = new THREE.MeshBasicMaterial({
      color: 0x000000,
    });
    const matWhiteEyeDot = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    // 1. Túnica Sacerdotal Longa e Reta de Veludo Obsidiana (Sem cantos redondos)
    const dRobe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.44, 1.45, 8), matBlackRobe);
    dRobe.position.set(0, 0.85, 0.02);
    this.demiurgeGroup.add(dRobe);

    // Estola central de seda carmesim com bordas em folha de ouro
    const dTrimCenter = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.42, 0.03), matCrimsonTrim);
    dTrimCenter.position.set(0, 0.85, 0.23);
    dTrimCenter.rotation.x = -0.04;
    this.demiurgeGroup.add(dTrimCenter);

    for (const sx of [-0.075, 0.075]) {
      const dGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.015, 1.42, 0.033), matAntiqueGold);
      dGoldTrim.position.set(sx, 0.85, 0.231);
      dGoldTrim.rotation.x = -0.04;
      this.demiurgeGroup.add(dGoldTrim);
    }

    // 2. Capa Cerimonial Roxa Imperial Estruturada com Forro de Seda Carmesim
    const dCapeOuter = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.25, 0.045), matPurpleCloak);
    dCapeOuter.position.set(0, 1.05, -0.21);
    dCapeOuter.rotation.x = -0.06;
    this.demiurgeGroup.add(dCapeOuter);

    const dCapeInner = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.22, 0.02), matCrimsonTrim);
    dCapeInner.position.set(0, 1.05, -0.19);
    dCapeInner.rotation.x = -0.06;
    this.demiurgeGroup.add(dCapeInner);

    // Ombreiras de alfaiataria nobre e rígidas (ombros retos e cerimoniais)
    for (const side of [-1, 1]) {
      const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.34), matPurpleCloak);
      epaulet.position.set(side * 0.32, 1.50, -0.01);
      epaulet.rotation.z = -side * 0.12;
      this.demiurgeGroup.add(epaulet);

      const epauletGold = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.345), matAntiqueGold);
      epauletGold.position.set(side * 0.41, 1.50, -0.01);
      epauletGold.rotation.z = -side * 0.12;
      this.demiurgeGroup.add(epauletGold);
    }

    // Gola alta rígida cerimonial cobrindo o pescoço
    const collarBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.30, 0.035), matPurpleCloak);
    collarBack.position.set(0, 1.66, -0.14);
    collarBack.rotation.x = 0.12;
    this.demiurgeGroup.add(collarBack);

    for (const side of [-1, 1]) {
      const collarWing = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.20), matPurpleCloak);
      collarWing.position.set(side * 0.20, 1.66, -0.04);
      collarWing.rotation.z = -side * 0.12;
      this.demiurgeGroup.add(collarWing);
    }

    // 3. Capuz Místico Geométrico e Máscara Veneziana de Porcelana Oculta (Eyes Wide Shut)
    this.demiurgeHeadGroup = new THREE.Group();
    this.demiurgeHeadGroup.position.set(0, 0.05, 0);
    this.head.add(this.demiurgeHeadGroup);

    // Capuz Sombrio facetado e rígido (sem esferas redondas)
    const dHoodRoof = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.34), matPurpleCloak);
    dHoodRoof.position.set(0, 0.24, -0.02);
    this.demiurgeHeadGroup.add(dHoodRoof);

    const dHoodPeak = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 4), matPurpleCloak);
    dHoodPeak.position.set(0, 0.34, -0.08);
    dHoodPeak.rotation.x = -0.32;
    this.demiurgeHeadGroup.add(dHoodPeak);

    for (const side of [-1, 1]) {
      const dHoodSide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.30), matPurpleCloak);
      dHoodSide.position.set(side * 0.16, 0.10, -0.02);
      this.demiurgeHeadGroup.add(dHoodSide);
    }

    // Máscara Veneziana de Porcelana e Ouro (Estilo Bauta / Volto do baile de Eyes Wide Shut)
    const dMaskGroup = new THREE.Group();
    dMaskGroup.position.set(0, 0.06, 0.16);

    const dMaskFace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.05), matVenetianPorcelain);
    dMaskGroup.add(dMaskFace);

    // Queixo afiado e angular característico da Bauta veneziana
    const dMaskChin = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 4), matVenetianPorcelain);
    dMaskChin.position.set(0, -0.14, 0.038);
    dMaskChin.rotation.x = Math.PI * 0.95;
    dMaskGroup.add(dMaskChin);

    // Filigrana dourada na fronte e cume nasal
    const dMaskForeheadGold = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.035, 0.055), matAntiqueGold);
    dMaskForeheadGold.position.set(0, 0.10, 0.002);
    dMaskGroup.add(dMaskForeheadGold);

    const dMaskNose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.07), matAntiqueGold);
    dMaskNose.position.set(0, 0.01, 0.028);
    dMaskGroup.add(dMaskNose);

    // Órbitas oculares chanfradas e profundas com olhar penetrante
    for (const sx of [-0.06, 0.06]) {
      const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.035), matVoidBlack);
      eyeSocket.position.set(sx, 0.038, 0.032);
      dMaskGroup.add(eyeSocket);

      const eyeGlint = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.018), matWhiteEyeDot);
      eyeGlint.position.set(sx, 0.038, 0.046);
      dMaskGroup.add(eyeGlint);
    }

    this.demiurgeHeadGroup.add(dMaskGroup);

    this.demiurgeGroup.visible = false;
    this.demiurgeHeadGroup.visible = false;
    this.wearingDemiurgeAttire = false;

    // Yaw primeiro, inclinação depois: a postura acompanha o rumo do personagem.
    this.model.rotation.order = "YXZ";
    this.model.rotation.y = Math.PI;
    // Espelha o modelo: a mão da arma fica do lado direito, como no GTA.
    this.model.scale.x = -1;
    this.root.position.set(this.x, world.heightAt(this.x, this.z), this.z);
    this.scene.add(this.root);
  }

  update(dt, input, world, cameraYaw, aim = null) {
    if (this.dead) {
      this._updateDead(dt, world);
      return;
    }
    if (this.mounted) {
      this._updateMounted(dt, input, aim);
      return;
    }
    if (input.consumeCrouchPressed() && !this.rolling && !this.knockedOut) this.crouching = !this.crouching;
    const rmbBlock = Boolean(input.aimHeld) && this.aimStyle === "melee" && this.weaponId !== "spear";
    const guardKey = input.isDown("KeyQ") || rmbBlock;
    if (!guardKey) this.blockLocked = false;
    this.blocking = guardKey && this.canBlock && !input.modalOpen && !this.blockLocked && !this.rolling && !this.knockedOut && this.attackTimer <= 0;
    const aiming = Boolean(aim && aim.active) && !this.knockedOut && !this.blocking;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.faceTimer > 0) this.faceTimer = Math.max(0, this.faceTimer - dt);
    if (this.firePoseTimer > 0) this.firePoseTimer = Math.max(0, this.firePoseTimer - dt);
    if (this.rollCooldown > 0) this.rollCooldown = Math.max(0, this.rollCooldown - dt);
    if (this.landTimer > 0) this.landTimer = Math.max(0, this.landTimer - dt);
    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.idleTime += dt;

    input.readMovement(this._move);
    const forward = this._move.z;
    const strafe = this._move.x;
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    this.moveX = strafe * cos - forward * sin;
    this.moveZ = -strafe * sin - forward * cos;
    // tropeço após um golpe: por um instante os controles não vencem a repulsão
    if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      this.moveX = 0;
      this.moveZ = 0;
    }
    const inputLength = Math.hypot(this.moveX, this.moveZ);
    if (inputLength > 1) { this.moveX /= inputLength; this.moveZ /= inputLength; }
    const hasInput = inputLength > 0.05;

    // Se estiver sentado ou ajoelhado rezando, mover-se (WASD), pular ou rolar levanta o personagem suavemente
    if (this.sitting || this.praying) {
      if (hasInput || input.jumpPressed || input.dodgePressed || this.staggerTimer > 0) {
        this.standUp();
      } else {
        this.vx = 0;
        this.vz = 0;
        const diffYaw = Math.atan2(Math.sin(this.seatYaw - this.model.rotation.y), Math.cos(this.seatYaw - this.model.rotation.y));
        this.model.rotation.y += diffYaw * (1 - Math.exp(-14 * dt));
        if (this.praying) {
          this.prayHealTimer += dt;
          if (this.prayHealTimer >= 2.2) {
            this.prayHealTimer = 0;
            if (this.health < this.maxHealth) {
              this.health = Math.min(this.maxHealth, this.health + 1);
            }
            this.effects?.play("star", this.x, this.root.position.y + 1.85, this.z, "#ffe48f", 0.9);
          }
        }
      }
    }

    // Rolamento de esquiva: impulso curto, sem controle, com invulnerabilidade.
    if (input.consumeDodgePressed() && !this.blocking && !this.rolling && this.rollCooldown <= 0 && this.grounded && !this.knockedOut) {
      const facing = this.model.rotation.y;
      this.rollX = hasInput ? this.moveX / inputLength : Math.sin(facing);
      this.rollZ = hasInput ? this.moveZ / inputLength : Math.cos(facing);
      this.rolling = true;
      this.crouching = false;
      this.rollTimer = ROLL_DURATION;
      this.model.rotation.y = Math.atan2(this.rollX, this.rollZ);
      this.effects?.play("dust", this.x, this.root.position.y + 0.15, this.z, "#cdbb97", 0.9);
    }

    // Tentar correr (Shift) enquanto agachado faz o personagem se levantar e correr normalmente (mesmo efeito de apertar U)
    if (this.crouching && this._move.run && !this.rolling && !this.knockedOut) {
      this.crouching = false;
    }

    const running = this._move.run && !aiming && !this.blocking && !this.crouching;
    const carryRelief = Math.max(0, (PlayerStats.str - 10) * 0.03);
    const effectiveWeight = Math.min(1.0, this.weaponWeight + (1 - this.weaponWeight) * carryRelief);
    const speed = effectiveWeight * PlayerStats.getSpeedMult() * (this.crouching ? CONFIG.player.walkSpeed * 0.45 : this.blocking ? CONFIG.player.walkSpeed * 0.4 : aiming ? CONFIG.player.walkSpeed * 0.62 : running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed);
    if (this.rolling) {
      this.rollTimer -= dt;
      const left = Math.max(0, this.rollTimer / ROLL_DURATION);
      this.vx = this.rollX * ROLL_SPEED * (0.55 + 0.45 * left);
      this.vz = this.rollZ * ROLL_SPEED * (0.55 + 0.45 * left);
      if (this.rollTimer <= 0) {
        this.rolling = false;
        this.rollCooldown = 0.45;
        this.vx *= 0.5;
        this.vz *= 0.5;
        this.effects?.play("dust", this.x, this.root.position.y + 0.15, this.z, "#cdbb97", 0.8);
      }
    } else {
      const control = this.grounded ? 1 : 0.45;
      const rate = (hasInput ? CONFIG.player.acceleration : CONFIG.player.acceleration * 1.45) * control * dt;
      const targetVX = this.moveX * speed;
      const targetVZ = this.moveZ * speed;
      this.vx += Math.max(-rate, Math.min(rate, targetVX - this.vx));
      this.vz += Math.max(-rate, Math.min(rate, targetVZ - this.vz));
    }

    // Pulo com "buffer": apertar um instante antes de pousar ainda vale.
    if (input.consumeJumpPressed()) this.jumpBuffer = 0.14;
    if (this.jumpBuffer > 0 && this.grounded && !this.rolling && !this.knockedOut) {
      this.verticalSpeed = CONFIG.player.jumpSpeed;
      this.grounded = false;
      this.jumpBuffer = 0;
      this.effects?.play("dust", this.x, this.root.position.y + 0.12, this.z, "#cdbb97", 0.6);
    }
    let landed = false;
    if (!this.grounded) {
      this.verticalOffset += this.verticalSpeed * dt;
      this.verticalSpeed -= CONFIG.player.gravity * dt;
    }

    const nextX = this.x + this.vx * dt;
    const nextZ = this.z + this.vz * dt;
    const currentY = this.root.position.y;
    world.resolveSphereMove(this.x, this.z, nextX, nextZ, this.radius, _moveResult, currentY);
    this.x = _moveResult.x;
    this.z = _moveResult.z;
    if (_moveResult.hitX) this.vx = 0;
    if (_moveResult.hitZ) this.vz = 0;

    // Raycast vertical descendente partindo do jogador para encaixar perfeitamente em terreno, pisos, muros e rochas
    const targetGround = world.raycastGround(this.x, currentY + this.verticalOffset, this.z);

    // Subida suave de degraus, muretas baixas e pedras ao caminhar
    if (this.grounded && targetGround > currentY && targetGround - currentY <= 0.65) {
      this.root.position.y = THREE.MathUtils.lerp(currentY, targetGround, 1 - Math.exp(-24 * dt));
    }

    if (this.verticalOffset <= 0) {
      if (!this.grounded) landed = true;
      this.verticalOffset = 0;
      this.verticalSpeed = 0;
      this.grounded = true;
    }
    const finalGround = this.grounded ? targetGround : (targetGround + this.verticalOffset);
    this.root.position.set(this.x, finalGround, this.z);
    if (landed) {
      this.audio?.land();
      this.landTimer = LAND_TIME;
      this.effects?.play("dust", this.x, finalGround + 0.15, this.z, "#cdbb97", 0.85);
    }

    const horizontalSpeed = Math.hypot(this.vx, this.vz);
    this.speedRatio = Math.min(1, horizontalSpeed / CONFIG.player.runSpeed);
    if (aiming || this.blocking) this.faceYaw = cameraYaw + Math.PI;
    let turnRate = 0;
    if (!this.rolling) {
      const before = this.model.rotation.y;
      if (aiming || this.blocking || this.faceTimer > 0) {
        const difference = Math.atan2(Math.sin(this.faceYaw - before), Math.cos(this.faceYaw - before));
        this.model.rotation.y += difference * (1 - Math.exp(-24 * dt));
        this.walkPhase += dt * 7.2 * Math.min(1.0, this.speedRatio * 1.35);
      } else if (horizontalSpeed > 0.12) {
        // Giro suave e firme na direção exata do vetor de movimento
        const target = Math.atan2(this.vx, this.vz);
        const difference = Math.atan2(Math.sin(target - before), Math.cos(target - before));
        this.model.rotation.y += difference * (1 - Math.exp(-20 * dt));
        this.walkPhase += dt * (running ? 9.8 : 6.8) * Math.min(1.0, this.speedRatio * 1.35);
      }
      turnRate = Math.atan2(Math.sin(this.model.rotation.y - before), Math.cos(this.model.rotation.y - before)) / Math.max(dt, 0.001);
    }

    if (this.grounded && running && this.speedRatio > 0.7 && !this.rolling) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.2;
        this.effects?.play("dust", this.x - this.vx * 0.06, finalGround + 0.12, this.z - this.vz * 0.06, "#cdbb97", 0.5);
      }
    }

    // Um passo a cada meio ciclo da passada.
    const stepIndex = Math.floor(this.walkPhase / Math.PI);
    if (this.grounded && !this.rolling && this.speedRatio > 0.12) {
      if (stepIndex !== this._stepIndex) this.audio?.step(running, this.crouching ? 0.2 : this.blocking ? 0.7 : 1);
    }
    this._stepIndex = stepIndex;

    this.hitHeight = this.rolling ? 0.9 : this.crouching ? 1.25 : 1.85;
    this._animate(dt, aim, aiming, running, turnRate);
  }

  _animate(dt, aim, aiming, running, turnRate) {
    const s = this.speedRatio;
    const air = !this.grounded;
    this.crouchPose += ((this.crouching ? 1 : 0) - this.crouchPose) * (1 - Math.exp(-12 * dt));
    const cp = this.crouchPose;

    // Amplitude de passada anatômica e proporcional: elimina o efeito espacate
    const targetStride = Math.sin(this.walkPhase) * s * (running ? 0.68 : 0.42);
    // os braços seguem as pernas com ~0,4 rad de atraso (follow-through): balanço mais orgânico
    const targetArmSwing = Math.sin(this.walkPhase - 0.4) * s * (running ? 0.62 : 0.35);
    const idle = 1 - Math.min(1, s * 4);
    const breath = Math.sin(this.idleTime * 1.9);
    const sway = Math.sin(this.idleTime * 0.7);

    // Suavização das pernas: rotação X com interpolação contínua e leve roll em Z
    const legBlend = 1 - Math.exp(-24 * dt);
    this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, targetStride, legBlend);
    this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, -targetStride, legBlend);
    this.leftLeg.rotation.z = THREE.MathUtils.lerp(this.leftLeg.rotation.z, Math.sin(this.walkPhase) * 0.025 * s, legBlend);
    this.rightLeg.rotation.z = THREE.MathUtils.lerp(this.rightLeg.rotation.z, -Math.sin(this.walkPhase) * 0.025 * s, legBlend);

    // Braços e antebraços com balanço natural e sincronizado
    if (running && s > 0.25) {
      this.leftArm.rotation.set(-targetArmSwing * 0.85 + 0.22, 0, -0.12);
      this.rightArm.rotation.set(targetArmSwing * 0.85 - 0.18, 0, 0.12);
      this.leftForearm.rotation.x = -0.75 - Math.max(0, -targetArmSwing) * 0.35;
      this.rightForearm.rotation.x = -0.75 - Math.max(0, targetArmSwing) * 0.35;
    } else {
      // Braços naturalmente caídos ao lado do corpo, com balanço oposto às pernas e leve respiração
      const armBreath = breath * 0.012 * idle;
      const walkSwing = targetArmSwing * 1.7;
      this.leftArm.rotation.set(-walkSwing + armBreath, 0, -0.085 - Math.sin(this.walkPhase) * 0.02 * s);
      this.rightArm.rotation.set(walkSwing - armBreath, 0, 0.085 + Math.sin(this.walkPhase) * 0.02 * s);
      // o cotovelo dobra mais quando o braço vem para a frente
      this.leftForearm.rotation.x = -0.14 - Math.max(0, walkSwing) * 0.9;
      this.rightForearm.rotation.x = -0.14 - Math.max(0, -walkSwing) * 0.9;
    }

    // Postura corporal: inclinação elegante para a frente e transferência de peso lateral
    let lean = s * (running ? 0.24 : 0.08) + 0.035 * idle; // parado: ombros levemente caídos, postura cansada
    let bank = Math.max(-0.18, Math.min(0.18, -turnRate * 0.014 * s));
    let squash = 1;
    let drop = -0.22 * cp;
    lean += 0.3 * cp;

    if (air) {
      const rising = this.verticalSpeed > 0;
      this.leftLeg.rotation.x = rising ? -0.55 : -0.22;
      this.rightLeg.rotation.x = rising ? 0.25 : 0.38;
      this.leftArm.rotation.z = -0.45;
      this.rightArm.rotation.z = 0.45;
      this.leftArm.rotation.x = -0.35;
      this.rightArm.rotation.x = -0.35;
      lean = rising ? 0.08 : 0.04;
      squash = rising ? 1.04 : 1.02;
    } else if (this.landTimer > 0) {
      const k = Math.sin((this.landTimer / LAND_TIME) * Math.PI);
      squash = 1 - 0.1 * k;
      drop = -0.1 * k;
      this.leftLeg.rotation.x = -0.35 * k;
      this.rightLeg.rotation.x = 0.35 * k;
      lean += 0.12 * k;
    }

    // Guarda: postura firme com o escudo protegendo o tronco
    this.blockPose += ((this.blocking ? 1 : 0) - this.blockPose) * (1 - Math.exp(-18 * dt));
    if (this.blockPose > 0.015) {
      const bp = this.blockPose;
      this.leftArm.rotation.x += (-0.55 - this.leftArm.rotation.x) * bp;
      this.leftArm.rotation.z += (-0.12 - this.leftArm.rotation.z) * bp;
      lean += 0.06 * bp;
    }

    // Respiração e troca suave de apoio quando parado
    // corpo mais alto quando as pernas se cruzam (cos²) e mais baixo no apoio duplo
    const stepBob = (1 + Math.cos(this.walkPhase * 2)) * 0.5;
    this.head.position.y = 1.66 + breath * 0.012 * idle + stepBob * 0.016 * s;
    this.head.rotation.z = -Math.sin(this.walkPhase) * 0.02 * s; // cabeça compensa o balanço do quadril
    this.head.rotation.x = -lean * 0.6 + 0.05 * idle; // cabeça um pouco baixa quando parado
    bank += sway * 0.016 * idle;

    this.cape.rotation.x = -0.08 - s * 0.32 - (air ? 0.22 : 0) - Math.sin(this.idleTime * 7.5) * 0.04 * s;
    this.cape.rotation.z = Math.sin(this.idleTime * 4.5) * 0.035 * s + bank * 0.5;

    const poseTarget = aiming || this.firePoseTimer > 0 ? 1 : 0;
    this.aimPose += (poseTarget - this.aimPose) * (1 - Math.exp(-16 * dt));
    const posing = this.aimPose > 0.015;
    if (posing) {
      const pose = this.aimPose;
      const elevation = aim ? aim.elevation : 0;
      if (this.aimStyle === "throw") {
        this.rightArm.rotation.x += (-2.35 - this.rightArm.rotation.x) * pose;
        this.rightArm.rotation.z += (-0.35 - this.rightArm.rotation.z) * pose;
        lean += 0.08 * pose;
      } else if (this.aimStyle === "long") {
        this.rightArm.rotation.x += (-Math.PI / 2 - elevation - this.rightArm.rotation.x) * pose;
        this.rightArm.rotation.z += (0 - this.rightArm.rotation.z) * pose;
        this.leftArm.rotation.x += (-Math.PI / 2 - elevation + 0.12 - this.leftArm.rotation.x) * pose;
        this.leftArm.rotation.z += (0.5 - this.leftArm.rotation.z) * pose;
        lean += 0.05 * pose;
        this.head.rotation.x = -elevation * 0.5 * pose;
      }
    }

    const melee = this.aimStyle === "melee";
    const carrying = !posing && this.attackTimer <= 0 && !air;

    // Dobras anatômicas corretas dos joelhos e cotovelos
    bendJoints(this, this.leftLeg.rotation.x, targetArmSwing, air ? 0.35 : 0, running);

    if (cp > 0.015) {
      // Agachado com flexão proporcional e alinhada
      this.leftLeg.rotation.x -= 0.65 * cp;
      this.rightLeg.rotation.x -= 0.65 * cp;
      this.leftKnee.rotation.x += 1.25 * cp;
      this.rightKnee.rotation.x += 1.25 * cp;
    }

    // Postura de descanso: arma descansando elegantemente em prontidão à frente do tronco
    if (carrying) {
      // Braço relaxado ao lado do corpo; a arma fica junto ao quadril, apontada para a frente
      this.rightArm.rotation.x += melee ? -0.1 : -0.12;
      this.rightArm.rotation.z += 0.02;
      this.rightForearm.rotation.x += melee ? -0.22 : -0.2;
    } else if (posing && this.aimStyle === "long") {
      this.rightForearm.rotation.x *= 1 - this.aimPose;
      this.leftForearm.rotation.x *= 1 - this.aimPose;
    }

    if (this.recoil > 0) {
      this.recoil *= Math.exp(-9 * dt);
      if (this.recoil < 0.01) this.recoil = 0;
      this.rightArm.rotation.x -= this.recoil * 0.2;
      this.leftArm.rotation.x -= this.recoil * 0.12;
      lean -= this.recoil * 0.07;
    }

    // Ataque carregado de armas pesadas
    if (this.chargePose > 0.01 && this.attackTimer <= 0) {
      const cp2 = this.chargePose;
      this.rightArm.rotation.x += (-0.6 - 2.0 * cp2 - this.rightArm.rotation.x) * Math.min(1, cp2 * 2);
      this.rightArm.rotation.z += (-0.15 - this.rightArm.rotation.z) * Math.min(1, cp2 * 2);
      this.rightForearm.rotation.x = -0.4 * cp2;
      lean -= 0.14 * cp2;
    }

    // Braço de apoio nas armas de duas mãos
    if (this.twoHanded && this.blockPose < 0.015 && !(posing && this.aimStyle === "long")) {
      if (this.weaponGrip === "pole") {
        this.leftArm.rotation.x = -0.85;
        this.leftArm.rotation.z = 0.45;
        this.leftForearm.rotation.x = -0.55;
      } else if (this.weaponGrip === "heavy") {
        this.leftArm.rotation.x += (this.rightArm.rotation.x * 0.85 - this.leftArm.rotation.x) * 0.8;
        this.leftArm.rotation.z = 0.42;
        this.leftForearm.rotation.x = this.rightForearm.rotation.x;
      } else if (this.weaponGrip === "blade") {
        // foice de duas mãos: a mão esquerda segura o cabo logo abaixo da direita e acompanha o corte
        this.leftArm.rotation.x += (this.rightArm.rotation.x * 0.92 - 0.1 - this.leftArm.rotation.x) * 0.85;
        this.leftArm.rotation.z = 0.3;
        this.leftForearm.rotation.x = this.rightForearm.rotation.x - 0.12;
      }
    }

    // Punhos: guarda clássica de combate corporal
    // (sem armas: os braços seguem naturais ao lado do corpo; a guarda só sobe ao bloquear/atacar)

    // =========================================================================
    // Sistema Cinematográfico de Golpes (Combate Suave com Wind-up, Corte e Follow-through)
    // =========================================================================
    let attackTorsoYaw = 0;
    if (this.attackTimer > 0) {
      const phase = 1 - this.attackTimer / this.attackLen;

      if (this.attackKind === 0) {
        // --- GOLPE 1: Corte Diagonal Direito -> Esquerdo (Slash A) ---
        if (phase < 0.22) {
          const t = phase / 0.22;
          const w = Math.sin(t * Math.PI * 0.5);
          this.rightArm.rotation.set(-0.4 - 1.05 * w, 0.42 * w, -0.32 * w);
          this.rightForearm.rotation.x = -0.5 - 0.65 * w;
          this.leftArm.rotation.set(-0.35 + 0.25 * w, 0, 0.22);
          lean -= 0.05 * w;
          bank += 0.08 * w;
          attackTorsoYaw = 0.26 * w;
        } else {
          const t = (phase - 0.22) / 0.78;
          const slash = t < 0.32 ? Math.sin((t / 0.32) * Math.PI * 0.5) : Math.cos(((t - 0.32) / 0.68) * Math.PI * 0.5);
          this.rightArm.rotation.set(-1.45 + 0.82 * slash, 0.42 - 0.88 * slash, -0.32 + 1.15 * slash);
          this.rightForearm.rotation.x = -1.15 + 1.05 * slash;
          this.leftArm.rotation.set(-0.35 - 0.22 * slash, 0, 0.32);
          lean += 0.22 * slash;
          bank -= 0.14 * slash;
          attackTorsoYaw = 0.26 - 0.58 * slash;
        }
      } else if (this.attackKind === 1) {
        // --- GOLPE 2: Contragolpe Inverso Esquerdo -> Direito (Slash B) ---
        if (phase < 0.2) {
          const t = phase / 0.2;
          const w = Math.sin(t * Math.PI * 0.5);
          this.rightArm.rotation.set(-1.05 - 0.48 * w, -0.38 * w, 0.65 * w);
          this.rightForearm.rotation.x = -0.4 - 0.55 * w;
          attackTorsoYaw = -0.24 * w;
        } else {
          const t = (phase - 0.2) / 0.8;
          const slash = t < 0.3 ? Math.sin((t / 0.3) * Math.PI * 0.5) : Math.cos(((t - 0.3) / 0.7) * Math.PI * 0.5);
          this.rightArm.rotation.set(-1.55 + 0.9 * slash, -0.38 + 0.82 * slash, 0.65 - 1.15 * slash);
          this.rightForearm.rotation.x = -0.95 + 0.88 * slash;
          lean += 0.18 * slash;
          bank += 0.15 * slash;
          attackTorsoYaw = -0.24 + 0.52 * slash;
        }
      } else if (this.attackKind === 2) {
        // --- GOLPE 3: Golpe Demolidor Vertical Descendente (Overhead Cleave) ---
        if (phase < 0.26) {
          const t = phase / 0.26;
          const w = Math.sin(t * Math.PI * 0.5);
          this.rightArm.rotation.set(-0.6 - 2.1 * w, 0, -0.12 * w);
          this.rightForearm.rotation.x = -0.4 - 0.55 * w;
          this.leftArm.rotation.set(-0.4 - 1.6 * w, 0, 0.25);
          this.leftForearm.rotation.x = -0.4 - 0.5 * w;
          lean -= 0.12 * w;
        } else {
          const t = (phase - 0.26) / 0.74;
          const cleave = t < 0.28 ? Math.sin((t / 0.28) * Math.PI * 0.5) : Math.cos(((t - 0.28) / 0.72) * Math.PI * 0.5);
          this.rightArm.rotation.set(-2.7 + 2.2 * cleave, 0, -0.05);
          this.rightForearm.rotation.x = -0.95 + 0.85 * cleave;
          this.leftArm.rotation.set(-2.0 + 1.5 * cleave, 0, 0.22);
          this.leftForearm.rotation.x = -0.9 + 0.75 * cleave;
          lean += 0.34 * cleave;
          this.leftKnee.rotation.x += 0.22 * cleave;
          this.rightKnee.rotation.x += 0.22 * cleave;
        }
      } else if (this.attackKind === 4) {
        // --- GOLPE 4: Estocada Rápida e Penetrante (Thrust - Lança / Adaga) ---
        if (phase < 0.18) {
          const t = phase / 0.18;
          const w = Math.sin(t * Math.PI * 0.5);
          this.rightArm.rotation.set(-0.25 + 0.12 * w, 0, 0.08);
          this.rightForearm.rotation.x = -0.55 - 0.75 * w;
          attackTorsoYaw = 0.18 * w;
        } else {
          const t = (phase - 0.18) / 0.82;
          const thrust = t < 0.28 ? Math.sin((t / 0.28) * Math.PI * 0.5) : Math.cos(((t - 0.28) / 0.72) * Math.PI * 0.5);
          this.rightArm.rotation.set(-0.15 - 1.45 * thrust, 0, 0.04);
          this.rightForearm.rotation.x = -1.3 + 1.25 * thrust;
          lean += 0.26 * thrust;
          attackTorsoYaw = 0.18 - 0.36 * thrust;
        }
      } else if (this.attackKind === 5) {
        // --- GOLPE 5: Soco Direto Direito (Jab) ---
        const t = phase < 0.3 ? Math.sin((phase / 0.3) * Math.PI * 0.5) : Math.cos(((phase - 0.3) / 0.7) * Math.PI * 0.5);
        this.rightArm.rotation.set(-0.5 - 1.15 * t, 0, 0.05);
        this.rightForearm.rotation.x = -1.35 + 1.25 * t;
        this.leftArm.rotation.set(-0.85, 0, 0.2);
        this.leftForearm.rotation.x = -1.4;
        lean += 0.16 * t;
        attackTorsoYaw = -0.22 * t;
      } else if (this.attackKind === 6) {
        // --- GOLPE 6: Cruzado / Direto Esquerdo (Cross) ---
        const t = phase < 0.3 ? Math.sin((phase / 0.3) * Math.PI * 0.5) : Math.cos(((phase - 0.3) / 0.7) * Math.PI * 0.5);
        this.leftArm.rotation.set(-0.5 - 1.15 * t, 0, -0.05);
        this.leftForearm.rotation.x = -1.4 + 1.3 * t;
        this.rightArm.rotation.set(-0.75, 0, -0.15);
        this.rightForearm.rotation.x = -1.35;
        lean += 0.16 * t;
        attackTorsoYaw = 0.22 * t;
      } else if (this.attackKind === 3) {
        // --- GOLPE 3: Arremesso (Throw) ---
        const t = phase < 0.35 ? Math.sin((phase / 0.35) * Math.PI * 0.5) : Math.cos(((phase - 0.35) / 0.65) * Math.PI * 0.5);
        this.rightArm.rotation.set(-2.4 + 1.9 * t, 0, -0.12);
        this.rightForearm.rotation.x = -0.8 + 0.75 * t;
        lean += 0.22 * t;
      }

      // Olhar da cabeça focado no alvo mesmo durante a rotação violenta do tronco
      this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, -attackTorsoYaw * 0.75, 1 - Math.exp(-22 * dt));
    } else {
      this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, 0, 1 - Math.exp(-14 * dt));
    }

    if (this.blockPose > 0.015) {
      // antebraço quase vertical: o escudo cobre peito e rosto e a mão fica atrás dele
      this.leftForearm.rotation.x += (-2.4 - this.leftForearm.rotation.x) * this.blockPose;
    }

    // Suavização final da pose (só nas juntas): rápida em combate/rolamento, macia no resto
    const poseRate = this.rolling ? 0 : this.attackTimer > 0 || this.chargePose > 0.01 ? 42 : 17;
    smoothPose(this._pose, this, dt, poseRate);
    this._updateShield();

    // Orientação suave da arma na mão (sem quebras angulares abruptas)
    let targetSocket;
    const elbowTotal = this.rightArm.rotation.x + this.rightForearm.rotation.x;
    const elevation = aim ? aim.elevation : 0;
    const grip = this.weaponGrip;
    if (grip === "blade" || grip === "torch") {
      // Ângulo MUNDIAL desejado da lâmina (0 = vertical para cima, π/2 = horizontal para a frente, > π/2 = para baixo):
      // o soquete compensa o braço (socket = desejado - braço), então a lâmina desenha um arco limpo no golpe
      // em vez de apontar sempre para o céu.
      if (this.attackTimer > 0) {
        const p = 1 - this.attackTimer / this.attackLen;
        const sm = THREE.MathUtils.smoothstep;
        let desired;
        if (this.attackKind === 2) {
          // golpe vertical: sobe para trás da cabeça e desce até a frente, levemente para baixo
          desired = -0.3 + 2.5 * sm(p, 0.14, 0.72);
        } else if (this.attackKind === 4) {
          desired = 1.42; // estocada: ponta para a frente
        } else {
          // corte lateral: lâmina sobe no wind-up, cruza na horizontal e termina um pouco abaixo (follow-through)
          desired = -0.35 + 0.5 * sm(p, 0, 0.2) + 1.95 * sm(p, 0.22, 0.58) - 0.25 * sm(p, 0.72, 1);
        }
        targetSocket = desired - elbowTotal;
      } else if (grip === "torch") {
        targetSocket = 0.42 - elbowTotal; // tocha em pé, levemente inclinada para a frente: a chama sobe
      } else {
        targetSocket = 0.85 - elbowTotal;
      }
    } else if (grip === "pole") {
      if (this.attackTimer > 0 && this.attackKind === 2) {
        const p = 1 - this.attackTimer / this.attackLen;
        targetSocket = -0.2 + 2.1 * THREE.MathUtils.smoothstep(p, 0.14, 0.72) - elbowTotal; // alabarda: golpe de cima para baixo
      } else {
        targetSocket = this.attackTimer > 0 ? Math.PI / 2 - 0.12 - elbowTotal : 0.78 - elbowTotal;
      }
    } else if (grip === "heavy") {
      if (this.attackTimer > 0) {
        const p = 1 - this.attackTimer / this.attackLen;
        const sm = THREE.MathUtils.smoothstep;
        // martelo/montante: levanta atrás, vem de cima (kind 2) ou varre lateral (kind 1) e termina à frente
        targetSocket = (this.attackKind === 2 ? -0.35 + 2.55 * sm(p, 0.2, 0.74) : -0.2 + 2.1 * sm(p, 0.2, 0.62) - 0.2 * sm(p, 0.75, 1)) - elbowTotal;
      } else {
        targetSocket = this.chargePose > 0.01 ? 0.15 - elbowTotal : 0.35 - elbowTotal;
      }
    } else if (grip === "bow") {
      targetSocket = 0.05 - elevation * 0.4 * this.aimPose - elbowTotal;
    } else if (grip === "throw") {
      targetSocket = 0.6 - elbowTotal;
    } else {
      const ready = Math.PI / 2 + 0.4;
      targetSocket = ready + (Math.PI / 2 - elevation - ready) * this.aimPose - elbowTotal;
    }
    // proteção: um dt anômalo (negativo/NaN) nunca pode contaminar o soquete da arma (NaN some com a arma para sempre)
    if (!Number.isFinite(targetSocket)) targetSocket = 0.85;
    if (!Number.isFinite(this.handSocket.rotation.x)) this.handSocket.rotation.x = targetSocket;
    this.handSocket.rotation.x += (targetSocket - this.handSocket.rotation.x) * (1 - Math.exp(-24 * Math.max(0, dt)));

    // Bobbing vertical e balanço dinâmico natural do corpo
    const runBob = (running ? 0.05 : 0.03) * stepBob * s;
    const bodySway = Math.sin(this.walkPhase) * (running ? 0.03 : 0.022) * s;

    this.model.rotation.x = lean;
    this.model.rotation.z = bank + bodySway;
    this.model.rotation.y += attackTorsoYaw;
    this.model.scale.y = squash;
    this.model.position.set(0, (this.grounded ? runBob : 0) + drop, 0);

    // Animações de Sentar no Banco (sitPose) e Ajoelhar / Rezar (prayPose)
    this.sitPose += ((this.sitting ? 1 : 0) - this.sitPose) * (1 - Math.exp(-12 * dt));
    this.prayPose += ((this.praying ? 1 : 0) - this.prayPose) * (1 - Math.exp(-12 * dt));

    if (this.sitPose > 0.01) {
      const sp = this.sitPose;
      this.leftLeg.rotation.set(-1.45 * sp, 0, -0.08 * sp);
      this.rightLeg.rotation.set(-1.45 * sp, 0, 0.08 * sp);
      this.leftKnee.rotation.x = 1.48 * sp;
      this.rightKnee.rotation.x = 1.48 * sp;
      this.leftArm.rotation.set(-0.52 * sp, 0, 0.14 * sp);
      this.rightArm.rotation.set(-0.52 * sp, 0, -0.14 * sp);
      this.leftForearm.rotation.x = -0.68 * sp;
      this.rightForearm.rotation.x = -0.68 * sp;
      this.model.position.y = -0.34 * sp;
      this.model.rotation.x = -0.04 * sp;
      this.cape.rotation.x = -0.03 * sp;
    }

    if (this.prayPose > 0.01) {
      const pp = this.prayPose;
      const prayBreath = Math.sin(this.idleTime * 2.4) * 0.04;
      if (!this.sitting) {
        // Ajoelhado diante do altar
        this.leftLeg.rotation.set(-0.52 * pp, 0, -0.06 * pp);
        this.rightLeg.rotation.set(-0.52 * pp, 0, 0.06 * pp);
        this.leftKnee.rotation.x = 2.05 * pp;
        this.rightKnee.rotation.x = 2.05 * pp;
        this.model.position.y = -0.44 * pp;
      }
      // Mãos unidas em oração à frente do peito e cabeça inclinada em reverência
      this.leftArm.rotation.set((-0.95 + prayBreath) * pp, 0.42 * pp, 0.38 * pp);
      this.rightArm.rotation.set((-0.95 + prayBreath) * pp, -0.42 * pp, -0.38 * pp);
      this.leftForearm.rotation.x = -1.18 * pp;
      this.rightForearm.rotation.x = -1.18 * pp;
      this.head.rotation.x = (0.38 + prayBreath * 0.5) * pp;
      this.model.rotation.x = 0.12 * pp;
    }

    if (this.handSocket) {
      this.handSocket.visible = this.prayPose < 0.35 && this.sitPose < 0.65;
    }

    if (this.mounted) {
      // sentado na sela: pernas abertas, tronco inclinado com a velocidade
      this.leftLeg.rotation.set(-1.0, 0, -0.5);
      this.rightLeg.rotation.set(-1.0, 0, 0.5);
      this.leftKnee.rotation.x = 1.1;
      this.rightKnee.rotation.x = 1.1;
      this.model.position.set(0, 0, 0);
      this.model.scale.y = 1;
      this.model.rotation.x = 0.06 + this.speedRatio * 0.16;
      this.model.rotation.z = 0;
      if (this.blockPose < 0.015 && !(this.aimPose > 0.015) && this.attackTimer <= 0) {
        this.leftArm.rotation.set(-0.7, 0, 0.25);
        this.leftForearm.rotation.x = -0.5;
      }
      this.cape.rotation.x = -0.1 - this.speedRatio * 0.7;
    }

    if (this.rolling) {
      const progress = 1 - this.rollTimer / ROLL_DURATION;
      const angle = progress * Math.PI * 2;
      const yaw = this.model.rotation.y;
      this.model.rotation.x = angle;
      this.model.rotation.z = 0;
      this.model.scale.y = 0.92;
      // gira em torno do centro do corpo, não dos pés
      this.model.position.set(-Math.sin(angle) * 0.85 * Math.sin(yaw), 0.85 - 0.85 * Math.cos(angle), -Math.sin(angle) * 0.85 * Math.cos(yaw));
      this.leftLeg.rotation.x = -1.3;
      this.rightLeg.rotation.x = -1.3;
      this.leftArm.rotation.x = -1.5;
      this.rightArm.rotation.x = -1.5;
      this.leftArm.rotation.z = 0.4;
      this.rightArm.rotation.z = -0.4;
    }
  }

  // Orientação do escudo: em repouso segue o antebraço (face para fora); ao bloquear, a face vira para a frente.
  _updateShield() {
    const bp = this.blockPose;
    if (bp < 0.015) {
      this.shield.quaternion.copy(_qShieldRest);
      return;
    }
    _qChain.copy(this.leftArm.quaternion).multiply(this.leftForearm.quaternion);
    _qGuard.copy(_qChain).invert(); // face para a frente do modelo, sem herdar a inclinação do braço
    this.shield.quaternion.slerpQuaternions(_qShieldRest, _qGuard, bp);
  }

  // Montado: a posição vem do sistema de montaria; aqui só a pose e o combate da sela.
  _updateMounted(dt, input, aim) {
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.firePoseTimer > 0) this.firePoseTimer = Math.max(0, this.firePoseTimer - dt);
    if (this.faceTimer > 0) this.faceTimer = Math.max(0, this.faceTimer - dt);
    if (this.landTimer > 0) this.landTimer = 0;
    if (this.jumpBuffer > 0) this.jumpBuffer = 0;
    this.blocking = false;
    this.rolling = false;
    this.crouching = false;
    this.hitHeight = 1.85;
    input.consumeCrouchPressed();
    input.consumeDodgePressed();
    this.idleTime += dt;
    const aiming = Boolean(aim && aim.active) && !this.knockedOut;
    this._animate(dt, aim, aiming, false, 0);
  }

  // Corpo caindo sem vida: desaba para o lado, membros soltos, deslizando pelo impulso do golpe.
  die(awayX, awayZ) {
    this.dead = true;
    this.deathTime = 0;
    this.deathSide = awayX >= 0 ? 1 : -1;
    this.vx = awayX * 4.5;
    this.vz = awayZ * 4.5;
    this.blocking = false;
    this.rolling = false;
    this.attackTimer = 0;
    this.weaponHidden = true;
  }

  revive() {
    this.dead = false;
    this.deathTime = 0;
    this.blockLocked = false;
    this.invuln = 3.0; // Proteção ao despertar na igreja
    this.model.rotation.x = 0;
    this.model.rotation.z = 0;
    this.model.position.set(0, 0, 0);
    this.model.scale.y = 1;
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this._pose.ready = false;
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
  }

  _updateDead(dt, world) {
    this.deathTime += dt;
    const p = Math.min(1, this.deathTime / 0.75);
    const decay = Math.exp(-4 * dt);
    this.vx *= decay;
    this.vz *= decay;
    const nextX = this.x + this.vx * dt;
    const nextZ = this.z + this.vz * dt;
    world.resolveSphereMove(this.x, this.z, nextX, nextZ, this.radius, _moveResult, this.root.position.y);
    this.x = _moveResult.x;
    this.z = _moveResult.z;
    this.root.position.set(this.x, world.raycastGround(this.x, this.root.position.y, this.z), this.z);
    this.verticalOffset = 0;
    this.grounded = true;
    this.speedRatio = 0;
    const bounce = Math.sin(Math.min(1, this.deathTime / 0.75) * Math.PI) * 0.18;
    this.model.rotation.x = -0.35 * p;
    this.model.rotation.z = this.deathSide * 1.45 * p;
    this.model.position.y = 0.3 * p + bounce * (1 - p);
    this.model.scale.y = 1;
    this.leftArm.rotation.set(-0.9 * p, 0, -0.7 * p);
    this.rightArm.rotation.set(0.6 * p, 0, 0.8 * p);
    this.leftForearm.rotation.x = -0.4 * p;
    this.rightForearm.rotation.x = -0.2 * p;
    this.leftLeg.rotation.set(0.6 * p, 0, -0.3 * p);
    this.rightLeg.rotation.set(-0.4 * p, 0, 0.3 * p);
    this.leftKnee.rotation.x = 0.5 * p;
    this.rightKnee.rotation.x = 0.3 * p;
    this.head.rotation.x = -0.35 * p;
    this.cape.rotation.x = -0.9 * p;
    this.shield.quaternion.copy(_qShieldRest);
  }

  // Repulsão ao levar um golpe: empurra 1 a 2 m na direção oposta.
  knockBack(awayX, awayZ, knock = 3.4) {
    const speed = 6 + knock * 0.8;
    this.vx = awayX * speed;
    this.vz = awayZ * speed;
    this.staggerTimer = 0.25 * PlayerStats.getHitstunMult();
  }

  // Atacar baixa o escudo; só volta a erguer soltando e apertando a tecla de novo.
  cancelBlock() {
    if (!this.blocking && this.blockPose < 0.05) return;
    this.blocking = false;
    this.blockLocked = true;
  }

  kick(amount = 1) {
    this.recoil = Math.min(1.3, this.recoil + amount);
  }

  startAttack(kind = 0, length = 0.36) {
    this.attackTimer = length;
    this.attackLen = length;
    this.attackKind = kind;
  }

  setArmorVisuals(level = 0) {
    this.armorLevel = Math.max(0, Math.min(3, Math.round(level)));
    const showLeather = this.armorLevel === 1;
    const showChain = this.armorLevel >= 2;
    const showPlate = this.armorLevel >= 3;

    if (this.armorPieces) {
      if (this.armorPieces.tunic) {
        for (const p of this.armorPieces.tunic) if (p) p.visible = true;
      }
      if (this.armorPieces.leather) {
        for (const p of this.armorPieces.leather) if (p) p.visible = showLeather;
      }
      if (this.armorPieces.chainmail) {
        for (const p of this.armorPieces.chainmail) if (p) p.visible = showChain;
      }
      if (this.armorPieces.plate) {
        for (const p of this.armorPieces.plate) if (p) p.visible = showPlate;
      }
    }
    // traje do Demiurgo esconde as placas do tronco (couraça, cruz, tabardo)
    if (this.wearingDemiurgeAttire && this.armorPieces?.plate) {
      for (const pc of this.armorPieces.plate) if (pc.userData.bodyPlate) pc.visible = false;
    }
    // Escudo: com placas vira o escudo templário (campo escuro + cruz vermelha de borda branca)
    if (this._shieldFace && this._tplMats) {
      this._shieldFace.material = showPlate ? this._tplMats.tplCloth : this._tplMats.heraldry;
      if (this._shieldRim) this._shieldRim.material = showPlate ? this._shieldRimMats[1] : this._shieldRimMats[0];
      for (const m of this._shieldTemplar) m.visible = showPlate;
      for (const m of this._shieldPlain) m.visible = !showPlate;
    }
  }

  reinforceArmor() {
    this.setArmorVisuals(Math.min(3, this.armorLevel + 1));
  }

  setDemiurgeAttire(equipped = true) {
    this.wearingDemiurgeAttire = Boolean(equipped);
    if (this.demiurgeGroup) this.demiurgeGroup.visible = this.wearingDemiurgeAttire;
    if (this.demiurgeHeadGroup) this.demiurgeHeadGroup.visible = this.wearingDemiurgeAttire;
    if (this.cape) this.cape.visible = !this.wearingDemiurgeAttire;
    if (this.armorPieces?.plate) {
      const plateOn = this.armorLevel >= 3 && !this.wearingDemiurgeAttire;
      for (const pc of this.armorPieces.plate) if (pc.userData.bodyPlate) pc.visible = plateOn;
    }
    if (this.head?.children) {
      for (let i = 0; i < this.head.children.length; i++) {
        const c = this.head.children[i];
        if (c !== this.demiurgeHeadGroup) {
          c.visible = !this.wearingDemiurgeAttire;
        }
      }
    }
    if (this.effects && this.wearingDemiurgeAttire) {
      this.effects.play("dust", this.x, this.root.position.y + 1.0, this.z, "#1c0b2c", 2.2);
      this.effects.play("star", this.x, this.root.position.y + 1.4, this.z, "#a822ee", 1.8);
      this.effects.play("star", this.x, this.root.position.y + 1.8, this.z, "#ff2233", 1.5);
    }
  }

  sitAt(x, z, yaw = 0, isChurchPew = false) {
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.crouching = false;
    this.blocking = false;
    this.rolling = false;
    this.sitting = true;
    this.praying = false;
    this.sittingInChurch = Boolean(isChurchPew);
    this.seatYaw = yaw;
    this.model.rotation.y = yaw;
    this.userData.state = "SITTING";
    this.root.position.set(this.x, this.world.raycastGround(this.x, this.root.position.y, this.z), this.z);
  }

  startAltarPrayer(x, z, yaw = 0) {
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.crouching = false;
    this.blocking = false;
    this.rolling = false;
    this.sitting = false;
    this.praying = true;
    this.sittingInChurch = true;
    this.prayHealTimer = 0;
    this.seatYaw = yaw;
    this.model.rotation.y = yaw;
    this.userData.state = "PRAYING";
    this.root.position.set(this.x, this.world.raycastGround(this.x, this.root.position.y, this.z), this.z);
  }

  toggleSeatPrayer() {
    if (!this.sitting && !this.praying) return false;
    this.praying = !this.praying;
    this.prayHealTimer = 0;
    this.userData.state = this.praying ? "PRAYING" : "SITTING";
    return this.praying;
  }

  standUp() {
    if (!this.sitting && !this.praying) return;
    this.sitting = false;
    this.praying = false;
    this.sittingInChurch = false;
    this.sittingAtCampfire = false;
    this.userData.state = "IDLE";
    if (this.handSocket) this.handSocket.visible = true;
  }
}
