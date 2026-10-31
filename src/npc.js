import * as THREE from "three";
import { makeSkinnedMaterial } from "./skins.js";
import { makeRandom } from "./utils.js";
import { buildHumanoid, bendJoints } from "./humanoid.js";
import { meleeThink, releaseToken } from "./melee.js";
import { setupGuardTorch, releaseGuardTorch, updateGuardTracking, GUARD_SPEED, TORCH_VISION_RANGE_SQ } from "./torches.js?v=19";
import { NPC_TYPES, NPC_STATES, updateNPCRoutine } from "./rpg.js?v=19";

function getDeterministicFleeTarget(npc) {
  const anchors = npc.root?.userData?.anchors;
  if (!anchors) return null;
  let bestTarget = anchors.home || null;
  let bestDistSq = bestTarget ? (bestTarget.x - npc.x) ** 2 + (bestTarget.z - npc.z) ** 2 : Infinity;
  if (Array.isArray(anchors.gates)) {
    for (let i = 0; i < anchors.gates.length; i++) {
      const g = anchors.gates[i];
      const dSq = (g.x - npc.x) ** 2 + (g.z - npc.z) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestTarget = g;
      }
    }
  }
  return bestTarget;
}

const _playerPosVec = new THREE.Vector3();

const CORPSE_TIME = 5;
const FADE_TIME = 0.8;
const RESPAWN_DELAY = 14;
const RESPAWN_CLEARANCE = 18;
const ACTIVE_DISTANCE_SQ = 95 * 95;
const FLASH_COLOR = new THREE.Color("#85764a");
const ZERO_COLOR = new THREE.Color("#000000");
const SIDE_SIGNS = [1, -1];

const GEO = {
  tunic: new THREE.CylinderGeometry(0.185, 0.27, 0.42, 10).scale(1, 1, 0.74),
  belt: new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10).scale(1, 1, 0.74),
  helmet: new THREE.SphereGeometry(0.139, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58),
  cap: new THREE.SphereGeometry(0.133, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.56),
  pauldron: new THREE.SphereGeometry(0.085, 8, 6).scale(1.15, 0.8, 1),
  shaft: new THREE.CylinderGeometry(0.024, 0.03, 1, 6),
  bag: new THREE.BoxGeometry(0.17, 0.2, 0.11),
};

const npcRoles = {
  guard: {
    name: "Sir Alden Voss", title: "Guarda da estrada", skin: "#bb815f", cloth: "#33495c", leather: "#463b30", metal: "#abb0a5", accent: "#c5a45e", speed: 1.75, wait: 0.35,
  },
  smith: {
    name: "Marta Ferrovia", title: "Ferreira", skin: "#a96f54", cloth: "#904a32", leather: "#3d3027", metal: "#565e59", accent: "#d1a65b", speed: 1.1, wait: 1.1,
  },
  merchant: {
    name: "Tomas Vell", title: "Mercador", skin: "#c68e69", cloth: "#385d69", leather: "#5b402c", metal: "#7f8c83", accent: "#d6b765", speed: 1.25, wait: 1.2,
  },
  farmer: {
    name: "Bruna do Vale", title: "Agricultora", skin: "#d19a70", cloth: "#66734a", leather: "#61432d", metal: "#797767", accent: "#c38b47", speed: 1.35, wait: 1.55,
  },
  villager: {
    name: "Ivo Salgueiro", title: "Mensageiro", skin: "#b77d5d", cloth: "#704653", leather: "#4f3929", metal: "#777e77", accent: "#b8955a", speed: 1.85, wait: 0.75,
  },
  priest: {
    name: "Padre Anselmo", title: "Sacerdote da Capela", skin: "#d19a70", cloth: "#36312d", leather: "#2a2420", metal: "#c5a45e", accent: "#e0c36e", speed: 1.0, wait: 2.2,
  },
  beggar: {
    name: "Bartolomeu", title: "Pedinte da Praça", skin: "#a96f54", cloth: "#6b5b4b", leather: "#4a3c30", metal: "#5c5750", accent: "#8c7a62", speed: 0.95, wait: 2.8,
  },
};

function material(color, metalness = 0, roughness = 0.88, kind = "fabric") {
  return makeSkinnedMaterial(kind, color, metalness, roughness);
}

function addPart(parent, geometry, mat, x, y, z, castShadow = false) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

const FIRST_NAMES = ["Alden", "Brenna", "Corin", "Edda", "Falk", "Gwen", "Hale", "Isolde", "Jorin", "Kara", "Leof", "Mira", "Njal", "Orla", "Piers", "Runa", "Sten", "Thea", "Ulric", "Wren"];
const LAST_NAMES = ["do Vale", "Salgueiro", "Ferrovale", "da Colina", "Brumas", "Pedraluz", "Cinzal", "do Moinho", "Carvalho", "Corvino", "da Ponte", "Alvorada"];
const SKIN_TONES = ["#bb815f", "#a96f54", "#c68e69", "#d19a70", "#b77d5d", "#8f5e47", "#d9a97e"];
const HAIR_TONES = ["#2f2420", "#4a3526", "#7a5a34", "#9a9a96", "#1c1714", "#8a4a26"];
const CLOTH_TONES = ["#66734a", "#704653", "#385d69", "#7a5f3a", "#52476b", "#8a5a3c", "#4b6b58", "#6e3f3a"];

