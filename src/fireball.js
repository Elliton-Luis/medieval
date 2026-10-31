import * as THREE from 'three';
import { COLORS, FIREBALL } from './config.js';

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

export function createFireballs(scene) {
  const glowTexture = createGlowTexture();

  const coreGeometry = new THREE.SphereGeometry(FIREBALL.coreRadius, 8, 6);
  const coreMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.fireCore,
    emissive: COLORS.fireEmissive,
    emissiveIntensity: 2.4,
    flatShading: true,
  });
  const haloMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: COLORS.fireHalo,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const fireballs = [];

  for (let i = 0; i < FIREBALL.poolSize; i += 1) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.setScalar(FIREBALL.haloScale);
    core.updateMatrix();
    core.matrixAutoUpdate = false;
    halo.updateMatrix();
    halo.matrixAutoUpdate = false;
    group.add(core, halo);
    group.visible = false;
    scene.add(group);

    fireballs.push({
      group,
      active: false,
      life: 0,
      trailTimer: 0,
      velocityX: 0,
      velocityZ: 0,
    });
  }

  const particleCount = FIREBALL.particlePoolSize;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const lives = new Float32Array(particleCount);
  const maxLives = new Float32Array(particleCount);
  const particleColor = new THREE.Color(COLORS.fireParticle);

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particleMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    size: FIREBALL.particleSize,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  scene.add(particles);

  let nextParticle = 0;
  let particlesDirty = false;
  let cooldown = 0;

  function spawnParticle(x, y, z, velocityX, velocityY, velocityZ, life) {
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

    colors[offset] = particleColor.r;
    colors[offset + 1] = particleColor.g;
    colors[offset + 2] = particleColor.b;

    particlesDirty = true;
  }

  function burst(x, y, z) {
    for (let i = 0; i < FIREBALL.burstCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = FIREBALL.burstSpeed * (0.4 + Math.random() * 0.6);
      const velocityY = FIREBALL.burstSpeed * (0.2 + Math.random() * 0.7);
      spawnParticle(
        x,
        y,
        z,
        Math.cos(angle) * speed,
        velocityY,
        Math.sin(angle) * speed,
        FIREBALL.burstLife * (0.6 + Math.random() * 0.7),
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
      velocities[offset + 1] -= 5 * dt;

      const glow = (remaining / maxLives[i]) ** 2;
      colors[offset] = particleColor.r * glow;
      colors[offset + 1] = particleColor.g * glow;
      colors[offset + 2] = particleColor.b * glow;
      particlesDirty = true;
    }

    if (particlesDirty) {
      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
      particlesDirty = false;
    }
  }

  function deactivate(fireball) {
    fireball.active = false;
    fireball.group.visible = false;
  }

  function spawnFireball(player) {
    let fireball = null;
    for (let i = 0; i < fireballs.length; i += 1) {
      if (!fireballs[i].active) {
        fireball = fireballs[i];
        break;
      }
    }
    if (fireball === null) return;

    const angle = player.group.rotation.y;
    const directionX = Math.sin(angle);
    const directionZ = Math.cos(angle);
    const position = player.group.position;

    fireball.group.position.set(
      position.x + directionX * FIREBALL.spawnOffset,
      position.y + FIREBALL.spawnHeight,
      position.z + directionZ * FIREBALL.spawnOffset,
    );
    fireball.velocityX = directionX * FIREBALL.speed;
    fireball.velocityZ = directionZ * FIREBALL.speed;
    fireball.life = FIREBALL.lifetime;
    fireball.trailTimer = 0;
    fireball.active = true;
    fireball.group.visible = true;
  }

  function hitsObstacle(x, y, z, colliders) {
    const radiusSq = FIREBALL.radius * FIREBALL.radius;

    for (let i = 0; i < colliders.length; i += 1) {
      const collider = colliders[i];
      const closestX = Math.max(
        collider.minX,
        Math.min(x, collider.maxX),
      );
      const closestY = Math.max(0, Math.min(y, collider.maxY));
      const closestZ = Math.max(
        collider.minZ,
        Math.min(z, collider.maxZ),
      );
      const dx = x - closestX;
      const dy = y - closestY;
      const dz = z - closestZ;

      if (dx * dx + dy * dy + dz * dz < radiusSq) return true;
    }

    return false;
  }

  function update(dt, input, player, colliders, target) {
    if (cooldown > 0) cooldown -= dt;

    const wantsToFire =
      input.wasPressed('Mouse0') || input.wasPressed('KeyF');
    if (wantsToFire && cooldown <= 0) {
      spawnFireball(player);
      cooldown = FIREBALL.cooldown;
    }

    for (let i = 0; i < fireballs.length; i += 1) {
      const fireball = fireballs[i];
      if (!fireball.active) continue;

      fireball.life -= dt;
      fireball.trailTimer -= dt;
      fireball.group.position.x += fireball.velocityX * dt;
      fireball.group.position.z += fireball.velocityZ * dt;

      while (fireball.trailTimer <= 0) {
        const position = fireball.group.position;
        spawnParticle(
          position.x,
          position.y,
          position.z,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.2) * 0.6,
          (Math.random() - 0.5) * 0.6,
          FIREBALL.trailLife,
        );
        fireball.trailTimer += FIREBALL.trailInterval;
      }

      const position = fireball.group.position;
      const dx = position.x - target.position.x;
      const dy = position.y - target.position.y;
      const dz = position.z - target.position.z;
      const targetRadius = target.radius + FIREBALL.radius;

      if (dx * dx + dy * dy + dz * dz < targetRadius * targetRadius) {
        target.hit();
        burst(position.x, position.y, position.z);
        deactivate(fireball);
        continue;
      }

      if (hitsObstacle(position.x, position.y, position.z, colliders)) {
        burst(position.x, position.y, position.z);
        deactivate(fireball);
        continue;
      }

      if (fireball.life <= 0) deactivate(fireball);
    }

    updateParticles(dt);
  }

  return { update };
}
