import * as THREE from 'three';
import { CAMERA, COLORS, WORLD } from './config.js';

const OBSTACLES = [
  { shape: 'box', x: -5, z: -2, width: 2, depth: 2, height: 1.5 },
  { shape: 'box', x: 4, z: -6, width: 1.6, depth: 1.6, height: 2.4 },
  { shape: 'column', x: -3, z: 6, radius: 1, height: 3 },
  { shape: 'column', x: 7, z: 3, radius: 0.8, height: 2 },
  { shape: 'box', x: 1, z: 9, width: 3, depth: 1, height: 0.9 },
];

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WORLD.skyColor);
  scene.fog = new THREE.Fog(WORLD.skyColor, WORLD.fogNear, WORLD.fogFar);

  const camera = new THREE.PerspectiveCamera(
    CAMERA.fov,
    window.innerWidth / window.innerHeight,
    CAMERA.near,
    CAMERA.far,
  );

  const cameraOffset = new THREE.Vector3(
    CAMERA.offsetX,
    CAMERA.offsetY,
    CAMERA.offsetZ,
  );
  const smoothTarget = new THREE.Vector3(0, CAMERA.targetHeight, 0);
  const desiredCamera = new THREE.Vector3();
  camera.position.copy(smoothTarget).add(cameraOffset);
  camera.lookAt(smoothTarget);

  const hemisphere = new THREE.HemisphereLight(
    COLORS.skyLight,
    COLORS.bounceLight,
    1.1,
  );
  scene.add(hemisphere);

  const sunOffset = new THREE.Vector3(10, 18, 8);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2);
  sun.position.copy(sunOffset);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  const groundGeometry = new THREE.PlaneGeometry(
    WORLD.groundSize,
    WORLD.groundSize,
  );
  const groundMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.ground,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.updateMatrix();
  ground.matrixAutoUpdate = false;
  scene.add(ground);

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const boxMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.box,
    flatShading: true,
  });
  const columnGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const columnMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.column,
    flatShading: true,
  });

  const colliders = [];

  for (const obstacle of OBSTACLES) {
    const isBox = obstacle.shape === 'box';
    const mesh = new THREE.Mesh(
      isBox ? boxGeometry : columnGeometry,
      isBox ? boxMaterial : columnMaterial,
    );

    if (isBox) {
      mesh.scale.set(obstacle.width, obstacle.height, obstacle.depth);
    } else {
      mesh.scale.set(obstacle.radius, obstacle.height, obstacle.radius);
    }

    mesh.position.set(obstacle.x, obstacle.height / 2, obstacle.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);

    const halfWidth = isBox ? obstacle.width / 2 : obstacle.radius;
    const halfDepth = isBox ? obstacle.depth / 2 : obstacle.radius;
    colliders.push({
      minX: obstacle.x - halfWidth,
      maxX: obstacle.x + halfWidth,
      minZ: obstacle.z - halfDepth,
      maxZ: obstacle.z + halfDepth,
      maxY: obstacle.height,
    });
  }

  const targetGeometry = new THREE.CylinderGeometry(0.22, 0.32, 1.2, 8);
  const targetMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.targetBody,
    emissive: COLORS.targetFlash,
    emissiveIntensity: 0,
    flatShading: true,
  });
  const targetBody = new THREE.Mesh(targetGeometry, targetMaterial);
  targetBody.position.y = 0.6;
  targetBody.castShadow = true;
  targetBody.receiveShadow = true;

  const targetHeadGeometry = new THREE.SphereGeometry(0.3, 8, 6);
  const targetHead = new THREE.Mesh(targetHeadGeometry, targetMaterial);
  targetHead.position.y = 1.45;
  targetHead.castShadow = true;

  const targetBaseGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 8);
  const targetBaseMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.targetBase,
    flatShading: true,
  });
  const targetBase = new THREE.Mesh(targetBaseGeometry, targetBaseMaterial);
  targetBase.position.y = 0.06;
  targetBase.castShadow = true;
  targetBase.receiveShadow = true;

  targetBody.updateMatrix();
  targetBody.matrixAutoUpdate = false;
  targetHead.updateMatrix();
  targetHead.matrixAutoUpdate = false;
  targetBase.updateMatrix();
  targetBase.matrixAutoUpdate = false;

  const targetGroup = new THREE.Group();
  targetGroup.position.set(0, 0, -8);
  targetGroup.add(targetBody, targetHead, targetBase);
  targetGroup.updateMatrix();
  targetGroup.matrixAutoUpdate = false;
  scene.add(targetGroup);

  colliders.push({
    minX: -0.4,
    maxX: 0.4,
    minZ: -8.4,
    maxZ: -7.6,
    maxY: 1.6,
  });

  let targetFlash = 0;
  const target = {
    position: new THREE.Vector3(0, 0.95, -8),
    radius: 0.55,
    hit() {
      targetFlash = 1;
      targetMaterial.emissiveIntensity = 2.8;
    },
    update(dt) {
      if (targetFlash <= 0) return;
      targetFlash = Math.max(0, targetFlash - dt * 2);
      targetMaterial.emissiveIntensity = targetFlash * 2.8;
    },
  };

  function updateCamera(x, z, dt) {
    const t = 1 - Math.exp(-CAMERA.followSpeed * dt);
    smoothTarget.x += (x - smoothTarget.x) * t;
    smoothTarget.z += (z - smoothTarget.z) * t;

    desiredCamera.copy(smoothTarget).add(cameraOffset);
    camera.position.lerp(desiredCamera, t);
    camera.lookAt(smoothTarget);

    sun.position.copy(smoothTarget).add(sunOffset);
    sun.target.position.copy(smoothTarget);
    sun.target.updateMatrixWorld();
  }

  return { scene, camera, colliders, target, updateCamera };
}
