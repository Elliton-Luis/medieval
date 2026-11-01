import * as THREE from "three";
import { thatchTexture } from "./textures.js";
import { makeGlowTexture } from "./torches.js";
import { addEvil } from "./rpg.js";

let hayMaterial = null;
let burntMaterial = null;

// Fardo de feno inflamável.
export function createHay(scene, world, x, z, ry = 0) {
  if (!hayMaterial) {
    hayMaterial = new THREE.MeshStandardMaterial({ map: thatchTexture(), color: "#d8bf72", roughness: 1, flatShading: true });
    burntMaterial = new THREE.MeshStandardMaterial({ map: thatchTexture(), color: "#241c16", roughness: 1, flatShading: true });
  }
  const y = world.heightAt(x, z);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.82), hayMaterial);
  mesh.position.set(x, y + 0.39, z);
  mesh.rotation.y = ry;
  mesh.castShadow = false;
  scene.add(mesh);
  const c = Math.abs(Math.cos(ry));
  const s = Math.abs(Math.sin(ry));
  const hw = (c * 1.15 + s * 0.82) / 2;
  const hd = (s * 1.15 + c * 0.82) / 2;
  const box = world.addBox(x - hw, x + hw, z - hd, z + hd, y, y + 0.8, { cam: false });
  return { x, y: y + 0.4, z, mesh, box, burning: false, burnt: false, timer: 0, ignite: 0, spread: 0, flames: [] };
}

const FLAME_POOL = 48;

// Incêndios: a vela acesa ateia fogo no feno; o fogo se espalha e pode queimar telhados de palha.
export class FireSystem {
  constructor({ scene, world, candle, player, combat, npcs, effects, ui }) {
    this.scene = scene;
    this.world = world;
    this.candle = candle;
    this.player = player;
    this.combat = combat;
    this.npcs = npcs;
    this.effects = effects;
    this.ui = ui;
    this.hay = [];
    this.houses = [];
    this.time = 0;
    this.hurtCooldown = 0;
    this.smokeTimer = 0;
    const glow = makeGlowTexture("255,230,160");
    this.pool = [];
    for (let i = 0; i < FLAME_POOL; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: "#ff8a30", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({ sprite, used: false, phase: Math.random() * 6 });
    }
    this.flameLight = null;
    this.patches = [];
    this.patchTick = 0;
  }

  register(hay, houses) {
    this.hay = hay;
    this.houses = houses;
  }

  _flame(x, y, z, size) {
    const item = this.pool.find((f) => !f.used);
    if (!item) return null;
    item.used = true;
    item.size = size;
    item.sprite.position.set(x, y, z);
    item.sprite.visible = true;
    return item;
  }

  _release(items) {
    for (const f of items) {
      f.used = false;
      f.sprite.visible = false;
    }
    items.length = 0;
  }

  igniteHay(bale, byPlayer) {
    if (bale.burning || bale.burnt) return;
    bale.burning = true;
    bale.timer = 24;
    for (let i = 0; i < 3; i++) {
      const f = this._flame(bale.x + (Math.random() - 0.5) * 0.7, bale.y + 0.3 + i * 0.2, bale.z + (Math.random() - 0.5) * 0.5, 1.3);
      if (f) bale.flames.push(f);
    }
    this.effects.play("smoke", bale.x, bale.y + 0.6, bale.z, "#8a847a", 1.4);
    if (byPlayer) {
      this.ui.showToast("O feno pegou fogo!");
      addEvil(1.5, "Incêndio em feno");
      this.npcs.notifyCrime(bale.x, bale.z, 26, null, 0.5);
    }
  }

