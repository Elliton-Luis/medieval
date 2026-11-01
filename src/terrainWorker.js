// ============================================================================
// Web Worker Nativo para Geração de Terreno Procedural (Zero-Stutter)
// Paraleliza matemática pesada de ruído simplex e relevo fora da thread principal.
// ============================================================================

// Gradientes 2D unitários para Simplex Noise
const GRAD_X = new Float32Array([1, -1, 1, -1, 1, -1, 0, 0, 0.70710678, -0.70710678, 0.70710678, -0.70710678]);
const GRAD_Z = new Float32Array([0, 0, 0.70710678, 0.70710678, -0.70710678, -0.70710678, 1, -1, 0.70710678, 0.70710678, -0.70710678, -0.70710678]);
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

function gradHash(ix, iz, seed) {
  let n = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) % 12;
}

function simplex2(xin, zin, seed = 0) {
  const s = (xin + zin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(zin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const z0 = zin - (j - t);
  const i1 = x0 > z0 ? 1 : 0;
  const j1 = x0 > z0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const z1 = z0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const z2 = z0 - 1 + 2 * G2;

  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - z0 * z0;
  if (t0 > 0) {
    const g0 = gradHash(i, j, seed);
    t0 *= t0;
    n0 = t0 * t0 * (GRAD_X[g0] * x0 + GRAD_Z[g0] * z0);
  }
  let t1 = 0.5 - x1 * x1 - z1 * z1;
  if (t1 > 0) {
    const g1 = gradHash(i + i1, j + j1, seed);
    t1 *= t1;
    n1 = t1 * t1 * (GRAD_X[g1] * x1 + GRAD_Z[g1] * z1);
  }
  let t2 = 0.5 - x2 * x2 - z2 * z2;
  if (t2 > 0) {
    const g2 = gradHash(i + 1, j + 1, seed);
    t2 *= t2;
    n2 = t2 * t2 * (GRAD_X[g2] * x2 + GRAD_Z[g2] * z2);
  }
  return 70 * (n0 + n1 + n2);
}

function hash2(x, z, seed = 0) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function terrainHeight(x, z, seed = 0) {
  const broad = simplex2(x * 0.0085, z * 0.0085, seed) * 5.8;
  const valleys = simplex2(x * 0.018, z * 0.018, seed + 17) * 2.4;
  const detail = simplex2(x * 0.055, z * 0.055, seed + 39) * 0.55;
  const ridgeRaw = simplex2(x * 0.0045, z * 0.0045, seed + 81);
  const ridge = Math.max(0, ridgeRaw - 0.25) * 14.5;
  return broad + valleys + detail + ridge;
}

const PLATEAU_INNER = 42;
const PLATEAU_OUTER = 78;

function proceduralHeightAt(x, z, seed, villages, villageHeights, floors) {
  if (floors && floors.length > 0) {
    for (let i = 0; i < floors.length; i++) {
      const f = floors[i];
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) return f.y;
    }
  }

  let height = terrainHeight(x, z, seed);
  if (villages && villageHeights) {
    for (let i = 0; i < villages.length; i++) {
      const v = villages[i];
      const dx = x - v.x;
      const dz = z - v.z;
      const dSq = dx * dx + dz * dz;
      if (dSq >= PLATEAU_OUTER * PLATEAU_OUTER) continue;
      const dist = Math.sqrt(dSq);
      let blend = dist <= PLATEAU_INNER ? 1 : (PLATEAU_OUTER - dist) / (PLATEAU_OUTER - PLATEAU_INNER);
      blend = blend * blend * (3 - 2 * blend);
      const vBase = villageHeights[i] !== undefined ? villageHeights[i] : terrainHeight(v.x, v.z, seed);
      height += (vBase - height) * blend;
    }
  }
  return height;
}

const COLOR_GRASSA = [0.32, 0.42, 0.26];
const COLOR_GRASSB = [0.47, 0.56, 0.35];
const COLOR_DIRT = [0.55, 0.47, 0.34];
const COLOR_STONE = [0.46, 0.47, 0.43];

// Listener de mensagens do Worker
self.onmessage = function (event) {
  const data = event.data;
  if (!data) return;

  const { id, cx, cz, segments, chunkSize, seed, villages, villageHeights, floors } = data;
  const row = segments + 1;
  const vertexCount = row * row;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const heights = new Float32Array(vertexCount);
  const indices = new Uint32Array(segments * segments * 6);

  let vertex = 0;
  for (let z = 0; z <= segments; z++) {
    for (let x = 0; x <= segments; x++) {
      const worldX = cx * chunkSize + (x / segments) * chunkSize;
      const worldZ = cz * chunkSize + (z / segments) * chunkSize;
      const h = proceduralHeightAt(worldX, worldZ, seed, villages, villageHeights, floors);
      heights[vertex] = h;

      const p = vertex * 3;
      positions[p] = worldX;
      positions[p + 1] = h;
      positions[p + 2] = worldZ;

      const variation = hash2(Math.floor(worldX * 0.8), Math.floor(worldZ * 0.8), seed + 211);
      let c = variation > 0.53 ? COLOR_GRASSB : COLOR_GRASSA;
      if (h > 5.5) c = COLOR_DIRT;
      if (h > 9.0) c = COLOR_STONE;
      const tint = 0.92 + variation * 0.12;
      colors[p] = c[0] * tint;
      colors[p + 1] = c[1] * tint;
      colors[p + 2] = c[2] * tint;
      vertex++;
    }
  }

  let idx = 0;
  for (let z = 0; z < segments; z++) {
    for (let x = 0; x < segments; x++) {
      const a = z * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      if ((x + z) % 2 === 0) {
        indices[idx] = a;
        indices[idx + 1] = c;
        indices[idx + 2] = b;
        indices[idx + 3] = b;
        indices[idx + 4] = c;
        indices[idx + 5] = d;
      } else {
        indices[idx] = a;
        indices[idx + 1] = c;
        indices[idx + 2] = d;
        indices[idx + 3] = a;
        indices[idx + 4] = d;
        indices[idx + 5] = b;
      }
      idx += 6;
    }
  }

  // Transfere os Float32Arrays como Transferable (Zero-Copy) para a thread principal
  self.postMessage(
    {
      id,
      cx,
      cz,
      positions,
      colors,
      heights,
      indices,
    },
    [positions.buffer, colors.buffer, heights.buffer, indices.buffer]
  );
};
