// Hitboxes por partes do corpo (cápsulas): cabeça, tronco e pernas para humanos;
// corpo, patas, pescoço e cabeça (orientados pela direção) para cavalos.
// Os projéteis fazem teste "varrido" (segmento contra cápsula), então nem os rápidos atravessam.

const zones = Array.from({ length: 5 }, () => ({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0, kind: "body" }));
const result = { d2: 0, s: 0 };
let count = 0;
export let lastKind = "body";

function zone(ax, ay, az, bx, by, bz, r, kind) {
  const z = zones[count++];
  z.ax = ax; z.ay = ay; z.az = az;
  z.bx = bx; z.by = by; z.bz = bz;
  z.r = r;
  z.kind = kind;
}

// Preenche as zonas de uma entidade; retorna quantas são.
export function zonesFor(npc) {
  count = 0;
  const x = npc.x;
  const z = npc.z;
  const y = npc.root.position.y;
  if (npc.roleKey === "horse") {
    const heading = npc.heading || 0;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const g = (npc.graze || 0) * 0.75;
    zone(x - fx * 0.7, y + 1.1, z - fz * 0.7, x + fx * 0.55, y + 1.15, z + fz * 0.55, 0.5, "body");
    zone(x - fx * 0.5, y + 0.35, z - fz * 0.5, x + fx * 0.45, y + 0.35, z + fz * 0.45, 0.36, "legs");
    zone(x + fx * 0.8, y + 1.5 - g * 0.5, z + fz * 0.8, x + fx * 1.0, y + 1.75 - g, z + fz * 1.0, 0.24, "body");
    zone(x + fx * (1.1 + g * 0.2), y + 1.8 - g, z + fz * (1.1 + g * 0.2), x + fx * (1.3 + g * 0.3), y + 1.65 - g * 1.1, z + fz * (1.3 + g * 0.3), 0.2, "head");
  } else {
    zone(x, y + 1.66, z, x, y + 1.72, z, 0.17, "head");
    zone(x, y + 0.95, z, x, y + 1.48, z, 0.27, "body");
    zone(x, y + 0.08, z, x, y + 0.85, z, 0.21, "legs");
  }
  return count;
}

// Menor distância² entre os segmentos P(a→b) e Q(c→d); result.s = posição em P (0..1).
function segSeg(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
  const ux = bx - ax + 1e-6, uy = by - ay, uz = bz - az;
  const vx = dx - cx + 1e-6, vy = dy - cy, vz = dz - cz;
  const wx = ax - cx, wy = ay - cy, wz = az - cz;
  const a = ux * ux + uy * uy + uz * uz;
  const b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz;
  const e = vx * wx + vy * wy + vz * wz;
  const D = a * c - b * b;
  let sN, sD = D, tN, tD = D;
  if (D < 1e-9) {
    sN = 0; sD = 1; tN = e; tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;
    if (sN < 0) { sN = 0; tN = e; tD = c; }
    else if (sN > sD) { sN = sD; tN = e + b; tD = c; }
  }
  if (tN < 0) {
    tN = 0;
    if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; }
  }
  const sc = Math.abs(sN) < 1e-9 ? 0 : sN / sD;
  const tc = Math.abs(tN) < 1e-9 ? 0 : tN / tD;
  const px = wx + sc * ux - tc * vx;
  const py = wy + sc * uy - tc * vy;
  const pz = wz + sc * uz - tc * vz;
  result.d2 = px * px + py * py + pz * pz;
  result.s = sc;
  return result;
}

// Projétil que andou de (x0,y0,z0) até (x1,y1,z1): acertou? Retorna "head" | "body" | "legs" | null.
export function segmentHit(npc, x0, y0, z0, x1, y1, z1, pr = 0.05) {
  // descarte rápido por esfera grande (cavalos têm 2 m de comprimento)
  const reach = (npc.roleKey === "horse" ? 2.4 : 1.2) + pr;
  const mx = (x0 + x1) / 2 - npc.x;
  const mz = (z0 + z1) / 2 - npc.z;
  const half = Math.hypot(x1 - x0, z1 - z0) / 2;
  if (Math.hypot(mx, mz) > reach + half) return null;
  const n = zonesFor(npc);
  let best = null;
  let bestS = 2;
  for (let i = 0; i < n; i++) {
    const zn = zones[i];
    segSeg(x0, y0, z0, x1, y1, z1, zn.ax, zn.ay, zn.az, zn.bx, zn.by, zn.bz);
    const lim = zn.r + pr;
    if (result.d2 > lim * lim) continue;
    // o primeiro ponto atingido ao longo do trajeto; a cabeça vence empates
    if (result.s < bestS - 0.02 || (Math.abs(result.s - bestS) <= 0.02 && zn.kind === "head")) {
      bestS = result.s;
      best = zn.kind;
    }
  }
  lastKind = best || "body";
  return best;
}

// Raio da mira: distância t do primeiro ponto atingido na entidade, ou -1.
export function rayTarget(npc, ox, oy, oz, dx, dy, dz, tmin, tmax) {
  const mx = ox + dx * (tmin + tmax) / 2 - npc.x;
  const mz = oz + dz * (tmin + tmax) / 2 - npc.z;
  if (Math.hypot(mx, mz) > (tmax - tmin) / 2 + (npc.roleKey === "horse" ? 2.4 : 1.2)) return -1;
  const n = zonesFor(npc);
  let best = -1;
  for (let i = 0; i < n; i++) {
    const zn = zones[i];
    segSeg(ox + dx * tmin, oy + dy * tmin, oz + dz * tmin, ox + dx * tmax, oy + dy * tmax, oz + dz * tmax, zn.ax, zn.ay, zn.az, zn.bx, zn.by, zn.bz);
    if (result.d2 > zn.r * zn.r) continue;
    const t = tmin + result.s * (tmax - tmin);
    if (best < 0 || t < best) {
      best = t;
      lastKind = zn.kind;
    }
  }
  return best;
}
