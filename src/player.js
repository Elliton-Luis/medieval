import * as THREE from 'three';
import { COLORS, PLAYER } from './config.js';

const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const aimPlane = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  -PLAYER.aimHeight,
);
const aimPoint = new THREE.Vector3();

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

  const bodyMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.playerBody,
    emissive: COLORS.hitFlash,
    emissiveIntensity: 0,
    flatShading: true,
  });
  const skinMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.playerSkin,
    emissive: COLORS.hitFlash,
    emissiveIntensity: 0,
    flatShading: true,
  });
  const gunMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.playerGun,
    emissive: COLORS.hitFlash,
    emissiveIntensity: 0,
    flatShading: true,
  });
  const accentMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.playerGunAccent,
    emissive: COLORS.hitFlash,
    emissiveIntensity: 0,
    flatShading: true,
  });
  const flashableMaterials = [
    bodyMaterial,
    skinMaterial,
    gunMaterial,
    accentMaterial,
  ];

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER.bodyRadius, PLAYER.bodyLength, 4, 8),
    bodyMaterial,
  );
  body.position.y = PLAYER.bodyRadius + PLAYER.bodyLength / 2;
  body.castShadow = true;
  body.updateMatrix();
  body.matrixAutoUpdate = false;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    skinMaterial,
  );
  head.position.y = 1.68;
  head.castShadow = true;
  head.updateMatrix();
  head.matrixAutoUpdate = false;
  group.add(head);

  const armGeometry = new THREE.BoxGeometry(0.16, 0.16, 0.72);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeometry, bodyMaterial);
    arm.position.set(side * 0.28, 1.16, 0.42);
    arm.castShadow = true;
    arm.updateMatrix();
    arm.matrixAutoUpdate = false;
    group.add(arm);
  }

  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.2, 0.62),
    gunMaterial,
  );
  gunBody.position.set(0.24, 1.1, 0.66);
  gunBody.castShadow = true;
  gunBody.updateMatrix();
  gunBody.matrixAutoUpdate = false;
  group.add(gunBody);

  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.56),
    accentMaterial,
  );
  barrel.position.set(0.24, 1.12, 1.08);
  barrel.castShadow = true;
  barrel.updateMatrix();
  barrel.matrixAutoUpdate = false;
  group.add(barrel);

  const magazine = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.24, 0.12),
    accentMaterial,
  );
  magazine.position.set(0.24, 0.94, 0.62);
  magazine.updateMatrix();
  magazine.matrixAutoUpdate = false;
  group.add(magazine);

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
  let aimAngle = Math.PI;
  let flash = 0;
  group.rotation.y = angle;

  function setFlash(intensity) {
    for (let i = 0; i < flashableMaterials.length; i += 1) {
      flashableMaterials[i].emissiveIntensity = intensity;
    }
  }

  function update(dt, input, camera, colliders) {
    pointer.x = (input.pointerX / window.innerWidth) * 2 - 1;
    pointer.y = -(input.pointerY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    if (raycaster.ray.intersectPlane(aimPlane, aimPoint)) {
      const aimX = aimPoint.x - group.position.x;
      const aimZ = aimPoint.z - group.position.z;
      if (aimX * aimX + aimZ * aimZ > 0.09) {
        aimAngle = Math.atan2(aimX, aimZ);
      }
    }

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

    const difference = Math.atan2(
      Math.sin(aimAngle - angle),
      Math.cos(aimAngle - angle),
    );
    angle += difference * (1 - Math.exp(-PLAYER.aimTurnSpeed * dt));
    group.rotation.y = angle;

    if (flash > 0) {
      flash = Math.max(0, flash - dt);
      setFlash((flash / PLAYER.flashTime) * 1.8);
    }

    const height = group.position.y;
    shadow.position.x = group.position.x;
    shadow.position.z = group.position.z;
    shadow.scale.setScalar(1 + height * 0.15);
    shadowMaterial.opacity =
      PLAYER.shadowOpacity * Math.max(0.25, 1 - height * 0.45);
  }

  function flashHit() {
    flash = PLAYER.flashTime;
    setFlash(1.8);
  }

  function reset() {
    group.position.set(0, 0, 0);
    velocityX = 0;
    velocityZ = 0;
    velocityY = 0;
    grounded = true;
    angle = Math.PI;
    aimAngle = Math.PI;
    flash = 0;
    group.rotation.y = angle;
    setFlash(0);
    shadow.position.x = 0;
    shadow.position.z = 0;
    shadow.scale.setScalar(1);
    shadowMaterial.opacity = PLAYER.shadowOpacity;
  }

  return {
    group,
    shadow,
    update,
    flashHit,
    reset,
    get angle() {
      return angle;
    },
  };
}
