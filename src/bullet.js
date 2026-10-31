import * as THREE from 'three';
import { BULLET, COLORS } from './config.js';

const dummy = new THREE.Object3D();

function createGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBullets(scene) {
  const glowTexture = createGlowTexture();

  const tracerGeometry = new THREE.BoxGeometry(
    BULLET.tracerWidth,
    BULLET.tracerWidth,
    BULLET.tracerLength,
  );
  const tracerMaterial = new THREE.MeshBasicMaterial({ color: COLORS.bullet });
  const tracers = new THREE.InstancedMesh(
    tracerGeometry,
    tracerMaterial,
    BULLET.poolSize,
  );
  tracers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tracers.frustumCulled = false;
  scene.add(tracers);

  const muzzleMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: COLORS.muzzle,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const muzzle = new THREE.Sprite(muzzleMaterial);
  muzzle.scale.setScalar(BULLET.muzzleFlashScale);
  muzzle.visible = false;
  scene.add(muzzle);

  const particleCount = BULLET.particlePoolSize;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const baseColors = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const lives = new Float32Array(particleCount);
  const maxLives = new Float32Array(particleCount);
  const sparkColor = new THREE.Color(COLORS.spark);
  const bloodColor = new THREE.Color(COLORS.blood);

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particleMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    size: BULLET.particleSize,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  scene.add(particles);

  const bullets = [];

  dummy.scale.setScalar(0);
  dummy.updateMatrix();

  for (let i = 0; i < BULLET.poolSize; i += 1) {
    tracers.setMatrixAt(i, dummy.matrix);
    bullets.push({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      angle: 0,
      life: 0,
    });
  }

  let nextParticle = 0;
  let particlesDirty = false;
  let fireTimer = 0;
  let flashTimer = 0;

  function spawnParticle(
    x,
    y,
    z,
    velocityX,
    velocityY,
    velocityZ,
    life,
    color,
  ) {
    const index = nextParticle;
    nextParticle = (nextParticle + 1) % particleCount;
    const offset = index * 3;

    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    velocities[offset] = velocityX;
    velocities[offset + 1] = velocityY;
    velocities[offset + 2] = velocityZ;
    lives[index] = life;
    maxLives[index] = life;

    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    baseColors[offset] = color.r;
    baseColors[offset + 1] = color.g;
    baseColors[offset + 2] = color.b;

    particlesDirty = true;
  }

  function burst(x, y, z, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const horizontal = speed * (0.35 + Math.random() * 0.65);
      spawnParticle(
        x,
        y,
        z,
        Math.cos(angle) * horizontal,
        speed * (0.15 + Math.random() * 0.55),
        Math.sin(angle) * horizontal,
        BULLET.burstLife * (0.6 + Math.random() * 0.7),
        color,
      );
    }
  }

  function updateParticles(dt) {
    for (let i = 0; i < particleCount; i += 1) {
      if (lives[i] <= 0) continue;

      const offset = i * 3;
      const remaining = lives[i] - dt;

      if (remaining <= 0) {
        lives[i] = 0;
        colors[offset] = 0;
        colors[offset + 1] = 0;
        colors[offset + 2] = 0;
        particlesDirty = true;
        continue;
      }

      lives[i] = remaining;
      positions[offset] += velocities[offset] * dt;
      positions[offset + 1] += velocities[offset + 1] * dt;
      positions[offset + 2] += velocities[offset + 2] * dt;
      velocities[offset + 1] -= 9 * dt;

      const glow = (remaining / maxLives[i]) ** 2;
      colors[offset] = baseColors[offset] * glow;
      colors[offset + 1] = baseColors[offset + 1] * glow;
      colors[offset + 2] = baseColors[offset + 2] * glow;
      particlesDirty = true;
    }

    if (particlesDirty) {
      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
      particlesDirty = false;
    }
  }

  function hitsObstacle(x, y, z, colliders) {
    const radiusSq = BULLET.radius * BULLET.radius;

    for (let i = 0; i < colliders.length; i += 1) {
      const collider = colliders[i];
      const closestX = Math.max(collider.minX, Math.min(x, collider.maxX));
      const closestY = Math.max(0, Math.min(y, collider.maxY));
      const closestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ));
      const dx = x - closestX;
      const dy = y - closestY;
      const dz = z - closestZ;

      if (dx * dx + dy * dy + dz * dz < radiusSq) return true;
    }

    return false;
  }

  function fire(player) {
    let bullet = null;

    for (let i = 0; i < bullets.length; i += 1) {
      if (!bullets[i].active) {
        bullet = bullets[i];
        break;
      }
    }

    if (bullet === null) return;

    const angle = player.angle + (Math.random() - 0.5) * BULLET.spread;
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
    const position = player.group.position;
    const sideX = Math.cos(angle) * BULLET.spawnSide;
    const sideZ = -Math.sin(angle) * BULLET.spawnSide;
    const x = position.x + dirX * BULLET.spawnOffset + sideX;
    const y = position.y + BULLET.spawnHeight;
    const z = position.z + dirZ * BULLET.spawnOffset + sideZ;

    bullet.active = true;
    bullet.x = x;
    bullet.y = y;
    bullet.z = z;
    bullet.vx = dirX * BULLET.speed;
    bullet.vz = dirZ * BULLET.speed;
    bullet.angle = angle;
    bullet.life = BULLET.lifetime;

    muzzle.position.set(
      position.x + dirX * BULLET.muzzleOffset + sideX,
      y,
      position.z + dirZ * BULLET.muzzleOffset + sideZ,
    );
    muzzle.visible = true;
    flashTimer = BULLET.muzzleFlashTime;
  }

  function update(dt, input, player, colliders, zombies, game) {
    if (fireTimer > 0) fireTimer -= dt;

    const firing = input.isDown('Mouse0') || input.isDown('KeyF');
    if (firing && fireTimer <= 0) {
      fire(player);
      fireTimer = BULLET.fireInterval;
    }

    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) muzzle.visible = false;
    }

    for (let i = 0; i < bullets.length; i += 1) {
      const bullet = bullets[i];

      if (!bullet.active) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        tracers.setMatrixAt(i, dummy.matrix);
        continue;
      }

      bullet.life -= dt;

      if (bullet.life <= 0) {
        bullet.active = false;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        tracers.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const distance = Math.hypot(bullet.vx, bullet.vz) * dt;
      const steps = Math.max(1, Math.ceil(distance / BULLET.maxStep));
      const stepDt = dt / steps;
      let dead = false;

      for (let step = 0; step < steps; step += 1) {
        bullet.x += bullet.vx * stepDt;
        bullet.z += bullet.vz * stepDt;

        const zombieIndex = zombies.hit(bullet.x, bullet.z, BULLET.radius);
        if (zombieIndex >= 0) {
          burst(
            bullet.x,
            bullet.y,
            bullet.z,
            bloodColor,
            BULLET.bloodCount,
            BULLET.bloodSpeed,
          );
          if (zombies.damage(zombieIndex, BULLET.damage)) game.kills += 1;
          dead = true;
          break;
        }

        if (hitsObstacle(bullet.x, bullet.y, bullet.z, colliders)) {
          burst(
            bullet.x,
            bullet.y,
            bullet.z,
            sparkColor,
            BULLET.sparkCount,
            BULLET.sparkSpeed,
          );
          dead = true;
          break;
        }
      }

      if (dead) {
        bullet.active = false;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        tracers.setMatrixAt(i, dummy.matrix);
        continue;
      }

      dummy.position.set(bullet.x, bullet.y, bullet.z);
      dummy.rotation.set(0, bullet.angle, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      tracers.setMatrixAt(i, dummy.matrix);
    }

    tracers.instanceMatrix.needsUpdate = true;
    updateParticles(dt);
  }

  function reset() {
    for (let i = 0; i < bullets.length; i += 1) {
      bullets[i].active = false;
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      tracers.setMatrixAt(i, dummy.matrix);
    }

    tracers.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < particleCount; i += 1) {
      lives[i] = 0;
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0;
      colors[i * 3 + 2] = 0;
      baseColors[i * 3] = 0;
      baseColors[i * 3 + 1] = 0;
      baseColors[i * 3 + 2] = 0;
    }

    particleGeometry.attributes.color.needsUpdate = true;
    fireTimer = 0;
    flashTimer = 0;
    muzzle.visible = false;
  }

  return { update, reset };
}