export class NPC {
  constructor(scene, world, roleKey, path, workPoint, appearance = {}, effects = null) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.hostile = false;
    this.temporary = false;
    this.removed = false;
    this.attackCooldown = 0;
    this.swingTimer = 0;
    this.meleeRange = roleKey === "guard" ? 2.0 : 0;
    this.meleeWind = 0;
    this.meleeDamage = 1;
    this.meleeCooldown = 1.35;
    this.spawnX = path[0].x;
    this.spawnZ = path[0].z;
    this.deadTime = 0;
    this.respawnTimer = 0;
    this._knockPower = 1.8;
    this._launch = 0;
    this._ragdollDuration = 0.55;
    this.roleKey = roleKey;
    this.role = { ...npcRoles[roleKey], ...appearance };
    this.name = this.role.name;
    this.title = this.role.title;
    this.path = path;
    this.workPoint = workPoint;
    this.waypoint = 0;
    this.pause = 0;
    this.animTime = roleKey.length * 0.87;
    this.walkPhase = roleKey.length * 1.31;
    this.moving = false;
    this.task = "";
    this.alive = true;
    this.health = 3;
    this.maxHealth = 3;
    this._hitStun = 0;
    this._flashTimer = 0;
    this._ragdollTime = 0;
    this._fallSide = 1;
    this._knockX = 0;
    this._knockZ = 0;
    this.x = path[0].x;
    this.z = path[0].z;
    this.vx = 0;
    this.vz = 0;
    this._moveSpeed = 0;
    this._distSq = 0;

    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.model.rotation.order = "YXZ";
    this.mode = "work";
    this.huntBoost = 0;
    this.onReport = null;
    this.modeTimer = 0;
    this.iconTimer = 0;
    this.threatX = 0;
    this.threatZ = 0;
    this.reportTarget = null;
    this.targetCheck = 0;
    this.lostTimer = 0;
    this.npcSystem = null;
    this.isBandit = Boolean(appearance.isBandit);
    this.root.userData.npcRef = this;
    this.root.userData.type = roleKey === "guard" ? NPC_TYPES.GUARD : this.isBandit ? NPC_TYPES.BANDIT : NPC_TYPES.VILLAGER;
    this.root.userData.state = NPC_STATES.WORK;
    this.root.userData.isDead = false;
    this.root.userData.isSleeping = false;
    this.root.userData.hasStolenGems = false;
    this.root.userData.isWantedByGuards = false;
    this.root.userData.nextTheftCheck = performance.now() + 1800 + Math.random() * 2200;
    this.root.add(this.model);
    this._buildModel();
    this.root.position.set(this.x, world.heightAt(this.x, this.z), this.z);
    scene.add(this.root);
  }

  _buildModel() {
    const skin = material(this.role.skin, 0, 1, "skin");
    const cloth = material(this.role.cloth, 0, 0.88, "fabric");
    const leather = material(this.role.leather, 0, 0.95, "leather");
    const metal = material(this.role.metal, this.roleKey === "guard" ? 0.55 : 0.18, 0.58, "metal");
    const accent = material(this.role.accent, 0.25, 0.62, this.roleKey === "farmer" ? "leather" : "metal");
    const dark = material("#332d27", 0, 0.95, "leather");
    const hair = material(this.role.hair || "#3b2d23", 0, 1, "leather");
    this.flashMaterials = [skin, cloth, leather, metal, accent, dark, hair];

    const body = buildHumanoid(this.model, {
      skin,
      shirt: cloth,
      sleeve: cloth,
      pants: leather,
      boots: dark,
      hair,
      forearm: this.roleKey === "guard" ? metal : skin,
    });
    Object.assign(this, body);
    const face = body.head;

    addPart(this.model, GEO.tunic, cloth, 0, 0.62, 0, true);
    addPart(this.model, GEO.belt, accent, 0, 0.83, 0);

    if (this.roleKey === "guard") {
      addPart(this.model, new THREE.BoxGeometry(0.36, 0.3, 0.08), metal, 0, 1.28, 0.1, true);
      addPart(this.model, new THREE.BoxGeometry(0.36, 0.3, 0.08), metal, 0, 1.28, -0.1);
      addPart(this.leftArm, GEO.pauldron, metal, 0, 0.02, 0);
      addPart(this.rightArm, GEO.pauldron, metal, 0, 0.02, 0);
      addPart(face, GEO.helmet, metal, 0, 0.035, 0);
      addPart(face, new THREE.BoxGeometry(0.022, 0.1, 0.02), metal, 0, -0.02, 0.128);
      addPart(face, new THREE.ConeGeometry(0.03, 0.14, 4), accent, 0, 0.17, -0.02);
      addPart(this.leftForearm, new THREE.BoxGeometry(0.3, 0.42, 0.04), cloth, 0, -0.14, 0.095);
      addPart(this.leftForearm, new THREE.SphereGeometry(0.05, 6, 5), accent, 0, -0.14, 0.13);
      addPart(this.model, new THREE.BoxGeometry(0.3, 0.46, 0.03), accent, 0, 0.62, 0.17);
      addPart(this.model, new THREE.BoxGeometry(0.34, 0.8, 0.03), cloth, 0, 1.08, -0.17);
      const spear = new THREE.Group();
      spear.position.set(0, -0.65, 0.04);
      this.rightArm.add(spear);
      const shaft = addPart(spear, GEO.shaft, leather, 0, 0.2, 0);
      shaft.scale.y = 1.9;
      addPart(spear, new THREE.ConeGeometry(0.05, 0.3, 5), metal, 0, 1.28, 0);
    } else if (this.roleKey === "smith") {
      addPart(this.model, new THREE.BoxGeometry(0.34, 0.62, 0.03), dark, 0, 0.98, 0.15);
      addPart(face, new THREE.CylinderGeometry(0.127, 0.127, 0.035, 9), accent, 0, 0.065, 0);
      this._addHammer(this.rightArm, leather, metal);
    } else if (this.roleKey === "merchant") {
      addPart(face, new THREE.ConeGeometry(0.14, 0.17, 6), cloth, 0, 0.15, 0);
      addPart(face, new THREE.CylinderGeometry(0.17, 0.17, 0.02, 8), accent, 0, 0.085, 0);
      const sash = addPart(this.model, new THREE.BoxGeometry(0.075, 0.62, 0.03), accent, 0, 1.15, 0.13);
      sash.rotation.z = 0.62;
      addPart(this.model, GEO.bag, leather, -0.28, 0.82, 0.02);
      addPart(this.model, new THREE.BoxGeometry(0.1, 0.09, 0.08), accent, 0.26, 0.82, 0.05);
    } else if (this.roleKey === "farmer") {
      addPart(face, new THREE.CylinderGeometry(0.235, 0.235, 0.02, 10), accent, 0, 0.1, 0);
      addPart(face, new THREE.SphereGeometry(0.128, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), accent, 0, 0.1, 0);
      addPart(this.model, new THREE.BoxGeometry(0.31, 0.52, 0.03), leather, 0, 0.98, 0.15);
      this._addHoe(this.rightArm, leather, metal);
    } else if (this.roleKey === "priest") {
      // Estola dourada e crucifixo no peito
      addPart(this.model, new THREE.BoxGeometry(0.06, 0.65, 0.035), accent, -0.09, 1.05, 0.155);
      addPart(this.model, new THREE.BoxGeometry(0.06, 0.65, 0.035), accent, 0.09, 1.05, 0.155);
      addPart(this.model, new THREE.BoxGeometry(0.035, 0.2, 0.04), accent, 0, 1.18, 0.165);
      addPart(this.model, new THREE.BoxGeometry(0.12, 0.035, 0.04), accent, 0, 1.21, 0.165);
      addPart(face, GEO.cap, cloth, 0, 0.045, 0);

      // Hóstia Sagrada e Cálice dourado para a celebração da Santa Missa
      const hostGroup = new THREE.Group();
      hostGroup.position.set(0, -0.45, 0.22);
      this.rightArm.add(hostGroup);
      const hostMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const chaliceMat = new THREE.MeshStandardMaterial({ color: 0xffdf6d, metalness: 0.7, roughness: 0.3 });
      const hostDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), hostMat);
      hostDisc.position.set(0, 0.35, 0);
      hostDisc.rotation.x = Math.PI / 2;
      hostGroup.add(hostDisc);
      const chalice = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.16, 8), chaliceMat);
      chalice.position.set(0, 0.12, 0);
      hostGroup.add(chalice);
      hostGroup.visible = false;
      this.hostMesh = hostGroup;
    } else if (this.roleKey === "beggar") {
      addPart(this.model, new THREE.BoxGeometry(0.28, 0.45, 0.03), leather, 0, 0.95, 0.15);
      addPart(this.model, GEO.bag, leather, -0.26, 0.82, 0.04);
    } else {
      addPart(face, GEO.cap, leather, 0, 0.04, 0);
      addPart(face, new THREE.CylinderGeometry(0.15, 0.15, 0.018, 8), leather, 0, 0.065, 0.02);
      addPart(this.model, new THREE.CylinderGeometry(0.085, 0.1, 0.06, 8), accent, 0, 1.5, 0);
      const strap = addPart(this.model, new THREE.BoxGeometry(0.05, 0.64, 0.02), leather, 0, 1.12, 0.135);
      strap.rotation.z = -0.62;
      addPart(this.model, GEO.bag, leather, 0.3, 0.88, 0);
    }
  }

  _addHammer(parent, wood, iron) {
    this.tool = new THREE.Group();
    this.tool.position.set(0, -0.62, 0.05);
    parent.add(this.tool);
    const shaft = addPart(this.tool, GEO.shaft, wood, 0, 0.05, 0);
    shaft.scale.y = 0.7;
    addPart(this.tool, new THREE.BoxGeometry(0.2, 0.1, 0.1), iron, 0, 0.4, 0);
  }

  _addHoe(parent, wood, iron) {
    this.tool = new THREE.Group();
    this.tool.position.set(0, -0.62, 0.05);
    parent.add(this.tool);
    const handle = addPart(this.tool, GEO.shaft, wood, 0, 0.2, 0);
    handle.scale.y = 1.35;
    handle.rotation.z = -0.1;
    const blade = addPart(this.tool, new THREE.BoxGeometry(0.18, 0.035, 0.09), iron, 0.06, 0.87, 0);
    blade.rotation.z = -0.2;
  }

  update(dt, playerX = 0, playerZ = 0) {
    if (this.removed) return;
    if (!this.alive) {
      this._updateDead(dt, playerX, playerZ);
      return;
    }
    this.animTime += dt;
    if (this._hitStun > 0) {
      const stun = this._hitStun / 0.82;
      this._hitStun = Math.max(0, this._hitStun - dt);
      this._knockMove(dt, stun);
    }
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const c = this._flashTimer > 0 ? FLASH_COLOR : ZERO_COLOR;
      const intensity = this._flashTimer > 0 ? 0.65 : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.copy(c);
        this.flashMaterials[i].emissiveIntensity = intensity;
      }
    }
    if (this.mode !== "work") {
      this._updateAlert(dt, playerX, playerZ);
      return;
    }
    // Rotina da Celebração da Santa Missa (NPCs assistem, comungam e recebem bênção)
    if (this.massTask) {
      this._updateMassBehavior(dt);
      return;
    }
    // Rotina de sono noturno (21h às 6h): interpola até sua âncora fixa de residência (home) e desativa renderização
    if (this.root.userData.state === NPC_STATES.SLEEP && this.roleKey !== "guard" && this.roleKey !== "werewolf") {
      const homeAnchor = this.root.userData.anchors?.home;
      const homeX = homeAnchor ? homeAnchor.x : this.spawnX;
      const homeZ = homeAnchor ? homeAnchor.z : this.spawnZ;
      const dxHome = homeX - this.x;
      const dzHome = homeZ - this.z;
      const distHomeSq = dxHome * dxHome + dzHome * dzHome;
      if (distHomeSq > 1.2 * 1.2) {
        const distHome = Math.sqrt(distHomeSq);
        const step = Math.min(this.role.speed * 1.15 * dt, distHome);
        this._stepTowards(dxHome / distHome, dzHome / distHome, step);
        this.model.rotation.y = Math.atan2(dxHome, dzHome);
        this.walkPhase += dt * 8.5;
        const ground = this.world.heightAt(this.x, this.z);
        this.root.position.set(this.x, ground, this.z);
        const stride = Math.sin(this.walkPhase) * 0.52;
        this.leftLeg.rotation.x = stride;
        this.rightLeg.rotation.x = -stride;
        bendJoints(this, stride, stride);
        this.task = "Recolhendo-se para dormir";
      } else {
        this.moving = false;
        this.vx = 0;
        this.vz = 0;
        this.task = "Dormindo";
        this.root.visible = false;
      }
      return;
    }
    if (this.pause > 0) this.pause -= dt;
    const target = this.path[this.waypoint];
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const distanceSq = dx * dx + dz * dz;
    this.moving = this.pause <= 0 && this._hitStun <= 0 && distanceSq > 0.42 * 0.42;
    if (this.moving) {
      const invDistance = 1 / Math.sqrt(distanceSq);
      const step = Math.min(this.role.speed * dt, Math.sqrt(distanceSq));
      const moveX = dx * invDistance * step;
      const moveZ = dz * invDistance * step;
      const nextX = this.x + moveX;
      const nextZ = this.z + moveZ;
      if (!this.world.isBlockedAt(nextX, nextZ, 0.28)) {
        this.x = nextX;
        this.z = nextZ;
        this.vx = moveX / Math.max(dt, 0.001);
        this.vz = moveZ / Math.max(dt, 0.001);
      } else {
        this.vx = 0;
        this.vz = 0;
        this.waypoint = (this.waypoint + 1) % this.path.length;
      }
      this.model.rotation.y = Math.atan2(this.vx, this.vz);
      this.walkPhase += dt * 8.5;
    } else {
      this.vx = 0;
      this.vz = 0;
      if (distanceSq <= 0.42 * 0.42) {
        this.waypoint = (this.waypoint + 1) % this.path.length;
        this.pause = this.role.wait;
      }
    }

    const ground = this.world.heightAt(this.x, this.z);
    this.root.position.set(this.x, ground, this.z);
    const stride = this.moving ? Math.sin(this.walkPhase) * 0.56 : 0;
    this.leftLeg.rotation.x = stride;
    this.rightLeg.rotation.x = -stride;
    bendJoints(this, stride, stride);
    this.leftArm.rotation.x = -stride * 0.82;
    this.rightArm.rotation.x = stride * 0.82;
    this.model.position.y = this.moving ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.03 : 0;

    if (this.roleKey === "smith") {
      const working = !this.moving;
      this.rightArm.rotation.x = working ? -0.88 + Math.sin(this.animTime * 4.2) * 0.52 : stride * 0.82;
      if (this.tool) this.tool.rotation.x = working ? Math.sin(this.animTime * 4.2 + 0.7) * 0.32 : 0;
      this.task = this.moving ? "Levando o ferro à forja" : "Martelando o aço";
    } else if (this.roleKey === "merchant") {
      this.task = this.moving ? "Repondo mercadorias" : "Negociando no balcão";
      if (!this.moving) this.rightArm.rotation.z = Math.sin(this.animTime * 1.7) * 0.24 - 0.18;
      else this.rightArm.rotation.z = 0;
    } else if (this.roleKey === "farmer") {
      const harvesting = !this.moving;
      this.task = this.moving ? "Percorrendo os canteiros" : "Colhendo a plantação";
      this.model.position.y = harvesting ? -0.12 + Math.sin(this.animTime * 2.8) * 0.035 : this.model.position.y;
      this.model.rotation.x = harvesting ? 0.12 + Math.sin(this.animTime * 2.8) * 0.08 : 0;
      this.rightArm.rotation.x = harvesting ? -0.9 + Math.sin(this.animTime * 3.1) * 0.45 : stride * 0.82;
      if (this.tool) this.tool.rotation.x = harvesting ? Math.sin(this.animTime * 3.1) * 0.28 : 0;
    } else if (this.roleKey === "guard") {
      this.task = "Patrulhando o portão";
      if (!this.moving) this.model.rotation.y += Math.sin(this.animTime * 0.55) * dt * 0.18;
    } else if (this.roleKey === "priest") {
      this.task = "Abençoando os fiéis e ouvindo confissões";
      if (!this.moving) {
        this.rightArm.rotation.x = -0.55 + Math.sin(this.animTime * 1.6) * 0.18;
      }
    } else if (this.roleKey === "beggar") {
      if (this.root.userData.state === "CHEERING" && (this.cheeringTimer = (this.cheeringTimer ?? 6) - dt) > 0) {
        this.task = "Comemorando a esmola recebida!";
        this.leftArm.rotation.x = -2.4 + Math.sin(this.animTime * 9) * 0.35;
        this.rightArm.rotation.x = -2.4 - Math.sin(this.animTime * 9) * 0.35;
        this.model.position.y = Math.abs(Math.sin(this.animTime * 7)) * 0.08;
      } else {
        if (this.root.userData.state === "CHEERING") this.root.userData.state = NPC_STATES.WORK;
        this.task = this.root.userData.hasReceivedAlms ? "Abençoando sua generosidade" : "Pedindo esmola (5 moedas)";
        if (!this.moving) this.rightArm.rotation.x = -0.95 + Math.sin(this.animTime * 2.2) * 0.12;
      }
    } else {
      if (this.root.userData.isMissionDebtor) {
        this.task = "Devedor da Estalagem (use Punhos ou E)";
      } else if (this.root.userData.isBountyBoss) {
        this.task = "Procurado pela Guarda (Alvo)";
      } else if (this.root.userData.type === NPC_TYPES.BANDIT && this.root.userData.hasStolenGems) {
        this.task = this.root.userData.isWantedByGuards ? "Despistando os guardas" : "Escondendo joias furtadas";
      } else {
        this.task = this.moving ? "Levando provisões" : "Descansando na estrada";
      }
      if (!this.moving) this.leftArm.rotation.z = Math.sin(this.animTime * 2) * 0.12;
    }
    if (this._hitStun > 0) {
      this.model.rotation.x = -0.18;
      this.leftArm.rotation.x = -1.05;
      this.rightArm.rotation.x = 0.78;
    } else if (this.roleKey !== "farmer") {
      this.model.rotation.x = 0;
    }
  }

  _updateMassBehavior(dt) {
    const task = this.massTask;
    const ground = this.world.heightAt(this.x, this.z);

    if (this.roleKey === "priest") {
      // Comportamento do Padre na Santa Missa
      if (this.massTarget) {
        const dx = this.massTarget.x - this.x;
        const dz = this.massTarget.z - this.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.45 * 0.45) {
          const dist = Math.sqrt(dSq);
          const step = Math.min(this.role.speed * dt, dist);
          this.x += (dx / dist) * step;
          this.z += (dz / dist) * step;
          this.model.rotation.y = Math.atan2(dx, dz);
          this.walkPhase += dt * 8.5;
          const stride = Math.sin(this.walkPhase) * 0.52;
          this.leftLeg.rotation.x = stride;
          this.rightLeg.rotation.x = -stride;
          bendJoints(this, stride, stride);
          this.task = "Dirigindo-se ao Altar-Mor";
        } else {
          if (typeof this.massTarget.yaw === "number") this.model.rotation.y = this.massTarget.yaw;
          this.leftLeg.rotation.x = 0;
          this.rightLeg.rotation.x = 0;
          bendJoints(this, 0, 0);
        }
      }

      if (task === "PREACHING") {
        this.task = "Celebrando a Santa Missa: Homilia no Altar";
        if (this.hostMesh) this.hostMesh.visible = false;
        // Gestos oratórios com ambos os braços
        this.rightArm.rotation.x = -1.1 + Math.sin(this.animTime * 2.2) * 0.35;
        this.leftArm.rotation.x = -0.9 + Math.cos(this.animTime * 1.8) * 0.3;
      } else if (task === "ELEVATION") {
        this.task = "Oferta da Sagrada Hóstia no Altar";
        if (this.hostMesh) this.hostMesh.visible = true;
        // Elevação solene com os dois braços erguidos ao céu
        this.rightArm.rotation.x = -2.6 + Math.sin(this.animTime * 1.5) * 0.08;
        this.leftArm.rotation.x = -2.6 - Math.sin(this.animTime * 1.5) * 0.08;
      } else if (task === "DISTRIBUTE_COMMUNION") {
        this.task = "Distribuindo a Sagrada Comunhão aos Fiéis";
        if (this.hostMesh) this.hostMesh.visible = true;
        this.rightArm.rotation.x = -1.2 + Math.sin(this.animTime * 3.0) * 0.2;
        this.leftArm.rotation.x = -1.0;
      } else if (task === "FINAL_BLESSING") {
        this.task = "Concedendo a Bênção Final aos Fiéis";
        if (this.hostMesh) this.hostMesh.visible = false;
        // Sinal da cruz no ar com o braço direito
        this.rightArm.rotation.x = -1.8 + Math.sin(this.animTime * 3.2) * 0.35;
        this.rightArm.rotation.z = Math.cos(this.animTime * 3.2) * 0.35;
        this.leftArm.rotation.x = -0.5;
      }
      this.root.position.set(this.x, ground, this.z);
      return;
    }

    // Comportamento dos Fiéis (Civis / Aldeões) na Santa Missa
    if (task === "GO_TO_PEW") {
      this.task = "Entrando na Igreja para a Santa Missa";
      if (this.massTarget) {
        const dx = this.massTarget.x - this.x;
        const dz = this.massTarget.z - this.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.4 * 0.4) {
          const dist = Math.sqrt(dSq);
          const step = Math.min(this.role.speed * dt, dist);
          this.x += (dx / dist) * step;
          this.z += (dz / dist) * step;
          this.model.rotation.y = Math.atan2(dx, dz);
          this.walkPhase += dt * 8.5;
          const stride = Math.sin(this.walkPhase) * 0.52;
          this.leftLeg.rotation.x = stride;
          this.rightLeg.rotation.x = -stride;
          bendJoints(this, stride, stride);
        } else {
          this.x = this.massTarget.x;
          this.z = this.massTarget.z;
          if (typeof this.massTarget.yaw === "number") this.model.rotation.y = this.massTarget.yaw;
          this.massTask = "SITTING_IN_PEW";
        }
      }
      this.root.position.set(this.x, ground, this.z);
      return;
    }

    if (task === "SITTING_IN_PEW") {
      this.task = "Sentado no banco ouvindo a Santa Missa";
      this.x = this.massTarget?.x ?? this.x;
      this.z = this.massTarget?.z ?? this.z;
      if (typeof this.massTarget?.yaw === "number") this.model.rotation.y = this.massTarget.yaw;

      // Pose de sentar no banco da igreja (Zero-GC)
      this.leftLeg.rotation.x = -1.55;
      this.rightLeg.rotation.x = -1.55;
      if (this.leftKnee) this.leftKnee.rotation.x = 1.55;
      if (this.rightKnee) this.rightKnee.rotation.x = 1.55;
      this.leftArm.rotation.x = -0.55;
      this.rightArm.rotation.x = -0.55;
      this.model.position.y = -0.28;
      this.root.position.set(this.x, ground, this.z);
      return;
    }

    if (task === "WALK_TO_COMMUNION") {
      this.task = "Indo ao Altar para comungar";
      this.model.position.y = 0;
      if (this.communionTarget) {
        const dx = this.communionTarget.x - this.x;
        const dz = this.communionTarget.z - this.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.45 * 0.45) {
          const dist = Math.sqrt(dSq);
          const step = Math.min(this.role.speed * dt, dist);
          this.x += (dx / dist) * step;
          this.z += (dz / dist) * step;
          this.model.rotation.y = Math.atan2(dx, dz);
          this.walkPhase += dt * 8.5;
          const stride = Math.sin(this.walkPhase) * 0.52;
          this.leftLeg.rotation.x = stride;
          this.rightLeg.rotation.x = -stride;
          bendJoints(this, stride, stride);
        } else {
          this.massTask = "RECEIVING_COMMUNION";
          this.communionTimer = 2.4;
        }
      }
      this.root.position.set(this.x, ground, this.z);
      return;
    }

    if (task === "RECEIVING_COMMUNION") {
      this.task = "Recebendo a Sagrada Comunhão diante do Altar";
      this.communionTimer = (this.communionTimer ?? 2.4) - dt;
      // Reverência/genuflexão com as mãos postas
      this.leftLeg.rotation.x = -0.8;
      this.rightLeg.rotation.x = -0.8;
      bendJoints(this, 0.7, 0.7);
      this.leftArm.rotation.x = -1.45;
      this.rightArm.rotation.x = -1.45;
      this.model.position.y = -0.22;
      this.model.rotation.x = 0.25;
      if (this.communionTimer <= 0) {
        this.massTask = "RETURN_TO_PEW";
        this.hasReceivedCommunion = true;
      }
      this.root.position.set(this.x, ground, this.z);
      return;
    }

    if (task === "RETURN_TO_PEW") {
      this.task = "Retornando ao banco após comungar";
      this.model.position.y = 0;
      this.model.rotation.x = 0;
      if (this.massTarget) {
        const dx = this.massTarget.x - this.x;
        const dz = this.massTarget.z - this.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.4 * 0.4) {
          const dist = Math.sqrt(dSq);
          const step = Math.min(this.role.speed * dt, dist);
          this.x += (dx / dist) * step;
          this.z += (dz / dist) * step;
          this.model.rotation.y = Math.atan2(dx, dz);
          this.walkPhase += dt * 8.5;
          const stride = Math.sin(this.walkPhase) * 0.52;
          this.leftLeg.rotation.x = stride;
          this.rightLeg.rotation.x = -stride;
          bendJoints(this, stride, stride);
        } else {
          this.x = this.massTarget.x;
          this.z = this.massTarget.z;
          if (typeof this.massTarget.yaw === "number") this.model.rotation.y = this.massTarget.yaw;
          this.massTask = "SITTING_IN_PEW";
        }
      }
      this.root.position.set(this.x, ground, this.z);
      return;
    }

    if (task === "LEAVE_CHURCH") {
      this.task = "Saindo da Igreja após a bênção final";
      this.model.position.y = 0;
      this.model.rotation.x = 0;
      if (this.exitTarget) {
        const dx = this.exitTarget.x - this.x;
        const dz = this.exitTarget.z - this.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > 1.2 * 1.2) {
          const dist = Math.sqrt(dSq);
          const step = Math.min(this.role.speed * dt, dist);
          this.x += (dx / dist) * step;
          this.z += (dz / dist) * step;
          this.model.rotation.y = Math.atan2(dx, dz);
          this.walkPhase += dt * 8.5;
          const stride = Math.sin(this.walkPhase) * 0.52;
          this.leftLeg.rotation.x = stride;
          this.rightLeg.rotation.x = -stride;
          bendJoints(this, stride, stride);
        } else {
          // Concluiu a saída: restaura rotina normal
          this.massTask = null;
          this.massTarget = null;
          this.communionTarget = null;
          this.exitTarget = null;
          this.hasReceivedCommunion = false;
          this.leftLeg.rotation.x = 0;
          this.rightLeg.rotation.x = 0;
          bendJoints(this, 0, 0);
          this.endAlert?.();
        }
      } else {
        this.massTask = null;
      }
      this.root.position.set(this.x, ground, this.z);
      return;
    }

    this.root.position.set(this.x, ground, this.z);
  }

  // Anda um passo em direção (dx, dz) deslizando em volta de obstáculos.
  _stepTowards(dx, dz, step) {
    const world = this.world;
    const nx = this.x + dx * step;
    const nz = this.z + dz * step;
    if (!world.isBlockedAt(nx, nz, 0.28)) { this.x = nx; this.z = nz; return true; }
    if (!world.isBlockedAt(nx, this.z, 0.28)) { this.x = nx; return true; }
    if (!world.isBlockedAt(this.x, nz, 0.28)) { this.z = nz; return true; }
    for (let i = 0; i < SIDE_SIGNS.length; i++) {
      const side = SIDE_SIGNS[i];
      const tx = this.x - dz * side * step;
      const tz = this.z + dx * side * step;
      if (!world.isBlockedAt(tx, tz, 0.28)) { this.x = tx; this.z = tz; return true; }
    }
    return false;
  }

  startAlert(mode, duration, threatX, threatZ) {
    this.mode = mode;
    this.modeTimer = duration;
    this.threatX = threatX;
    this.threatZ = threatZ;
    this.iconTimer = 0;
    this.pause = 0;
    if (this.tool) this.tool.rotation.x = 0;
    this.model.position.y = 0;
  }

  endAlert() {
    this.mode = "work";
    this.alerted = false;
    this.reportTarget = null;
    this.pause = 0.8;
    // volta ao ponto da rota mais próximo
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < this.path.length; i++) {
      const d = (this.path[i].x - this.x) ** 2 + (this.path[i].z - this.z) ** 2;
      if (d < bestDistance) { bestDistance = d; best = i; }
    }
    this.waypoint = best;
    this.model.rotation.x = 0;
    this.model.rotation.z = 0;
    this.leftArm.rotation.z = 0;
    this.rightArm.rotation.z = 0;
  }

  // Fuga, denúncia ao guarda mais próximo ou perseguição (guardas).
  _updateAlert(dt, playerX, playerZ) {
    this.animTime += dt;
    this.modeTimer -= dt;
    this.iconTimer -= dt;
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const c = this._flashTimer > 0 ? FLASH_COLOR : ZERO_COLOR;
      const intensity = this._flashTimer > 0 ? 0.65 : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.copy(c);
        this.flashMaterials[i].emissiveIntensity = intensity;
      }
    }
    if (this._hitStun > 0) {
      const stun = this._hitStun / 0.82;
      this._hitStun = Math.max(0, this._hitStun - dt);
      this._knockMove(dt, stun);
      this.model.rotation.x = -0.18;
      this.leftArm.rotation.x = -1.05;
      this.rightArm.rotation.x = 0.78;
      this.root.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);
      return;
    }
    if (this.iconTimer <= 0 && this.mode !== "hunt") {
      this.effects?.play("alert", this.x, this.root.position.y + 2.35, this.z, "#ffffff", 0.85);
      this.iconTimer = 1.5;
    }

    let dirX = 0;
    let dirZ = 0;
    let speed = 0;
    let arrived = false;
    const isNight = Boolean(this.npcSystem?.isNight);
    const isPlayerLit = Boolean(this.npcSystem ? this.npcSystem.isPlayerLit : true);
    const distSq = (playerX - this.x) ** 2 + (playerZ - this.z) ** 2;
    const hasTorch = Boolean(this.root.userData.hasTorch);
    // Mesmo o guarda com tocha só enxerga até o limite da luz da tocha (16m) se o jogador estiver no escuro
    const torchReachesPlayer = hasTorch && distSq < TORCH_VISION_RANGE_SQ;
    const hasDirectVision = !isNight || torchReachesPlayer || isPlayerLit || distSq < 9.0;

    if (this.mode === "hunt") {
      const loseRangeSq = isNight ? (hasTorch ? 22 * 22 : 13 * 13) : 42 * 42;
      if (!hasDirectVision && distSq > TORCH_VISION_RANGE_SQ) {
        this.lostTimer += dt * (distSq > 28 * 28 ? 1.8 : 1.0);
      } else if (distSq > loseRangeSq) {
        this.lostTimer += dt;
      } else {
        this.lostTimer = Math.max(0, this.lostTimer - dt * 2);
      }
      // Se o jogador se afastou o suficiente e o guarda perdeu o rastro por completo, ele desiste e volta à patrulha
      if (this.lostTimer > 6.5 || (isNight && !hasDirectVision && distSq > 36 * 36)) {
        this.lostTimer = 0;
        this.endAlert();
        return;
      }
    }

    if (this.mode === "flee") {
      // Fuga determinística: corre em direção à âncora de residência (home) ou ao portão mais próximo
      const safeAnchor = getDeterministicFleeTarget(this);
      if (safeAnchor && (safeAnchor.x - this.x) ** 2 + (safeAnchor.z - this.z) ** 2 > 1.8 * 1.8) {
        dirX = safeAnchor.x - this.x;
        dirZ = safeAnchor.z - this.z;
      } else {
        dirX = this.x - this.threatX;
        dirZ = this.z - this.threatZ;
      }
      speed = 4.3;
    } else if (this.mode === "report") {
      const guard = this.reportTarget;
      if (!guard || !guard.alive) {
        this.startAlert("flee", 4, playerX, playerZ);
        return;
      }
      dirX = guard.x - this.x;
      dirZ = guard.z - this.z;
      speed = 4.6;
      arrived = dirX * dirX + dirZ * dirZ < 2.4 * 2.4;
    } else if (!hasDirectVision && this.mode === "hunt") {
      // Perseguição sem visão direta (mesmo com tocha se o jogador estiver fora do raio da tocha): desvio angular
      _playerPosVec.set(playerX, 0, playerZ);
      const drift = updateGuardTracking(this.root, _playerPosVec, isPlayerLit, isNight, dt, false);
      dirX = drift.x;
      dirZ = drift.z;
      // Reduz levemente a velocidade quando perdido longe no escuro
      speed = distSq > 24 * 24 ? GUARD_SPEED * 0.78 : GUARD_SPEED;
    } else if (this.meleeRange > 0) {
      // guarda em combate com visão direta: espera a vez, prepara o golpe (visível) e recua depois
      this.root.userData.driftAngle = 0;
      const think = meleeThink(this, dt, playerX, playerZ);
      dirX = think.mx;
      dirZ = think.mz;
      speed = think.speed * (3.4 + Math.min(3, this.huntBoost) * 0.45);
    } else {
      dirX = playerX - this.x;
      dirZ = playerZ - this.z;
      speed = 3.4 + Math.min(3, this.huntBoost) * 0.45;
      if (dirX * dirX + dirZ * dirZ < 1.4 * 1.4) speed = 0;
    }
    const length = Math.hypot(dirX, dirZ);
    this.moving = speed > 0 && !arrived;
    if (length > 0.001 && this.moving) {
      dirX /= length;
      dirZ /= length;
      this._stepTowards(dirX, dirZ, speed * dt);
      this.vx = dirX * speed;
      this.vz = dirZ * speed;
      const target = Math.atan2(dirX, dirZ);
      const difference = Math.atan2(Math.sin(target - this.model.rotation.y), Math.cos(target - this.model.rotation.y));
      const rotRate = !hasDirectVision && this.mode === "hunt" ? Math.min(1, dt * 4.5) : 1 - Math.exp(-14 * dt);
      this.model.rotation.y += difference * rotRate;
      this.walkPhase += dt * 12.5;
    } else {
      this.vx = 0;
      this.vz = 0;
      if (this.mode === "hunt" && length > 0.001) {
        const target = Math.atan2(dirX, dirZ);
        const difference = Math.atan2(Math.sin(target - this.model.rotation.y), Math.cos(target - this.model.rotation.y));
        this.model.rotation.y += difference * (1 - Math.exp(-14 * dt));
      }
    }

    // em combate com visão direta o guarda sempre encara o jogador
    if (this.mode === "hunt" && this.meleeRange > 0 && hasDirectVision) {
      const target = Math.atan2(playerX - this.x, playerZ - this.z);
      const difference = Math.atan2(Math.sin(target - this.model.rotation.y), Math.cos(target - this.model.rotation.y));
      this.model.rotation.y += difference * (1 - Math.exp(-14 * dt));
    }
    const ground = this.world.heightAt(this.x, this.z);
    this.root.position.set(this.x, ground, this.z);
    const stride = this.moving ? Math.sin(this.walkPhase) * 0.9 : 0;
    this.leftLeg.rotation.x = stride;
    this.rightLeg.rotation.x = -stride;
    bendJoints(this, stride, stride);
    if (this.mode === "hunt") {
      this.leftArm.rotation.x = -stride * 0.8;
      this.rightArm.rotation.x = stride * 0.8 - 0.4;
      if (this.meleeWind > 0) {
        // preparação do golpe: o braço da arma sobe devagar
        this.rightArm.rotation.x = -0.4 - 1.9 * this.meleeWind;
        this.rightForearm.rotation.x = -0.3 - 0.6 * this.meleeWind;
      }
      if (this.swingTimer > 0) {
        this.swingTimer = Math.max(0, this.swingTimer - dt);
        this.rightArm.rotation.x = -2.1 * Math.sin((1 - this.swingTimer / 0.3) * Math.PI);
      }
    } else {
      // braços para o alto, em pânico
      this.leftArm.rotation.x = -2.5 + stride * 0.35;
      this.rightArm.rotation.x = -2.5 - stride * 0.35;
      this.leftArm.rotation.z = -0.25;
      this.rightArm.rotation.z = 0.25;
    }
    this.model.rotation.x = this.moving ? 0.22 : 0;
    this.model.position.y = this.moving ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.06 : 0;

    if (arrived) this.onReport?.(this);
    else if (this.mode !== "hunt" && this.modeTimer <= 0) this.endAlert();
  }

  takeHit(amount, directionX, directionZ, force = 1.8, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this._hitStun = 0.82;
    this._flashTimer = 0.18;
    this._knockX = directionX;
    this._knockZ = directionZ;
    this._knockPower = force;
    if (this.roleKey === "guard") this.alerted = true;
    if (this.health > 0) return false;
    this.alive = false;
    this.root.userData.isDead = true;
    releaseToken(this);
    releaseGuardTorch(this.root);
    this._ragdollTime = 0;
    this.deadTime = 0;
    this._launch = launch;
    this._ragdollDuration = launch > 0 ? 0.95 : 0.55;
    this._fallSide = directionX >= 0 ? 1 : -1;
    this.task = "Atordoado";
    return true;
  }

  _knockMove(dt, strength) {
    const step = this._knockPower * strength * dt;
    const nextX = this.x + this._knockX * step;
    const nextZ = this.z + this._knockZ * step;
    if (!this.world.isBlockedAt(nextX, nextZ, 0.28)) {
      this.x = nextX;
      this.z = nextZ;
    }
  }

  _updateDead(dt, playerX, playerZ) {
    this.deadTime += dt;
    if (this.deadTime < CORPSE_TIME) {
      this._updateRagdoll(dt);
      return;
    }
    const fade = (this.deadTime - CORPSE_TIME) / FADE_TIME;
    if (fade < 1) {
      this.root.scale.setScalar(Math.max(0.001, 1 - fade));
      return;
    }
    if (this.temporary) {
      if (this.remove) this.remove();
      else {
        this.root.visible = false;
        this.removed = true;
      }
      return;
    }
    if (this.root.visible) {
      this.root.visible = false;
      this.respawnTimer = RESPAWN_DELAY;
    }
    this.respawnTimer -= dt;
    if (this.respawnTimer > 0) return;
    const dx = playerX - this.spawnX;
    const dz = playerZ - this.spawnZ;
    if (dx * dx + dz * dz < RESPAWN_CLEARANCE * RESPAWN_CLEARANCE) {
      this.respawnTimer = 1.5;
      return;
    }
    this.respawn();
  }

  respawn() {
    this.alive = true;
    this.health = this.maxHealth;
    this.alerted = false;
    this.mode = "work";
    this.reportTarget = null;
    this.root.userData.isDead = false;
    this.root.userData.isSleeping = false;
    this.root.userData.hasStolenGems = false;
    this.root.userData.isWantedByGuards = false;
    this.root.userData.state = NPC_STATES.WORK;
    this.root.userData.nextTheftCheck = performance.now() + 2000 + Math.random() * 2000;
    this.x = this.spawnX;
    this.z = this.spawnZ;
    this.vx = 0;
    this.vz = 0;
    this.waypoint = this.path.length > 1 ? 1 : 0;
    this.pause = 0.6;
    this._hitStun = 0;
    this._flashTimer = 0;
    this._knockX = 0;
    this._knockZ = 0;
    this._ragdollTime = 0;
    this.deadTime = 0;
    this.root.visible = true;
    this.root.scale.setScalar(1);
    this.model.position.set(0, 0, 0);
    this.model.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
    for (let i = 0; i < this.flashMaterials.length; i++) {
      this.flashMaterials[i].emissive.set("#000000");
      this.flashMaterials[i].emissiveIntensity = 0;
    }
    this.root.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);
    if (this.roleKey === "guard" && this.npcSystem?.torches) {
      this.npcSystem.torches.attachGuardTorchProp(this.root, this.leftForearm);
      setupGuardTorch(this.root, Boolean(this.npcSystem.isNight), this.npcSystem.torches.guardTorchPool);
    }
    this.effects?.play("smoke", this.x, this.root.position.y + 0.9, this.z, "#e6dcc0", 1.3);
  }

  _updateRagdoll(dt) {
    this._ragdollTime += dt;
    const progress = Math.min(1, this._ragdollTime / this._ragdollDuration);
    const fall = 1 - progress;
    this._knockMove(dt, fall);
    const ground = this.world.heightAt(this.x, this.z);
    const arc = this._launch * 4 * progress * fall;
    this.root.position.set(this.x, ground + arc + Math.sin(this._ragdollTime * 17) * 0.16 * fall, this.z);
    this.model.position.y = 0.36 * progress;
    this.model.rotation.z = this._fallSide * 1.32 * progress;
    this.model.rotation.x = -0.34 * progress + (this._launch > 0 ? progress * Math.PI * 2 : 0);
    this.leftArm.rotation.x = -1.05 * progress;
    this.rightArm.rotation.x = 0.68 * progress;
    this.leftArm.rotation.z = -0.52 * progress;
    this.rightArm.rotation.z = 0.42 * progress;
    this.leftLeg.rotation.x = 0.72 * progress;
    this.rightLeg.rotation.x = -0.56 * progress;
  }
}

