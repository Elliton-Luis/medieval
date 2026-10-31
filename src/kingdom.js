// Layout do Reino de Caldera: vilas satélites e estradas que as ligam à capital.
// Dados puros, importados pelo mundo (terreno/decoração) e pelo assentamento.

export const KINGDOM_NAME = "Reino de Caldera";
export const VILLAGE_RADIUS = 36;
export const PLATEAU_INNER = 24;
export const PLATEAU_OUTER = 40;

export const VILLAGES = [
  { id: "ferrovale", name: "Ferrovale", x: 92, z: -18, kind: "forge", seed: 11 },
  { id: "pedraluz", name: "Pedraluz", x: -96, z: -34, kind: "farm", seed: 23 },
  { id: "salgueiro", name: "Salgueiro", x: -8, z: 84, kind: "market", seed: 37 },
  { id: "cinzal", name: "Cinzal", x: 70, z: -104, kind: "forge", seed: 41 },
  { id: "brumas", name: "Brumas", x: -82, z: -112, kind: "farm", seed: 53 },
  { id: "atalaia", name: "Atalaia do Norte", x: 8, z: -140, kind: "watch", seed: 67 },
];

// Segmentos [x0, z0, x1, z1] de estrada de pedras. Os que partem da capital
// continuam as estradas já existentes (leste, oeste, norte e sul).
export const ROADS = [
  [30, -26, 92, -18],
  [-28, 0, -96, -34],
  [0, 8, -8, 84],
  [0, -48, 8, -140],
  [6, -96, 70, -104],
  [6, -96, -82, -112],
];

const CAPITAL = { name: "Caldera", x: -2, z: -20, rx: 44, rz: 38 };

let baseHeights = null;

export function setVillageBaseHeights(heights) {
  baseHeights = heights;
}

export function villageBaseHeight(index) {
  return baseHeights ? baseHeights[index] : 0;
}

export function distanceToRoad(x, z) {
  let best = Infinity;
  for (let i = 0; i < ROADS.length; i++) {
    const [ax, az, bx, bz] = ROADS[i];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const px = ax + dx * t - x;
    const pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function isKingdomClear(x, z) {
  for (let i = 0; i < VILLAGES.length; i++) {
    const v = VILLAGES[i];
    const dx = x - v.x;
    const dz = z - v.z;
    if (dx * dx + dz * dz < VILLAGE_RADIUS * VILLAGE_RADIUS) return true;
  }
  return distanceToRoad(x, z) < 3.4;
}

export function locationAt(x, z) {
  for (let i = 0; i < VILLAGES.length; i++) {
    const v = VILLAGES[i];
    const dx = x - v.x;
    const dz = z - v.z;
    if (dx * dx + dz * dz < (VILLAGE_RADIUS + 6) ** 2) return v.name;
  }
  const dx = (x - CAPITAL.x) / CAPITAL.rx;
  const dz = (z - CAPITAL.z) / CAPITAL.rz;
  if (dx * dx + dz * dz < 1) return CAPITAL.name;
  return distanceToRoad(x, z) < 6 ? "Estrada Real" : "Pradaria de Caldera";
}
