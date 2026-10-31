import * as THREE from "three";
import { ROADS, VILLAGES } from "./kingdom.js";
import { makeRandom } from "./utils.js?v=19";
import { createHouse, createChurchBuilding } from "./house.js?v=19";
import { createHay } from "./fire.js";
import { createSeededRandom, createSharedHouseMaterial, generateCity } from "./procedural.js?v=19";

const sharedHouseMat = createSharedHouseMaterial();
const wallMat = sharedHouseMat;
const timberMat = new THREE.MeshStandardMaterial({ color: "#563e2b", roughness: 1, flatShading: true });
const darkTimberMat = new THREE.MeshStandardMaterial({ color: "#392e25", roughness: 1, flatShading: true });
const roofMat = new THREE.MeshStandardMaterial({ color: "#654a3a", roughness: 1, flatShading: true, side: THREE.DoubleSide });
const stoneMat = new THREE.MeshStandardMaterial({ color: "#77796d", roughness: 1, flatShading: true });
const ironMat = new THREE.MeshStandardMaterial({ color: "#454d49", metalness: 0.42, roughness: 0.66, flatShading: true });
const warmLightMat = new THREE.MeshStandardMaterial({ color: "#e88a3c", emissive: "#bd4918", emissiveIntensity: 1.2, roughness: 0.6, flatShading: true });
const cropMat = new THREE.MeshStandardMaterial({ color: "#88a349", roughness: 1, flatShading: true });
const clothRedMat = new THREE.MeshStandardMaterial({ color: "#8c4035", roughness: 1, flatShading: true });
const clothCreamMat = new THREE.MeshStandardMaterial({ color: "#d0bd91", roughness: 1, flatShading: true });
const paleWallMat = new THREE.MeshStandardMaterial({ color: "#c6b894", roughness: 1, flatShading: true });
const fadedWallMat = new THREE.MeshStandardMaterial({ color: "#a88c70", roughness: 1, flatShading: true });

function addMesh(parent, geometry, material, x, y, z, castShadow = false) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, material, x, y, z, sx, sy, sz, castShadow = false) {
  return addMesh(parent, new THREE.BoxGeometry(sx, sy, sz), material, x, y, z, castShadow);
}

function createGableRoof() {
  const width = 5.4;
  const depth = 4.4;
  const height = 2.25;
  const x = width / 2;
  const z = depth / 2;
  const points = [
    -x, 0, z, 0, height, z, 0, height, -z,
    -x, 0, z, 0, height, -z, -x, 0, -z,
    0, height, z, x, 0, z, x, 0, -z,
    0, height, z, x, 0, -z, 0, height, -z,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function toWorld(x, z, ry, ox, oz) {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  return { x: x + ox * cos + oz * sin, z: z - ox * sin + oz * cos };
}

function sampleFoundation(world, x, z, ry, width, depth) {
  let maxY = -Infinity;
  let minY = Infinity;
  const hw = width * 0.5;
  const hd = depth * 0.5;
  for (const lx of [-hw, 0, hw]) {
    for (const lz of [-hd, 0, hd]) {
      const p = toWorld(x, z, ry, lx, lz);
      const h = world.heightAt(p.x, p.z);
      if (h > maxY) maxY = h;
      if (h < minY) minY = h;
    }
  }
  const baseY = maxY + 0.04;
  const depthY = Math.max(2.6, baseY - minY + 2.0);
  return { baseY, depthY };
}

function createBlacksmith(scene, world, x = 15, z = -27, ry = 0) {
  const { baseY: y, depthY } = sampleFoundation(world, x, z, ry, 7.6, 8.2);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);
  // Terreno/fundação de pedra sólido sob a forja e a bigorna externa até o chão
  addBox(group, stoneMat, 0, -depthY / 2 + 0.06, 0, 7.6, depthY + 0.12, 6.2, true);
  addBox(group, stoneMat, 2.5, -depthY / 2 + 0.04, 3.6, 1.5, depthY + 0.08, 1.4, true);
  addBox(group, wallMat, 0, 2, 0, 7.2, 4, 5.8, true);
  const roof = addMesh(group, createGableRoof(), roofMat, 0, 4, 0);
  roof.scale.set(7.2 / 5.4, 1, 5.8 / 4.4);
  roof.castShadow = true;
  addBox(group, darkTimberMat, 0, 1.1, 2.96, 1.05, 2.2, 0.16);
  addBox(group, timberMat, -2.25, 2, 2.98, 0.28, 4.15, 0.22);
  addBox(group, timberMat, 2.25, 2, 2.98, 0.28, 4.15, 0.22);
  addBox(group, ironMat, -2.65, 1.05, 0.2, 0.42, 0.4, 0.42);

  const chimney = addMesh(group, new THREE.CylinderGeometry(0.42, 0.56, 2.9, 5), darkTimberMat, 2.55, 5.1, -1.1);
  chimney.rotation.z = -0.14;
  addMesh(group, new THREE.BoxGeometry(0.82, 0.28, 0.82), stoneMat, 2.5, 0.18, 3.6);
  addMesh(group, new THREE.BoxGeometry(1.05, 0.42, 0.74), ironMat, 2.5, 0.5, 3.6);
  addMesh(group, new THREE.BoxGeometry(0.58, 0.3, 0.5), warmLightMat, 2.5, 0.86, 3.6, false);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.16, 1.8, 5), darkTimberMat, 2.5, 1.25, 4.05).rotation.z = Math.PI / 2;

  world.addOrientedBox(x, z, 7.2, 5.8, ry, y - depthY, y + 5.8, { move: true, shot: true, cam: true });
  const forgePos = toWorld(x, z, ry, 2.5, 3.6);
  world.addOrientedBox(forgePos.x, forgePos.z, 1.15, 1.0, ry, y - depthY, y + 1.2, { move: true, shot: true, cam: false });
  return { ...toWorld(x, z, ry, -4.5, 5.6), name: "Forja de Bracken" };
}