function ringPath(cx, cz, radius, start = 0) {
  const path = [];
  for (let i = 0; i < 4; i++) {
    const angle = start + (i / 4) * Math.PI * 2;
    path.push({ x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius });
  }
  return path;
}

function around(point, offset) {
  return [
    { x: point.x, z: point.z },
    { x: point.x + offset, z: point.z + offset * 0.4 },
    { x: point.x - offset * 0.3, z: point.z + offset },
  ];
}

export class NPCSystem {
  constructor(scene, world, settlement, effects = null) {
    this.scene = scene;
    this.world = world;
    this.settlement = settlement;
    this.npcs = [];
    this.missionNpcPool = new Map();
    this.nearest = null;
    this.effects = effects;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.wantedCooldown = 0;
    this.playerX = 0;
    this.playerZ = 0;
    this.onWantedChange = null;
    this.onAlert = null;
    this.onClear = null;
    this.wantedPoints = 0;
    this.torches = null;
    this.isNight = false;
    this.isPlayerLit = true;
    this._wasNight = null;
    const smith = settlement.blacksmith;
    const market = settlement.market;
    const gate = settlement.gate;
    const well = settlement.well;
    const cityAnchors = settlement.cityData?.anchors || null;
    const profMap = {
      smith: "blacksmiths",
      merchant: "taverns",
      farmer: "farms",
      guard: "gates",
      villager: "houses",
    };
    const add = (role, path, work, appearance) => {
      const npc = new NPC(scene, world, role, path, work, appearance, effects);
      npc.npcSystem = this;
      npc.onReport = (reporter) => this._report(reporter);
      if (cityAnchors && settlement.cityData?.assignNpcAnchors) {
        settlement.cityData.assignNpcAnchors(npc.root, cityAnchors, profMap[role] || "houses");
      }
      this.npcs.push(npc);
      return npc;
    };
    add("guard", [
      { x: -3.2, z: -41.5 }, { x: 3.2, z: -41.5 }, { x: 3.2, z: -45.1 }, { x: -3.2, z: -45.1 },
    ], gate);
    add("smith", [
      { x: smith.x, z: smith.z }, { x: 14.1, z: -22 }, { x: 11.7, z: -22.8 },
    ], smith);
    add("merchant", [
      { x: market.x, z: market.z }, { x: -18.8, z: -18.7 }, { x: -19.5, z: -22.8 },
    ], market);
    add("farmer", [
      { x: -35.4, z: 7.1 }, { x: -26.7, z: 7.1 }, { x: -26.7, z: -6.1 }, { x: -35.4, z: -6.1 },
    ], { x: -31, z: 0 });
    add("villager", [
      { x: well.x + 2, z: well.z + 2 }, { x: -8.2, z: -17.4 }, { x: -4.4, z: -30.5 }, { x: 1.5, z: -35.2 },
    ], well);
    add("villager", [
      { x: market.x + 2.4, z: market.z + 1.8 }, { x: well.x - 1.8, z: well.z + 1.2 }, { x: smith.x - 2.2, z: smith.z + 1.5 },
    ], market, {
      name: "Vasco Corvino",
      title: "Andarilho",
      cloth: "#52476b",
      hair: "#1c1714",
      isBandit: true,
    });
    const capitalChurch = settlement.churches?.[0];
    if (capitalChurch) {
      add("priest", around(capitalChurch.spawn, 1.4), capitalChurch.spawn, {
        name: "Padre Anselmo",
        title: "Sacerdote de Caldera",
      });
    }
    add("beggar", [
      { x: well.x - 2.2, z: well.z + 1.8 }, { x: well.x - 3.0, z: well.z - 1.2 },
    ], well, {
      name: "Bartolomeu",
      title: "Pedinte da Praça",
    });

    for (const place of settlement.villages || []) this._populateVillage(add, place);
  }

