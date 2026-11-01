import * as THREE from "three";
import { makeSkinnedMaterial } from "./skins.js";

const GEO = {
  torso: new THREE.CapsuleGeometry(0.38, 0.96, 4, 12),
  flank: new THREE.SphereGeometry(0.39, 10, 8).scale(0.96, 1.05, 1.0),
  chest: new THREE.SphereGeometry(0.41, 10, 8).scale(1.0, 1.15, 1.05),
  withers: new THREE.ConeGeometry(0.12, 0.22, 5),
  neckBase: new THREE.CylinderGeometry(0.18, 0.26, 0.48, 8),
  neckTop: new THREE.CylinderGeometry(0.14, 0.18, 0.42, 8),
  jaw: new THREE.SphereGeometry(0.15, 8, 6).scale(0.85, 1.1, 1.15),
  muzzle: new THREE.BoxGeometry(0.16, 0.16, 0.32),
  ear: new THREE.ConeGeometry(0.045, 0.16, 4),
  eye: new THREE.SphereGeometry(0.02, 5, 4),
  mane: new THREE.BoxGeometry(0.06, 0.58, 0.16),
  maneForelock: new THREE.ConeGeometry(0.05, 0.16, 4),
  thighFront: new THREE.CapsuleGeometry(0.105, 0.34, 4, 8),
  thighRear: new THREE.CapsuleGeometry(0.13, 0.38, 4, 8),
  joint: new THREE.SphereGeometry(0.075, 7, 6),
  cannon: new THREE.CapsuleGeometry(0.062, 0.38, 4, 8),
  pastern: new THREE.CylinderGeometry(0.055, 0.065, 0.1, 7),
  hoof: new THREE.CylinderGeometry(0.08, 0.095, 0.1, 8),
  tailBase: new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6),
  tailPlume: new THREE.ConeGeometry(0.11, 0.65, 5),
  saddle: new THREE.BoxGeometry(0.5, 0.12, 0.52),
  saddleCantle: new THREE.BoxGeometry(0.48, 0.12, 0.14),
  stirrup: new THREE.TorusGeometry(0.06, 0.015, 4, 8),
  blanket: new THREE.BoxGeometry(0.64, 0.06, 0.68),
  bridle: new THREE.BoxGeometry(0.18, 0.18, 0.03),
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
    // Tronco anatômico equino: peito largo, cernelha alta e flancos esculpidos
    add(m, GEO.torso, hide, 0, 1.14, 0).rotation.x = Math.PI / 2;
    add(m, GEO.chest, hide, 0, 1.18, 0.44);
    add(m, GEO.flank, hide, 0, 1.15, -0.42);
    const withers = add(m, GEO.withers, hide, 0, 1.48, 0.46);
    withers.rotation.x = -0.3;

    // Pescoço musculoso arqueado e cabeça nobre
    this.neck = new THREE.Group();
    this.neck.position.set(0, 1.42, 0.65);
    m.add(this.neck);

    const nBase = add(this.neck, GEO.neckBase, hide, 0, 0.16, 0.14);
    nBase.rotation.x = 0.65;
    const nTop = add(this.neck, GEO.neckTop, hide, 0, 0.42, 0.28);
    nTop.rotation.x = 0.52;

    // Cabeça esculpida: queixo arredondado, focinho cônico e olhos
    add(this.neck, GEO.jaw, hide, 0, 0.62, 0.38);
    const muzzle = add(this.neck, GEO.muzzle, hide, 0, 0.56, 0.55);
    muzzle.rotation.x = 0.42;
    add(this.neck, GEO.bridle, leather, 0, 0.58, 0.45);

    // Olhos escuros laterais
    for (const side of [-1, 1]) {
      add(this.neck, GEO.eye, dark, side * 0.14, 0.64, 0.42);
      const ear = add(this.neck, GEO.ear, hide, side * 0.08, 0.78, 0.32);
      ear.rotation.z = -side * 0.15;
    }

    // Crina volumosa e topete
    const mane = add(this.neck, GEO.mane, dark, 0, 0.38, 0.08);
    mane.rotation.x = 0.58;
    add(this.neck, GEO.maneForelock, dark, 0, 0.74, 0.36);

    // Cauda realista bifurcada em leque
    const tailBase = add(m, GEO.tailBase, dark, 0, 1.25, -0.95);
    tailBase.rotation.x = -2.1;
    const tailPlume = add(m, GEO.tailPlume, dark, 0, 0.95, -1.22);
    tailPlume.rotation.x = -2.35;

    // Sela de montaria com estribos, cantle traseiro e manta bordada
    add(m, GEO.blanket, blanket, 0, 1.48, -0.05);
    add(m, GEO.saddle, leather, 0, 1.54, -0.05);
    add(m, GEO.saddleCantle, leather, 0, 1.62, -0.28);
    for (const side of [-1, 1]) {
      const stirrup = add(m, GEO.stirrup, leather, side * 0.32, 1.15, -0.05);
      stirrup.rotation.y = Math.PI / 2;
    }

    this.legs = [];
    this.knees = [];
    // Pernas articuladas com coxas robustas, junta de jarrete/joelho e cascos esculpidos
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const isFront = sz > 0;
      const leg = new THREE.Group();
      leg.position.set(sx * 0.22, 1.05, sz * 0.56);
      m.add(leg);

      add(leg, isFront ? GEO.thighFront : GEO.thighRear, hide, 0, -0.18, 0);
      const knee = new THREE.Group();
      knee.position.set(0, -0.42, 0);
      leg.add(knee);

      add(knee, GEO.joint, hide, 0, 0, 0);
      add(knee, GEO.cannon, hide, 0, -0.25, 0);
      add(knee, GEO.pastern, hide, 0, -0.46, 0.02);
      add(knee, GEO.hoof, dark, 0, -0.54, 0.03);

      this.legs.push(leg);
      this.knees.push(knee);
    }
    this.root.visible = false;
    scene.add(this.root);
  }

  activate(x, z, heading) {
    this.removed = false;
    this.alive = true;
    this.maxHealth = 6;
    this.health = 6;
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
    // Registra na Spatial Hash Grid para que armas e projéteis consigam atingi-lo
    if (this.manager?.npcs?.spatialGrid) {
      this.manager.npcs.spatialGrid.remove(this);
      this.manager.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius || 0.85);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
    }
  }

  remove() {
    this.removed = true;
    this.alive = false;
    this.root.visible = false;
    this.rider = null;
    if (this.manager?.npcs?.spatialGrid) {
      this.manager.npcs.spatialGrid.remove(this);
    }
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
    this._knockX = directionX;
    this._knockZ = directionZ;
    this._knock = force * 0.6;
    if (this.effects) {
      this.effects.play("star", this.x, (this.root?.position?.y || 0) + 1.2, this.z, "#ff3322", 1.4);
    }
    if (this.health > 0) {
      if (this.kind === "field") this.flee(this.manager?.player?.x ?? this.x, this.manager?.player?.z ?? this.z, 6);
      return false;
    }
    this.alive = false;
    this.deadTime = 0;
    this.fallSide = directionX >= 0 ? 1 : -1;
    this.speed = 0;
    if (this.manager?.npcs?.spatialGrid) {
      this.manager.npcs.spatialGrid.remove(this);
    }
    if (this.effects) {
      this.effects.play("dust", this.x, (this.root?.position?.y || 0) + 0.8, this.z, "#3b2418", 2.4);
      this.effects.play("star", this.x, (this.root?.position?.y || 0) + 1.1, this.z, "#ff2211", 1.8);
    }
    // Desmonta cavaleiro (NPC)
    const rider = this.rider;
    this.rider = null;
    if (rider && rider.alive && rider.dismount) rider.dismount(this);

    // Se o jogador estiver montado neste cavalo, desmonta e cai no chão
    if (this.manager?.player?.mounted === this) {
      import("./riding.js").then(({ dismountHorse }) => {
        dismountHorse(this.manager.player);
      });
    }
    return true;
  }

  _blocked(x, z) {
    if (this.world?.isHorseBlocked) {
      return this.world.isHorseBlocked(x, z, 0.7);
    }
    const found = this.world?.obstacleAt ? this.world.obstacleAt(x, z, 0.7) : null;
    return found === "tree" || found === "house";
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
    const groundY = this.world.horseHeightAt ? this.world.horseHeightAt(this.x, this.z) : this.world.heightAt(this.x, this.z);
    this.root.position.set(this.x, groundY + this.height, this.z);

    // Atualiza célula na Spatial Hash Grid quando o cavalo se desloca
    if (this.alive && this.manager?.npcs?.spatialGrid) {
      const curCX = Math.floor(this.x * 0.0625);
      const curCZ = Math.floor(this.z * 0.0625);
      if (curCX !== this._spatialCX || curCZ !== this._spatialCZ) {
        this.manager.npcs.spatialGrid.remove(this);
        this.manager.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius || 0.85);
        this._spatialCX = curCX;
        this._spatialCZ = curCZ;
      }
    }
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
