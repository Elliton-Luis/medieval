// ============================================================================
// worldgen.js — Mundo procedural por SEED, com taxa de CAOS.
//
// Ideia: a lore se prende a ÂNCORAS por PAPEL (capital, vilas, ruínas, acampamentos do culto, pontos do
// Livro do Barro, ponto da cutscene...), não a coordenadas. O resolvedor sorteia as âncoras por restrições
// (anel de distâncias, afastamento mínimo, terreno adequado), liga tudo por um grafo de estradas e o resto
// do jogo (casas, NPCs, vegetação, eventos) deriva daí.
//
//   seed  -> tudo é determinístico (PRNG próprio; nada de Math.random no mundo).
//   caos  -> 0..1. Com 0 o mundo é limpo/simétrico (e a seed canônica 731942 reproduz o mundo ORIGINAL);
//            com 1 o mapa é selvagem (nº de vilas/ruínas varia, raios e ângulos fogem do molde, estradas
//            curvas com ciclos, casas com estilos distintos, marcos raros). Mesmo seed + caos diferentes
//            = mundos diferentes; seeds diferentes = mundos que NÃO se parecem.
//
// Uso:  ?seed=123456&chaos=0.6  |  window.__worldgen.validate(1, 200, 0.4)
// ============================================================================
import { terrainHeight } from "./utils.js";
import { setKingdomLayout } from "./kingdom.js";

export const CANONICAL_SEED = 731942;
export const DEFAULT_CHAOS = 0.4;
const WORLD_KEY = "rex-mundi-world-v1";
const SAVE_KEY = "rex-mundi-save-v1";
const LEGACY_SAVE_KEY = "gta-medieval-save-v1";

// Capital: molde desenhado à mão (muralha, praça, igreja, ferraria...). Fica ancorada em (-2,-20);
// o caos mexe só no que a cerca (estilo/cor/vegetação), não no traçado interno.
export const CAPITAL = Object.freeze({ name: "Caldera", x: -2, z: -20, rx: 44, rz: 38 });
// Portões da capital onde as estradas externas encontram as ruas internas.
const GATES = [
  { id: "leste", x: 30, z: -26, ang: 0 },
  { id: "oeste", x: -28, z: 0, ang: Math.PI },
  { id: "sul", x: 0, z: 8, ang: Math.PI / 2 },
  { id: "norte", x: 0, z: -48, ang: -Math.PI / 2 },
];
const SPAWN = Object.freeze({ x: 0, z: -62 }); // logo depois do Portão Norte