  _populateVillage(add, place) {
    const random = makeRandom(place.village.seed * 104729);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const look = () => ({
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      skin: pick(SKIN_TONES),
      cloth: pick(CLOTH_TONES),
      hair: pick(HAIR_TONES),
    });
    const { well, village } = place;

    if (village.kind === "forge") {
      add("smith", around(place.work, 1.6), place.work, { ...look(), title: "Ferreiro" });
    } else if (village.kind === "market") {
      add("merchant", around(place.work, 1.5), place.work, { ...look(), title: "Mercador" });
    } else if (village.kind === "farm") {
      add("farmer", place.farmPath, place.work, { ...look(), title: "Agricultor" });
    } else {
      add("guard", place.patrol, well, { ...look(), title: "Vigia da Atalaia" });
    }

    if (village.kind !== "watch") {
      add("guard", ringPath(well.x, well.z, 5.4, random() * 6), well, { ...look(), title: "Guarda local" });
    }
    add("villager", ringPath(well.x, well.z, 6.4, random() * 6), well, { ...look(), title: "Aldeão" });
    add("villager", ringPath(well.x, well.z, 7.4, random() * 6), well, { ...look(), title: "Aldeão", isBandit: true });
    if (place.church) {
      add("priest", around(place.church.spawn, 1.3), place.church.spawn, { ...look(), cloth: "#36312d", title: "Sacerdote" });
    }
    add("beggar", around(well, 2.2), well, { ...look(), cloth: "#6b5b4b", title: "Pedinte" });
  }

