export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function hash2(x, z, seed = 0) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

// Gradientes 2D unitários pré-alocados para ruído Simplex/Perlin (Zero-GC)
const GRAD_X = new Float32Array([1, -1, 1, -1, 1, -1, 0, 0, 0.70710678, -0.70710678, 0.70710678, -0.70710678]);
const GRAD_Z = new Float32Array([0, 0, 0.70710678, 0.70710678, -0.70710678, -0.70710678, 1, -1, 0.70710678, 0.70710678, -0.70710678, -0.70710678]);
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

function gradHash(ix, iz, seed) {
  let n = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) % 12;
}

// Ruído Simplex 2D rápido (retorna em [-1, 1]) sem alocações
export function simplex2(xin, zin, seed = 0) {
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

// Ruído Perlin/Simplex normalizado em [0, 1]
export function noise2(x, z, seed = 0) {
  return simplex2(x, z, seed) * 0.5 + 0.5;
}

export const valueNoise = noise2;

// Altura procedural suave com vales, colinas e cristas via Simplex Noise
export function terrainHeight(x, z, seed = 0) {
  const broad = simplex2(x * 0.0085, z * 0.0085, seed) * 5.8;
  const valleys = simplex2(x * 0.018, z * 0.018, seed + 17) * 2.4;
  const detail = simplex2(x * 0.055, z * 0.055, seed + 39) * 0.55;
  const ridgeRaw = simplex2(x * 0.0045, z * 0.0045, seed + 81);
  const ridge = Math.max(0, ridgeRaw - 0.25) * 14.5;
  return broad + valleys + detail + ridge;
}

export function makeRandom(seed) {
  let state = seed | 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}