function createMarket(scene, world, x = -15, z = -22, ry = 0) {
  const { baseY: y, depthY } = sampleFoundation(world, x, z, ry, 5.8, 4.6);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);
  // Base de pedra sólida até o chão sob o mercado
  addBox(group, stoneMat, 0, -depthY / 2 + 0.02, 0, 5.8, depthY + 0.04, 4.6, true);
  const postGeometry = new THREE.CylinderGeometry(0.13, 0.17, 3.1, 5);
  for (const px of [-2.2, 2.2]) {
    for (const pz of [-1.65, 1.65]) {
      addMesh(group, postGeometry, timberMat, px, 1.55, pz);
      const postWorld = toWorld(x, z, ry, px, pz);
      world.addOrientedBox(postWorld.x, postWorld.z, 0.34, 0.34, ry, y, y + 3.05, { move: true, shot: true, cam: false });
    }
  }
  addBox(group, timberMat, 0, 2.98, 0, 5.2, 0.22, 4.2);
  addBox(group, clothRedMat, -1.31, 3.18, 0, 2.6, 0.16, 4.3);
  addBox(group, clothCreamMat, 1.31, 3.18, 0, 2.6, 0.16, 4.3);
  // Toldo superior só bloqueia tiros na altura do telhado (2.88m..3.32m), deixando o interior livre!
  world.addOrientedBox(x, z, 5.2, 4.3, ry, y + 2.88, y + 3.32, { move: false, shot: true, cam: false });

  addBox(group, timberMat, 0, 1.2, 1.45, 4.5, 0.25, 0.8);
  addBox(group, timberMat, 0, 0.7, 1.45, 4.7, 0.18, 0.9);
  const counterWorld = toWorld(x, z, ry, 0, 1.45);
  world.addOrientedBox(counterWorld.x, counterWorld.z, 4.65, 0.88, ry, y, y + 1.34, { move: true, shot: true, cam: false });

  for (let i = 0; i < 3; i++) {
    const cx = -1.6 + i * 1.5;
    const crate = addMesh(group, new THREE.BoxGeometry(0.7, 0.65, 0.7), i === 1 ? clothCreamMat : timberMat, cx, 0.35, -0.5);
    crate.rotation.y = (i - 1) * 0.16;
    const crateWorld = toWorld(x, z, ry, cx, -0.5);
    world.addOrientedBox(crateWorld.x, crateWorld.z, 0.72, 0.72, ry, y, y + 0.72, { move: true, shot: true, cam: false });
  }
  addMesh(group, new THREE.CylinderGeometry(0.38, 0.42, 0.9, 7), timberMat, 2.8, 0.45, 1.7);
  const barrelWorld = toWorld(x, z, ry, 2.8, 1.7);
  world.addOrientedBox(barrelWorld.x, barrelWorld.z, 0.8, 0.8, ry, y, y + 0.9, { move: true, shot: true, cam: false });
  return { ...toWorld(x, z, ry, 3.5, 3.6), name: "Mercado da Estrada" };
}

