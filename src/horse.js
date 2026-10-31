import * as THREE from "three";
import { makeSkinnedMaterial } from "./skins.js";

const GEO = {
  body: new THREE.CapsuleGeometry(0.36, 0.95, 4, 10),
  neck: new THREE.CapsuleGeometry(0.15, 0.5, 3, 8),
  head: new THREE.CapsuleGeometry(0.115, 0.3, 3, 8),
  ear: new THREE.ConeGeometry(0.04, 0.12, 4),
  thigh: new THREE.CapsuleGeometry(0.095, 0.3, 3, 7),
  shin: new THREE.CapsuleGeometry(0.058, 0.38, 3, 7),
  hoof: new THREE.BoxGeometry(0.11, 0.07, 0.14),
  tail: new THREE.CapsuleGeometry(0.06, 0.55, 3, 6),
  mane: new THREE.BoxGeometry(0.05, 0.5, 0.12),
  saddle: new THREE.BoxGeometry(0.46, 0.08, 0.48),
  blanket: new THREE.BoxGeometry(0.6, 0.05, 0.64),
};

const CORPSE_TIME = 5;
const MAX_TURN = 2.6;
const FLASH_COLOR = new THREE.Color("#85764a");
const ZERO_COLOR = new THREE.Color("#000000");

function add(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Cavalo de guerra: uma entidade própria (vida, hitbox, morte), separada do cavaleiro.
export class Horse {
  constructor(scene, world, effects, coat = "#4a3022") {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.kind = "war";
    this.wild = false;
    this.tamed = false;
    this.tame = 0;
    this.owner = null;
    this.controlled = false;
    this.stay = false;
    this.home = null;
    this.manager = null;
    this.fieldTimer = 0;
    this.graze = 0;
    this.wanderHeading = 0;
    this.rearMax = 0.6;
    this.vy = 0;
    this.height = 0;
    this.roleKey = "horse";
    this.name = "Corcel de guerra";
    this.title = "Montaria";
    this.task = "Em investida";
    this.hostile = true;
    this.temporary = true;
    this.removed = true;
    this.alive = false;
    this.alerted = false;
    this.mode = "hunt";
    this.maxHealth = 7;
    this.health = 7;
    this.hitRadius = 0.85;
    this.hitHeight = 1.9;
    this.headHeight = 1.5;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.distanceSq = 0;
    this.rider = null;
    this.state = "charge";
    this.stateTimer = 0;
    this.lanceCooldown = 0;
    this.lancePrep = 0;
    this.trampleCooldown = 0;
    this.deadTime = 0;
    this.fallSide = 1;
    this.rear = 0;
    this.gait = 0;
    this.bob = 0;
    this.fade = 0;
    this.awayTimer = 0;
    this._knockX = 0;
    this._knockZ = 0;
    this._knock = 0;
    this._flash = 0;

    const hide = makeSkinnedMaterial("leather", coat, 0, 0.9);
    const dark = makeSkinnedMaterial("leather", "#241812", 0, 0.95);
    const leather = makeSkinnedMaterial("leather", "#5a4030", 0, 0.9);
    const blanket = makeSkinnedMaterial("fabric", "#7a2a2a", 0, 0.9);
    this.materials = [hide, dark, leather, blanket];

    this.root = new THREE.Group();
    this.userData = this.root.userData;
    this.position = this.root.position;
    this.targetHay = null;
    this.model = new THREE.Group();
    this.model.rotation.order = "YXZ";
    this.root.add(this.model);
    const m = this.model;
    add(m, GEO.body, hide, 0, 1.1, 0).rotation.x = Math.PI / 2;
    // pescoço e cabeça num grupo próprio: baixam para pastar
    this.neck = new THREE.Group();
    this.neck.position.set(0, 1.42, 0.68);
    m.add(this.neck);
    add(this.neck, GEO.neck, hide, 0, 0.13, 0.12).rotation.x = 0.7;
    add(this.neck, GEO.head, hide, 0, 0.41, 0.44).rotation.x = 2.0;
    for (const side of [-1, 1]) add(this.neck, GEO.ear, hide, side * 0.07, 0.6, 0.34);
    add(this.neck, GEO.mane, dark, 0, 0.26, 0.02).rotation.x = 0.7;
    add(m, GEO.tail, dark, 0, 1.14, -1.1).rotation.x = -2.2;
    add(m, GEO.blanket, blanket, 0, 1.47, -0.05);
    add(m, GEO.saddle, leather, 0, 1.53, -0.05);

    this.legs = [];
    this.knees = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.2, 0.97, sz * 0.58);
      m.add(leg);
      add(leg, GEO.thigh, hide, 0, -0.2, 0);
      const knee = new THREE.Group();
      knee.position.set(0, -0.45, 0);
      leg.add(knee);
      add(knee, GEO.shin, hide, 0, -0.27, 0);
      add(knee, GEO.hoof, dark, 0, -0.52, 0.02);
      this.legs.push(leg);
      this.knees.push(knee);
    }
    this.root.visible = false;
    scene.add(this.root);
  }

  activate(x, z, heading) {
    this.removed = false;
    this.alive = true;
    this.health = this.maxHealth;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.state = "charge";
    this.stateTimer = 0;
    this.lanceCooldown = 1;
    this.lancePrep = 0;
    this.trampleCooldown = 0;
    this.deadTime = 0;
    this.fade = 0;
    this.rear = 0;
    this.awayTimer = 0;
    this.controlled = false;
    this.stay = false;
    this.height = 0;
    this.vy = 0;
    this.graze = 0;
    this.root.visible = true;
    this.root.scale.setScalar(1);
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this.root.position.set(x, this.world.heightAt(x, z), z);
    for (const material of this.materials) {
      material.emissive.set("#000000");
      material.emissiveIntensity = 0;
    }
  }

  remove() {
    this.removed = true;
    this.alive = false;
    this.root.visible = false;
    this.rider = null;
  }

  dismiss() {
    if (!this.removed && this.fade <= 0) this.fade = 1;
  }

  takeHit(amount, directionX, directionZ, force = 1.8, launch = 0) {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this.rear = 0.6;
    this.rearMax = 0.6;
    this._flash = 0.18;
    if (this.kind === "field") this.flee(this.manager?.player?.x ?? this.x, this.manager?.player?.z ?? this.z, 6);
    this._knockX = directionX;
    this._knockZ = directionZ;
    this._knock = force * 0.6;
    if (this.health > 0) return false;
    this.alive = false;
    this.deadTime = 0;
    this.fallSide = directionX >= 0 ? 1 : -1;
    this.speed = 0;
    // o cavaleiro cai junto
    const rider = this.rider;
    this.rider = null;
    if (rider && rider.alive) rider.dismount(this);
    return true;
  }

  _blocked(x, z) {
    return this.world.isBlockedAt(x, z, 0.7);
  }

  update(dt, playerX, playerZ) {
    if (this.removed) return;
    if (this.controlled) return;
    if (this.lanceCooldown > 0) this.lanceCooldown -= dt;
    if (this.trampleCooldown > 0) this.trampleCooldown -= dt;

    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt);
      const c = this._flash > 0 ? FLASH_COLOR : ZERO_COLOR;
      const intensity = this._flash > 0 ? 0.65 : 0;
      for (let i = 0; i < this.materials.length; i++) {
        this.materials[i].emissive.copy(c);
        this.materials[i].emissiveIntensity = intensity;
      }
    }

    if (!this.alive) {
      this._updateDead(dt);
      return;
    }
    if (this.fade > 0) {
      this.fade -= dt * 1.2;
      this.root.scale.setScalar(Math.max(0.001, this.fade));
      if (this.fade <= 0) {
        this.effects?.play("smoke", this.x, this.root.position.y + 1, this.z, "#e6dcc0", 1.6);
        this.remove();
      }
      return;
    }

    if (this.kind === "field") {
      this._updateField(dt, playerX, playerZ);
      return;
    }
    const dx = playerX - this.x;
    const dz = playerZ - this.z;
    const distance = Math.hypot(dx, dz);
    let wantHeading = this.heading;
    let wantSpeed = 0;

    if (this.rider && this.rider.alive) {
      this.task = "Em investida";
      if (this.state === "charge") {
        wantHeading = Math.atan2(dx, dz);
        wantSpeed = distance > 4 ? 9.2 : 7;
        const alignment = Math.sin(this.heading) * dx + Math.cos(this.heading) * dz;
        // passou pelo jogador: afasta-se para voltar a investir
        if (distance < 2.2 && alignment < 0) {
          this.state = "retreat";
          this.stateTimer = 2.4;
        }
      } else {
        wantHeading = Math.atan2(-dx, -dz) + Math.sin(this.stateTimer * 3) * 0.5;
        wantSpeed = 8.2;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0 || distance > 20) this.state = "charge";
      }
    } else {
      // solto: foge a galope e some
      this.task = "Fugindo";
      wantHeading = Math.atan2(-dx, -dz);
      wantSpeed = 7.5;
      this.awayTimer += dt;
      if (this.awayTimer > 9 || distance > 70) this.dismiss();
    }

    const turn = Math.atan2(Math.sin(wantHeading - this.heading), Math.cos(wantHeading - this.heading));
    const maxTurn = MAX_TURN * dt * (this.speed > 6 ? 0.8 : 1.4);
    this.heading += Math.max(-maxTurn, Math.min(maxTurn, turn));
    const accel = (wantSpeed > this.speed ? 9 : 14) * dt;
    this.speed += Math.max(-accel, Math.min(accel, wantSpeed - this.speed));

    const step = this.speed * dt;
    const nx = this.x + Math.sin(this.heading) * step;
    const nz = this.z + Math.cos(this.heading) * step;
    if (!this._blocked(nx, nz)) {
      this.x = nx;
      this.z = nz;
    } else if (!this._blocked(nx, this.z)) {
      this.x = nx;
      this.speed *= 0.8;
    } else if (!this._blocked(this.x, nz)) {
      this.z = nz;
      this.speed *= 0.8;
    } else {
      this.speed *= 0.4;
      this.heading += dt * 2.5;
    }
    if (this._knock > 0.05) {
      const k = this._knock * dt;
      if (!this._blocked(this.x + this._knockX * k, this.z + this._knockZ * k)) {
        this.x += this._knockX * k;
        this.z += this._knockZ * k;
      }
      this._knock *= Math.exp(-6 * dt);
    }

    this._animate(dt);
  }

  flee(fromX, fromZ, seconds = 4) {
    if (!this.alive || this.controlled) return;
    this.state = "flee";
    this.fieldTimer = seconds;
    this.threatX = fromX;
    this.threatZ = fromZ;
    this.stay = false;
  }

  // assobio do dono: vem trotando até o jogador
  summon() {
    if (!this.alive || this.controlled) return;
    this.state = "come";
    this.stay = false;
    this.fieldTimer = 30;
  }

  buck() {
    this.rear = 1.1;
    this.rearMax = 1.1;
    this.speed = 0;
  }

  _move(dt, wantHeading, wantSpeed, turnRate) {
    const turn = Math.atan2(Math.sin(wantHeading - this.heading), Math.cos(wantHeading - this.heading));
    const maxTurn = turnRate * dt;
    this.heading += Math.max(-maxTurn, Math.min(maxTurn, turn));
    const accel = (wantSpeed > this.speed ? 8 : 12) * dt;
    this.speed += Math.max(-accel, Math.min(accel, wantSpeed - this.speed));
    const step = this.speed * dt;
    const nx = this.x + Math.sin(this.heading) * step;
    const nz = this.z + Math.cos(this.heading) * step;
    if (!this._blocked(nx, nz)) {
      this.x = nx;
      this.z = nz;
    } else if (!this._blocked(nx, this.z)) {
      this.x = nx;
    } else if (!this._blocked(this.x, nz)) {
      this.z = nz;
    } else {
      this.speed *= 0.3;
      this.wanderHeading += 1.2;
    }
  }

  // Cavalo solto no campo: pasta, anda, trota, foge se assustado e volta ao dono quando chamado.
  _updateField(dt, px, pz) {
    const player = this.manager?.player;
    const dx = px - this.x;
    const dz = pz - this.z;
    const distance = Math.hypot(dx, dz);
    this.fieldTimer -= dt;

    if (this.userData.state === "APPROACH_HAY" && this.userData.targetHay?.visible) {
      this.state = "approach_hay";
    }

    // furtivo (agachado) ou atraído por isca de feno: os cavalos não se assustam com o jogador
    const stealth = Boolean(player && player.crouching) || this.state === "approach_hay";
    if (!this.tamed && !stealth && this.state !== "flee") {
      const pace = player ? player.speedRatio * 7.2 : 0;
      if ((distance < 5 && pace > 2.5) || (distance < 14 && pace > 6.2)) this.flee(px, pz, 4.5);
    }

    let wantHeading = this.heading;
    let wantSpeed = 0;
    let turnRate = 1.8;
    let graze = 0;
    switch (this.state) {
      case "approach_hay": {
        const hay = this.userData.targetHay || this.targetHay;
        if (!hay || !hay.visible) {
          this.userData.state = "";
          this.state = "graze";
          this.fieldTimer = 4;
          break;
        }
        const hdx = hay.position.x - this.x;
        const hdz = hay.position.z - this.z;
        const hDistSq = hdx * hdx + hdz * hdz;
        if (hDistSq > 1.35 * 1.35) {
          wantHeading = Math.atan2(hdx, hdz);
          wantSpeed = hDistSq > 6 * 6 ? 5.2 : 2.6;
          turnRate = 2.6;
          graze = 0;
          this.task = "Atraído pelo feno";
        } else {
          wantSpeed = 0;
          graze = 1;
          this.tame = Math.max(this.tame, 3);
          this.tamed = true;
          this.task = "Comendo feno (manso)";
        }
        break;
      }
      case "flee":
        wantHeading = Math.atan2(this.x - this.threatX, this.z - this.threatZ) + Math.sin(this.fieldTimer * 2) * 0.35;
        wantSpeed = 11.5;
        turnRate = 3.2;
        if (this.fieldTimer <= 0 && distance > 18) {
          this.state = this.tamed ? "stand" : "graze";
          this.fieldTimer = 3;
        }
        break;
      case "come":
        wantHeading = Math.atan2(dx, dz);
        wantSpeed = Math.min(11, distance * 1.5);
        turnRate = 3;
        if (distance < 3.4) {
          this.state = "stand";
          this.stay = true;
          this.fieldTimer = 4;
        }
        break;
      case "stand":
        wantSpeed = 0;
        graze = this.fieldTimer < 0 ? 0 : this.graze;
        if (this.fieldTimer <= 0) {
          this.fieldTimer = 3 + Math.random() * 5;
          this.graze = Math.random() < 0.4 ? 1 : 0;
        }
        graze = this.graze;
        break;
      case "walk":
      case "trot": {
        wantSpeed = this.state === "trot" ? 5.6 : 1.8;
        wantHeading = this.wanderHeading;
        turnRate = 1.4;
        if (this.home) {
          const hx = this.home.x - this.x;
          const hz = this.home.z - this.z;
          if (hx * hx + hz * hz > this.home.r * this.home.r) wantHeading = Math.atan2(hx, hz);
        }
        if (this.fieldTimer <= 0) {
          this.state = "graze";
          this.fieldTimer = 4 + Math.random() * 6;
        }
        break;
      }
      default: // graze
        graze = 1;
        wantSpeed = 0;
        if (this.fieldTimer <= 0) {
          this.state = Math.random() < 0.7 ? "walk" : "trot";
          this.fieldTimer = 3 + Math.random() * 4;
          this.wanderHeading = this.heading + (Math.random() - 0.5) * 2.4;
        }
    }
    this.graze += (graze - this.graze) * Math.min(1, dt * 3);
    this._move(dt, wantHeading, wantSpeed, turnRate);
    this._animate(dt);
  }

  _animate(dt) {
    const ratio = Math.min(1, this.speed / 9);
    this.gait += dt * (4 + this.speed * 1.5);
    const p = this.gait;
    const amplitude = 0.25 + ratio * 0.75;
    // pares diagonais em galope: frente-esq + trás-dir
    const phases = [0, Math.PI * 0.35, Math.PI, Math.PI * 1.35];
    for (let i = 0; i < 4; i++) {
      const s = Math.sin(p + phases[i]);
      this.legs[i].rotation.x = s * amplitude * (this.speed > 0.4 ? 1 : 0);
      this.knees[i].rotation.x = Math.max(0, -Math.sin(p + phases[i] + 0.9)) * amplitude * 1.3 * (this.speed > 0.4 ? 1 : 0);
    }
    this.bob = Math.sin(p * 2) * 0.06 * ratio;
    if (this.rear > 0) {
      this.rear = Math.max(0, this.rear - dt);
      this.model.rotation.x = -Math.sin((this.rear / this.rearMax) * Math.PI) * 0.55;
    } else {
      this.model.rotation.x = Math.sin(p * 2 + 1) * 0.04 * ratio;
    }
    this.neck.rotation.x += (this.graze * 0.95 - this.neck.rotation.x) * (1 - Math.exp(-5 * dt));
    this.model.rotation.y = this.heading;
    this.model.rotation.z = 0;
    this.model.position.y = this.bob;
    this.root.position.set(this.x, this.world.heightAt(this.x, this.z) + this.height, this.z);
  }

  _updateDead(dt) {
    this.deadTime += dt;
    const progress = Math.min(1, this.deadTime / 0.6);
    this.model.rotation.z = this.fallSide * 1.5 * progress;
    this.model.position.y = 0.12 * progress;
    for (let i = 0; i < 4; i++) {
      this.legs[i].rotation.x = (i % 2 ? 0.7 : -0.5) * progress;
      this.knees[i].rotation.x = 0.4 * progress;
    }
    this.root.position.set(this.x, this.world.heightAt(this.x, this.z), this.z);
    if (this.deadTime > CORPSE_TIME) {
      const fade = (this.deadTime - CORPSE_TIME) / 0.8;
      this.root.scale.setScalar(Math.max(0.001, 1 - fade));
      if (fade >= 1) this.remove();
    }
  }
}
