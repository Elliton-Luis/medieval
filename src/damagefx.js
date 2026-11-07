import * as THREE from "three";

const CSS = `
.damage-flash { position: absolute; inset: 0; z-index: 3; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at center, rgba(120,0,0,0) 38%, rgba(200,12,12,.55) 78%, rgba(150,0,0,.9) 100%); }
.lowhp-vignette { position: absolute; inset: 0; z-index: 3; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(60,0,0,.65) 100%); }
#game.lowhp #world-canvas { filter: saturate(.55) contrast(1.06) brightness(.94); }
`;

// Efeitos de tela de dano: flash vermelho nas bordas, vida baixa (tela dessaturada) e batimento cardíaco.
export class DamageFx {
  constructor({ container, audio, player }) {
    this.container = container;
    this.audio = audio;
    this.player = player;
    this.flashValue = 0;
    this.beatTimer = 0;
    this.low = false;
    if (!document.getElementById("damagefx-style")) {
      const style = document.createElement("style");
      style.id = "damagefx-style";
      style.textContent = CSS;
      document.head.append(style);
    }
    this.flashEl = document.createElement("div");
    this.flashEl.className = "damage-flash";
    this.vignetteEl = document.createElement("div");
    this.vignetteEl.className = "lowhp-vignette";
    container.append(this.flashEl, this.vignetteEl);
  }

  flash(strength = 1) {
    this.flashValue = Math.min(1, Math.max(this.flashValue, strength));
  }

  update(dt) {
    const player = this.player;
    if (this.flashValue > 0.001) {
      this.flashValue = Math.max(0, this.flashValue - dt * 2.6);
      this.flashEl.style.opacity = this.flashValue.toFixed(3);
    } else if (this.flashEl.style.opacity !== "0") {
      this.flashEl.style.opacity = "0";
    }

    // vida baixa: 40% ou menos (e ainda vivo)
    const low = player.health > 0 && !player.dead && player.health <= Math.max(1, Math.ceil(player.maxHealth * 0.4));
    if (low !== this.low) {
      this.low = low;
      this.container.classList.toggle("lowhp", low);
      if (!low) this.vignetteEl.style.opacity = "0";
    }
    if (low) {
      const critical = player.health <= 1;
      const period = critical ? 0.78 : 1.05;
      this.beatTimer -= dt;
      if (this.beatTimer <= 0) {
        this.beatTimer = period;
        this.audio.heartbeat(critical ? 1 : 0.75);
        this.pulse = 1;
      }
      this.pulse = Math.max(0, (this.pulse || 0) - dt * 2.2);
      this.vignetteEl.style.opacity = (0.45 + this.pulse * 0.45).toFixed(3);
    } else {
      this.beatTimer = 0;
    }
  }
}


// ============================================================================
// Sangue: gotas com física que, ao tocar o chão, viram manchas achatadas (decals) e secam/somem.
// Tudo em dois InstancedMesh pré-alocados (gotas + manchas): zero alocação por frame.
// ============================================================================
const MAX_DROPS = 140;
const MAX_DECALS = 110;
const DECAL_LIFE = 34; // s
const GRAVITY = 15;
const _bc = new THREE.Color();
const COL_WET = new THREE.Color("#6b0a0e");
const COL_DRY = new THREE.Color("#3a0508");
const _bUp = new THREE.Vector3(0, 1, 0);
const _bN = new THREE.Vector3();
const _bPos = new THREE.Vector3();
const _bScale = new THREE.Vector3();
const _bQ = new THREE.Quaternion();
const _bQYaw = new THREE.Quaternion();
const _bM = new THREE.Matrix4();
const _bRed = new THREE.Color();