function createGate(scene, world) {
  const x = 0;
  const z = -48;
  const { baseY: y, depthY } = sampleFoundation(world, x, z, 0, 10.6, 2.0);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  for (const px of [-4.6, 4.6]) {
    addBox(group, stoneMat, px, -depthY / 2 + 0.05, 0, 1.5, depthY + 0.1, 1.6, true);
    addMesh(group, new THREE.BoxGeometry(1.15, 6.4, 1.25), stoneMat, px, 3.2, 0, true);
    addMesh(group, new THREE.ConeGeometry(0.9, 1.4, 4), darkTimberMat, px, 7, 0);
    addBox(group, timberMat, px, 2.25, 0.8, 0.28, 3.4, 0.3);
    addBox(group, timberMat, px, 2.1, -0.8, 0.28, 3.1, 0.3);
    world.addBox(px - 0.62, px + 0.62, z - 0.68, z + 0.68, y - depthY, y + 7.5, { move: true, shot: true, cam: true });
  }
  addBox(group, timberMat, 0, 5.5, 0, 10.4, 0.7, 1.4, true);
  addBox(group, darkTimberMat, 0, 4.85, 0, 8.2, 0.35, 1.5);
  addMesh(group, new THREE.ConeGeometry(0.72, 1.4, 5), clothRedMat, 0, 7.3, 0.15).rotation.z = Math.PI;
  addBox(group, clothCreamMat, 0, 7.25, 0.22, 0.1, 0.9, 0.08, false);
  // Viga superior do portão: bloqueia tiros no alto, mas deixa a passagem livre embaixo
  world.addBox(-5.2, 5.2, z - 0.75, z + 0.75, y + 4.68, y + 5.88, { move: false, shot: true, cam: true });
  return { x: 0, z: -40.5, name: "Portão de Caldera" };
}

function createWell(scene, world, x = 5, z = -14) {
  const { baseY: y, depthY } = sampleFoundation(world, x, z, 0, 2.8, 2.8);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  // Base de pedra do poço indo até o chão
  addMesh(group, new THREE.CylinderGeometry(1.36, 1.52, depthY, 8), stoneMat, 0, -depthY / 2 + 0.02, 0, true);
  addMesh(group, new THREE.CylinderGeometry(1.18, 1.35, 0.9, 8), stoneMat, 0, 0.45, 0);
  addMesh(group, new THREE.CylinderGeometry(0.82, 0.92, 0.14, 8), darkTimberMat, 0, 0.93, 0, false);
  for (const px of [-1.12, 1.12]) {
    addMesh(group, new THREE.CylinderGeometry(0.1, 0.14, 2.5, 5), timberMat, px, 1.85, 0);
    // Colisor apenas nas duas hastes de madeira laterais (o vão central fica 100% livre para flechas!)
    world.addBox(x + px - 0.14, x + px + 0.14, z - 0.14, z + 0.14, y + 0.9, y + 3.1, { move: false, shot: true, cam: false });
  }
  addBox(group, timberMat, 0, 3.08, 0, 2.8, 0.18, 0.2);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.16, 1.8, 5), darkTimberMat, 0.75, 2.3, 0).rotation.z = Math.PI / 2;
  addMesh(group, new THREE.ConeGeometry(1.55, 1.05, 4), roofMat, 0, 3.62, 0).rotation.y = Math.PI / 4;
  // Mureta circular de pedra na base (altura até 1.0m): bloqueia andar e tiros baixos, sem bloquear o vão aberto acima!
  world.addStaticCollider(x, z, 1.28, 1.0);
  // Telhado do poço no alto (3.0m a 4.1m)
  world.addBox(x - 1.15, x + 1.15, z - 1.15, z + 1.15, y + 3.0, y + 4.1, { move: false, shot: true, cam: false });
  return { x, z };
}

