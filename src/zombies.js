import * as THREE from 'three';
import { COLORS, GAME, ZOMBIE } from './config.js';

const dummy = new THREE.Object3D();

function resolveObstacles(zombie, colliders) {
  const radius = ZOMBIE.radius * zombie.scale;

  for (let i = 0; i < colliders.length; i += 1) {
    const collider = colliders[i];
    const closestX = Math.max(collider.minX, Math.min(zombie.x, collider.maxX));
    const closestZ = Math.max(collider.minZ, Math.min(zombie.z, collider.maxZ));
    const dx = zombie.x - closestX;
    const dz = zombie.z - closestZ;
    const distanceSq = dx * dx + dz * dz;

    if (distanceSq >= radius * radius) continue;

    if (distanceSq > 1e-8) {
      const distance = Math.sqrt(distanceSq);
      const push = radius - distance;
      zombie.x += (dx / distance) * push;
      zombie.z += (dz / distance) * push;
    } else {
      const toMinX = zombie.x - collider.minX;
      const toMaxX = collider.maxX - zombie.x;
      const toMinZ = zombie.z - collider.minZ;
      const toMaxZ = collider.maxZ - zombie.z;
      const smallest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);

      if (smallest === toMinX) zombie.x = collider.minX - radius;
      else if (smallest === toMaxX) zombie.x = collider.maxX + radius;
      else if (smallest === toMinZ) zombie.z = collider.minZ - radius;
      else zombie.z = collider.maxZ + radius;
    }
  }
}

