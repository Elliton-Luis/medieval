import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CONFIG } from "./config.js";
import { hash2, makeRandom, terrainHeight } from "./utils.js";
import { TreeKit, LOD_LEVELS, createCrossedTriangles, createIsoscelesTriangleGeometry, makeBillboardMaterial, makeImpostorMaterial } from "./trees.js";
import { VILLAGES, PLATEAU_INNER, PLATEAU_OUTER, isKingdomClear, setVillageBaseHeights, villageBaseHeight } from "./kingdom.js";
import { SpatialHashGrid } from "./spatialGrid.js";
import { applyBiome } from "./biomes.js";

const COLORS = {
  // Paleta "apodrecida": capim seco e amarelado, manchas de mato morto e terra escura
  grassA: new THREE.Color("#7a7538"),
  grassB: new THREE.Color("#a39c47"),
  rot: new THREE.Color("#5d4b2f"),
  dirt: new THREE.Color("#6f5d42"),
  stone: new THREE.Color("#686961"),
};

const _tintColor = new THREE.Color();
const _terrainColor = new THREE.Color();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDown = new THREE.Vector3(0, -1, 0);
const _hitPoint = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

// Só o que está perto do jogador entra no mapa de sombras (frustum curto ~30m em volta do jogador).
export const SHADOW_RADIUS = 30;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.activeChunks = [];
    this.environmentInstancedMeshes = [];
    this.staticColliders = [];
    this.boxColliders = [];
    this._boxGrid = new Map();
    this._boxScratch = [];
    this._boxStamp = 0;
    this.spatialGrid = new SpatialHashGrid(16.0);
    this._nearbyColliders = [];
    this._worker = null;
    this._workerJobId = 0;
    this._workerCallbacks = new Map();
    this._initTerrainWorker();
    this.floors = [];
    this.centerX = Number.NaN;
    this.centerZ = Number.NaN;
    this.seed = CONFIG.seed;
    this.chunkSize = CONFIG.chunkSize;
    this.radius = CONFIG.activeChunkRadius;
    this.loadRadiusSq = (this.radius + 0.35) * (this.radius + 0.35);
    this.unloadRadiusSq = CONFIG.chunkUnloadRadius * CONFIG.chunkUnloadRadius;
    this.viewDistanceSq = CONFIG.viewDistance * CONFIG.viewDistance;
    this._dummy = new THREE.Object3D();
    this._frustum = new THREE.Frustum();
    this._projectionView = new THREE.Matrix4();
    this._camDir = new THREE.Vector3();
    this._terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
    this.treeKit = new TreeKit();
    this.lodLevels = LOD_LEVELS;
    this._lodDistances = CONFIG.lodDistances;
    this._rockMaterial = new THREE.MeshStandardMaterial({ color: "#777a70", roughness: 1, flatShading: true });
    this._clayMaterial = new THREE.MeshStandardMaterial({ color: "#9c5737", roughness: 1, flatShading: true });
    // Pedras: 6 níveis (icosaedro 20 faces -> octaedro 8 -> tetraedro 4 -> pirâmide -> 2 triângulos cruzados -> 1 triângulo)
    const rockFar = "#545650";
    this._rockLods = [
      { geometry: new THREE.IcosahedronGeometry(0.7, 0), material: this._rockMaterial },
      { geometry: new THREE.OctahedronGeometry(0.7, 0), material: this._rockMaterial },
      { geometry: new THREE.TetrahedronGeometry(0.8, 0), material: this._rockMaterial },
      { geometry: new THREE.ConeGeometry(0.75, 0.8, 4, 1, true), material: this._rockMaterial },
      { geometry: createCrossedTriangles(1.5, 0.85, 0.02), material: makeImpostorMaterial(rockFar) },
      { geometry: createIsoscelesTriangleGeometry(1.5, 0.85, 0.02, false), material: makeBillboardMaterial(rockFar) },
    ];
    // Argila: só aparece nos 4 níveis mais próximos (pequena demais para impostor)
    const clayHi = new THREE.DodecahedronGeometry(0.65, 0);
    const clayLo = new THREE.OctahedronGeometry(0.65, 0);
    this._clayLods = [
      { geometry: clayHi, material: this._clayMaterial },
      { geometry: clayHi, material: this._clayMaterial },
      { geometry: clayLo, material: this._clayMaterial },
      { geometry: clayLo, material: this._clayMaterial },
    ];
    // Grama: só nos 2 níveis mais próximos
    this._grassLods = [
      { geometry: this.treeKit.grass.geometry, material: this.treeKit.grass.material },
      { geometry: this.treeKit.grass.geometry, material: this.treeKit.grass.material },
    ];
    setVillageBaseHeights(VILLAGES.map((v) => terrainHeight(v.x, v.z, CONFIG.seed)));
    this._spawnX = CONFIG.player.startX;
    this._spawnZ = CONFIG.player.startZ;
    this._pendingChunkQueue = [];
    this._pendingUnloadQueue = [];

    // Pré-computa o array de índices de terreno uma única vez (Zero-GC no streaming)
    const segs = CONFIG.chunkSegments;
    const r = segs + 1;
    this._sharedTerrainIndices = new Uint32Array(segs * segs * 6);
    let idxCursor = 0;
    for (let z = 0; z < segs; z++) {
      for (let x = 0; x < segs; x++) {
        const a = z * r + x;
        const b = a + 1;
        const c = a + r;
        const d = c + 1;
        if ((x + z) % 2 === 0) {
          this._sharedTerrainIndices[idxCursor] = a;
          this._sharedTerrainIndices[idxCursor + 1] = c;
          this._sharedTerrainIndices[idxCursor + 2] = b;
          this._sharedTerrainIndices[idxCursor + 3] = b;
          this._sharedTerrainIndices[idxCursor + 4] = c;
          this._sharedTerrainIndices[idxCursor + 5] = d;
        } else {
          this._sharedTerrainIndices[idxCursor] = a;
          this._sharedTerrainIndices[idxCursor + 1] = c;
          this._sharedTerrainIndices[idxCursor + 2] = d;
          this._sharedTerrainIndices[idxCursor + 3] = a;
          this._sharedTerrainIndices[idxCursor + 4] = d;
          this._sharedTerrainIndices[idxCursor + 5] = b;
        }
        idxCursor += 6;
      }
    }

    this._initInitialChunks(this._spawnX, this._spawnZ);
  }

  _initInitialChunks(x, z) {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    this.centerX = cx;
    this.centerZ = cz;
    this.activeChunks.length = 0;

    for (let dz = -this.radius; dz <= this.radius; dz++) {
      for (let dx = -this.radius; dx <= this.radius; dx++) {
        if (dx * dx + dz * dz > this.loadRadiusSq) continue;
        const chunkX = cx + dx;
        const chunkZ = cz + dz;
        const key = `${chunkX}:${chunkZ}`;
        const chunk = this._createChunk(chunkX, chunkZ);
        this.chunks.set(key, chunk);
        chunk.group.visible = true;
        this.activeChunks.push(chunk);
      }
    }
    this._syncEnvironmentMeshes();
  }

  _syncEnvironmentMeshes() {
    this.environmentInstancedMeshes.length = 0;
    for (let i = 0; i < this.activeChunks.length; i++) {
      const chunk = this.activeChunks[i];
      for (let m = 0; m < chunk.instancedMeshes.length; m++) {
        const mesh = chunk.instancedMeshes[m];
        if (mesh.name === "Trees" || mesh.name === "Rocks" || mesh.name === "Clay") {
          this.environmentInstancedMeshes.push(mesh);
        }
      }
    }
  }

  _proceduralHeightAt(x, z) {
    let height = terrainHeight(x, z, this.seed);
    for (let i = 0; i < VILLAGES.length; i++) {
      const village = VILLAGES[i];
      const dx = x - village.x;
      const dz = z - village.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= PLATEAU_OUTER * PLATEAU_OUTER) continue;
      const distance = Math.sqrt(distanceSq);
      let blend = distance <= PLATEAU_INNER ? 1 : (PLATEAU_OUTER - distance) / (PLATEAU_OUTER - PLATEAU_INNER);
      blend = blend * blend * (3 - 2 * blend);
      height += (villageBaseHeight(i) - height) * blend;
    }
    return height;
  }

  _initTerrainWorker() {
    try {
      this._worker = new Worker(new URL("./terrainWorker.js?v=30", import.meta.url), { type: "module" });
      this._worker.onmessage = (e) => {
        const { id, positions, colors, heights, indices } = e.data;
        const cb = this._workerCallbacks.get(id);
        if (cb) {
          this._workerCallbacks.delete(id);
          cb({ positions, colors, heights, indices });
        }
      };
    } catch (_) {
      this._worker = null;
    }
  }

  requestTerrainChunk(cx, cz, callback) {
    if (!this._worker) {
      callback(this._createTerrainGeometry(cx, cz));
      return;
    }

    const id = ++this._workerJobId;
    this._workerCallbacks.set(id, ({ positions, colors, heights, indices }) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      callback({ geometry, heights });
    });

    const villageHeights = VILLAGES.map((_, i) => villageBaseHeight(i));
    this._worker.postMessage({
      id,
      cx,
      cz,
      segments: CONFIG.chunkSegments,
      chunkSize: this.chunkSize,
      seed: this.seed,
      villages: VILLAGES,
      villageHeights,
      floors: this.floors,
    });
  }

  heightAt(x, z) {
    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (f.active === false) continue;
      if (f.rot) {
        const relX = x - f.cx;
        const relZ = z - f.cz;
        const lx = relX * f.cos - relZ * f.sin;
        const lz = relX * f.sin + relZ * f.cos;
        if (Math.abs(lx) <= f.hx && Math.abs(lz) <= f.hz) return f.y;
      } else if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
        return f.y;
      }
    }
    return this._proceduralHeightAt(x, z);
  }

  // Calcula a altura analítica exata da malha triangular do terreno em (x, z)
  chunkGroundHeight(cx, cz, heights, x, z) {
    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (f.active === false) continue;
      if (f.rot) {
        const relX = x - f.cx;
        const relZ = z - f.cz;
        const lx = relX * f.cos - relZ * f.sin;
        const lz = relX * f.sin + relZ * f.cos;
        if (Math.abs(lx) <= f.hx && Math.abs(lz) <= f.hz) return f.y;
      } else if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
        return f.y;
      }
    }
    const size = this.chunkSize;
    const segments = CONFIG.chunkSegments;
    const row = segments + 1;
    const cellSize = size / segments;
    const localX = (x - cx * size) / cellSize;
    const localZ = (z - cz * size) / cellSize;
    const gx = Math.max(0, Math.min(segments - 1, localX | 0));
    const gz = Math.max(0, Math.min(segments - 1, localZ | 0));
    const tx = localX - gx;
    const tz = localZ - gz;

    const ia = gz * row + gx;
    const ya = heights[ia];
    const yb = heights[ia + 1];
    const yc = heights[ia + row];
    const yd = heights[ia + row + 1];

    if ((gx + gz) % 2 === 0) {
      if (tx + tz <= 1) {
        return ya + tx * (yb - ya) + tz * (yc - ya);
      } else {
        return yd + (1 - tx) * (yc - yd) + (1 - tz) * (yb - yd);
      }
    } else {
      if (tz >= tx) {
        return yc + tx * (yd - yc) + (1 - tz) * (ya - yc);
      } else {
        return yb + (1 - tx) * (ya - yb) + tz * (yd - yb);
      }
    }
  }

  // Raycast vertical descendente partindo do jogador para encaixar perfeitamente na malha do terreno, pisos, muros e rochas (Zero-GC)
  raycastGround(x, y = 0, z = 0) {
    let bestY = -Infinity;
    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (f.active === false) continue;
      if (f.rot) {
        const relX = x - f.cx;
        const relZ = z - f.cz;
        const lx = relX * f.cos - relZ * f.sin;
        const lz = relX * f.sin + relZ * f.cos;
        if (Math.abs(lx) <= f.hx && Math.abs(lz) <= f.hz) {
          if (f.y <= y + 0.65 && f.y > bestY) bestY = f.y;
        }
      } else if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
        if (f.y <= y + 0.65 && f.y > bestY) bestY = f.y;
      }
    }

    // Topo de caixas sólidas / muros / blocos (se o jogador estiver pulando ou caminhando sobre o topo)
    const boxes = this._boxesAt(x, z, 0.42);
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.active || !b.move || b.top === undefined) continue;
      let inside = false;
      if (b.rot) {
        const relX = x - b.cx;
        const relZ = z - b.cz;
        const lx = relX * b.cos - relZ * b.sin;
        const lz = relX * b.sin + relZ * b.cos;
        if (Math.abs(lx) <= b.hx + 0.05 && Math.abs(lz) <= b.hz + 0.05) inside = true;
      } else {
        if (x >= b.minX - 0.05 && x <= b.maxX + 0.05 && z >= b.minZ - 0.05 && z <= b.maxZ + 0.05) inside = true;
      }
      if (inside && b.top <= y + 0.65 && b.top > bestY) {
        bestY = b.top;
      }
    }

    // Topo de rochas e pedras naturais
    const size = this.chunkSize;
    const cx = Math.floor(x / size);
    const cz = Math.floor(z / size);
    for (let c = 0; c < this.activeChunks.length; c++) {
      const chunk = this.activeChunks[c];
      if (Math.abs(chunk.x - cx) > 1 || Math.abs(chunk.z - cz) > 1) continue;
      for (let i = 0; i < chunk.colliders.length; i++) {
        const o = chunk.colliders[i];
        if (o.disabled || o.radius <= 0 || o.top === undefined) continue;
        if (o.kind !== "rock" && o.kind !== "clay" && o.kind !== "stone") continue;
        const dx = x - o.x;
        const dz = z - o.z;
        const rad = o.radius * 1.15;
        if (dx * dx + dz * dz <= rad * rad) {
          if (o.top <= y + 0.75 && o.top > bestY) {
            bestY = o.top;
          }
        }
      }
    }

    let chunk = null;
    for (let i = 0; i < this.activeChunks.length; i++) {
      const c = this.activeChunks[i];
      if (c.x === cx && c.z === cz) {
        chunk = c;
        break;
      }
    }
    const terrainH = (!chunk || !chunk.heights)
      ? this._proceduralHeightAt(x, z)
      : this.chunkGroundHeight(cx, cz, chunk.heights, x, z);

    return Math.max(terrainH, bestY);
  }

  updateWind(dt) {
    this.treeKit.update(dt);
  }

  updateAround(x, z) {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);

    // Quando o jogador cruza a fronteira de um chunk (64m)
    if (cx !== this.centerX || cz !== this.centerZ) {
      this.centerX = cx;
      this.centerZ = cz;
      this.activeChunks.length = 0;
      this._pendingChunkQueue.length = 0;
      this._pendingUnloadQueue.length = 0;

      // 1. Identifica chunks já construídos no raio e enfileira os que faltam
      for (let dz = -this.radius; dz <= this.radius; dz++) {
        for (let dx = -this.radius; dx <= this.radius; dx++) {
          const dSq = dx * dx + dz * dz;
          if (dSq > this.loadRadiusSq) continue;
          const chunkX = cx + dx;
          const chunkZ = cz + dz;
          const key = `${chunkX}:${chunkZ}`;
          const chunk = this.chunks.get(key);
          if (chunk) {
            chunk.group.visible = true;
            this.activeChunks.push(chunk);
          } else {
            this._pendingChunkQueue.push({ x: chunkX, z: chunkZ, distSq: dSq });
          }
        }
      }

      // Oculta apenas os chunks que agora estão fora do raio de carregamento (sem piscar a cena)
      for (const [key, chunk] of this.chunks) {
        const dcx = chunk.x - cx;
        const dcz = chunk.z - cz;
        if (dcx * dcx + dcz * dcz > this.loadRadiusSq) {
          chunk.group.visible = false;
        }
      }

      // Prioriza a construção dos chunks mais próximos do jogador
      this._pendingChunkQueue.sort((a, b) => a.distSq - b.distSq);

      // 2. Enfileira chunks muito distantes para descarregamento suave
      for (const [key, chunk] of this.chunks) {
        const dcx = chunk.x - cx;
        const dcz = chunk.z - cz;
        if (dcx * dcx + dcz * dcz > this.unloadRadiusSq) {
          this._pendingUnloadQueue.push(key);
        }
      }

      this._syncEnvironmentMeshes();
    }

    // Processamento orçado por frame: constrói no máximo 1 novo chunk por frame
    // Isso evita completamente picos de 150-250ms que causavam travamentos ao caminhar ou cavalgar
    let createdChunk = false;
    if (this._pendingChunkQueue.length > 0) {
      const next = this._pendingChunkQueue.shift();
      const key = `${next.x}:${next.z}`;
      if (!this.chunks.has(key)) {
        const dcx = next.x - this.centerX;
        const dcz = next.z - this.centerZ;
        if (dcx * dcx + dcz * dcz <= this.loadRadiusSq) {
          const chunk = this._createChunk(next.x, next.z);
          this.chunks.set(key, chunk);
          chunk.group.visible = true;
          this.activeChunks.push(chunk);
          this._syncEnvironmentMeshes();
          createdChunk = true;
        }
      }
    }

    // Descarregamento orçado por frame: libera no máximo 1 chunk por frame APENAS quando nenhum chunk foi construído no frame atual,
    // eliminando conflitos de desalocação e alocação simultânea no driver WebGL
    if (!createdChunk && this._pendingUnloadQueue.length > 0) {
      const unloadKey = this._pendingUnloadQueue.shift();
      const chunk = this.chunks.get(unloadKey);
      if (chunk) {
        const dcx = chunk.x - this.centerX;
        const dcz = chunk.z - this.centerZ;
        if (dcx * dcx + dcz * dcz > this.unloadRadiusSq) {
          this.scene.remove(chunk.group);
          chunk.terrain.geometry.dispose();
          for (let i = 0; i < chunk.instancedMeshes.length; i++) {
            chunk.instancedMeshes[i].dispose();
          }
          if (chunk.colliders) {
            for (let i = 0; i < chunk.colliders.length; i++) {
              this.spatialGrid.remove(chunk.colliders[i]);
            }
          }
          this.chunks.delete(unloadKey);
        }
      }
    }
  }

  // Respawn de Recursos: restaura a matriz e colisor original das árvores e pedras colhidas após o tempo de regeneração.
  respawnResources(now = performance.now(), respawnDelayMs = 180000) {
    for (let i = 0; i < this.environmentInstancedMeshes.length; i++) {
      const mesh = this.environmentInstancedMeshes[i];
      const harvested = mesh.userData?.harvested;
      if (!harvested || harvested.size === 0) continue;
      let updated = false;
      let farUpdated = false;
      for (const [instanceId, entry] of harvested.entries()) {
        if (now - entry.time >= respawnDelayMs) {
          mesh.setMatrixAt(instanceId, entry.matrix);
          if (entry.collider) {
            entry.collider.disabled = false;
            entry.collider.radius = entry.originalRadius;
          }
          if (entry.farMesh && entry.farMatrix && typeof entry.farIndex === "number") {
            entry.farMesh.setMatrixAt(entry.farIndex, entry.farMatrix);
            farUpdated = true;
          }
          harvested.delete(instanceId);
          updated = true;
        }
      }
      if (updated) mesh.instanceMatrix.needsUpdate = true;
      if (farUpdated && mesh.userData.farMesh) mesh.userData.farMesh.instanceMatrix.needsUpdate = true;
    }
  }

  isBlockedAt(x, z, radius, y = null) {
    // Spatial Hash Grid O(1): Testa apenas obstáculos locais na célula de 16m e vizinhas imediatas
    this.spatialGrid.queryRadius(x, z, radius + 2.5, this._nearbyColliders);
    for (let i = 0; i < this._nearbyColliders.length; i++) {
      const obstacle = this._nearbyColliders[i];
      if (obstacle.disabled || obstacle.radius <= 0) continue;
      if (y !== null && obstacle.top !== undefined && y >= obstacle.top - 0.22) continue;
      const dx = x - obstacle.x;
      const dz = z - obstacle.z;
      const minDistance = radius + obstacle.radius;
      if (dx * dx + dz * dz < minDistance * minDistance) return true;
    }
    if (this._hitsBoxMove(x, z, radius, y)) return true;
    return false;
  }

  // Resolução contínua de esfera/cápsula (deslizamento suave contra obstáculos circulares, AABBs e OBBs respeitando altura real Y).
  resolveSphereMove(prevX, prevZ, nextX, nextZ, radius, out, playerY = null) {
    const totalDX = nextX - prevX;
    const totalDZ = nextZ - prevZ;
    const dist = Math.hypot(totalDX, totalDZ);
    const steps = dist > 0.16 ? Math.min(6, Math.ceil(dist / 0.16)) : 1;

    let curX = prevX;
    let curZ = prevZ;
    let hitX = false;
    let hitZ = false;

    for (let s = 1; s <= steps; s++) {
      const targetX = prevX + (totalDX * s) / steps;
      const targetZ = prevZ + (totalDZ * s) / steps;
      let x = targetX;
      let z = targetZ;

      const padding = radius + 1.8;
      const minChunkX = Math.floor((x - padding) / this.chunkSize);
      const maxChunkX = Math.floor((x + padding) / this.chunkSize);
      const minChunkZ = Math.floor((z - padding) / this.chunkSize);
      const maxChunkZ = Math.floor((z + padding) / this.chunkSize);

      for (let iter = 0; iter < 3; iter++) {
        // Spatial Hash Grid O(1): Consulta rápida de obstáculos circulares locais
        this.spatialGrid.queryRadius(x, z, radius + 2.5, this._nearbyColliders);
        for (let i = 0; i < this._nearbyColliders.length; i++) {
          const o = this._nearbyColliders[i];
          if (o.disabled || o.radius <= 0) continue;
          if (playerY !== null && o.top !== undefined && playerY >= o.top - 0.22) continue;
          const dx = x - o.x;
          const dz = z - o.z;
          const minD = radius + o.radius;
          const dSq = dx * dx + dz * dz;
          if (dSq < minD * minD) {
            const d = Math.sqrt(dSq);
            if (d > 1e-5) {
              const push = (minD - d) / d;
              x += dx * push;
              z += dz * push;
            } else {
              x += minD;
            }
          }
        }

        const boxes = this._boxesAt(x, z, radius + 0.6);
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          if (!b.active || !b.move) continue;
          if (playerY !== null && b.top !== undefined) {
            if (playerY >= b.top - 0.22) continue;
            if (b.bottom !== undefined && playerY + 1.8 <= b.bottom) continue;
          }
          if (b.rot) {
            const relX = x - b.cx;
            const relZ = z - b.cz;
            let lx = relX * b.cos - relZ * b.sin;
            let lz = relX * b.sin + relZ * b.cos;
            const clampX = Math.max(-b.hx, Math.min(lx, b.hx));
            const clampZ = Math.max(-b.hz, Math.min(lz, b.hz));
            const dx = lx - clampX;
            const dz = lz - clampZ;
            const dSq = dx * dx + dz * dz;
            if (dSq < radius * radius) {
              if (dSq > 1e-6) {
                const d = Math.sqrt(dSq);
                const push = (radius - d) / d;
                lx += dx * push;
                lz += dz * push;
              } else {
                const left = lx + b.hx;
                const right = b.hx - lx;
                const back = lz + b.hz;
                const front = b.hz - lz;
                const minSide = Math.min(left, right, back, front);
                if (minSide === left) lx = -b.hx - radius;
                else if (minSide === right) lx = b.hx + radius;
                else if (minSide === back) lz = -b.hz - radius;
                else lz = b.hz + radius;
              }
              x = b.cx + lx * b.cos + lz * b.sin;
              z = b.cz - lx * b.sin + lz * b.cos;
            }
          } else {
            const cx = Math.max(b.minX, Math.min(x, b.maxX));
            const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
            const dx = x - cx;
            const dz = z - cz;
            const dSq = dx * dx + dz * dz;
            if (dSq < radius * radius) {
              if (dSq > 1e-6) {
                const d = Math.sqrt(dSq);
                const push = (radius - d) / d;
                x += dx * push;
                z += dz * push;
              } else {
                const left = x - b.minX;
                const right = b.maxX - x;
                const back = z - b.minZ;
                const front = b.maxZ - z;
                const minSide = Math.min(left, right, back, front);
                if (minSide === left) x = b.minX - radius;
                else if (minSide === right) x = b.maxX + radius;
                else if (minSide === back) z = b.minZ - radius;
                else z = b.maxZ + radius;
              }
            }
          }
        }
      }

      if (this.isBlockedAt(x, z, radius, playerY)) {
        if (!this.isBlockedAt(targetX, curZ, radius, playerY)) {
          x = targetX;
          z = curZ;
          hitZ = true;
        } else if (!this.isBlockedAt(curX, targetZ, radius, playerY)) {
          x = curX;
          z = targetZ;
          hitX = true;
        } else {
          x = curX;
          z = curZ;
          hitX = true;
          hitZ = true;
        }
      } else {
        if (Math.abs(x - targetX) > 1e-3 && Math.abs(targetX - curX) > 1e-4) hitX = true;
        if (Math.abs(z - targetZ) > 1e-3 && Math.abs(targetZ - curZ) > 1e-4) hitZ = true;
      }

      curX = x;
      curZ = z;
    }

    out.x = curX;
    out.z = curZ;
    out.hitX = hitX;
    out.hitZ = hitZ;
    return out;
  }

  // Colisor retangular (AABB). move: bloqueia andar; shot: bloqueia tiros e a mira; cam: empurra a câmera.
  addBox(minX, maxX, minZ, maxZ, bottom, top, flags = {}) {
    const box = {
      minX,
      maxX,
      minZ,
      maxZ,
      bottom,
      top,
      rot: false,
      move: flags.move ?? true,
      shot: flags.shot ?? true,
      cam: flags.cam ?? true,
      active: true,
      ref: flags.ref ?? null,
      _stamp: 0,
    };
    this.boxColliders.push(box);
    const cell = 8;
    for (let cx = Math.floor(minX / cell); cx <= Math.floor(maxX / cell); cx++) {
      for (let cz = Math.floor(minZ / cell); cz <= Math.floor(maxZ / cell); cz++) {
        const key = cx * 100003 + cz;
        let list = this._boxGrid.get(key);
        if (!list) this._boxGrid.set(key, (list = []));
        list.push(box);
      }
    }
    return box;
  }

  addOrientedFloor(cx, cz, width, depth, ry, y) {
    const hx = width * 0.5;
    const hz = depth * 0.5;
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    const extX = Math.abs(hx * cos) + Math.abs(hz * sin);
    const extZ = Math.abs(hx * sin) + Math.abs(hz * cos);
    const floor = {
      rot: true,
      cx,
      cz,
      hx,
      hz,
      cos,
      sin,
      minX: cx - extX,
      maxX: cx + extX,
      minZ: cz - extZ,
      maxZ: cz + extZ,
      y,
    };
    this.floors.push(floor);
    return floor;
  }

  clearObstaclesInRadius(cx, cz, radius) {
    const list = [];
    this.spatialGrid.queryRadius(cx, cz, radius, list);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      o.disabled = true;
      o.radius = 0;
    }
  }

  // Colisor retangular orientado (OBB) para construções rotacionadas sem criar barreiras invisíveis nos cantos.
  addOrientedBox(cx, cz, width, depth, ry, bottom, top, flags = {}) {
    const hx = width * 0.5;
    const hz = depth * 0.5;
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    const extX = Math.abs(hx * cos) + Math.abs(hz * sin);
    const extZ = Math.abs(hx * sin) + Math.abs(hz * cos);
    const minX = cx - extX;
    const maxX = cx + extX;
    const minZ = cz - extZ;
    const maxZ = cz + extZ;
    const box = {
      minX,
      maxX,
      minZ,
      maxZ,
      cx,
      cz,
      hx,
      hz,
      cos,
      sin,
      bottom,
      top,
      rot: true,
      move: flags.move ?? true,
      shot: flags.shot ?? true,
      cam: flags.cam ?? true,
      active: true,
      ref: flags.ref ?? null,
      _stamp: 0,
    };
    this.boxColliders.push(box);
    const cell = 8;
    for (let gx = Math.floor(minX / cell); gx <= Math.floor(maxX / cell); gx++) {
      for (let gz = Math.floor(minZ / cell); gz <= Math.floor(maxZ / cell); gz++) {
        const key = gx * 100003 + gz;
        let list = this._boxGrid.get(key);
        if (!list) this._boxGrid.set(key, (list = []));
        list.push(box);
      }
    }
    return box;
  }

  _boxesAt(x, z, radius) {
    const cell = 8;
    const out = this._boxScratch;
    out.length = 0;
    const stamp = ++this._boxStamp;
    for (let cx = Math.floor((x - radius) / cell); cx <= Math.floor((x + radius) / cell); cx++) {
      for (let cz = Math.floor((z - radius) / cell); cz <= Math.floor((z + radius) / cell); cz++) {
        const list = this._boxGrid.get(cx * 100003 + cz);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if (b._stamp !== stamp) {
            b._stamp = stamp;
            out.push(b);
          }
        }
      }
    }
    return out;
  }

  _hitsBoxMove(x, z, radius, y = null) {
    const boxes = this._boxesAt(x, z, radius);
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.active || !b.move) continue;
      if (y !== null && b.top !== undefined) {
        if (y >= b.top - 0.22) continue;
        if (b.bottom !== undefined && y + 1.8 <= b.bottom) continue;
      }
      if (b.rot) {
        const relX = x - b.cx;
        const relZ = z - b.cz;
        const lx = relX * b.cos - relZ * b.sin;
        const lz = relX * b.sin + relZ * b.cos;
        const dx = lx - Math.max(-b.hx, Math.min(lx, b.hx));
        const dz = lz - Math.max(-b.hz, Math.min(lz, b.hz));
        if (dx * dx + dz * dz < radius * radius) return true;
      } else {
        const dx = x - Math.max(b.minX, Math.min(x, b.maxX));
        const dz = z - Math.max(b.minZ, Math.min(z, b.maxZ));
        if (dx * dx + dz * dz < radius * radius) return true;
      }
    }
    return false;
  }

  _hitsBoxShot(x, y, z, radius) {
    const boxes = this._boxesAt(x, z, radius);
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.active || !b.shot || y < b.bottom || y > b.top) continue;
      if (b.rot) {
        const relX = x - b.cx;
        const relZ = z - b.cz;
        const lx = relX * b.cos - relZ * b.sin;
        const lz = relX * b.sin + relZ * b.cos;
        const dx = lx - Math.max(-b.hx, Math.min(lx, b.hx));
        const dz = lz - Math.max(-b.hz, Math.min(lz, b.hz));
        if (dx * dx + dz * dz < radius * radius) return true;
      } else {
        const dx = x - Math.max(b.minX, Math.min(x, b.maxX));
        const dz = z - Math.max(b.minZ, Math.min(z, b.maxZ));
        if (dx * dx + dz * dz < radius * radius) return true;
      }
    }
    return false;
  }

  // Distância (0..maxT) até a primeira parede no caminho da câmera; maxT se livre. (Zero-GC)
  cameraRay(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT;
    const mx = ox + dx * maxT;
    const mz = oz + dz * maxT;
    const boxes = this._boxesAt((ox + mx) * 0.5, (oz + mz) * 0.5, maxT * 0.5 + 1);
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.active || !b.cam) continue;
      let t0 = 0;
      let t1 = best;

      let rox = ox, roz = oz, rdx = dx, rdz = dz;
      let minX = b.minX, maxX = b.maxX, minZ = b.minZ, maxZ = b.maxZ;
      if (b.rot) {
        const relX = ox - b.cx;
        const relZ = oz - b.cz;
        rox = relX * b.cos - relZ * b.sin;
        roz = relX * b.sin + relZ * b.cos;
        rdx = dx * b.cos - dz * b.sin;
        rdz = dx * b.sin + dz * b.cos;
        minX = -b.hx;
        maxX = b.hx;
        minZ = -b.hz;
        maxZ = b.hz;
      }

      if (Math.abs(rdx) < 1e-8) {
        if (rox < minX || rox > maxX) continue;
      } else {
        const inv = 1 / rdx;
        let ta = (minX - rox) * inv;
        let tb = (maxX - rox) * inv;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) continue;
      }

      if (Math.abs(dy) < 1e-8) {
        if (oy < b.bottom || oy > b.top) continue;
      } else {
        const inv = 1 / dy;
        let ta = (b.bottom - oy) * inv;
        let tb = (b.top - oy) * inv;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) continue;
      }

      if (Math.abs(rdz) < 1e-8) {
        if (roz < minZ || roz > maxZ) continue;
      } else {
        const inv = 1 / rdz;
        let ta = (minZ - roz) * inv;
        let tb = (maxZ - roz) * inv;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) continue;
      }

      if (t0 < best) best = t0;
    }
    return best;
  }

  // Identifica obstáculos especificamente para o cavalo.
  // Regra do jogo: o cavalo SEMPRE passa por cima de pedras, todas elas (rock, clay, stone).
  // Ele SÓ deve bater em árvores ("tree") e casas/construções ("house"), apenas.
  obstacleAt(x, z, radius) {
    // 1. Árvores próximas nos chunks carregados
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    for (let c = 0; c < this.activeChunks.length; c++) {
      const chunk = this.activeChunks[c];
      if (Math.abs(chunk.x - cx) > 1 || Math.abs(chunk.z - cz) > 1) continue;
      for (let i = 0; i < chunk.colliders.length; i++) {
        const o = chunk.colliders[i];
        if (o.disabled || o.radius <= 0) continue;
        const dx = x - o.x;
        const dz = z - o.z;
        const min = radius + o.radius;
        if (dx * dx + dz * dz >= min * min) continue;
        if (o.kind === "tree") return "tree";
        // Todas as pedras e barro/argila são ignorados pelo cavalo (passa por cima)
        if (o.kind === "rock" || o.kind === "clay" || o.kind === "stone") continue;
      }
    }

    // 2. Casas, muralhas e construções sólidas
    if (this._hitsBoxMove(x, z, radius)) return "house";

    // 3. Colisores estáticos de edifícios (torres, forjas, poços, paredes)
    for (let i = 0; i < this.staticColliders.length; i++) {
      const o = this.staticColliders[i];
      if (o.disabled) continue;
      if (o.kind === "rock" || o.kind === "clay" || o.kind === "stone") continue;
      const dx = x - o.x;
      const dz = z - o.z;
      const min = radius + o.radius;
      if (dx * dx + dz * dz < min * min) return "house";
    }

    return null;
  }

  isHorseBlocked(x, z, radius = 0.7) {
    const obst = this.obstacleAt(x, z, radius);
    return obst === "tree" || obst === "house";
  }

  // Altura do solo para cavalo: se estiver sobre pedras, eleva suavemente por cima delas
  horseHeightAt(x, z) {
    const baseH = this.heightAt(x, z);
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    for (let c = 0; c < this.activeChunks.length; c++) {
      const chunk = this.activeChunks[c];
      if (Math.abs(chunk.x - cx) > 1 || Math.abs(chunk.z - cz) > 1) continue;
      for (let i = 0; i < chunk.colliders.length; i++) {
        const o = chunk.colliders[i];
        if (o.disabled || o.radius <= 0) continue;
        if (o.kind !== "rock" && o.kind !== "clay" && o.kind !== "stone") continue;
        const dx = x - o.x;
        const dz = z - o.z;
        const dSq = dx * dx + dz * dz;
        const rad = o.radius * 1.15;
        if (dSq < rad * rad) {
          const dist = Math.sqrt(dSq);
          const factor = Math.max(0, 1 - dist / rad);
          const rockLift = Math.max(0, o.top - baseH) * factor * 0.75;
          return baseH + rockLift;
        }
      }
    }
    return baseH;
  }

  addStaticCollider(x, z, radius, height = 8) {
    const col = { x, z, radius, top: this.heightAt(x, z) + height };
    this.staticColliders.push(col);
    this.spatialGrid.insertCircle(col, x, z, radius);
  }

  // Colisão levando a altura em conta: acelerada pelo Spatial Hash Grid O(1)
  isBlockedAtHeight(x, y, z, radius) {
    this.spatialGrid.queryRadius(x, z, radius + 2.5, this._nearbyColliders);
    for (let i = 0; i < this._nearbyColliders.length; i++) {
      const obstacle = this._nearbyColliders[i];
      if (obstacle.disabled || obstacle.radius <= 0 || y > obstacle.top) continue;
      const dx = x - obstacle.x;
      const dz = z - obstacle.z;
      const minDistance = radius + obstacle.radius;
      if (dx * dx + dz * dz < minDistance * minDistance) return true;
    }
    if (this._hitsBoxShot(x, y, z, radius)) return true;
    return false;
  }

  _setChunkLod(chunk, level) {
    if (chunk.lodLevel === level) return;
    const lods = chunk.lods;
    for (let i = 0; i < lods.length; i++) lods[i].visible = i === level;
    chunk.lodLevel = level;
  }

  // Nível de LOD (0 = detalhado ... 5 = triângulo 2D) a partir da distância ao jogador.
  // Histerese de 6m evita o "pisca-pisca" quando o jogador anda na fronteira entre dois níveis.
  _lodForDistance(dist, current) {
    const d = this._lodDistances;
    let level = d.length;
    for (let i = 0; i < d.length; i++) {
      // quem já está no lado perto da fronteira i tende a ficar (+6m); quem está do lado longe, também (-6m)
      const limit = d[i] + (current < 0 ? 0 : current <= i ? 6 : -6);
      if (dist < limit) {
        level = i;
        break;
      }
    }
    return level;
  }

  updateVisibility(camera, x, z, isCutscene = false) {
    camera.updateMatrixWorld();
    this._projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._projectionView);
    camera.getWorldDirection(this._camDir);
    const cdx = this._camDir.x;
    const cdz = this._camDir.z;

    const camX = camera.position.x;
    const camZ = camera.position.z;
    // Raio seguro circular onde o chão e mundo NUNCA somem (135m = > 2 chunks ao redor em 360°, inclusive atrás)
    const alwaysVisibleRadiusSq = 135.0 * 135.0;

    for (let i = 0; i < this.activeChunks.length; i++) {
      const chunk = this.activeChunks[i];
      const toChunkX = chunk.centerX - x;
      const toChunkZ = chunk.centerZ - z;
      const distanceSq = toChunkX * toChunkX + toChunkZ * toChunkZ;

      // Cutscenes: sem descarte por frustum, LOD só por distância
      if (isCutscene) {
        chunk.group.visible = true;
        this._setChunkLod(chunk, this._lodForDistance(Math.sqrt(distanceSq), chunk.lodLevel));
        continue;
      }

      // Além da distância de visão total, desativa
      if (distanceSq > this.viewDistanceSq) {
        chunk.group.visible = false;
        this._setChunkLod(chunk, -1);
        continue;
      }

      const inSafeRadius = distanceSq <= alwaysVisibleRadiusSq;
      const inFrustum = inSafeRadius || this._frustum.intersectsSphere(chunk.bounds);

      chunk.group.visible = inFrustum;
      if (!inFrustum) {
        this._setChunkLod(chunk, -1);
        continue;
      }

      // LOD dianteiro: chunks na frente da câmera ganham até 60% mais alcance em cada nível,
      // evitando transições bruscas à frente do jogador/cavalo.
      const toCamX = chunk.centerX - camX;
      const toCamZ = chunk.centerZ - camZ;
      const distToCam = Math.sqrt(toCamX * toCamX + toCamZ * toCamZ);
      const dotCam = toCamX * cdx + toCamZ * cdz;
      const forwardFactor = Math.max(0, dotCam / Math.max(1, distToCam));
      const effectiveDist = Math.sqrt(distanceSq) / (1.0 + forwardFactor * 0.6);
      this._setChunkLod(chunk, this._lodForDistance(effectiveDist, chunk.lodLevel));
    }
  }

  _isSettlementClear(x, z) {
    if (isKingdomClear(x, z)) return true;
    if ((x + 14) ** 2 + (z + 8) ** 2 < 12 * 12) return true;
    if (Math.abs(x) < 2.6 && z > -52 && z < 5) return true;
    if (x > -42 && x < -21 && z > -12 && z < 13) return true;
    const marketX = x + 15;
    const marketZ = z + 22;
    if (marketX * marketX + marketZ * marketZ < 10 * 10) return true;
    const forgeX = x - 15;
    const forgeZ = z + 27;
    if (forgeX * forgeX + forgeZ * forgeZ < 10 * 10) return true;
    if (Math.abs(z + 48) < 5 && Math.abs(x) < 13) return true;
    if ((x - 25) ** 2 + (z + 14) ** 2 < 7 * 7) return true;
    if ((x - 26) ** 2 + (z + 31) ** 2 < 8 * 8) return true;
    if ((x + 24) ** 2 + (z + 28) ** 2 < 7 * 7) return true;
    if ((x + 25) ** 2 + (z + 43) ** 2 < 7 * 7) return true;
    if ((x - 30) ** 2 + (z + 45) ** 2 < 7 * 7) return true;
    return false;
  }

  _createChunk(cx, cz) {
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    const centerX = (cx + 0.5) * this.chunkSize;
    const centerZ = (cz + 0.5) * this.chunkSize;

    // Geração síncrona determinística da malha e das alturas do terreno (garante 100% de alinhamento com decorações)
    const { geometry, heights } = this._createTerrainGeometry(cx, cz);
    const terrain = new THREE.Mesh(geometry, this._terrainMaterial);
    terrain.receiveShadow = true;
    terrain.frustumCulled = true;
    terrain.matrixAutoUpdate = false;
    group.add(terrain);

    // 6 grupos de LOD (0 = detalhado ... 5 = triângulo 2D); só um fica visível por vez
    const lods = [];
    for (let l = 0; l < this.lodLevels; l++) {
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      g.visible = l === this.lodLevels - 1; // começa no mais barato; updateVisibility ajusta no 1º frame
      lods.push(g);
    }
    const decor = this._createDecorations(cx, cz, heights);
    for (let l = 0; l < decor.lodMeshes.length; l++) {
      const list = decor.lodMeshes[l];
      for (let i = 0; i < list.length; i++) lods[l].add(list[i]);
    }
    for (let i = 0; i < decor.colliders.length; i++) {
      const c = decor.colliders[i];
      this.spatialGrid.insertCircle(c, c.x, c.z, c.radius);
    }
    for (let l = 0; l < lods.length; l++) group.add(lods[l]);
    this.scene.add(group);

    const chunkData = {
      x: cx,
      z: cz,
      centerX,
      centerZ,
      group,
      terrain,
      heights,
      lods,
      lodLevel: this.lodLevels - 1,
      bounds: geometry.boundingSphere,
      colliders: decor.colliders,
      shadowMeshes: decor.shadowMeshes,
      instancedMeshes: decor.instancedMeshes,
    };

    return chunkData;
  }

  _createTerrainGeometry(cx, cz) {
    const segments = CONFIG.chunkSegments;
    const size = this.chunkSize;
    const row = segments + 1;
    const positions = new Float32Array(row * row * 3);
    const colors = new Float32Array(row * row * 3);
    const normals = new Float32Array(row * row * 3);
    const heights = new Float32Array(row * row);
    let vertex = 0;

    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const worldX = cx * size + (x / segments) * size;
        const worldZ = cz * size + (z / segments) * size;
        const height = this.heightAt(worldX, worldZ);
        heights[vertex] = height;
        const p = vertex * 3;
        positions[p] = worldX;
        positions[p + 1] = height;
        positions[p + 2] = worldZ;

        const variation = hash2(Math.floor(worldX * 0.8), Math.floor(worldZ * 0.8), this.seed + 211);
        let color = _terrainColor.copy(variation > 0.53 ? COLORS.grassB : COLORS.grassA);
        // manchas de vegetação morta espalhadas (ruído de baixa frequência)
        const blight = hash2(Math.floor(worldX * 0.16), Math.floor(worldZ * 0.16), this.seed + 977);
        if (blight > 0.7) color.copy(COLORS.rot);
        // bioma em gradiente (pântano / ocre / cinzas / geada), atenuado perto de povoações
        applyBiome(color, worldX, worldZ, height, this.seed);
        if (height > 5.5) color.lerp(COLORS.dirt, Math.min(1, (height - 5.5) * 0.6));
        if (height > 9) color.lerp(COLORS.stone, Math.min(1, (height - 9) * 0.6));
        const tint = 0.92 + variation * 0.12;
        colors[p] = color.r * tint;
        colors[p + 1] = color.g * tint;
        colors[p + 2] = color.b * tint;
        vertex++;
      }
    }

    // Normais analíticas diretas de grade regular (100x mais veloz que computeVertexNormals)
    const step = size / segments;
    const invTwoStep = 1.0 / (2.0 * step);
    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const idx = z * row + x;
        const p = idx * 3;
        const hL = x > 0 ? heights[idx - 1] : heights[idx];
        const hR = x < segments ? heights[idx + 1] : heights[idx];
        const hD = z > 0 ? heights[idx - row] : heights[idx];
        const hU = z < segments ? heights[idx + row] : heights[idx];

        const nx = -(hR - hL) * invTwoStep;
        const nz = -(hU - hD) * invTwoStep;
        const invLen = 1.0 / Math.hypot(nx, 1.0, nz);
        normals[p] = nx * invLen;
        normals[p + 1] = 1.0 * invLen;
        normals[p + 2] = nz * invLen;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(this._sharedTerrainIndices, 1));
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3((cx + 0.5) * size, 0, (cz + 0.5) * size),
      size * 0.88
    );
    return { geometry, heights };
  }

  _createDecorations(cx, cz, heights) {
    const random = makeRandom(hash2(cx, cz, this.seed) * 4294967295);
    const colliders = [];
    const speciesData = { oak: [], pine: [], birch: [], bush: [] };
    const rockData = [];
    const clayData = [];
    const grassData = [];
    const size = this.chunkSize;
    const baseX = cx * size;
    const baseZ = cz * size;
    const treeCount = 12 + Math.floor(random() * 9);

    for (let i = 0; i < treeCount; i++) {
      const x = baseX + 3 + random() * (size - 6);
      const z = baseZ + 3 + random() * (size - 6);
      const dx = x - this._spawnX;
      const dz = z - this._spawnZ;
      if (dx * dx + dz * dz < 18 * 18 || this._isSettlementClear(x, z)) continue;
      const y = heights ? this.chunkGroundHeight(cx, cz, heights, x, z) : this.heightAt(x, z);
      const scale = 0.78 + random() * 0.62;
      const rotation = random() * Math.PI * 2;
      const kind = this.treeKit.pick(random());
      const tree = { x, y, z, scale: kind === "bush" ? scale * 0.9 : scale, rotation, tint: 0.88 + random() * 0.24, collider: null, farIndex: -1 };
      speciesData[kind].push(tree);
      if (kind !== "bush") {        // colisor só no tronco, nunca na copa
        const col = { x, z, radius: 0.28 + scale * 0.11, top: y + 7.5 * scale, kind: "tree" };
        tree.collider = col;
        colliders.push(col);
      }
    }

    const rockCount = 5 + Math.floor(random() * 8);
    for (let i = 0; i < rockCount; i++) {
      const x = baseX + 2 + random() * (size - 4);
      const z = baseZ + 2 + random() * (size - 4);
      const dx = x - this._spawnX;
      const dz = z - this._spawnZ;
      if (dx * dx + dz * dz < 18 * 18 || this._isSettlementClear(x, z)) continue;
      const y = heights ? this.chunkGroundHeight(cx, cz, heights, x, z) : this.heightAt(x, z);
      const scale = 0.42 + random() * 0.72;
      const rotation = random() * Math.PI * 2;
      const col = { x, z, radius: scale * 0.58, top: y + scale * 0.9, kind: "rock" };
      rockData.push({ x, y, z, scale, rotation, collider: col });
      colliders.push(col);
    }

    const clayCount = 3 + Math.floor(random() * 5);
    for (let i = 0; i < clayCount; i++) {
      const x = baseX + 2 + random() * (size - 4);
      const z = baseZ + 2 + random() * (size - 4);
      const dx = x - this._spawnX;
      const dz = z - this._spawnZ;
      if (dx * dx + dz * dz < 18 * 18 || this._isSettlementClear(x, z)) continue;
      const y = heights ? this.chunkGroundHeight(cx, cz, heights, x, z) : this.heightAt(x, z);
      const scale = 0.45 + random() * 0.55;
      const rotation = random() * Math.PI * 2;
      const col = { x, z, radius: scale * 0.52, top: y + scale * 0.75, kind: "clay" };
      clayData.push({ x, y, z, scale, rotation, collider: col });
      colliders.push(col);
    }

    const grassCount = 36 + Math.floor(random() * 24);
    for (let i = 0; i < grassCount; i++) {
      const x = baseX + 1.5 + random() * (size - 3);
      const z = baseZ + 1.5 + random() * (size - 3);
      const y = heights ? this.chunkGroundHeight(cx, cz, heights, x, z) : this.heightAt(x, z);
      if (y > 6.2 || this._isSettlementClear(x, z)) continue;
      const scale = 0.75 + random() * 0.65;
      const rotation = random() * Math.PI * 2;
      grassData.push({ x, y, z, scale, rotation, tint: 0.86 + random() * 0.26 });
    }

    const lodMeshes = [];
    for (let l = 0; l < this.lodLevels; l++) lodMeshes.push([]);
    const instancedMeshes = [];
    const shadowMeshes = [];

    // Registra o conjunto de LODs de um tipo de objeto. O nível 0 é o "mesh principal" (colheita, raycast, decay);
    // os demais compartilham o MESMO buffer de matrizes, então colher/respawnar um item atualiza todos os níveis.
    const register = (meshes, name, userData = null, castShadowLods = 0) => {
      if (!meshes) return null;
      for (let l = 0; l < meshes.length; l++) {
        const m = meshes[l];
        if (!m) continue;
        m.name = l === 0 ? name : name + "LOD" + l;
        if (l === 0 && userData) m.userData = userData;
        m.castShadow = l < castShadowLods;
        lodMeshes[l].push(m);
        instancedMeshes.push(m);
        if (m.castShadow) shadowMeshes.push(m);
      }
      return meshes[0];
    };

    for (const [kind, data] of Object.entries(speciesData)) {
      const species = this.treeKit.species[kind];
      const meshes = this._makeLodSet(species.lods, data, (dummy, item) => {
        dummy.position.set(item.x, item.y, item.z);
        dummy.rotation.set(0, item.rotation, 0);
        dummy.scale.set(item.scale, item.scale, item.scale);
      }, (i, color) => color.setScalar(data[i].tint));
      register(meshes, "Trees", {
        isResourceMesh: true,
        resourceType: "WOOD",
        species: kind,
        items: data,
        farMesh: null,
        harvested: new Map(),
      }, kind === "bush" ? 0 : 2);
    }

    register(this._makeLodSet(this._rockLods, rockData, (dummy, item) => {
      dummy.position.set(item.x, item.y + item.scale * 0.22, item.z);
      dummy.rotation.set(item.rotation * 0.4, item.rotation, item.rotation * 0.7);
      dummy.scale.set(item.scale, item.scale * (0.72 + item.scale * 0.12), item.scale * 0.86);
    }), "Rocks", { isResourceMesh: true, resourceType: "STONE", items: rockData, harvested: new Map() });

    register(this._makeLodSet(this._clayLods, clayData, (dummy, item) => {
      dummy.position.set(item.x, item.y + item.scale * 0.15, item.z);
      dummy.rotation.set(item.rotation * 0.3, item.rotation, item.rotation * 0.5);
      dummy.scale.set(item.scale * 1.15, item.scale * 0.65, item.scale * 1.05);
    }), "Clay", { isResourceMesh: true, resourceType: "CLAY", items: clayData, harvested: new Map() });

    register(this._makeLodSet(this._grassLods, grassData, (dummy, item) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.set(item.scale, item.scale * (0.85 + (item.tint - 0.86) * 0.8), item.scale);
    }, (i, color) => color.setScalar(grassData[i].tint)), "Grass");

    return { lodMeshes, colliders, shadowMeshes, instancedMeshes };
  }

  /**
   * Cria um InstancedMesh por nível de LOD, todos compartilhando o mesmo instanceMatrix/instanceColor
   * (uma única cópia dos dados por objeto, não seis).
   */
  _makeLodSet(levels, data, setTransform, tintFn = null) {
    if (data.length === 0) return null;
    const meshes = new Array(levels.length).fill(null);
    let base = null;
    for (let lod = 0; lod < levels.length; lod++) {
      const def = levels[lod];
      if (!def || !def.geometry) continue;
      let mesh;
      if (!base) {
        mesh = this._makeInstances(def.geometry, def.material, data, setTransform, false);
        if (tintFn) {
          for (let i = 0; i < data.length; i++) {
            tintFn(i, _tintColor);
            mesh.setColorAt(i, _tintColor);
          }
          mesh.instanceColor.needsUpdate = true;
        }
        base = mesh;
      } else {
        if (!def.geometry.boundingSphere) {
          def.geometry.computeBoundingBox();
          def.geometry.computeBoundingSphere();
        }
        mesh = new THREE.InstancedMesh(def.geometry, def.material, data.length);
        mesh.instanceMatrix = base.instanceMatrix;
        if (base.instanceColor) mesh.instanceColor = base.instanceColor;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
        mesh.matrixAutoUpdate = false;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
      }
      meshes[lod] = mesh;
    }
    return meshes;
  }

  _makeInstances(geometry, material, data, setTransform, castShadow) {
    if (!geometry) return null;
    const count = data.length;
    if (count === 0) return null;
    if (!geometry.boundingSphere) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.matrixAutoUpdate = false;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    for (let i = 0; i < count; i++) {
      setTransform(this._dummy, data[i]);
      this._dummy.updateMatrix();
      mesh.setMatrixAt(i, this._dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    return mesh;
  }
}
