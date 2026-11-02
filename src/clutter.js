import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ============================================================================
// clutter.js — Preenchimento Massivo de Mundo Otimizado (ClutterManager)
// Renderiza 100% dos adereços decorativos usando 1 Draw Call (InstancedMesh)
// por tipo no mundo todo. Zero-GC e computeBoundingSphere antecipado.
// ============================================================================

const _dummy = new THREE.Object3D();
const _zeroScale = new THREE.Vector3(0, 0, 0);

// Materiais reutilizados (Zero-GC)
const _woodMat = new THREE.MeshStandardMaterial({ color: "#664830", roughness: 0.9, flatShading: true });
const _darkWoodMat = new THREE.MeshStandardMaterial({ color: "#3d2a1b", roughness: 0.95, flatShading: true });
const _hayMat = new THREE.MeshStandardMaterial({ color: "#d2b050", roughness: 0.9, flatShading: true });
const _stoneMat = new THREE.MeshStandardMaterial({ color: "#80827b", roughness: 0.95, flatShading: true });
const _clothMat = new THREE.MeshStandardMaterial({ color: "#a88860", roughness: 0.85, flatShading: true });
const _cropMat = new THREE.MeshStandardMaterial({ color: "#c89f48", roughness: 0.85, flatShading: true });

/**
 * Cria a geometria combinada de Plantações (Trigo/Cenoura).
 */
function createCropGeometry() {
  const geos = [];
  // Montículo de terra arada no sulco
  const soil = new THREE.BoxGeometry(0.9, 0.08, 0.9);
  soil.translate(0, 0.04, 0);
  geos.push(soil);

  // Tufos de trigo com espigas douradas
  const stalkOffsets = [
    [-0.22, -0.22], [0.22, -0.22],
    [-0.22, 0.22], [0.22, 0.22],
    [0.0, 0.0],
  ];
  for (const [ox, oz] of stalkOffsets) {
    const stalk = new THREE.CylinderGeometry(0.02, 0.025, 0.52, 4);
    stalk.translate(ox, 0.3, oz);
    geos.push(stalk);

    const ear = new THREE.ConeGeometry(0.065, 0.22, 4);
    ear.translate(ox, 0.58, oz);
    geos.push(ear);
  }

  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Cria a geometria combinada do Espantalho (Scarecrow).
 */
function createScarecrowGeometry() {
  const geos = [];
  // Poste central vertical
  const post = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6);
  post.translate(0, 1.2, 0);
  geos.push(post);
  // Barra transversal dos braços
  const cross = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6);
  cross.rotateZ(Math.PI / 2);
  cross.translate(0, 1.8, 0);
  geos.push(cross);
  // Cabeça de palha/saco
  const head = new THREE.SphereGeometry(0.24, 6, 6);
  head.translate(0, 2.15, 0);
  geos.push(head);
  // Chapéu de palha
  const hatBrim = new THREE.CylinderGeometry(0.48, 0.48, 0.04, 8);
  hatBrim.translate(0, 2.3, 0);
  geos.push(hatBrim);
  const hatCone = new THREE.ConeGeometry(0.3, 0.45, 8);
  hatCone.translate(0, 2.52, 0);
  geos.push(hatCone);
  // Túnica de farrapos
  const body = new THREE.ConeGeometry(0.32, 1.1, 6);
  body.translate(0, 1.35, 0);
  geos.push(body);

  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Cria a geometria combinada do Monte de Feno (Hay Mounds).
 */
