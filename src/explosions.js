import * as THREE from "three";

const FIRE_POOL = 30;
const SMOKE_POOL = 44;
const SPARK_POOL = 220;
const DEBRIS_POOL = 44;
const DECAL_POOL = 5;
const RING_POOL = 4;
const DECAL_SEGMENTS = 18;
const GRAVITY = 18;

function radialTexture(stops) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function smokeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  let state = 9137;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  for (let i = 0; i < 9; i++) {
    const x = 18 + random() * 28;
    const y = 18 + random() * 28;
    const r = 11 + random() * 11;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class ExplosionSystem {
  constructor(scene, world, onShake) {
    this.world = world;
    this.onShake = onShake;
    this._time = 0;

    const glow = radialTexture([[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.7)"], [1, "rgba(255,255,255,0)"]]);
    const smoke = smokeTexture();
    const scorch = radialTexture([[0, "rgba(255,255,255,1)"], [0.55, "rgba(255,255,255,0.85)"], [1, "rgba(255,255,255,0)"]]);

    // A luz existe desde o início (intensidade 0) para não recompilar shaders.
    this.light = new THREE.PointLight("#ffa04a", 0, 48, 2);
    this.flashTime = 0;
    scene.add(this.light);

    this.flash = this._makeSprite(scene, glow, true);
    this.flashLife = 0;

    this.fire = [];
    for (let i = 0; i < FIRE_POOL; i++) {
      const sprite = this._makeSprite(scene, glow, true);
      this.fire.push({ ...sprite, life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size0: 1, size1: 3 });
    }
    this.smoke = [];
    for (let i = 0; i < SMOKE_POOL; i++) {
      const sprite = this._makeSprite(scene, smoke, false);
      this.smoke.push({ ...sprite, life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size0: 1, size1: 3, tone: 0.3, spin: 0 });
    }

    this.rings = [];
    const ringGeometry = new THREE.RingGeometry(0.9, 1, 44);
    ringGeometry.rotateX(-Math.PI / 2);
    const domeGeometry = new THREE.SphereGeometry(1, 14, 10);
    for (let i = 0; i < RING_POOL; i++) {
      const ringMaterial = new THREE.MeshBasicMaterial({ color: "#ffd9a0", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      const domeMaterial = new THREE.MeshBasicMaterial({ color: "#ff8a35", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const dome = new THREE.Mesh(domeGeometry, domeMaterial);
      ring.visible = false;
      dome.visible = false;
      ring.frustumCulled = false;
      scene.add(ring, dome);
      this.rings.push({ ring, dome, ringMaterial, domeMaterial, life: 0, max: 0.45, radius: 6 });
    }

    // Faíscas (Points aditivos)
    this.sparkPositions = new Float32Array(SPARK_POOL * 3);
    this.sparkColors = new Float32Array(SPARK_POOL * 3);
    this.sparkVelocity = new Float32Array(SPARK_POOL * 3);
    this.sparkLife = new Float32Array(SPARK_POOL);
    this.sparkMax = new Float32Array(SPARK_POOL);
    this.sparkCursor = 0;
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(this.sparkPositions, 3));
    sparkGeometry.setAttribute("color", new THREE.BufferAttribute(this.sparkColors, 3));
    this.sparkGeometry = sparkGeometry;
    this.sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ map: glow, size: 0.34, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);
    this.sparksActive = 0;

    // Destroços (InstancedMesh)
    this.debris = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.24, 0.18, 0.28),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      DEBRIS_POOL,
    );
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.frustumCulled = false;
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this.debrisData = [];
    const tones = ["#6b5036", "#5a4630", "#77705f", "#4d4a40", "#7b6140"];
    this._dummy.scale.setScalar(0);
    this._dummy.updateMatrix();
    for (let i = 0; i < DEBRIS_POOL; i++) {
      this.debris.setMatrixAt(i, this._dummy.matrix);
      this.debris.setColorAt(i, this._color.set(tones[i % tones.length]));
      this.debrisData.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0, size: 1, bounces: 0 });
    }
    this.debris.instanceColor.needsUpdate = true;
    this.debrisDirty = true;
    scene.add(this.debris);

    // Marcas de queimado coladas no terreno
    this.decals = [];
    const rings = 3;
    const vertexCount = 1 + (rings - 1) * DECAL_SEGMENTS;
    const indices = [];
    for (let s = 0; s < DECAL_SEGMENTS; s++) {
      const next = (s + 1) % DECAL_SEGMENTS;
      indices.push(0, 1 + s, 1 + next);
      indices.push(1 + s, 1 + DECAL_SEGMENTS + s, 1 + next);
      indices.push(1 + next, 1 + DECAL_SEGMENTS + s, 1 + DECAL_SEGMENTS + next);
    }
    for (let i = 0; i < DECAL_POOL; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      uvs[0] = 0.5;
      uvs[1] = 0.5;
      for (let r = 1; r < rings; r++) {
        for (let s = 0; s < DECAL_SEGMENTS; s++) {
          const angle = (s / DECAL_SEGMENTS) * Math.PI * 2;
          const k = 1 + (r - 1) * DECAL_SEGMENTS + s;
          uvs[k * 2] = 0.5 + Math.cos(angle) * 0.5 * (r / (rings - 1));
          uvs[k * 2 + 1] = 0.5 + Math.sin(angle) * 0.5 * (r / (rings - 1));
        }
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      const material = new THREE.MeshBasicMaterial({ color: "#0f0c09", map: scorch, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      scene.add(mesh);
      this.decals.push({ mesh, material, positions, geometry, age: 99 });
    }
    this.decalCursor = 0;
    this.ringCursor = 0;
    this.fireCursor = 0;
    this.smokeCursor = 0;
    this.debrisCursor = 0;
  }

  _makeSprite(scene, map, additive) {
    const material = new THREE.SpriteMaterial({
      map,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.renderOrder = 4;
    scene.add(sprite);
    return { sprite, material };
  }

  trigger(x, y, z, radius = 6) {
    const ground = this.world.heightAt(x, z);
    const baseY = Math.max(ground + 0.2, y);

    this.flashTime = 0.5;
    this.light.position.set(x, baseY + 1.4, z);
    this.flashLife = 0.2;
    this.flash.sprite.position.set(x, baseY + 0.9, z);
    this.flash.sprite.visible = true;

    for (let i = 0; i < 16; i++) {
      const p = this.fire[this.fireCursor];
      this.fireCursor = (this.fireCursor + 1) % FIRE_POOL;
      const angle = Math.random() * Math.PI * 2;
      const lateral = 0.4 + Math.random() * 1.0;
      const speed = (i < 6 ? 0.8 : 3.4) * (0.6 + Math.random() * 0.8);
      p.x = x + Math.cos(angle) * lateral * 0.4;
      p.z = z + Math.sin(angle) * lateral * 0.4;
      p.y = baseY + 0.4 + Math.random() * 0.8;
      p.vx = Math.cos(angle) * speed;
      p.vz = Math.sin(angle) * speed;
      p.vy = 1.8 + Math.random() * (i < 6 ? 4.8 : 2.6);
      p.max = 0.42 + Math.random() * 0.4;
      p.life = p.max;
      p.size0 = 1.5 + Math.random() * 0.9;
      p.size1 = (radius * 0.55) * (0.7 + Math.random() * 0.6);
      p.sprite.visible = true;
    }

    // Fumaça: coluna que sobe + anel de poeira rente ao chão.
    for (let i = 0; i < 24; i++) {
      const p = this.smoke[this.smokeCursor];
      this.smokeCursor = (this.smokeCursor + 1) % SMOKE_POOL;
      const angle = Math.random() * Math.PI * 2;
      const dust = i >= 14;
      const speed = dust ? 4.5 + Math.random() * 3.5 : 0.6 + Math.random() * 2.1;
      p.x = x + Math.cos(angle) * (dust ? 0.8 : 0.4);
      p.z = z + Math.sin(angle) * (dust ? 0.8 : 0.4);
      p.y = baseY + (dust ? 0.3 : 0.6 + Math.random() * 0.9);
      p.vx = Math.cos(angle) * speed;
      p.vz = Math.sin(angle) * speed;
      p.vy = dust ? 0.5 + Math.random() * 0.8 : 2.4 + Math.random() * 3.1;
      p.max = dust ? 1.0 + Math.random() * 0.7 : 1.9 + Math.random() * 1.2;
      p.life = p.max;
      p.size0 = dust ? 1.4 : 1.8 + Math.random() * 1.1;
      p.size1 = dust ? 4.2 + Math.random() * 2 : 5 + Math.random() * 3.2;
      p.tone = dust ? 0.5 : 0.2 + Math.random() * 0.14;
      p.spin = (Math.random() - 0.5) * 1.4;
      p.material.rotation = Math.random() * 6.28;
      p.sprite.visible = true;
    }

    const wave = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % RING_POOL;
    wave.life = 0.45;
    wave.max = 0.45;
    wave.radius = radius * 1.35;
    wave.ring.position.set(x, ground + 0.35, z);
    wave.dome.position.set(x, baseY + 0.4, z);
    wave.ring.visible = true;
    wave.dome.visible = true;

    for (let i = 0; i < 110; i++) {
      const k = this.sparkCursor;
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_POOL;
      const angle = Math.random() * Math.PI * 2;
      const up = Math.random();
      const horizontal = (4 + Math.random() * 11) * (1 - up * 0.5);
      const o = k * 3;
      this.sparkPositions[o] = x;
      this.sparkPositions[o + 1] = baseY + 0.5;
      this.sparkPositions[o + 2] = z;
      this.sparkVelocity[o] = Math.cos(angle) * horizontal;
      this.sparkVelocity[o + 1] = 3 + up * 11;
      this.sparkVelocity[o + 2] = Math.sin(angle) * horizontal;
      this.sparkMax[k] = 0.5 + Math.random() * 0.8;
      this.sparkLife[k] = this.sparkMax[k];
    }
    this.sparksActive = SPARK_POOL;

    for (let i = 0; i < 26; i++) {
      const d = this.debrisData[this.debrisCursor];
      this.debrisCursor = (this.debrisCursor + 1) % DEBRIS_POOL;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8.5;
      d.x = x + Math.cos(angle) * 0.5;
      d.z = z + Math.sin(angle) * 0.5;
      d.y = ground + 0.3;
      d.vx = Math.cos(angle) * speed;
      d.vz = Math.sin(angle) * speed;
      d.vy = 6 + Math.random() * 9;
      d.rx = Math.random() * 6;
      d.ry = Math.random() * 6;
      d.rz = Math.random() * 6;
      d.sx = (Math.random() - 0.5) * 14;
      d.sy = (Math.random() - 0.5) * 14;
      d.sz = (Math.random() - 0.5) * 14;
      d.size = 0.7 + Math.random() * 1.1;
      d.max = 1.5 + Math.random() * 1.1;
      d.life = d.max;
      d.bounces = 0;
    }
    this.debrisDirty = true;

    this._placeDecal(x, z, radius * (0.45 + Math.random() * 0.12));
    this.onShake?.(x, z, 0.75 + radius * 0.06);
  }

  _placeDecal(x, z, radius) {
    const decal = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % DECAL_POOL;
    const positions = decal.positions;
    positions[0] = x;
    positions[1] = this.world.heightAt(x, z) + 0.07;
    positions[2] = z;
    for (let r = 1; r < 3; r++) {
      const ringRadius = radius * (r / 2) * (0.9 + Math.random() * 0.2);
      for (let s = 0; s < DECAL_SEGMENTS; s++) {
        const angle = (s / DECAL_SEGMENTS) * Math.PI * 2;
        const px = x + Math.cos(angle) * ringRadius;
        const pz = z + Math.sin(angle) * ringRadius;
        const k = (1 + (r - 1) * DECAL_SEGMENTS + s) * 3;
        positions[k] = px;
        positions[k + 1] = this.world.heightAt(px, pz) + 0.07;
        positions[k + 2] = pz;
      }
    }
    decal.geometry.attributes.position.needsUpdate = true;
    decal.geometry.computeBoundingSphere();
    decal.age = 0;
    decal.mesh.visible = true;
  }

  update(dt) {
    this._time += dt;

    if (this.flashTime > 0) {
      this.flashTime = Math.max(0, this.flashTime - dt);
      const f = this.flashTime / 0.5;
      this.light.intensity = 520 * f * f;
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      const f = Math.max(0, this.flashLife / 0.2);
      const scale = 7 + (1 - f) * 7;
      this.flash.sprite.scale.set(scale, scale, 1);
      this.flash.material.opacity = f;
      this.flash.material.color.setRGB(1, 0.9, 0.62);
      if (this.flashLife <= 0) this.flash.sprite.visible = false;
    }

    for (let i = 0; i < FIRE_POOL; i++) {
      const p = this.fire[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      const t = 1 - p.life / p.max;
      const drag = Math.exp(-2.2 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy += 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const size = p.size0 + (p.size1 - p.size0) * Math.sqrt(t);
      p.sprite.position.set(p.x, p.y, p.z);
      p.sprite.scale.set(size, size, 1);
      // amarelo -> laranja -> brasa escura
      const r = 1 - t * 0.55;
      const g = Math.max(0.05, 0.86 - t * 0.95);
      const b = Math.max(0.02, 0.42 - t * 0.5);
      p.material.color.setRGB(r, g, b);
      p.material.opacity = (1 - t) ** 1.3;
    }

    for (let i = 0; i < SMOKE_POOL; i++) {
      const p = this.smoke[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      const t = 1 - p.life / p.max;
      const drag = Math.exp(-1.3 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy *= Math.exp(-0.45 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const size = p.size0 + (p.size1 - p.size0) * Math.sqrt(t);
      p.sprite.position.set(p.x, p.y, p.z);
      p.sprite.scale.set(size, size, 1);
      p.material.rotation += p.spin * dt;
      const tone = p.tone + t * 0.12;
      p.material.color.setRGB(tone, tone * 0.96, tone * 0.9);
      p.material.opacity = Math.min(1, t * 9) * 0.62 * (1 - t) ** 1.2;
    }

    for (let i = 0; i < RING_POOL; i++) {
      const wave = this.rings[i];
      if (wave.life <= 0) continue;
      wave.life -= dt;
      if (wave.life <= 0) {
        wave.ring.visible = false;
        wave.dome.visible = false;
        continue;
      }
      const t = 1 - wave.life / wave.max;
      const eased = 1 - (1 - t) ** 3;
      const ringScale = 0.6 + eased * wave.radius;
      wave.ring.scale.set(ringScale, 1, ringScale);
      wave.ringMaterial.opacity = 0.85 * (1 - t) ** 2;
      const domeScale = 0.8 + eased * wave.radius * 0.55;
      wave.dome.scale.setScalar(domeScale);
      wave.domeMaterial.opacity = 0.5 * (1 - t) ** 2.4;
    }

    if (this.sparksActive > 0) {
      let alive = 0;
      for (let i = 0; i < SPARK_POOL; i++) {
        const o = i * 3;
        if (this.sparkLife[i] <= 0) continue;
        this.sparkLife[i] -= dt;
        if (this.sparkLife[i] <= 0) {
          this.sparkColors[o] = 0;
          this.sparkColors[o + 1] = 0;
          this.sparkColors[o + 2] = 0;
          this.sparkPositions[o + 1] = -500;
          continue;
        }
        alive++;
        this.sparkVelocity[o + 1] -= GRAVITY * 0.7 * dt;
        this.sparkPositions[o] += this.sparkVelocity[o] * dt;
        this.sparkPositions[o + 1] += this.sparkVelocity[o + 1] * dt;
        this.sparkPositions[o + 2] += this.sparkVelocity[o + 2] * dt;
        const ground = this.world.heightAt(this.sparkPositions[o], this.sparkPositions[o + 2]) + 0.05;
        if (this.sparkPositions[o + 1] < ground) {
          this.sparkPositions[o + 1] = ground;
          this.sparkVelocity[o + 1] *= -0.38;
          this.sparkVelocity[o] *= 0.7;
          this.sparkVelocity[o + 2] *= 0.7;
        }
        const f = this.sparkLife[i] / this.sparkMax[i];
        this.sparkColors[o] = 1;
        this.sparkColors[o + 1] = 0.35 + f * 0.55;
        this.sparkColors[o + 2] = 0.08 + f * 0.25;
      }
      this.sparkGeometry.attributes.position.needsUpdate = true;
      this.sparkGeometry.attributes.color.needsUpdate = true;
      if (alive === 0) this.sparksActive = 0;
    }

    let debrisMoving = false;
    for (let i = 0; i < DEBRIS_POOL; i++) {
      const d = this.debrisData[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      debrisMoving = true;
      if (d.life <= 0) {
        this._dummy.scale.setScalar(0);
        this._dummy.position.set(0, -500, 0);
        this._dummy.updateMatrix();
        this.debris.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      d.vy -= GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      const ground = this.world.heightAt(d.x, d.z) + 0.1;
      if (d.y < ground) {
        d.y = ground;
        if (d.bounces < 3) {
          d.vy = Math.abs(d.vy) * 0.38;
          d.bounces++;
        } else {
          d.vy = 0;
        }
        d.vx *= 0.62;
        d.vz *= 0.62;
        d.sx *= 0.5;
        d.sy *= 0.5;
        d.sz *= 0.5;
      }
      d.rx += d.sx * dt;
      d.ry += d.sy * dt;
      d.rz += d.sz * dt;
      const shrink = Math.min(1, d.life / 0.4);
      this._dummy.position.set(d.x, d.y, d.z);
      this._dummy.rotation.set(d.rx, d.ry, d.rz);
      this._dummy.scale.setScalar(d.size * shrink);
      this._dummy.updateMatrix();
      this.debris.setMatrixAt(i, this._dummy.matrix);
    }
    if (debrisMoving || this.debrisDirty) {
      this.debris.instanceMatrix.needsUpdate = true;
      this.debrisDirty = false;
    }

    for (let i = 0; i < DECAL_POOL; i++) {
      const decal = this.decals[i];
      if (!decal.mesh.visible) continue;
      decal.age += dt;
      const fadeIn = Math.min(1, decal.age / 0.15);
      const fadeOut = decal.age < 12 ? 1 : Math.max(0, 1 - (decal.age - 12) / 6);
      decal.material.opacity = 0.7 * fadeIn * fadeOut;
      if (fadeOut <= 0) decal.mesh.visible = false;
    }
  }
}
