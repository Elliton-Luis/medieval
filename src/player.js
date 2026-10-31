import * as THREE from 'three';
import { COLORS, PLAYER } from './config.js';

const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

function resolveCollisions(position, colliders) {
  const radius = PLAYER.radius;

  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < colliders.length; i += 1) {
      const collider = colliders[i];
      const closestX = Math.max(
        collider.minX,
        Math.min(position.x, collider.maxX),
      );
      const closestZ = Math.max(
        collider.minZ,
        Math.min(position.z, collider.maxZ),
      );
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq >= radius * radius) continue;

      if (distanceSq > 1e-8) {
        const distance = Math.sqrt(distanceSq);
        const push = radius - distance;
        position.x += (dx / distance) * push;
        position.z += (dz / distance) * push;
      } else {
        const toMinX = position.x - collider.minX;
        const toMaxX = collider.maxX - position.x;
        const toMinZ = position.z - collider.minZ;
        const toMaxZ = collider.maxZ - position.z;
        const smallest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);

        if (smallest === toMinX) position.x = collider.minX - radius;
        else if (smallest === toMaxX) position.x = collider.maxX + radius;
        else if (smallest === toMinZ) position.z = collider.minZ - radius;
        else position.z = collider.maxZ + radius;
      }
    }
  }
}

export function createPlayer(scene) {
  const group = new THREE.Group();

  const bodyGeometry = new THREE.CapsuleGeometry(
    PLAYER.bodyRadius,
    PLAYER.bodyLength,
    4,
    8,
  );
  const bodyMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.playerBody,
    flatShading: true,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = PLAYER.bodyRadius + PLAYER.bodyLength / 2;
  group.add(body);

  const noseGeometry = new THREE.ConeGeometry(0.16, 0.34, 4);
  const noseMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.playerNose,
    flatShading: true,
  });
  const nose = new THREE.Mesh(noseGeometry, noseMaterial);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1, PLAYER.bodyRadius + 0.15);
  group.add(nose);

  scene.add(group);

  const shadowGeometry = new THREE.CircleGeometry(PLAYER.shadowRadius, 16);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.shadow,
    transparent: true,
    opacity: PLAYER.shadowOpacity,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  scene.add(shadow);

  let velocityX = 0;
  let velocityZ = 0;
  let velocityY = 0;
  let grounded = true;
  let angle = Math.PI;
  group.rotation.y = angle;

  function update(dt, input, camera, colliders) {
    camera.getWorldDirection(forward);
    forward.y = 0;
    const forwardLength = Math.hypot(forward.x, forward.z);
    if (forwardLength > 1e-5) {
      forward.x /= forwardLength;
      forward.z /= forwardLength;
    }
    right.crossVectors(forward, up);

    let moveX = 0;
    let moveZ = 0;

    if (input.isDown('KeyW') || input.isDown('ArrowUp')) {
      moveX += forward.x;
      moveZ += forward.z;
    }
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
      moveX -= forward.x;
      moveZ -= forward.z;
    }
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) {
      moveX -= right.x;
      moveZ -= right.z;
    }
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) {
      moveX += right.x;
      moveZ += right.z;
    }

    const moveLength = Math.hypot(moveX, moveZ);
    const hasInput = moveLength > 1e-5;

    if (hasInput) {
      moveX /= moveLength;
      moveZ /= moveLength;
    }

    const targetX = hasInput ? moveX * PLAYER.moveSpeed : 0;
    const targetZ = hasInput ? moveZ * PLAYER.moveSpeed : 0;
    const control = grounded ? 1 : PLAYER.airControl;
    const rate =
      (hasInput ? PLAYER.acceleration : PLAYER.deceleration) * control;
    const blend = 1 - Math.exp(-rate * dt);

    velocityX += (targetX - velocityX) * blend;
    velocityZ += (targetZ - velocityZ) * blend;

    group.position.x += velocityX * dt;
    group.position.z += velocityZ * dt;
    resolveCollisions(group.position, colliders);

    if (input.wasPressed('Space') && grounded) {
      velocityY = PLAYER.jumpSpeed;
      grounded = false;
    }

    if (!grounded) {
      velocityY -= PLAYER.gravity * dt;
      group.position.y += velocityY * dt;

      if (group.position.y <= 0) {
        group.position.y = 0;
        velocityY = 0;
        grounded = true;
      }
    }

    const speedSq = velocityX * velocityX + velocityZ * velocityZ;
    if (speedSq > 0.04) {
      const targetAngle = Math.atan2(velocityX, velocityZ);
      const difference = Math.atan2(
        Math.sin(targetAngle - angle),
        Math.cos(targetAngle - angle),
      );
      angle += difference * (1 - Math.exp(-PLAYER.turnSpeed * dt));
      group.rotation.y = angle;
    }

    const height = group.position.y;
    shadow.position.x = group.position.x;
    shadow.position.z = group.position.z;
    shadow.scale.setScalar(1 + height * 0.15);
    shadowMaterial.opacity =
      PLAYER.shadowOpacity * Math.max(0.25, 1 - height * 0.45);
  }

  return { group, shadow, update };
}