function createFarm(scene, world, centerX = -31, centerZ = 0) {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);
  scene.add(group);
  const plotMaterial = new THREE.MeshStandardMaterial({ color: "#756345", roughness: 1, flatShading: true });
  const rowGeometry = new THREE.BoxGeometry(0.24, 0.07, 17);
  for (let row = 0; row < 5; row++) {
    const x = centerX - 4 + row * 2;
    const z = centerZ;
    const y = world.heightAt(x, z) + 0.035;
    addMesh(group, rowGeometry, plotMaterial, x, y, z, false);
  }
  const cropGeometry = new THREE.ConeGeometry(0.24, 0.72, 4, 1);
  const cropMesh = new THREE.InstancedMesh(cropGeometry, cropMat, 54);
  cropMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  let count = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 18; col++) {
      const x = centerX - 3.8 + row * 3.8;
      const z = centerZ - 7.2 + col * 0.82;
      dummy.position.set(x, world.heightAt(x, z) + 0.36, z);
      dummy.rotation.set(0, (row * 17 + col * 11) % 6 * 0.17, 0);
      dummy.scale.set(0.76, 0.7 + (col % 3) * 0.12, 0.76);
      dummy.updateMatrix();
      cropMesh.setMatrixAt(count++, dummy.matrix);
    }
  }
  cropMesh.castShadow = false;
  cropMesh.receiveShadow = false;
  group.add(cropMesh);
  const fenceMaterial = timberMat;
  for (let i = 0; i < 9; i++) {
    const z = centerZ - 8 + i * 2;
    const yL = world.heightAt(centerX - 8, z);
    const yR = world.heightAt(centerX + 3, z);
    addMesh(group, new THREE.CylinderGeometry(0.08, 0.1, 1.1, 4), fenceMaterial, centerX - 8, yL + 0.55, z);
    addMesh(group, new THREE.CylinderGeometry(0.08, 0.1, 1.1, 4), fenceMaterial, centerX + 3, yR + 0.55, z);
    world.addStaticCollider(centerX - 8, z, 0.12, 1.1);
    world.addStaticCollider(centerX + 3, z, 0.12, 1.1);
  }
}

function createRoad(scene, world) {
  const stoneGeometry = new THREE.DodecahedronGeometry(0.38, 0);
  const roadMaterial = new THREE.MeshStandardMaterial({ color: "#88806c", roughness: 1, flatShading: true });
  const stones = new THREE.InstancedMesh(stoneGeometry, roadMaterial, 128);
  stones.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  let index = 0;
  let state = 94821;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  for (let z = -7; z >= -48; z -= 1.2) {
    const x = (random() - 0.5) * 3.1;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.18, (random() - 0.5) * 0.8, random() * 0.18);
    dummy.scale.set(0.8 + random() * 0.45, 0.42 + random() * 0.28, 0.8 + random() * 0.45);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  for (let x = -14; x <= 14; x += 1.1) {
    const z = -21 + (random() - 0.5) * 3;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.2, (random() - 0.5) * 0.9, random() * 0.2);
    dummy.scale.set(0.78 + random() * 0.42, 0.42 + random() * 0.28, 0.78 + random() * 0.42);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  for (let x = -10; x >= -28; x -= 1.15) {
    const z = (random() - 0.5) * 2.4;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.2, (random() - 0.5) * 0.9, random() * 0.2);
    dummy.scale.set(0.76 + random() * 0.44, 0.42 + random() * 0.28, 0.78 + random() * 0.42);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  for (let x = 9; x <= 30; x += 1.15) {
    const z = -26 + (random() - 0.5) * 1.8;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.2, (random() - 0.5) * 0.9, random() * 0.2);
    dummy.scale.set(0.76 + random() * 0.44, 0.42 + random() * 0.28, 0.78 + random() * 0.42);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  for (let x = -14; x >= -25; x -= 1.15) {
    const z = -26 + (random() - 0.5) * 1.8;
    dummy.position.set(x, world.heightAt(x, z) + 0.12, z);
    dummy.rotation.set(random() * 0.2, (random() - 0.5) * 0.9, random() * 0.2);
    dummy.scale.set(0.76 + random() * 0.44, 0.42 + random() * 0.28, 0.78 + random() * 0.42);
    dummy.updateMatrix();
    stones.setMatrixAt(index++, dummy.matrix);
  }
  stones.count = index;
  stones.castShadow = false;
  stones.receiveShadow = true;
  scene.add(stones);
}