export function createZombies(scene, colliders) {
  const bodyGeometry = new THREE.CapsuleGeometry(
    ZOMBIE.bodyRadius,
    ZOMBIE.bodyLength,
    4,
    8,
  );
  bodyGeometry.translate(
    0,
    ZOMBIE.bodyRadius + ZOMBIE.bodyLength / 2,
    0,
  );
  const bodyMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.zombieBody,
    flatShading: true,
  });

  const headGeometry = new THREE.SphereGeometry(ZOMBIE.headRadius, 8, 6);
  headGeometry.translate(0, ZOMBIE.headHeight, 0);
  const headMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.zombieHead,
    flatShading: true,
  });

  const armsGeometry = new THREE.BoxGeometry(0.56, 0.16, 0.5);
  armsGeometry.translate(0, ZOMBIE.armHeight, ZOMBIE.armForward);
  const armsMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.zombieArms,
    flatShading: true,
  });

  const bodies = new THREE.InstancedMesh(
    bodyGeometry,
    bodyMaterial,
    ZOMBIE.poolSize,
  );
  const heads = new THREE.InstancedMesh(
    headGeometry,
    headMaterial,
    ZOMBIE.poolSize,
  );
  const arms = new THREE.InstancedMesh(
    armsGeometry,
    armsMaterial,
    ZOMBIE.poolSize,
  );

  bodies.castShadow = true;
  heads.castShadow = true;

  dummy.scale.setScalar(0);
  dummy.updateMatrix();

  for (let i = 0; i < ZOMBIE.poolSize; i += 1) {
    bodies.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    arms.setMatrixAt(i, dummy.matrix);
  }

  for (const mesh of [bodies, heads, arms]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  const zombies = [];

  for (let i = 0; i < ZOMBIE.poolSize; i += 1) {
    zombies.push({
      active: false,
      x: 0,
      z: 0,
      health: 0,
      speed: 0,
      scale: 1,
      angle: 0,
      phase: 0,
    });
  }

  let spawnTimer = ZOMBIE.firstHordeTime;
  let hordeIndex = 0;

  function findFree() {
    for (let i = 0; i < zombies.length; i += 1) {
      if (!zombies[i].active) return zombies[i];
    }
    return null;
  }

  function spawnHorde(player) {
    const size = Math.min(
      ZOMBIE.maxHorde,
      Math.floor(ZOMBIE.hordeBase + hordeIndex * ZOMBIE.hordeGrowth),
    );
    const baseAngle = Math.random() * Math.PI * 2;
    const px = player.group.position.x;
    const pz = player.group.position.z;

    for (let n = 0; n < size; n += 1) {
      const zombie = findFree();
      if (zombie === null) break;

      const angle =
        baseAngle +
        (n / size) * Math.PI * 2 +
        (Math.random() - 0.5) * 0.5;
      const radius =
        ZOMBIE.spawnRadiusMin +
        Math.random() * (ZOMBIE.spawnRadiusMax - ZOMBIE.spawnRadiusMin);

      zombie.active = true;
      zombie.x = px + Math.sin(angle) * radius;
      zombie.z = pz + Math.cos(angle) * radius;
      zombie.health = ZOMBIE.health;
      zombie.speed =
        ZOMBIE.minSpeed + Math.random() * (ZOMBIE.maxSpeed - ZOMBIE.minSpeed);
      zombie.scale =
        ZOMBIE.scaleMin + Math.random() * (ZOMBIE.scaleMax - ZOMBIE.scaleMin);
      zombie.angle = Math.atan2(px - zombie.x, pz - zombie.z);
      zombie.phase = Math.random() * Math.PI * 2;
    }

    hordeIndex += 1;
    spawnTimer = Math.max(
      ZOMBIE.minSpawnInterval,
      ZOMBIE.spawnInterval - hordeIndex * ZOMBIE.intervalStep,
    );
  }

  function update(dt, player, game) {
    if (game.damageCooldown > 0) game.damageCooldown -= dt;

    spawnTimer -= dt;
    if (spawnTimer <= 0) spawnHorde(player);

    const px = player.group.position.x;
    const pz = player.group.position.z;
    const playerHeight = player.group.position.y;

    for (let i = 0; i < zombies.length; i += 1) {
      const zombie = zombies[i];

      if (!zombie.active) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        bodies.setMatrixAt(i, dummy.matrix);
        heads.setMatrixAt(i, dummy.matrix);
        arms.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const dx = px - zombie.x;
      const dz = pz - zombie.z;
      const distance = Math.hypot(dx, dz);

      if (distance > ZOMBIE.attackRange) {
        zombie.angle = Math.atan2(dx, dz);
        const inv = 1 / Math.max(distance, 1e-4);
        const wobble =
          Math.sin(game.time * 1.7 + zombie.phase) * ZOMBIE.wobble;
        const dirX = dx * inv - dz * inv * wobble;
        const dirZ = dz * inv + dx * inv * wobble;
        const step = zombie.speed * dt;

        zombie.x += dirX * step;
        zombie.z += dirZ * step;
        resolveObstacles(zombie, colliders);
      } else {
        zombie.angle = Math.atan2(dx, dz);
        if (
          game.damageCooldown <= 0 &&
          playerHeight <= ZOMBIE.attackMaxHeight
        ) {
          game.health = Math.max(0, game.health - ZOMBIE.attackDamage);
          game.damageCooldown = GAME.damageCooldown;
          player.flashHit();
        }
      }

      dummy.position.set(zombie.x, 0, zombie.z);
      dummy.rotation.set(0, zombie.angle, 0);
      dummy.scale.setScalar(zombie.scale);
      dummy.updateMatrix();

      bodies.setMatrixAt(i, dummy.matrix);
      heads.setMatrixAt(i, dummy.matrix);
      arms.setMatrixAt(i, dummy.matrix);
    }

    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
  }

  function hit(x, z, radius) {
    const reach = ZOMBIE.radius + radius;

    for (let i = 0; i < zombies.length; i += 1) {
      const zombie = zombies[i];
      if (!zombie.active) continue;

      const dx = zombie.x - x;
      const dz = zombie.z - z;
      if (dx * dx + dz * dz <= reach * reach) return i;
    }

    return -1;
  }

  function damage(index, amount) {
    const zombie = zombies[index];
    if (!zombie.active) return false;

    zombie.health -= amount;
    if (zombie.health > 0) return false;

    zombie.active = false;
    return true;
  }

  function reset() {
    for (let i = 0; i < zombies.length; i += 1) {
      zombies[i].active = false;
    }

    spawnTimer = ZOMBIE.firstHordeTime;
    hordeIndex = 0;

    dummy.scale.setScalar(0);
    dummy.updateMatrix();

    for (let i = 0; i < zombies.length; i += 1) {
      bodies.setMatrixAt(i, dummy.matrix);
      heads.setMatrixAt(i, dummy.matrix);
      arms.setMatrixAt(i, dummy.matrix);
    }

    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
  }

  return { update, hit, damage, reset };
}