function createHayMoundGeometry() {
  const geos = [];
  const base = new THREE.CylinderGeometry(1.4, 1.7, 1.2, 8);
  base.translate(0, 0.6, 0);
  geos.push(base);
  const top = new THREE.ConeGeometry(1.45, 1.5, 8);
  top.translate(0, 1.85, 0);
  geos.push(top);

  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Cria a geometria combinada da Pilha de Toras de Madeira (Wood Piles).
 */
function createWoodPileGeometry() {
  const geos = [];
  // Toras empilhadas em pirâmide (3 embaixo, 2 no meio, 1 no topo)
  const logLen = 2.4;
  const logRadius = 0.16;
  const addLog = (x, y, z) => {
    const log = new THREE.CylinderGeometry(logRadius, logRadius, logLen, 6);
    log.rotateX(Math.PI / 2);
    log.translate(x, y, z);
    geos.push(log);
  };
  addLog(-0.35, 0.16, 0);
  addLog(0.0, 0.16, 0);
  addLog(0.35, 0.16, 0);
  addLog(-0.18, 0.44, 0);
  addLog(0.18, 0.44, 0);
  addLog(0.0, 0.72, 0);

  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Cria a geometria combinada de Monte de Pedras Talhadas (Stone Piles).
 */
function createStonePileGeometry() {
  const geos = [];
  const addBlock = (w, h, d, x, y, z, ry = 0) => {
    const b = new THREE.BoxGeometry(w, h, d);
    if (ry) b.rotateY(ry);
    b.translate(x, y, z);
    geos.push(b);
  };
  addBlock(0.8, 0.4, 0.5, -0.3, 0.2, 0.1, 0.1);
  addBlock(0.7, 0.35, 0.6, 0.35, 0.18, -0.05, -0.2);
  addBlock(0.65, 0.38, 0.45, 0.05, 0.55, 0.05, 0.3);
  addBlock(0.4, 0.3, 0.35, -0.25, 0.52, -0.2, 0.5);

  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Cria a geometria combinada de Carroça Abandonada (Abandoned Cart).
 */
function createCartGeometry() {
  const geos = [];
  // Caçamba de tábuas de madeira
  const floor = new THREE.BoxGeometry(1.6, 0.1, 2.6);
  floor.translate(0, 0.65, 0);
  geos.push(floor);
  // Laterais
  const left = new THREE.BoxGeometry(0.08, 0.55, 2.6);
  left.translate(-0.8, 0.95, 0);
  geos.push(left);
  const right = new THREE.BoxGeometry(0.08, 0.55, 2.6);
  right.translate(0.8, 0.95, 0);
  geos.push(right);
  const back = new THREE.BoxGeometry(1.6, 0.55, 0.08);
  back.translate(0, 0.95, -1.3);
  geos.push(back);
  // Varal dianteiro para atrelar cavalos
  const shaftLeft = new THREE.BoxGeometry(0.08, 0.08, 1.8);
  shaftLeft.translate(-0.45, 0.45, 1.9);
  geos.push(shaftLeft);
  const shaftRight = new THREE.BoxGeometry(0.08, 0.08, 1.8);
  shaftRight.translate(0.45, 0.45, 1.9);
  geos.push(shaftRight);
  // Eixos e 2 Rodas de madeira
  const axle = new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6);
  axle.rotateZ(Math.PI / 2);
  axle.translate(0, 0.5, 0);
  geos.push(axle);
  for (const sx of [-1.02, 1.02]) {
    const wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 10);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(sx, 0.55, 0);
    geos.push(wheel);
  }

  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Gerenciador Central de Adereços (ClutterManager).
 */
export class ClutterManager {
  constructor(scene, world, capacity = 120, churches = [], houses = []) {
    this.scene = scene;
    this.world = world;
    this.churches = churches;
    this.houses = houses;
    this.capacity = capacity;

    // 1 InstancedMesh por tipo de adereço (Exatamente 1 Draw Call cada)
    this.scarecrowsMesh = new THREE.InstancedMesh(createScarecrowGeometry(), _clothMat, capacity);
    this.scarecrowsMesh.name = "Clutter_Scarecrows";
    this.scarecrowsMesh.castShadow = true;
    this.scarecrowsMesh.receiveShadow = true;
    this.scarecrowsCount = 0;

    this.hayMoundsMesh = new THREE.InstancedMesh(createHayMoundGeometry(), _hayMat, capacity);
    this.hayMoundsMesh.name = "Clutter_HayMounds";
    this.hayMoundsMesh.castShadow = true;
    this.hayMoundsMesh.receiveShadow = true;
    this.hayMoundsCount = 0;

    this.woodPilesMesh = new THREE.InstancedMesh(createWoodPileGeometry(), _woodMat, capacity);
    this.woodPilesMesh.name = "Clutter_WoodPiles";
    this.woodPilesMesh.castShadow = true;
    this.woodPilesMesh.receiveShadow = true;
    this.woodPilesCount = 0;

    this.stonePilesMesh = new THREE.InstancedMesh(createStonePileGeometry(), _stoneMat, capacity);
    this.stonePilesMesh.name = "Clutter_StonePiles";
    this.stonePilesMesh.castShadow = true;
    this.stonePilesMesh.receiveShadow = true;
    this.stonePilesCount = 0;

    this.cartsMesh = new THREE.InstancedMesh(createCartGeometry(), _darkWoodMat, capacity);
    this.cartsMesh.name = "Clutter_AbandonedCarts";
    this.cartsMesh.castShadow = true;
    this.cartsMesh.receiveShadow = true;
    this.cartsCount = 0;

    const cropCapacity = Math.max(400, capacity * 4);
    this.cropCapacity = cropCapacity;
    this.cropsMesh = new THREE.InstancedMesh(createCropGeometry(), _cropMat, cropCapacity);
    this.cropsMesh.name = "Clutter_FarmCrops";
    this.cropsMesh.castShadow = false;
    this.cropsMesh.receiveShadow = true;
    this.cropsCount = 0;

    // Inicializa todas as matrizes em escala 0 (invisíveis por padrão)
    for (let i = 0; i < capacity; i++) {
      _dummy.position.set(0, -999, 0);
      _dummy.scale.copy(_zeroScale);
      _dummy.updateMatrix();
      this.scarecrowsMesh.setMatrixAt(i, _dummy.matrix);
      this.hayMoundsMesh.setMatrixAt(i, _dummy.matrix);
      this.woodPilesMesh.setMatrixAt(i, _dummy.matrix);
      this.stonePilesMesh.setMatrixAt(i, _dummy.matrix);
      this.cartsMesh.setMatrixAt(i, _dummy.matrix);
    }
    for (let i = 0; i < cropCapacity; i++) {
      _dummy.position.set(0, -999, 0);
      _dummy.scale.copy(_zeroScale);
      _dummy.updateMatrix();
      this.cropsMesh.setMatrixAt(i, _dummy.matrix);
    }

    this.scene.add(this.scarecrowsMesh);
    this.scene.add(this.hayMoundsMesh);
    this.scene.add(this.woodPilesMesh);
    this.scene.add(this.stonePilesMesh);
    this.scene.add(this.cartsMesh);
    this.scene.add(this.cropsMesh);
  }

  addScarecrow(x, z, ry = 0) {
    if (this.scarecrowsCount >= this.capacity) return;
    const y = this.world.heightAt(x, z);
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, ry, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    this.scarecrowsMesh.setMatrixAt(this.scarecrowsCount, _dummy.matrix);
    this.scarecrowsCount++;
    this.world.addStaticCollider(x, z, 0.4, 2.4);
  }

  addHayMound(x, z, ry = 0) {
    if (this.hayMoundsCount >= this.capacity) return;
    const y = this.world.heightAt(x, z);
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, ry, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    this.hayMoundsMesh.setMatrixAt(this.hayMoundsCount, _dummy.matrix);
    this.hayMoundsCount++;
    this.world.addStaticCollider(x, z, 1.4, 2.2);
  }

  addWoodPile(x, z, ry = 0) {
    if (this.woodPilesCount >= this.capacity) return;
    const y = this.world.heightAt(x, z);
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, ry, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    this.woodPilesMesh.setMatrixAt(this.woodPilesCount, _dummy.matrix);
    this.woodPilesCount++;
    this.world.addStaticCollider(x, z, 1.2, 0.9);
  }

  addStonePile(x, z, ry = 0) {
    if (this.stonePilesCount >= this.capacity) return;
    const y = this.world.heightAt(x, z);
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, ry, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    this.stonePilesMesh.setMatrixAt(this.stonePilesCount, _dummy.matrix);
    this.stonePilesCount++;
    this.world.addStaticCollider(x, z, 0.8, 0.7);
  }

  addAbandonedCart(x, z, ry = 0) {
    if (this.cartsCount >= this.capacity) return;
    const y = this.world.heightAt(x, z);
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, ry, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    this.cartsMesh.setMatrixAt(this.cartsCount, _dummy.matrix);
    this.cartsCount++;
    this.world.addStaticCollider(x, z, 1.2, 1.6);
  }

  addCrop(x, z, ry = 0) {
    if (this.cropsCount >= this.cropCapacity) return;
    const y = this.world.heightAt(x, z);
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, ry, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    this.cropsMesh.setMatrixAt(this.cropsCount, _dummy.matrix);
    this.cropsCount++;
  }

  /**
   * Checa se o ponto está proibido para plantações e clutter rural:
   * 1. Distância mínima de 38m de qualquer igreja (NENHUM espantalho ou trigo dentro/perto da igreja)
   * 2. Distância mínima de 8.5m de casas e construções
   * 3. Colisores estáticos no mundo
   */
  isLocationBlocked(x, z, radius = 2.5) {
    if (this.churches) {
      for (let i = 0; i < this.churches.length; i++) {
        const c = this.churches[i];
        const cx = c.x || 0;
        const cz = c.z || 0;
        const dx = x - cx;
        const dz = z - cz;
        if (dx * dx + dz * dz < 38.0 * 38.0) return true;
      }
    }
    if (this.houses) {
      for (let i = 0; i < this.houses.length; i++) {
        const h = this.houses[i];
        const hx = h.x || (h.root ? h.root.position.x : 0);
        const hz = h.z || (h.root ? h.root.position.z : 0);
        const dx = x - hx;
        const dz = z - hz;
        if (dx * dx + dz * dz < 8.5 * 8.5) return true;
      }
    }
    if (this.world && this.world.isBlockedAtHeight) {
      const y = this.world.heightAt(x, z);
      if (this.world.isBlockedAtHeight(x, y, z, radius)) return true;
    }
    return false;
  }

  /**
   * ZONAS DE PERTENCIMENTO (Smart Clutter Generation):
   * Cria uma fazenda estruturada (FarmZone):
   * 1. Espantalho nasce EXCLUSIVAMENTE no centro geométrico do grid.
   * 2. Áreas ao redor são preenchidas com as instâncias de plantação (trigo/cenoura).
   * 3. Fardos de feno nascem unicamente atrelados nas margens imediatas da plantação.
   */
  createFarmZone(centerX, centerZ, gridX = 4, gridZ = 4, spacing = 1.15) {
    // Validação rígida: se estiver perto de igrejas ou sobre construções, cancela a fazenda inteira
    if (this.isLocationBlocked(centerX, centerZ, 4.0)) return false;

    // 1. Espantalho spawna unicamente no centro desse grid
    this.addScarecrow(centerX, centerZ, Math.PI * 0.15);

    // 2. Preenchimento de plantação ao redor do espantalho
    const halfX = (gridX - 1) / 2;
    const halfZ = (gridZ - 1) / 2;

    for (let ix = -halfX; ix <= halfX; ix++) {
      for (let iz = -halfZ; iz <= halfZ; iz++) {
        // Pula o centro onde fica a estaca do espantalho
        if (Math.abs(ix) < 0.4 && Math.abs(iz) < 0.4) continue;
        const px = centerX + ix * spacing;
        const pz = centerZ + iz * spacing;
        if (this.isLocationBlocked(px, pz, 0.4)) continue;
        const jitterRot = ((ix * 13 + iz * 7) % 8) * 0.25;
        this.addCrop(px, pz, jitterRot);
      }
    }

    // 3. Fardo de feno na margem imediata da plantação
    const hayEdgeX = centerX + (halfX + 1.2) * spacing;
    const hayEdgeZ = centerZ + (halfZ - 0.5) * spacing;
    if (!this.isLocationBlocked(hayEdgeX, hayEdgeZ, 1.0)) {
      this.addHayMound(hayEdgeX, hayEdgeZ, 0.4);
    }
    return true;
  }

  /**
   * Finaliza o preenchimento de adereços atualizando as matrizes e calculando os Bounding Volumes.
   */
  build() {
    const list = [
      this.scarecrowsMesh,
      this.hayMoundsMesh,
      this.woodPilesMesh,
      this.stonePilesMesh,
      this.cartsMesh,
      this.cropsMesh,
    ];
    for (const mesh of list) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }
}