function createCottage(scene, world, x, z, variant = 0, ry = 0) {
  const width = variant === 2 ? 8 : 6.4;
  const depth = variant === 2 ? 6.2 : 5.4;
  const { baseY, depthY } = sampleFoundation(world, x, z, ry, width + 0.5, depth + 0.5);
  const group = new THREE.Group();
  group.position.set(x, baseY, z);
  group.rotation.y = ry;
  scene.add(group);
  const wall = variant === 0 ? wallMat : variant === 1 ? paleWallMat : fadedWallMat;
  const roofMaterial = variant === 1 ? darkTimberMat : roofMat;
  addBox(group, stoneMat, 0, -depthY / 2 + 0.18, 0, width + 0.45, depthY + 0.36, depth + 0.45, true);
  addBox(group, wall, 0, 1.9, 0, width, 3.7, depth, true);
  const roof = addMesh(group, createGableRoof(), roofMaterial, 0, 3.68, 0, true);
  roof.scale.set(width / 5.4, 1, depth / 4.4);
  addBox(group, darkTimberMat, 0, 1.02, depth / 2 + 0.11, 0.95, 2.04, 0.18);
  for (const px of [-width * 0.3, width * 0.3]) {
    addBox(group, timberMat, px, 2.05, depth / 2 + 0.1, 0.15, 4.05, 0.2);
    addMesh(group, new THREE.BoxGeometry(0.72, 0.82, 0.12), clothCreamMat, px * 0.72, 2.15, depth / 2 + 0.14, false);
  }
  const chimney = addMesh(group, new THREE.CylinderGeometry(0.34, 0.42, 2.1, 5), darkTimberMat, width * 0.31, 5.0, -depth * 0.18);
  chimney.rotation.z = -0.12;
  if (variant === 2) {
    addBox(group, timberMat, 0, 2.85, depth / 2 + 0.24, 2.4, 0.72, 0.16);
    addBox(group, clothRedMat, 0, 2.86, depth / 2 + 0.34, 1.75, 0.42, 0.07, false);
    addMesh(group, new THREE.CylinderGeometry(0.38, 0.42, 0.8, 7), timberMat, -2.4, 0.42, depth / 2 + 0.6);
    addMesh(group, new THREE.CylinderGeometry(0.38, 0.42, 0.8, 7), timberMat, 2.4, 0.42, depth / 2 + 0.6);
  }
  world.addOrientedBox(x, z, width, depth, ry, baseY - depthY, baseY + 5.6, { move: true, shot: true, cam: true });
}