// ---------------------------------------------------------------------------
// PRNG e hash
// ---------------------------------------------------------------------------
function mulberry32(a) {
  let t = a >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hash32(...vals) {
  let h = 2166136261 >>> 0;
  for (const v of vals) {
    h ^= (v | 0) + 0x9e3779b9 + ((h << 6) >>> 0) + (h >>> 2);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// ---------------------------------------------------------------------------
// Tabelas CANÔNICAS (o mundo original; seed 731942 + caos 0 reproduz exatamente isto)
// ---------------------------------------------------------------------------
const CANON = {
  villages: [
    { id: "ferrovale", name: "Ferrovale", x: 92, z: -18, kind: "forge", seed: 11 },
    { id: "pedraluz", name: "Pedraluz", x: -96, z: -34, kind: "farm", seed: 23 },
    { id: "salgueiro", name: "Salgueiro", x: -8, z: 84, kind: "market", seed: 37 },
    { id: "cinzal", name: "Cinzal", x: 70, z: -104, kind: "forge", seed: 41 },
    { id: "brumas", name: "Brumas", x: -82, z: -112, kind: "farm", seed: 53 },
    { id: "atalaia", name: "Atalaia do Norte", x: 8, z: -140, kind: "watch", seed: 67 },
  ],
  roads: [
    [30, -26, 92, -18],
    [-28, 0, -96, -34],
    [0, 8, -8, 84],
    [0, -48, 8, -140],
    [6, -96, 70, -104],
    [6, -96, -82, -112],
  ],
  ghostTowns: [
    { nameIdx: 4, x: -165, z: 125, seed: 55102, radius: 46 },
    { nameIdx: 5, x: 175, z: -140, seed: 44208, radius: 48 },
    { nameIdx: 6, x: -120, z: -180, seed: 33405, radius: 45 },
    { nameIdx: 0, x: -280, z: -310, seed: 77101, radius: 52 },
    { nameIdx: 1, x: 320, z: -270, seed: 88203, radius: 50 },
    { nameIdx: 2, x: -330, z: 290, seed: 99307, radius: 55 },
    { nameIdx: 3, x: 290, z: 350, seed: 66409, radius: 52 },
  ],
  // deslocamentos (dx,dz) dos acampamentos do culto, na ordem de CULT_CAMPS_PRESETS (huge, 3 medium, 4 small)
  camps: [
    { dx: 270, dz: 230 },
    { dx: 290, dz: -70 },
    { dx: -40, dz: 290 },
    { dx: -290, dz: -50 },
    { dx: 20, dz: -280 },
    { dx: -240, dz: -240 },
    { dx: -250, dz: 200 },
    { dx: 210, dz: 270 },
  ].map((c) => ({ ...c, x: c.dx, z: c.dz })),
  bookSpots: [
    { x: 12, z: -64 },
    { x: -58, z: -14 },
    { x: 54, z: 24 },
    { x: -24, z: 62 },
    { x: 38, z: -58 },
  ],
  cutscene: { x: 0, z: -270 },
};

const GHOST_TOWN_NAMES = [
  "Ruínas de Norvânia",
  "Aldeia Devastada de Cairn",
  "Fortaleza Caída de Valdor",
  "Povoado Silencioso de Oakhaven",
  "Bastião Sangrento de Kren",
  "Vila Arruinada de Corvos",
  "Necrópole Deserta de Morvath",
];

// Nomes gerados (sílabas temáticas) para vilas de mundos não canônicos
const NAME_PRE = ["Ferro", "Pedra", "Sal", "Cinza", "Bruma", "Corvo", "Lodo", "Brejo", "Cruz", "Espinho", "Sombra", "Musgo", "Alvor", "Fumo", "Garça", "Trevo", "Lume", "Osso", "Névoa", "Tojo", "Urze", "Salgueiro", "Carvalho", "Vime"];
const NAME_SUF = ["vale", "luz", "gueiro", "zal", "mar", "fria", "morta", "alta", "funda", "seca", "negra", "velha", "pouso", "ponte", "colina", "campo", "moinho", "forja", "rocha"];
const WATCH_NAMES = ["Atalaia do Norte", "Atalaia do Corvo", "Torre da Vigília", "Atalaia Cinzenta", "Posto da Geada"];

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let _world = null; // { seed, chaos, canonical, villages, roads, ... }

export function getWorldSeed() {
  return _world ? _world.seed : CANONICAL_SEED;
}
export function getWorldChaos() {
  return _world ? _world.chaos : 0;
}
export function isCanonicalWorld() {
  return !_world || _world.canonical;
}

/** Valor determinístico 0..1 derivado da seed do mundo e de uma chave (para variações pontuais). */
export function worldRand(...key) {
  return hash32(getWorldSeed(), ...key) / 4294967296;
}

// ---------------------------------------------------------------------------
// Resolução da seed (cedo, antes de criar o World)
// ---------------------------------------------------------------------------
function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function resolveWorldParams() {
  let seed = null;
  let chaos = null;
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("seed")) seed = Number(q.get("seed"));
    if (q.has("chaos")) chaos = Number(q.get("chaos"));
  } catch (_) {}
  const hasUrlSeed = Number.isFinite(seed);
  if (!hasUrlSeed) {
    const save = readJson(SAVE_KEY) || readJson(LEGACY_SAVE_KEY);
    if (save) {
      // save antigo (sem seed) = mundo canônico, para não quebrar a continuação do jogo
      seed = Number.isFinite(save.worldSeed) ? save.worldSeed : CANONICAL_SEED;
      if (chaos === null || !Number.isFinite(chaos)) chaos = Number.isFinite(save.worldChaos) ? save.worldChaos : 0;
    } else {
      const pending = readJson(WORLD_KEY);
      if (pending && Number.isFinite(pending.seed)) {
        seed = pending.seed;
        if (chaos === null || !Number.isFinite(chaos)) chaos = Number.isFinite(pending.chaos) ? pending.chaos : DEFAULT_CHAOS;
      } else {
        // jogo novo: mundo novo e único
        let r = (Math.random() * 4294967296) >>> 0;
        try {
          const a = new Uint32Array(1);
          crypto.getRandomValues(a);
          r = a[0];
        } catch (_) {}
        seed = (r % 900000000) + 1000;
      }
    }
  }
  if (!Number.isFinite(seed)) seed = CANONICAL_SEED;
  seed = Math.floor(seed) | 0;
  if (chaos === null || !Number.isFinite(chaos)) chaos = DEFAULT_CHAOS;
  chaos = clamp(chaos, 0, 1);
  return { seed, chaos };
}

export function rememberWorld(seed, chaos) {
  try {
    localStorage.setItem(WORLD_KEY, JSON.stringify({ seed, chaos }));
  } catch (_) {}
}
export function forgetPendingWorld() {
  try {
    localStorage.removeItem(WORLD_KEY);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Terreno: critérios de adequação (usa o terreno natural da seed)
// ---------------------------------------------------------------------------
function siteScore(x, z, seed, r = 26) {
  const h0 = terrainHeight(x, z, seed);
  let span = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    span = Math.max(span, Math.abs(terrainHeight(x + Math.cos(a) * r, z + Math.sin(a) * r, seed) - h0));
  }
  // preferir terreno baixo e plano (cristas altas viram penhascos)
  return { h: h0, span, score: span * 1.0 + Math.max(0, h0 - 5) * 0.8 + Math.max(0, -h0 - 3) * 0.6 };
}

function farFromAll(list, x, z, min) {
  for (const p of list) if (dist(p.x, p.z, x, z) < min) return false;
  return true;
}

/** Procura em espiral um ponto que respeite as restrições; devolve o melhor candidato. */
function findAnchorSite(rng, seed, tx, tz, constraints, tries = 30, maxSpan = 6.5) {
  let best = null;
  for (let i = 0; i < tries; i++) {
    const rad = i === 0 ? 0 : 6 + i * 4.5;
    const ang = rng() * Math.PI * 2;
    const x = tx + Math.cos(ang) * rad;
    const z = tz + Math.sin(ang) * rad;
    if (!constraints(x, z)) continue;
    const s = siteScore(x, z, seed);
    if (!best || s.score < best.s.score) best = { x, z, s };
    if (s.span <= maxSpan * 0.5 && s.h < 6) break;
  }
  return best;
}

/** Fallback: amostra o anel [rMin,rMax] em volta da capital até achar um ponto que respeite as restrições. */
function findInAnnulus(rng, seed, rMin, rMax, constraints, samples = 400, maxSpan = 8) {
  let best = null;
  for (let i = 0; i < samples; i++) {
    const ang = rng() * Math.PI * 2;
    const rad = lerp(rMin, rMax, rng());
    const x = CAPITAL.x + Math.cos(ang) * rad;
    const z = CAPITAL.z + Math.sin(ang) * rad;
    if (!constraints(x, z)) continue;
    const s = siteScore(x, z, seed);
    if (!best || s.score < best.s.score) best = { x, z, s };
    if (s.span <= maxSpan * 0.5 && s.h < 6) break;
  }
  return best;
}

/** Âncora com tentativa local (perto do alvo) e, se falhar, busca no anel inteiro. */
function placeAnchor(rng, seed, tx, tz, constraints, ring, tries = 30, maxSpan = 6.5) {
  return findAnchorSite(rng, seed, tx, tz, constraints, tries, maxSpan) || findInAnnulus(rng, seed, ring[0], ring[1], constraints, 500, maxSpan + 2);
}

function slug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Gerador
// ---------------------------------------------------------------------------
function generateWorld(seed, chaos) {
  const canonical = seed === CANONICAL_SEED && chaos === 0;
  if (canonical) {
    return {
      seed,
      chaos,
      canonical: true,
      villages: CANON.villages.map((v) => ({ ...v })),
      roads: CANON.roads.map((r) => r.slice()),
      ghostTowns: CANON.ghostTowns.map((g, i) => ({ ...g, name: GHOST_TOWN_NAMES[g.nameIdx], id: `ruina-${i}` })),
      camps: CANON.camps.map((c) => ({ ...c })),
      bookSpots: CANON.bookSpots.map((b) => ({ ...b })),
      cutscene: { ...CANON.cutscene },
      spawn: { ...SPAWN },
      infiltrated: 1,
      tint: { r: 1, g: 1, b: 1 },
    };
  }

  const c = chaos;
  const rng = mulberry32(hash32(seed, 0xa11ce));
  const rot0 = rng() * Math.PI * 2; // rotação global do anel de vilas (a capital fica fixa; o mundo em volta gira)
  const baseRot = c === 0 ? 0 : rot0 * Math.min(1, c * 1.6);

  // ---- vilas -------------------------------------------------------------
  const delta = Math.round((rng() * 2 - 1) * c * 2.4);
  const nVill = clamp(6 + delta, 4, 8);
  const baseKinds = ["forge", "farm", "market", "forge", "farm", "watch"];
  const kinds = [];
  for (let i = 0; i < nVill; i++) kinds.push(i < baseKinds.length ? baseKinds[i] : ["forge", "farm", "market"][Math.floor(rng() * 3)]);
  // a ordem dos ofícios em volta do anel também varia com o caos
  if (c > 0.2) {
    for (let i = kinds.length - 1; i > 0; i--) {
      if (rng() < c) {
        const j = Math.floor(rng() * (i + 1));
        [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
      }
    }
  }
  const villages = [];
  const cx0 = CAPITAL.x;
  const cz0 = CAPITAL.z;
  const canonRadii = [95, 98, 104, 130, 136, 121];
  for (let i = 0; i < nVill; i++) {
    const ang = baseRot + (i / nVill) * Math.PI * 2 + (rng() * 2 - 1) * 0.42 * c;
    const radBase = i < canonRadii.length ? canonRadii[i] : 118;
    const rad = clamp(radBase + (rng() * 2 - 1) * 34 * c, 92, 168);
    const tx = cx0 + Math.cos(ang) * rad;
    const tz = cz0 + Math.sin(ang) * rad;
    const site = placeAnchor(rng, seed, tx, tz, (x, z) => dist(x, z, cx0, cz0) >= 88 && farFromAll(villages, x, z, 86) && dist(x, z, CANON.cutscene.x, CANON.cutscene.z) >= 80, [92, 170]);
    const p = site || { x: tx, z: tz };
    villages.push({ x: p.x, z: p.z, kind: kinds[i], ang });
  }
  // a vila mais afastada vira a atalaia (vigia); garante exatamente uma
  villages.forEach((v) => {
    if (v.kind === "watch") v.kind = "farm";
  });
  let far = 0;
  villages.forEach((v, i) => {
    if (dist(v.x, v.z, cx0, cz0) > dist(villages[far].x, villages[far].z, cx0, cz0)) far = i;
  });
  villages[far].kind = "watch";
  // garante ao menos uma vila de cada ofício (forja, fazenda, mercado): converte uma duplicada se faltar
  for (const need of ["forge", "farm", "market"]) {
    if (villages.some((v) => v.kind === need)) continue;
    const counts = {};
    villages.forEach((v) => (counts[v.kind] = (counts[v.kind] || 0) + 1));
    const donor = villages.find((v) => v.kind !== "watch" && counts[v.kind] > 1);
    if (donor) donor.kind = need;
  }

  // nomes únicos (sílabas temáticas)
  const used = new Set();
  const namePick = (kind) => {
    if (kind === "watch") {
      for (let k = 0; k < 12; k++) {
        const n = WATCH_NAMES[Math.floor(rng() * WATCH_NAMES.length)];
        if (!used.has(n)) return n;
      }
    }
    for (let k = 0; k < 60; k++) {
      const n = NAME_PRE[Math.floor(rng() * NAME_PRE.length)] + NAME_SUF[Math.floor(rng() * NAME_SUF.length)];
      const cap = n.charAt(0).toUpperCase() + n.slice(1);
      if (!used.has(cap)) return cap;
    }
    return `Aldeia ${used.size + 1}`;
  };
  villages.forEach((v, i) => {
    v.name = namePick(v.kind);
    used.add(v.name);
    v.id = slug(v.name);
    v.seed = (hash32(seed, 4000 + i) % 90000) + 7;
    delete v.ang;
  });
  const infiltrated = Math.floor(rng() * villages.length);

  // ---- estradas: portão -> vila, ramais, curvas e ciclos ------------------
  const roads = [];
  const seedRef = seed;
  const gateUsed = new Map();
  const order = villages.map((v, i) => i).sort((a, b) => Math.atan2(villages[a].z - cz0, villages[a].x - cx0) - Math.atan2(villages[b].z - cz0, villages[b].x - cx0));
  const curve = (ax, az, bx, bz, strength) => {
    // quebra o segmento em 1..3 trechos com desvio perpendicular determinístico (curvatura por caos)
    const len = dist(ax, az, bx, bz);
    const parts = clamp(1 + Math.round(c * 2 * (len / 90)), 1, 4);
    const nx = -(bz - az) / (len || 1);
    const nz = (bx - ax) / (len || 1);
    const pts = [[ax, az]];
    for (let k = 1; k < parts; k++) {
      const t = k / parts;
      // 5 candidatos de desvio; fica o que deixa o trecho menos íngreme (a estrada contorna morros)
      let bestPt = null;
      let bestGrade = Infinity;
      const prev = pts[pts.length - 1];
      for (let q = 0; q < 5; q++) {
        const off = (rng() * 2 - 1) * strength * c;
        const px = lerp(ax, bx, t) + nx * off;
        const pz = lerp(az, bz, t) + nz * off;
        const grade = Math.abs(terrainHeight(px, pz, seedRef) - terrainHeight(prev[0], prev[1], seedRef)) / Math.max(1, dist(px, pz, prev[0], prev[1]));
        if (grade < bestGrade) {
          bestGrade = grade;
          bestPt = [px, pz];
        }
      }
      pts.push(bestPt);
    }
    pts.push([bx, bz]);
    for (let k = 0; k < pts.length - 1; k++) roads.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]]);
    return pts;
  };
  // ponto a `frac` do comprimento da polilinha (o ramal sai EXATAMENTE de cima da estrada)
  const pointAlong = (pts, frac) => {
    let total = 0;
    for (let k = 0; k < pts.length - 1; k++) total += dist(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
    let want = total * frac;
    for (let k = 0; k < pts.length - 1; k++) {
      const seg = dist(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
      if (want <= seg || k === pts.length - 2) {
        const t = seg > 0 ? want / seg : 0;
        return [lerp(pts[k][0], pts[k + 1][0], t), lerp(pts[k][1], pts[k + 1][1], t)];
      }
      want -= seg;
    }
    return pts[0];
  };
  for (const vi of order) {
    const v = villages[vi];
    let g = GATES[0];
    let bd = Infinity;
    for (const gt of GATES) {
      // custo = distância * (1 + inclinação média): estradas evitam subidas íngremes
      const grade = Math.abs(terrainHeight(gt.x, gt.z, seed) - terrainHeight(v.x, v.z, seed)) / Math.max(1, dist(gt.x, gt.z, v.x, v.z));
      const d = dist(gt.x, gt.z, v.x, v.z) * (1 + 2.5 * grade);
      if (d < bd) {
        bd = d;
        g = gt;
      }
    }
    if (!gateUsed.has(g.id)) {
      gateUsed.set(g.id, { pts: curve(g.x, g.z, v.x, v.z, 26) });
    } else {
      // ramal: sai de um ponto da estrada do primeiro destino desse portão (sempre sobre a polilinha)
      const first = gateUsed.get(g.id);
      const [jx, jz] = pointAlong(first.pts, 0.5 + (rng() - 0.5) * 0.2);
      curve(jx, jz, v.x, v.z, 22);
    }
  }
  // ciclos: liga vilas vizinhas que ficam a menos de ~170 m (mais ciclos com mais caos)
  const maxCycles = c < 0.25 ? 0 : c < 0.6 ? 1 : 2;
  const pairs = [];
  for (let a = 0; a < villages.length; a++) {
    for (let b = a + 1; b < villages.length; b++) pairs.push([a, b, dist(villages[a].x, villages[a].z, villages[b].x, villages[b].z)]);
  }
  pairs.sort((p, q) => p[2] - q[2]);
  let cyc = 0;
  for (const [a, b, d] of pairs) {
    if (cyc >= maxCycles) break;
    if (d > 170 || d < 92) continue;
    if (rng() < 0.65) {
      curve(villages[a].x, villages[a].z, villages[b].x, villages[b].z, 20);
      cyc++;
    }
  }

  // ---- ruínas (vilas abandonadas) ----------------------------------------
  const nGhost = clamp(7 + Math.round((rng() * 2 - 1) * c * 1.6), 5, 9);
  const nearGhost = Math.ceil(nGhost * 0.43);
  const ghostNames = GHOST_TOWN_NAMES.slice();
  for (let i = ghostNames.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ghostNames[i], ghostNames[j]] = [ghostNames[j], ghostNames[i]];
  }
  const anchorsSoFar = [{ x: cx0, z: cz0 }, CANON.cutscene, ...villages];
  const ghostTowns = [];
  const ghostRot = rng() * Math.PI * 2 * Math.min(1, c * 1.6);
  for (let i = 0; i < nGhost; i++) {
    const nearRing = i < nearGhost;
    const idx = nearRing ? i : i - nearGhost;
    const cnt = nearRing ? nearGhost : nGhost - nearGhost;
    const ang = ghostRot + (idx / cnt) * Math.PI * 2 + (nearRing ? 0.5 : 1.1) + (rng() * 2 - 1) * 0.38 * c;
    const rad = (nearRing ? 205 : 395) + (rng() * 2 - 1) * (nearRing ? 40 : 55) * (0.3 + c);
    const tx = cx0 + Math.cos(ang) * rad;
    const tz = cz0 + Math.sin(ang) * rad;
    const site = placeAnchor(rng, seed, tx, tz, (x, z) => dist(x, z, cx0, cz0) >= 150 && farFromAll(anchorsSoFar, x, z, 110) && farFromAll(ghostTowns, x, z, 140), nearRing ? [160, 300] : [320, 480], 40, 8);
    const p = site || { x: tx, z: tz };
    const t = {
      id: `ruina-${i}`,
      name: ghostNames[i % ghostNames.length] + (i >= ghostNames.length ? ` (${i - ghostNames.length + 2})` : ""),
      x: p.x,
      z: p.z,
      seed: (hash32(seed, 5000 + i) % 90000) + 11111,
      radius: 44 + Math.floor(rng() * 12),
    };
    ghostTowns.push(t);
    anchorsSoFar.push(t);
  }

  // ---- acampamentos do culto (1 enorme, 3 médios, 4 pequenos) --------------
  const campPlan = [
    { r: 365, jr: 45 }, // huge
    { r: 315, jr: 40 }, { r: 315, jr: 40 }, { r: 315, jr: 40 }, // medium
    { r: 285, jr: 45 }, { r: 285, jr: 45 }, { r: 285, jr: 45 }, { r: 285, jr: 45 }, // small
  ];
  const camps = [];
  const campRot = rng() * Math.PI * 2 * Math.min(1, c * 1.6);
  campPlan.forEach((plan, i) => {
    const ang = campRot + (i / campPlan.length) * Math.PI * 2 + 0.3 + (rng() * 2 - 1) * 0.32 * c;
    const rad = plan.r + (rng() * 2 - 1) * plan.jr * (0.25 + c);
    const tx = cx0 + Math.cos(ang) * rad;
    const tz = cz0 + Math.sin(ang) * rad;
    const site = placeAnchor(rng, seed, tx, tz, (x, z) => farFromAll(anchorsSoFar, x, z, 120) && farFromAll(camps, x, z, 130), [230, 430], 40, 8);
    const p = site || { x: tx, z: tz };
    camps.push({ x: p.x, z: p.z, dx: p.x - 0, dz: p.z - 0 });
    anchorsSoFar.push({ x: p.x, z: p.z });
  });

  // ---- pontos do Livro do Barro (5 candidatos ao redor das muralhas; um é escolhido por seed no jogo) ----
  const bookSpots = [];
  const bookRot = rng() * Math.PI * 2 * Math.min(1, c * 1.6);
  for (let i = 0; i < 5; i++) {
    const ang = bookRot + (i / 5) * Math.PI * 2 + (rng() * 2 - 1) * 0.3 * c + 0.4;
    const rad = 62 + (rng() * 2 - 1) * 8 * (0.4 + c);
    const tx = cx0 + Math.cos(ang) * rad;
    const tz = cz0 + Math.sin(ang) * rad;
    const site = placeAnchor(
      rng,
      seed,
      tx,
      tz,
      (x, z) => {
        const ex = (x - cx0) / (CAPITAL.rx * 1.25);
        const ez = (z - cz0) / (CAPITAL.rz * 1.25);
        return ex * ex + ez * ez > 1 && farFromAll(villages, x, z, 48) && farFromAll(bookSpots, x, z, 30);
      },
      [58, 85],
      30,
      6,
    );
    const p = site || { x: tx, z: tz };
    bookSpots.push({ x: p.x, z: p.z });
  }

  // ---- ponto da cutscene: clareira canônica segura e estável para todas as seeds ----
  const cutscene = { ...CANON.cutscene };

  // ---- tinta global do mundo (matiz leve, dentro de uma faixa que preserva o clima sinistro) ----
  const tr = rng();
  const tg = rng();
  const tb = rng();
  const tint = {
    r: 1 + (tr * 2 - 1) * 0.1 * c,
    g: 1 + (tg * 2 - 1) * 0.1 * c,
    b: 1 + (tb * 2 - 1) * 0.12 * c,
  };

  return { seed, chaos, canonical: false, villages, roads, ghostTowns, camps, bookSpots, cutscene, spawn: { ...SPAWN }, infiltrated, tint };
}

// ---------------------------------------------------------------------------
// Direção e dicas de texto (Livro do Barro)
// ---------------------------------------------------------------------------
function compass(dx, dz) {
  // convenção do jogo: -z = norte, +x = leste
  const a = Math.atan2(dx, -dz); // 0 = norte, cresce para leste
  const names = ["ao norte", "a nordeste", "a leste", "a sudeste", "ao sul", "a sudoeste", "a oeste", "a noroeste"];
  const i = ((Math.round((a / (Math.PI * 2)) * 8) % 8) + 8) % 8;
  return names[i];
}

/** Palavra de direção (norte, nordeste, leste...) de (x,z) em relação à capital; -z = norte, +x = leste. */
export function directionName(x, z) {
  const a = Math.atan2(x - CAPITAL.x, -(z - CAPITAL.z));
  const names = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"];
  const i = ((Math.round((a / (Math.PI * 2)) * 8) % 8) + 8) % 8;
  return names[i];
}

const BOOK_LANDMARKS = [
  { name: "Marco de Pedra", hint: "sob um marco de pedra antigo" },
  { name: "Ruínas", hint: "entre escombros de pedra negra, onde a floresta começa" },
  { name: "Penhasco", hint: "entre rochas frias, num penhasco de vento" },
  { name: "Carroça Tombada", hint: "perto de uma carroça quebrada nas colinas ermas" },
  { name: "Acampamento Arruinado", hint: "sobre as cinzas de um acampamento profano" },
  { name: "Árvore Seca", hint: "ao pé de uma árvore seca e retorcida" },
  { name: "Cruzeiro Quebrado", hint: "junto a um cruzeiro partido à beira do caminho" },
];

function buildBookSpots(w) {
  return w.bookSpots.map((b, i) => {
    const dir = compass(b.x - CAPITAL.x, b.z - CAPITAL.z);
    const lm = BOOK_LANDMARKS[hash32(w.seed, 7000 + i) % BOOK_LANDMARKS.length];
    return {
      id: i,
      x: b.x,
      z: b.z,
      name: `${lm.name} ${dir.replace(/^(ao|a) /, "a ")} das Muralhas`,
      hint: `Dizem que o Livro do Barro foi deixado ${dir} das muralhas de Caldera, fora dos muros, ${lm.hint}.`,
    };
  });
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------
export function initWorld({ seed, chaos } = {}) {
  const p = seed === undefined ? resolveWorldParams() : { seed: Math.floor(seed) | 0, chaos: clamp(chaos ?? DEFAULT_CHAOS, 0, 1) };
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  _world = generateWorld(p.seed, p.chaos);
  _world.bookSpotsFull = buildBookSpots(_world);
  _world.genMs = typeof performance !== "undefined" ? performance.now() - t0 : 0;
  setKingdomLayout(_world.villages, _world.roads);
  return _world;
}

export function getWorld() {
  return _world;
}
export function getAnchors() {
  return _world;
}
export function getVillages() {
  return _world ? _world.villages : [];
}
export function getRoads() {
  return _world ? _world.roads : [];
}
export function getCapital() {
  return CAPITAL;
}
export function getGhostTownSpots() {
  return _world ? _world.ghostTowns : [];
}
export function getCampOffsets() {
  return _world ? _world.camps : CANON.camps;
}
export function getBookSpotsFull() {
  return _world ? _world.bookSpotsFull : [];
}
export function getCutscenePoint() {
  return CANON.cutscene; // Sempre o ponto canônico seguro, testado e estável para qualquer seed
}
export function getSpawnPoint() {
  return _world ? _world.spawn : SPAWN;
}
export function getInfiltratedVillage() {
  return _world ? _world.villages[_world.infiltrated] : null;
}
export function getWorldTint() {
  return _world ? _world.tint : { r: 1, g: 1, b: 1 };
}

/** Âncoras de lore (ruínas e acampamentos) perto de (x,z)? Usado para a vegetação não nascer em cima delas. */
export function anchorNear(x, z, margin = 6) {
  // Corredor da cutscene 100% livre de árvores, rochas e obstáculos em todas as seeds
  const cs = CANON.cutscene;
  if (Math.abs(x - cs.x) < 22 && z <= cs.z + 20 && z >= cs.z - 85) return true;
  if (!_world) return false;
  for (const g of _world.ghostTowns) if (dist(x, z, g.x, g.z) < g.radius + margin) return true;
  for (const c of _world.camps) if (dist(x, z, c.dx ?? c.x, c.dz ?? c.z) < 26 + margin) return true;
  return false;
}

// ---------------------------------------------------------------------------
// VALIDAÇÃO por muitas seeds (só âncoras e estradas, sem malhas)
// ---------------------------------------------------------------------------
export function validate(seedStart = 1, count = 100, chaos = DEFAULT_CHAOS) {
  const failures = [];
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  let maxMs = 0;
  for (let n = 0; n < count; n++) {
    const seed = seedStart + n;
    const a = typeof performance !== "undefined" ? performance.now() : 0;
    const w = generateWorld(seed, chaos);
    w.bookSpotsFull = buildBookSpots(w);
    maxMs = Math.max(maxMs, (typeof performance !== "undefined" ? performance.now() : 0) - a);
    const fail = (msg) => failures.push(`seed ${seed} caos ${chaos}: ${msg}`);

    // existência e papéis
    if (w.villages.length < 4 || w.villages.length > 8) fail(`nº de vilas ${w.villages.length}`);
    if (w.villages.filter((v) => v.kind === "watch").length !== 1) fail("não há exatamente 1 atalaia");
    if (!w.villages.some((v) => v.kind === "forge")) fail("sem vila da forja");
    if (!w.villages.some((v) => v.kind === "farm")) fail("sem vila da fazenda");
    if (!w.villages.some((v) => v.kind === "market")) fail("sem vila do mercado");
    if (w.ghostTowns.length < 5) fail(`ruínas ${w.ghostTowns.length}`);
    if (w.camps.length !== 8) fail(`acampamentos ${w.camps.length}`);
    if (w.bookSpots.length !== 5) fail(`pontos do livro ${w.bookSpots.length}`);
    // nomes únicos
    const names = [...w.villages.map((v) => v.name), ...w.ghostTowns.map((g) => g.name)];
    if (new Set(names).size !== names.length) fail("nomes repetidos");
    if (new Set(w.villages.map((v) => v.id)).size !== w.villages.length) fail("ids de vila repetidos");
    // finitude
    const all = [...w.villages, ...w.ghostTowns, ...w.camps.map((c) => ({ x: c.x, z: c.z })), ...w.bookSpots, w.cutscene];
    if (all.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) fail("coordenada inválida");
    // distâncias mínimas
    for (let i = 0; i < w.villages.length; i++) {
      const v = w.villages[i];
      if (dist(v.x, v.z, CAPITAL.x, CAPITAL.z) < 84) fail(`vila ${v.name} colada na capital`);
      for (let j = i + 1; j < w.villages.length; j++) {
        if (dist(v.x, v.z, w.villages[j].x, w.villages[j].z) < 66) fail(`vilas ${v.name}/${w.villages[j].name} coladas`);
      }
    }
    for (const g of w.ghostTowns) {
      for (const v of w.villages) if (dist(g.x, g.z, v.x, v.z) < 70) fail(`ruína ${g.name} colada em ${v.name}`);
      if (dist(g.x, g.z, CAPITAL.x, CAPITAL.z) < 130) fail(`ruína ${g.name} colada na capital`);
    }
    for (let i = 0; i < w.ghostTowns.length; i++) {
      for (let j = i + 1; j < w.ghostTowns.length; j++) {
        if (dist(w.ghostTowns[i].x, w.ghostTowns[i].z, w.ghostTowns[j].x, w.ghostTowns[j].z) < 110) fail("ruínas coladas entre si");
      }
    }
    for (const cp of w.camps) {
      for (const v of w.villages) if (dist(cp.x, cp.z, v.x, v.z) < 100) fail("acampamento colado em vila");
      for (const g of w.ghostTowns) if (dist(cp.x, cp.z, g.x, g.z) < 75) fail("acampamento colado em ruína");
    }
    // livro: fora da muralha e fora das vilas; terreno acessível
    for (const b of w.bookSpots) {
      const ex = (b.x - CAPITAL.x) / CAPITAL.rx;
      const ez = (b.z - CAPITAL.z) / CAPITAL.rz;
      if (ex * ex + ez * ez <= 1) fail("livro dentro da muralha");
      if (siteScore(b.x, b.z, seed, 8).span > 9) fail("livro em terreno íngreme");
    }
    // cutscene: terreno acessível e longe de tudo
    const cs = siteScore(w.cutscene.x, w.cutscene.z, seed, 20);
    if (cs.span > 9) fail("cutscene em terreno íngreme");
    for (const v of w.villages) if (dist(w.cutscene.x, w.cutscene.z, v.x, v.z) < 70) fail("cutscene colada em vila");
    // estradas: grafo conexo (todas as vilas alcançam algum portão) e sem trecho íngreme demais
    const nodes = [];
    const find = (x, z) => {
      for (let i = 0; i < nodes.length; i++) if (dist(nodes[i].x, nodes[i].z, x, z) < 0.6) return i;
      nodes.push({ x, z, p: nodes.length });
      return nodes.length - 1;
    };
    const parent = [];
    const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
    const reg = (i) => {
      while (parent.length <= i) parent.push(parent.length);
    };
    for (const g of GATES) reg(find(g.x, g.z));
    for (const v of w.villages) reg(find(v.x, v.z));
    // ponto -> segmento mais próximo (ramais saem do MEIO de uma estrada, como no mundo canônico)
    const distToSeg = (px, pz, s) => {
      const dx = s[2] - s[0];
      const dz = s[3] - s[1];
      const l2 = dx * dx + dz * dz || 1;
      const t = clamp(((px - s[0]) * dx + (pz - s[1]) * dz) / l2, 0, 1);
      return dist(px, pz, s[0] + dx * t, s[1] + dz * t);
    };
    for (const r of w.roads) {
      const a = find(r[0], r[1]);
      const b = find(r[2], r[3]);
      reg(Math.max(a, b));
      parent[root(a)] = root(b);
      const len = dist(r[0], r[1], r[2], r[3]);
      const hA = terrainHeight(r[0], r[1], seed);
      const hB = terrainHeight(r[2], r[3], seed);
      if (len > 1 && Math.abs(hA - hB) / len > 0.34) fail("estrada com inclinação extrema");
    }
    // pontas que tocam o meio de outra estrada (tolerância 2,5 m) também se ligam
    for (let i = 0; i < w.roads.length; i++) {
      for (const [px, pz] of [[w.roads[i][0], w.roads[i][1]], [w.roads[i][2], w.roads[i][3]]]) {
        for (let j = 0; j < w.roads.length; j++) {
          if (i === j) continue;
          if (distToSeg(px, pz, w.roads[j]) < 2.5) {
            const a = find(px, pz);
            const b = find(w.roads[j][0], w.roads[j][1]);
            reg(Math.max(a, b));
            parent[root(a)] = root(b);
          }
        }
      }
    }
    for (let i = 1; i < GATES.length; i++) {
      // os 4 portões se ligam pelas ruas internas da capital
      const a = find(GATES[0].x, GATES[0].z);
      const b = find(GATES[i].x, GATES[i].z);
      parent[root(a)] = root(b);
    }
    const base = root(find(GATES[0].x, GATES[0].z));
    for (const v of w.villages) if (root(find(v.x, v.z)) !== base) fail(`vila ${v.name} desconectada do reino`);
  }
  const report = {
    seeds: count,
    from: seedStart,
    chaos,
    failures: failures.length,
    sample: failures.slice(0, 8),
    totalMs: Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0),
    maxGenMs: Number(maxMs.toFixed(2)),
  };
  return report;
}

if (typeof window !== "undefined") {
  window.__worldgen = {
    validate,
    initWorld,
    getWorld,
    getWorldSeed,
    getWorldChaos,
    generate: (seed, chaos) => generateWorld(seed, chaos),
    CANONICAL_SEED,
  };
}