  /**
   * Reaproveita ou instancia um NPC de missão dinâmica (Devedor ou Líder de Bandidos) sem alocar lixo em missões repetidas.
   */
  spawnMissionNPC(roleKey, x, z, options = {}) {
    const slotKey = options.slotKey || roleKey;
    let npc = this.missionNpcPool.get(slotKey);
    const path = around({ x, z }, 1.6);
    const work = { x, z };
    if (!npc) {
      npc = new NPC(
        this.scene,
        this.world,
        roleKey,
        path,
        work,
        {
          name: options.name || "Forasteiro",
          title: options.title || "Alvo de Missão",
          cloth: options.cloth || "#5a3d31",
          hair: options.hair || "#241d18",
          isBandit: Boolean(options.isBandit),
        },
        this.effects,
      );
      npc.npcSystem = this;
      npc.onReport = (reporter) => this._report(reporter);
      this.npcs.push(npc);
      this.missionNpcPool.set(slotKey, npc);
    }
    npc.spawnX = x;
    npc.spawnZ = z;
    npc.path = path;
    npc.work = work;
    npc.name = options.name || npc.name;
    npc.title = options.title || npc.title;
    npc.maxHealth = options.maxHealth || 8;
    npc.meleeRange = options.meleeRange ?? (options.isBountyBoss ? 2.1 : 0);
    npc.meleeDamage = options.meleeDamage ?? (options.isBountyBoss ? 2 : 1);
    npc.isBandit = Boolean(options.isBandit);
    npc.respawn();
    npc.health = npc.maxHealth;
    npc.root.userData.type = options.isBandit ? NPC_TYPES.BANDIT : NPC_TYPES.VILLAGER;
    npc.root.userData.hasStolenGems = Boolean(options.isBandit);
    npc.root.userData.isMissionDebtor = Boolean(options.isDebtor);
    npc.root.userData.isBountyBoss = Boolean(options.isBountyBoss);
    npc.root.userData.debtPunches = 0;
    npc.root.userData.str = options.str ?? 10;
    npc.root.userData.con = options.con ?? 10;
    if (options.task) npc.task = options.task;
    return npc;
  }