// Mancha irregular: miolo orgânico + 3 pingos satélites, deitada em XZ com normal +Y.
function makeBloodSplatGeometry() {
  const pos = [];
  const idx = [];
  const addFan = (cx, cz, radius, segs, jitter, seed) => {
    const base = pos.length / 3;
    pos.push(cx, 0, cz);
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const n = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      const r = radius * (1 - jitter + jitter * 2 * (n - Math.floor(n)));
      pos.push(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r * (0.8 + 0.2 * Math.sin(a * 2 + seed)));
    }
    for (let i = 0; i < segs; i++) idx.push(base, base + 1 + ((i + 1) % segs), base + 1 + i);
  };
  addFan(0, 0, 1, 16, 0.3, 1.7);
  addFan(1.25, 0.35, 0.22, 7, 0.3, 3.1);
  addFan(-0.9, -0.95, 0.17, 6, 0.3, 5.3);
  addFan(0.25, 1.3, 0.13, 6, 0.3, 7.9);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class BloodFx {
  constructor(scene) {
    this.scene = scene;
    this.world = null;
    this._seen = new WeakMap();
    this._watchTimer = 0;

    // --- gotas em voo ---
    const dropMat = new THREE.MeshStandardMaterial({ color: "#7a0b10", roughness: 0.18, metalness: 0.1, flatShading: true });
    this.drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), dropMat, MAX_DROPS);
    this.drops.frustumCulled = false;
    this.drops.matrixAutoUpdate = false;
    this.drops.count = 0;
    this._d = [];
    for (let i = 0; i < MAX_DROPS; i++) this._d.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.05, life: 0 });
    scene.add(this.drops);

    // --- manchas no chão ---
    const decalMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.22, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    decalMat.depthWrite = false;
    this.decals = new THREE.InstancedMesh(makeBloodSplatGeometry(), decalMat, MAX_DECALS);
    this.decals.frustumCulled = false;
    this.decals.matrixAutoUpdate = false;
    this.decals.renderOrder = 1;
    this.decals.setColorAt(0, COL_WET);
    this._k = [];
    for (let i = 0; i < MAX_DECALS; i++) {
      this._k.push({ on: false, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, sx: 1, sz: 1, target: 1, grow: 0.6, spread: 0, age: 0 });
      this.decals.setMatrixAt(i, _bM.makeScale(0, 0, 0));
      this.decals.setColorAt(i, COL_WET);
    }
    this.decals.instanceColor.needsUpdate = true;
    this._decalCursor = 0;
    this._dropCursor = 0;
    this._decalsActive = 0;
    scene.add(this.decals);
  }

  _w() {
    return this.world || (this.world = (typeof window !== "undefined" && window.__game?.world) || null);
  }

  _groundAt(x, z) {
    const w = this._w();
    return w ? w.heightAt(x, z) : 0;
  }

  _nextDecal() {
    for (let a = 0; a < MAX_DECALS; a++) {
      const i = (this._decalCursor + a) % MAX_DECALS;
      if (!this._k[i].on) { this._decalCursor = (i + 1) % MAX_DECALS; return i; }
    }
    const i = this._decalCursor; // sobrescreve a mais antiga
    this._decalCursor = (i + 1) % MAX_DECALS;
    return i;
  }

  /** Mancha no chão em (x,z). radius = raio final; spread>0 => cresce devagar (poça de cadáver). */
  decal(x, z, radius = 0.4, spread = 0, yHint = null) {
    const w = this._w();
    let y = this._groundAt(x, z);
    if (w && yHint !== null) {
      const g = w.raycastGround(x, yHint, z);
      if (g > y) y = g; // piso de casa/igreja acima do terreno
    }
    // normal aproximada do terreno (diferenças finitas) para a mancha acompanhar a inclinação
    const e = 0.6;
    _bN.set(this._groundAt(x - e, z) - this._groundAt(x + e, z), 2 * e, this._groundAt(x, z - e) - this._groundAt(x, z + e)).normalize();
    _bQ.setFromUnitVectors(_bUp, _bN);
    _bQYaw.setFromAxisAngle(_bUp, Math.random() * Math.PI * 2);
    _bQ.multiply(_bQYaw);

    const i = this._nextDecal();
    const k = this._k[i];
    k.on = true;
    k.x = x;
    k.z = z;
    k.y = y + 0.03 + (i % 16) * 0.0015; // anti z-fighting entre manchas sobrepostas
    k.qx = _bQ.x; k.qy = _bQ.y; k.qz = _bQ.z; k.qw = _bQ.w;
    k.target = radius * (0.85 + Math.random() * 0.3);
    k.sx = 0.8 + Math.random() * 0.45;
    k.sz = 0.8 + Math.random() * 0.45;
    k.grow = spread > 0 ? spread : 0.35 + Math.random() * 0.3;
    k.age = 0;
    this._decalsActive++;
    this._writeDecal(i, 0.25);
    this.decals.instanceColor.needsUpdate = true;
  }

  _writeDecal(i, scale01) {
    const k = this._k[i];
    _bPos.set(k.x, k.y, k.z);
    _bQ.set(k.qx, k.qy, k.qz, k.qw);
    const r = k.target * scale01;
    _bScale.set(r * k.sx, 1, r * k.sz);
    _bM.compose(_bPos, _bQ, _bScale);
    this.decals.setMatrixAt(i, _bM);
    this.decals.instanceMatrix.needsUpdate = true;
  }

  _spawnDrop(x, y, z, vx, vy, vz, r) {
    let d = null;
    for (let a = 0; a < MAX_DROPS; a++) {
      const i = (this._dropCursor + a) % MAX_DROPS;
      if (!this._d[i].on) { d = this._d[i]; this._dropCursor = (i + 1) % MAX_DROPS; break; }
    }
    if (!d) return;
    d.on = true;
    d.x = x; d.y = y; d.z = z;
    d.vx = vx; d.vy = vy; d.vz = vz;
    d.r = r;
    d.life = 2.5;
  }

  /**
   * Jorro de sangue. (dirX,dirZ) = direção do golpe (0,0 => radial). amount ~ 0.5 (arranhão) .. 2 (morte).
   * As gotas voam em arco e, ao tocarem o chão, viram manchas.
   */
  splash(x, y, z, dirX = 0, dirZ = 0, amount = 1) {
    const n = Math.min(26, Math.round(5 + amount * 8));
    const len = Math.hypot(dirX, dirZ);
    const hasDir = len > 0.01;
    const dx = hasDir ? dirX / len : 0;
    const dz = hasDir ? dirZ / len : 0;
    for (let i = 0; i < n; i++) {
      let ax;
      let az;
      if (hasDir) {
        const spread = (Math.random() - 0.5) * 1.5; // cone de ~85°
        const c = Math.cos(spread), sn = Math.sin(spread);
        ax = dx * c - dz * sn;
        az = dx * sn + dz * c;
      } else {
        const a = Math.random() * Math.PI * 2;
        ax = Math.cos(a);
        az = Math.sin(a);
      }
      const speed = 1.2 + Math.random() * 3.8 * (0.6 + amount * 0.4);
      this._spawnDrop(x, y, z, ax * speed, 1.2 + Math.random() * 3.2, az * speed, 0.025 + Math.random() * 0.045);
    }
    // mancha imediata sob a vítima (golpe forte)
    if (amount >= 1) this.decal(x + dx * 0.4, z + dz * 0.4, 0.28 + 0.14 * amount, 0, y);
  }

  /** Poça que se espalha devagar sob um cadáver. */
  pool(x, z, yHint = null, radius = 1.15) {
    this.decal(x, z, radius, 4.5, yHint);
    this.decal(x + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5, radius * 0.6, 3, yHint);
  }

  update(dt) {
    // ---- gotas ----
    let maxActive = 0;
    const w = this._w();
    for (let i = 0; i < MAX_DROPS; i++) {
      const d = this._d[i];
      if (!d.on) continue;
      d.life -= dt;
      d.vy -= GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      const terrain = this._groundAt(d.x, d.z);
      let ground = terrain;
      if (w && d.y < terrain + 2.2) {
        const g = w.raycastGround(d.x, d.y + 0.1, d.z);
        if (g > ground) ground = g;
      }
      if (d.y <= ground + 0.02 || d.life <= 0) {
        d.on = false;
        if (d.life > 0 && d.vy < 0) {
          // pingo grande => mancha; pingo pequeno => pontinho (não gasta todo o pool)
          if (d.r > 0.058 || Math.random() < 0.12) this.decal(d.x, d.z, 0.1 + d.r * 5, 0, d.y + 0.2);
        }
        _bM.makeScale(0, 0, 0);
        this.drops.setMatrixAt(i, _bM);
        continue;
      }
      // gota alongada na direção da velocidade
      const sp = Math.hypot(d.vx, d.vy, d.vz);
      _bPos.set(d.x, d.y, d.z);
      _bN.set(d.vx, d.vy, d.vz).multiplyScalar(1 / (sp || 1));
      _bQ.setFromUnitVectors(_bUp, _bN);
      const stretch = 1 + Math.min(2.2, sp * 0.18);
      _bScale.set(d.r, d.r * stretch, d.r);
      _bM.compose(_bPos, _bQ, _bScale);
      this.drops.setMatrixAt(i, _bM);
      maxActive = i + 1;
    }
    this.drops.count = Math.max(this.drops.count > 0 ? this.drops.count : 0, maxActive);
    if (maxActive === 0 && this.drops.count > 0) this.drops.count = 0;
    if (this.drops.count > 0) this.drops.instanceMatrix.needsUpdate = true;

    // ---- manchas: crescem, secam (cor) e encolhem no final ----
    if (this._decalsActive > 0) {
      let colorDirty = false;
      for (let i = 0; i < MAX_DECALS; i++) {
        const k = this._k[i];
        if (!k.on) continue;
        k.age += dt;
        if (k.age >= DECAL_LIFE) {
          k.on = false;
          this._decalsActive--;
          this.decals.setMatrixAt(i, _bM.makeScale(0, 0, 0));
          this.decals.instanceMatrix.needsUpdate = true;
          continue;
        }
        const grow = Math.min(1, k.age / k.grow);
        let s = 0.25 + 0.75 * (1 - (1 - grow) * (1 - grow));
        const fade = Math.max(0, (k.age - (DECAL_LIFE - 7)) / 7);
        s *= 1 - fade * fade; // some encolhendo (sem alpha => sem custo de transparência)
        this._writeDecal(i, s);
        // úmido -> seco (vermelho vivo escuro -> marrom enegrecido); atualiza ~a cada 0.5 s por mancha
        if (((k.age * 2) | 0) !== (((k.age - dt) * 2) | 0)) {
          _bc.copy(COL_WET).lerp(COL_DRY, Math.min(1, k.age / 14));
          this.decals.setColorAt(i, _bc);
          colorDirty = true;
        }
      }
      if (colorDirty) this.decals.instanceColor.needsUpdate = true;
    }

    // ---- observa NPCs / jogador: feridas e mortes viram sangue (independe de quem causou o dano) ----
    this._watchTimer -= dt;
    if (this._watchTimer <= 0) {
      this._watchTimer = 0.08;
      this._watch();
    }
  }

  _watch() {
    const g = typeof window !== "undefined" ? window.__game : null;
    if (!g) return;
    const px = g.player?.x ?? 0;
    const pz = g.player?.z ?? 0;
    const list = g.npcs?.npcs;
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const npc = list[i];
        if (!npc || npc.roleKey === "horse" || npc.removed) continue;
        const dx0 = npc.x - px;
        const dz0 = npc.z - pz;
        if (dx0 * dx0 + dz0 * dz0 > 45 * 45) continue; // só sangue perto do jogador
        let st = this._seen.get(npc);
        if (!st) {
          st = { hp: npc.health, dead: !npc.alive };
          this._seen.set(npc, st);
          continue;
        }
        const y = npc.root?.position?.y ?? this._groundAt(npc.x, npc.z);
        if (npc.alive) {
          if (st.dead) st.dead = false; // respawn
          if (npc.health < st.hp - 0.001) {
            let kx = npc._knockX || 0;
            let kz = npc._knockZ || 0;
            if (kx * kx + kz * kz < 1e-4) { kx = npc.x - px; kz = npc.z - pz; }
            this.splash(npc.x, y + 1.25, npc.z, kx, kz, 0.9 + (st.hp - npc.health) * 0.25);
          }
          st.hp = npc.health;
        } else if (!st.dead) {
          st.dead = true;
          this.splash(npc.x, y + 1.0, npc.z, npc._knockX || 0, npc._knockZ || 0, 2);
          this.pool(npc.x, npc.z, y + 0.2);
        }
      }
    }
    const pl = g.player;
    if (pl) {
      if (this._pHp === undefined) this._pHp = pl.health;
      if (pl.health < this._pHp - 0.001) {
        this.splash(pl.x, (pl.root?.position?.y ?? 0) + 1.2, pl.z, 0, 0, 1);
      }
      this._pHp = pl.health;
    }
  }
}

// cor "de golpe" vermelha (estrelas de acerto das feras/monstros) => também vira sangue no chão
export function isBloodColor(color) {
  if (!color || typeof color !== "string") return false;
  _bRed.set(color);
  return _bRed.r > 0.55 && _bRed.g < 0.3 && _bRed.b < 0.3;
}