function createChurch(scene, world, x, z, ry, name, houses = null) {
  const church = createChurchBuilding(scene, world, {
    id: `church-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    x,
    z,
    ry,
    seed: Math.round(Math.abs(x * 31 + z * 17)) + 777,
  });
  if (houses) houses.push(church);
  return church;
}

function createTownBench(scene, world, x, z, ry = 0, label = "E · sentar no banco da praça") {
  const y = world.heightAt(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);
  addBox(group, darkTimberMat, 0, 0.44, 0, 1.55, 0.08, 0.42, true);
  addBox(group, timberMat, 0, 0.72, -0.18, 1.55, 0.48, 0.08, true);
  for (const lx of [-0.65, 0.65]) {
    addBox(group, darkTimberMat, lx, 0.22, 0, 0.1, 0.44, 0.38, true);
  }
  return {
    x,
    z,
    yaw: ry,
    isChurchPew: false,
    label,
  };
}

function createWatchTower(scene, world, x, z) {
  const { baseY: y, depthY } = sampleFoundation(world, x, z, 0, 7.0, 7.0);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  addMesh(group, new THREE.CylinderGeometry(3.55, 3.85, depthY, 8), stoneMat, 0, -depthY / 2 + 0.05, 0, true);
  addMesh(group, new THREE.CylinderGeometry(3.1, 3.5, 11, 8), stoneMat, 0, 5.5, 0, true);
  addMesh(group, new THREE.CylinderGeometry(3.7, 3.1, 1.2, 8), darkTimberMat, 0, 11.4, 0, true);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    addBox(group, stoneMat, Math.cos(angle) * 3.5, 12.4, Math.sin(angle) * 3.5, 0.9, 1, 0.9).rotation.y = -angle;
  }
  addMesh(group, new THREE.ConeGeometry(2.7, 3.4, 8), roofMat, 0, 14.2, 0);
  addBox(group, darkTimberMat, 0, 1.1, 3.35, 1.2, 2.2, 0.2);
  addMesh(group, new THREE.ConeGeometry(0.72, 1.5, 5), clothRedMat, 0, 17.6, 0).rotation.z = Math.PI;
  world.addStaticCollider(x, z, 3.38, 14);
}

function createVillage(scene, world, village, houses) {
  const random = makeRandom(village.seed * 7919);
  const cx = village.x;
  const cz = village.z;
  const well = createWell(scene, world, cx, cz);
  const faceCenter = (x, z) => Math.atan2(cx - x, cz - z);

  // Chalés em anel, com a porta voltada para o poço.
  const count = village.kind === "watch" ? 2 : 5;
  const startAngle = random() * Math.PI * 2;
  const slots = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (i / count) * Math.PI * 2 + (random() - 0.5) * 0.25;
    const radius = 15 + random() * 3.5;
    slots.push({ angle, x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius });
  }

  const points = { well, home: [], work: null, patrol: [] };
  let workSlot = null;
  if (village.kind === "forge") workSlot = slots.pop();
  else if (village.kind === "market") workSlot = slots.pop();
  else if (village.kind === "farm") workSlot = slots.pop();

  for (const slot of slots) {
    houses.push(createHouse(scene, world, { id: `${village.id}-${houses.length}`, name: `Casa de ${village.name}`, x: slot.x, z: slot.z, ry: faceCenter(slot.x, slot.z), seed: village.seed * 31 + houses.length }));
    points.home.push({ x: cx + Math.cos(slot.angle) * 9, z: cz + Math.sin(slot.angle) * 9 });
  }

  if (village.kind === "forge") {
    points.work = createBlacksmith(scene, world, workSlot.x, workSlot.z, faceCenter(workSlot.x, workSlot.z));
  } else if (village.kind === "market") {
    points.work = createMarket(scene, world, workSlot.x, workSlot.z, faceCenter(workSlot.x, workSlot.z));
  } else if (village.kind === "farm") {
    const fx = cx + Math.cos(workSlot.angle) * 24;
    const fz = cz + Math.sin(workSlot.angle) * 24;
    createFarm(scene, world, fx, fz);
    points.work = { x: fx, z: fz };
    points.farmPath = [
      { x: fx - 4.4, z: fz + 7.1 }, { x: fx + 4.4, z: fz + 7.1 },
      { x: fx + 4.4, z: fz - 6.1 }, { x: fx - 4.4, z: fz - 6.1 },
    ];
  } else {
    const tx = cx + 7;
    const tz = cz - 8;
    createWatchTower(scene, world, tx, tz);
    points.patrol = [
      { x: tx - 5.4, z: tz + 5.4 }, { x: tx + 5.4, z: tz + 5.4 },
      { x: tx + 5.4, z: tz - 5.4 }, { x: tx - 5.4, z: tz - 5.4 },
    ];
  }

  // capela entre dois chalés, com a porta voltada para o poço
  const churchAngle = startAngle + Math.PI / count;
  const churchX = cx + Math.cos(churchAngle) * 27;
  const churchZ = cz + Math.sin(churchAngle) * 27;
  points.church = createChurch(scene, world, churchX, churchZ, faceCenter(churchX, churchZ), `Igreja de ${village.name}`, houses);

  return { village, ...points };
}

function createKingdomRoads(scene, world) {
  const stones = [];
  let state = 5527;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  for (let r = 0; r < ROADS.length; r++) {
    const [ax, az, bx, bz] = ROADS[r];
    const length = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / length;
    const dz = (bz - az) / length;
    for (let d = 0; d < length; d += 1.15) {
      const lateral = (random() - 0.5) * 3.1;
      const x = ax + dx * d - dz * lateral;
      const z = az + dz * d + dx * lateral;
      stones.push({ x, z, ry: (random() - 0.5) * 0.8, tilt: random() * 0.18, sx: 0.8 + random() * 0.45, sy: 0.42 + random() * 0.28 });
    }
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.38, 0),
    new THREE.MeshStandardMaterial({ color: "#88806c", roughness: 1, flatShading: true }),
    stones.length,
  );
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < stones.length; i++) {
    const stone = stones[i];
    dummy.position.set(stone.x, world.heightAt(stone.x, stone.z) + 0.12, stone.z);
    dummy.rotation.set(stone.tilt, stone.ry, stone.tilt);
    dummy.scale.set(stone.sx, stone.sy, stone.sx);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}

export function createSettlement(scene, world) {
  createRoad(scene, world);
  const well = createWell(scene, world);
  createFarm(scene, world);
  const blacksmith = createBlacksmith(scene, world);
  const market = createMarket(scene, world);
  const gate = createGate(scene, world);

  const houses = [];
  const house = (x, z, ry, seed, extra = {}) => houses.push(createHouse(scene, world, { id: `caldera-${houses.length}`, x, z, ry, seed, ...extra }));
  house(25, -14, -Math.PI / 2, 101, { type: "inn", name: "Pousada de Caldera", price: 5, width: 7.4, depth: 6.4 });
  house(26, -31, -Math.PI / 2, 102, { name: "Casa de Caldera" });
  house(-24, -28, Math.PI / 2, 103, { name: "Casa de Caldera" });
  house(-25, -43, Math.PI / 2, 104, { name: "Casa de Caldera" });
  house(30, -45, -Math.PI / 2, 105, { name: "Casa de Caldera" });

  createKingdomRoads(scene, world);
  const villages = VILLAGES.map((village) => createVillage(scene, world, village, houses));
  const hay = [];
  const torchSpots = [];
  const post = (x, z) => {
    world.addStaticCollider(x, z, 0.2, 2.4);
    torchSpots.push({ x, y: world.heightAt(x, z) + 2.3, z, nx: 0, nz: 0, post: true });
  };
  const capitalChurch = createChurch(scene, world, -14, -8, 0, "Igreja de Caldera", houses);
  const churches = [capitalChurch, ...villages.map((v) => v.church)];
  const wells = [well, ...villages.map((v) => v.well)];
  const townBenches = [
    createTownBench(scene, world, 8.2, -14.0, -Math.PI / 2, "E · sentar no banco da praça"),
    createTownBench(scene, world, 1.8, -14.0, Math.PI / 2, "E · sentar no banco da praça"),
    createTownBench(scene, world, -9.2, -2.5, 0, "E · sentar no banco do pátio da igreja"),
    createTownBench(scene, world, -9.5, -21.0, Math.PI / 2, "E · sentar no banco do mercado"),
  ];
  for (const house of houses) {
    for (const spot of house.torchSpots) torchSpots.push({ ...spot, post: false });
  }
  // postes na estrada principal e em volta dos poços
  for (const z of [-14, -28, -42]) {
    post(-3.8, z);
    post(3.8, z);
  }
  for (const place of villages) {
    for (const [dx, dz] of [[3.6, 3.6], [-3.6, 3.6], [3.6, -3.6], [-3.6, -3.6]]) post(place.village.x + dx, place.village.z + dz);
  }
  // feno: na horta da capital, nas hortas das vilas e junto de casas de palha
  const bale = (x, z, ry = 0) => {
    if (!world.isBlockedAt(x, z, 0.8)) hay.push(createHay(scene, world, x, z, ry));
  };
  bale(-26, 5);
  bale(-25.8, 3.6, 0.4);
  for (const place of villages) if (place.farmPath) {
    bale(place.work.x + 7, place.work.z + 8);
    bale(place.work.x + 7.4, place.work.z + 6.8, 0.5);
  }
  houses.forEach((house, i) => {
    if (house.thatch && i % 2 === 0) bale(house.outer.maxX + 1.0, house.outer.minZ + 1.3, i * 0.7);
  });
  const stands = churches.map((c) => c.stand);
  const settlementData = { blacksmith, market, gate, well, wells, townBenches, villages, churches, houses, hay, torchSpots, stands };
  settlementData.cityData = generateCity(104729, scene, sharedHouseMat, world, settlementData);

  return settlementData;
}