  _nearestGuard(npc) {
    let best = null;
    let bestDistance = Infinity;
    for (let i = 0; i < this.npcs.length; i++) {
      const guard = this.npcs[i];
      if (guard.roleKey !== "guard" || !guard.alive) continue;
      const d = (guard.x - npc.x) ** 2 + (guard.z - npc.z) ** 2;
      if (d < bestDistance) { bestDistance = d; best = guard; }
    }
    return best;
  }

  // Pontos de procurado: o nível (1 a 5) é o teto do total acumulado.
  addWantedPoints(points) {
    this.wantedPoints = (this.wantedPoints || 0) + points;
    this.wantedTimer = 30;
    const level = Math.min(5, Math.ceil(this.wantedPoints));
    if (level !== this.wanted) {
      const rose = level > this.wanted;
      this.wanted = level;
      this.onWantedChange?.(level);
      if (rose && level > 1) this.onAlert?.(`Procurado nível ${level}: reforços a caminho!`);
    }
  }

  _hunt(guard) {
    if (!guard.alive) return;
    if (guard.mode !== "hunt") this.effects?.play("alert", guard.x, guard.root.position.y + 2.4, guard.z, "#ffffff", 0.95);
    guard.mode = "hunt";
    guard.alerted = true;
    guard.pause = 0;
    guard.huntBoost = Math.min(3, this.wanted);
  }