  // Poça de chamas (pote de óleo, bomba incendiária): queima quem está dentro e ateia o que é inflamável.
  addPatch(x, z, radius, duration) {
    const y = this.world.heightAt(x, z);
    const patch = { x, y, z, radius, life: duration, flames: [], contact: new Map() };
    const count = Math.min(8, Math.max(3, Math.ceil(radius * 2.4)));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius * 0.85;
      const f = this._flame(x + Math.cos(angle) * r, y + 0.35, z + Math.sin(angle) * r, 1.2 + Math.random() * 0.6);
      if (f) patch.flames.push(f);
    }
    this.patches.push(patch);
    return patch;
  }

  // Acende o feno que estiver no raio (explosão incendiária).
  igniteNear(x, z, radius) {
    for (const bale of this.hay) {
      if (bale.burning || bale.burnt) continue;
      if ((bale.x - x) ** 2 + (bale.z - z) ** 2 < radius * radius) this.igniteHay(bale, false);
    }
  }

  _updatePatches(dt) {
    this.patchTick -= dt;
    const tick = this.patchTick <= 0;
    if (tick) this.patchTick = 0.7;
    for (let i = this.patches.length - 1; i >= 0; i--) {
      const patch = this.patches[i];
      patch.life -= dt;
      for (const f of patch.flames) {
        const k = 0.8 + 0.3 * Math.sin(this.time * 11 + f.phase) + 0.15 * Math.sin(this.time * 25 + f.phase * 2);
        f.sprite.scale.set(f.size * k, f.size * 1.4 * k, 1);
      }
      if (patch.life <= 0) {
        this._release(patch.flames);
        this.patches.splice(i, 1);
        continue;
      }
      if (tick) {
        const r2 = patch.radius * patch.radius;
        for (const npc of this.npcs.npcs) {
          if (!npc.alive || npc.controlled || npc.removed || npc.roleKey === "horse") continue;
          const dx = npc.x - patch.x;
          const dz = npc.z - patch.z;
          if (dx * dx + dz * dz > r2) continue;
          const d = Math.max(0.05, Math.hypot(dx, dz));
          this.combat.damageNPC(npc, 1, dx / d, dz / d, "#ff9a3a", 0.6, 1.4, 0, false, true);
        }
        for (const bale of this.hay) {
          if (bale.burning || bale.burnt) continue;
          if ((bale.x - patch.x) ** 2 + (bale.z - patch.z) ** 2 < (patch.radius + 0.9) ** 2) this.igniteHay(bale, false);
        }
        for (const house of this.houses) {
          if (!house.thatch || house.burning || house.burned) continue;
          const o = house.outer;
          const ddx = Math.max(o.minX - patch.x, 0, patch.x - o.maxX);
          const ddz = Math.max(o.minZ - patch.z, 0, patch.z - o.maxZ);
          if (ddx * ddx + ddz * ddz < (patch.radius + 1.2) ** 2) {
            house.burnWatch = (house.burnWatch || 0) + 0.7;
            if (house.burnWatch > 2.5) this._burnHouse(house);
          }
        }
      }
      const player = this.player;
      if (this.hurtCooldown <= 0 && !player.knockedOut && (player.x - patch.x) ** 2 + (player.z - patch.z) ** 2 < (patch.radius + 0.3) ** 2) {
        this.hurtCooldown = 1.3;
        this.combat.hurtPlayer(1, patch.x, patch.z, { knock: 2, weapon: "burn" });
      }
    }
  }

  _burnHouse(house) {
    house.burning = true;
    house.burnTimer = 30;
    house.roofFlames = [];
    for (let i = 0; i < 6; i++) {
      const lx = (Math.random() - 0.5) * house.W * 0.8;
      const lz = (Math.random() - 0.5) * house.D * 0.7;
      const c = Math.round(Math.cos(house.ry));
      const s = Math.round(Math.sin(house.ry));
      const f = this._flame(house.x + lx * c + lz * s, house.floorY + 3.6 + Math.random() * 0.9, house.z - lx * s + lz * c, 1.8);
      if (f) house.roofFlames.push(f);
    }
    this.ui.showToast("O telhado de palha pegou fogo!");
    addEvil(3, "Incêndio de habitação");
    this.npcs.notifyCrime(house.x, house.z, 30, null, 0.6);
  }

  update(dt) {
    this.time += dt;
    this._updatePatches(dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    this.smokeTimer -= dt;
    const hand = this.candle.hand;
    const candleOn = this.candle.lit;
    const player = this.player;

    for (const bale of this.hay) {
      if (bale.burnt) continue;
      if (!bale.burning) {
        if (candleOn && (hand.x - bale.x) ** 2 + (hand.z - bale.z) ** 2 < 1.3 * 1.3 && Math.abs(hand.y - bale.y) < 1.6) {
          bale.ignite += dt;
          if (bale.ignite > 0.8) this.igniteHay(bale, true);
        } else {
          bale.ignite = Math.max(0, bale.ignite - dt);
        }
        continue;
      }
      bale.timer -= dt;
      for (const f of bale.flames) {
        const k = 0.8 + 0.3 * Math.sin(this.time * 12 + f.phase) + 0.15 * Math.sin(this.time * 27 + f.phase * 2);
        f.sprite.scale.set(f.size * k, f.size * 1.4 * k, 1);
      }
      if (this.smokeTimer <= 0) this.effects.play("smoke", bale.x, bale.y + 1, bale.z, "#7a746a", 1.1);
      // espalha para o feno vizinho
      for (const other of this.hay) {
        if (other.burning || other.burnt) continue;
        if ((other.x - bale.x) ** 2 + (other.z - bale.z) ** 2 < 3.3 * 3.3) {
          other.spread += dt;
          if (other.spread > 2) this.igniteHay(other, false);
        }
      }
      // telhados de palha próximos queimam
      for (const house of this.houses) {
        if (!house.thatch || house.burning || house.burned) continue;
        const o = house.outer;
        const dx = Math.max(o.minX - bale.x, 0, bale.x - o.maxX);
        const dz = Math.max(o.minZ - bale.z, 0, bale.z - o.maxZ);
        if (dx * dx + dz * dz < 3.8 * 3.8) {
          house.burnWatch = (house.burnWatch || 0) + dt;
          if (house.burnWatch > 3) this._burnHouse(house);
        }
      }
      // queimadura
      if (this.hurtCooldown <= 0 && !player.knockedOut && (player.x - bale.x) ** 2 + (player.z - bale.z) ** 2 < 1.4 * 1.4) {
        this.hurtCooldown = 1.3;
        this.combat.hurtPlayer(1, bale.x, bale.z, { knock: 2, weapon: "burn" });
        this.ui.showToast("Queimaste-te!");
      }
      if (bale.timer <= 0) {
        bale.burnt = true;
        bale.burning = false;
        this._release(bale.flames);
        bale.mesh.material = burntMaterial;
        bale.mesh.scale.y = 0.45;
        bale.mesh.position.y = bale.y - 0.2;
        if (bale.box) bale.box.active = false;
      }
    }

    for (const house of this.houses) {
      if (!house.burning) continue;
      house.burnTimer -= dt;
      for (const f of house.roofFlames) {
        const k = 0.8 + 0.3 * Math.sin(this.time * 10 + f.phase) + 0.15 * Math.sin(this.time * 23 + f.phase * 2);
        f.sprite.scale.set(f.size * k, f.size * 1.5 * k, 1);
      }
      if (this.smokeTimer <= 0) this.effects.play("smoke", house.x, house.floorY + 4.6, house.z, "#6a645a", 2.4);
      if (house.burnTimer <= 0) {
        house.burning = false;
        house.burned = true;
        this._release(house.roofFlames);
        if (house.meshes.roof) house.meshes.roof.material = burntMaterial;
      }
    }
    if (this.smokeTimer <= 0) this.smokeTimer = 0.7;
  }
}