  // Um crime aconteceu em (x, z): quem vê foge, denuncia ou, se for guarda, ataca.
  notifyCrime(x, z, radius, victim = null, severity = 0.25) {
    const radiusSq = radius * radius;
    let guardSaw = false;
    let hasGuard = false;
    for (let i = 0; i < this.npcs.length; i++) if (this.npcs[i].alive && this.npcs[i].roleKey === "guard") { hasGuard = true; break; }
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (!npc.alive || npc.temporary) continue;
      const dx = npc.x - x;
      const dz = npc.z - z;
      if (dx * dx + dz * dz > radiusSq) continue;
      if (npc.roleKey === "guard") {
        guardSaw = true;
        this._hunt(npc);
        continue;
      }
      if (npc.mode === "report") continue;
      if (npc !== victim && hasGuard && Math.random() < 0.55) {
        npc.reportTarget = this._nearestGuard(npc);
        npc.startAlert("report", 28, this.playerX, this.playerZ);
      } else {
        npc.startAlert("flee", 5.5 + Math.random() * 2, this.playerX, this.playerZ);
      }
    }
    if (guardSaw) this.addWantedPoints(severity);
  }

  // A testemunha chegou ao guarda: a guarda inteira da região parte atrás do jogador.
  _report(reporter) {
    const guard = reporter.reportTarget;
    reporter.endAlert();
    this.effects?.play("star", reporter.x, reporter.root.position.y + 1.8, reporter.z, "#ffd88a", 1);
    this.addWantedPoints(0.6);
    for (let i = 0; i < this.npcs.length; i++) {
      const other = this.npcs[i];
      if (other.roleKey !== "guard" || !other.alive) continue;
      const near = guard && (other.x - guard.x) ** 2 + (other.z - guard.z) ** 2 < 70 * 70;
      if (other === guard || near) this._hunt(other);
    }
    this.onAlert?.(`${reporter.name} alertou a guarda!`);
  }

  clearWanted() {
    this.wanted = 0;
    this.wantedPoints = 0;
    this.wantedTimer = 0;
    this.onClear?.();
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc.alive && !npc.temporary && npc.mode !== "work") npc.endAlert();
    }
    this.onWantedChange?.(0);
  }

  update(dt, playerX, playerZ, isNight = false, isPlayerLit = true, timeOfDay = 12) {
    const clampedDt = Math.min(dt, 0.05);
    this.playerX = playerX;
    this.playerZ = playerZ;
    this.isNight = isNight;
    this.isPlayerLit = isPlayerLit;
    this.timeOfDay = timeOfDay;

    // Ao transicionar entre dia e noite, sorteia (30% à noite) ou recolhe as tochas dos guardas vivos
    if (this._wasNight !== isNight && this.torches) {
      this._wasNight = isNight;
      const pool = this.torches.guardTorchPool;
      for (let i = 0; i < this.npcs.length; i++) {
        const npc = this.npcs[i];
        if (!npc.alive || npc.removed) continue;
        if (npc.roleKey === "guard" || npc.roleKey === "footman") {
          this.torches.attachGuardTorchProp(npc.root, npc.leftForearm);
          setupGuardTorch(npc.root, isNight, pool);
        }
      }
    }

    if (this.wantedCooldown > 0) this.wantedCooldown -= clampedDt;
    if (this.wanted > 0) {
      let anyGuardSeesPlayer = false;
      for (let i = 0; i < this.npcs.length; i++) {
        const guard = this.npcs[i];
        if (!(guard.roleKey === "guard" || guard.hostile) || !guard.alive || guard.mode !== "hunt") continue;
        const dSq = (guard.x - playerX) ** 2 + (guard.z - playerZ) ** 2;
        const hasTorch = Boolean(guard.root.userData.hasTorch);
        const sightRangeSq = !isNight || isPlayerLit ? 18 * 18 : hasTorch ? TORCH_VISION_RANGE_SQ : 4.5 * 4.5;
        if (dSq < sightRangeSq) {
          anyGuardSeesPlayer = true;
          this.wantedTimer = Math.max(this.wantedTimer, 10);
          break;
        }
      }
      // Se nenhum guarda (nem mesmo os de tocha) consegue enxergar o jogador à distância, o tempo de busca cai mais rápido
      this.wantedTimer -= clampedDt * (anyGuardSeesPlayer ? 1.0 : isNight && !isPlayerLit ? 2.2 : 1.35);
      if (this.wantedTimer <= 0) {
        this.clearWanted();
        this.onAlert?.("A guarda perdeu o seu rastro e desistiu da perseguição.");
      }
    }
    let nearest = null;
    let nearestDistanceSq = 16 * 16;
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      const dx = playerX - npc.x;
      const dz = playerZ - npc.z;
      const distanceSq = dx * dx + dz * dz;
      npc.distanceSq = distanceSq;
      if (npc.alive && npc.mode === "report" && (npc.targetCheck -= clampedDt) <= 0) {
        npc.targetCheck = 1;
        if (!npc.reportTarget || !npc.reportTarget.alive) npc.reportTarget = this._nearestGuard(npc);
      }
      if (npc.alive && !npc.temporary && npc.roleKey !== "horse") {
        updateNPCRoutine(npc.root, timeOfDay, this.npcs);
        if (npc.root.userData.isBountyBoss && npc.mode !== "hunt" && distanceSq < 18 * 18) {
          this._hunt(npc);
          npc.task = "Emboscando você!";
        }
        // Se um bandido oculto foi flagrado roubando (5% de chance), guardas próximos o abatem
        if (npc.root.userData.isWantedByGuards) {
          const guard = this._nearestGuard(npc);
          if (guard && (guard.x - npc.x) ** 2 + (guard.z - npc.z) ** 2 < 22 * 22) {
            const gdx = npc.x - guard.x;
            const gdz = npc.z - guard.z;
            const gDist = Math.hypot(gdx, gdz);
            if (gDist > 1.5) {
              guard._stepTowards(gdx / gDist, gdz / gDist, 3.8 * clampedDt);
              guard.model.rotation.y = Math.atan2(gdx, gdz);
              guard.root.position.set(guard.x, guard.world.heightAt(guard.x, guard.z), guard.z);
            } else {
              npc.takeHit(3, gdx / Math.max(0.1, gDist), gdz / Math.max(0.1, gDist), 3.2);
              this.onAlert?.(`${guard.name} deteve o ladrão ${npc.name}!`);
            }
          }
        }
      }
      if (distanceSq > ACTIVE_DISTANCE_SQ && npc.mode === "work") {
        // Longe do jogador: não anima nem desenha, mas o respawn continua contando.
        if (npc.alive) {
          npc.root.visible = false;
        } else {
          npc.update(clampedDt, playerX, playerZ);
        }
        continue;
      }
      if (npc.alive && !npc.root.userData.isSleeping) npc.root.visible = true;
      npc.update(clampedDt, playerX, playerZ);
      if (!npc.alive || npc.root.userData.isSleeping) continue;
      // Também verifica se o guarda com tocha acesa está iluminando o jogador (< 10 m)
      if (isNight && !this.isPlayerLit && npc.root.userData.hasTorch && distanceSq < 10 * 10) {
        this.isPlayerLit = true;
      }
      if (!npc.temporary && distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = npc;
      }
    }
    this.nearest = nearest;
  }
}
