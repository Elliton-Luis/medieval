// ============================================================================
// placement.js — Registro global de pegadas de construções (anti-sobreposição)
// Cada construção reserva um retângulo orientado (centro, meia-largura, meia-profundidade, rotação).
// Antes de criar uma construção, canPlace() garante o afastamento mínimo (margem) das demais;
// findSpot() procura o ponto livre mais próximo (espiral). auditBuildings() lista qualquer sobreposição.
// ============================================================================

export const BUILDING_GAP = 3.2; // afastamento mínimo (m) entre construções de verdade
export const PROP_GAP = 0.6; // adereços (curral, barraca, forja externa) só precisam não entrar nas paredes

const entries = [];

export function resetPlacement() {
  entries.length = 0;
}

export function getPlacements() {
  return entries;
}

// ---------------------------------------------------------------------------
// Geometria: SAT entre dois retângulos orientados (com folga) — sem alocação no caminho quente
// ---------------------------------------------------------------------------
function separated(ax, az, ahw, ahd, ary, bx, bz, bhw, bhd, bry, gap) {
  const ca = Math.cos(ary), sa = Math.sin(ary);
  const cb = Math.cos(bry), sb = Math.sin(bry);
  // eixos locais (x,z) de cada retângulo; convenção do jogo: x local = (cos, -sin), z local = (sin, cos)
  const axes = [
    [ca, -sa], [sa, ca],
    [cb, -sb], [sb, cb],
  ];
  const dx = bx - ax;
  const dz = bz - az;
  for (let i = 0; i < 4; i++) {
    const ux = axes[i][0];
    const uz = axes[i][1];
    const ra = ahw * Math.abs(ux * ca + uz * -sa) + ahd * Math.abs(ux * sa + uz * ca);
    const rb = bhw * Math.abs(ux * cb + uz * -sb) + bhd * Math.abs(ux * sb + uz * cb);
    const dist = Math.abs(dx * ux + dz * uz);
    if (dist > ra + rb + gap) return true;
  }
  return false;
}

/** Primeiro registro que conflita com o retângulo candidato (ou null). */
export function findConflict(x, z, hw, hd, ry, margin = BUILDING_GAP, ignoreGroup = null) {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (ignoreGroup && e.group === ignoreGroup) continue;
    const gap = Math.min(margin, e.margin);
    if (!separated(x, z, hw, hd, ry, e.x, e.z, e.hw, e.hd, e.ry, gap)) return e;
  }
  return null;
}

export function canPlace(x, z, hw, hd, ry = 0, margin = BUILDING_GAP, ignoreGroup = null) {
  return findConflict(x, z, hw, hd, ry, margin, ignoreGroup) === null;
}

export function release(entry) {
  const i = entries.indexOf(entry);
  if (i >= 0) entries.splice(i, 1);
}

export function reserve(x, z, hw, hd, ry = 0, kind = "building", id = "", margin = null, group = null) {
  const e = {
    x, z, hw, hd, ry, kind, id,
    margin: margin ?? (kind === "prop" || kind === "field" || kind === "stairs" ? PROP_GAP : BUILDING_GAP),
    group: group || id || kind,
  };
  entries.push(e);
  return e;
}

// ---------------------------------------------------------------------------
// Validação de PONTO: "existe alguma construção perto/em cima deste ponto?"
// Todo objeto solto (poste de tocha, banco, feno, árvore, pedra, grama...) deve passar por aqui antes de nascer.
// ---------------------------------------------------------------------------
/** Primeira pegada que contém (x,z) com folga `margin` (m); ignora a pegada do grupo `ignoreGroup`. */
export function pointBlockedBy(x, z, margin = 0.8, ignoreGroup = null) {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (ignoreGroup && e.group === ignoreGroup) continue;
    const dx = x - e.x;
    const dz = z - e.z;
    const c = Math.cos(e.ry);
    const s = Math.sin(e.ry);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < e.hw + margin && Math.abs(lz) < e.hd + margin) return e;
  }
  return null;
}

export function pointBlocked(x, z, margin = 0.8, ignoreGroup = null) {
  return pointBlockedBy(x, z, margin, ignoreGroup) !== null;
}

/** Ponto livre mais próximo de (x,z) (espiral de anéis); null se não houver até maxR metros. */
export function nearestFreePoint(x, z, margin = 0.8, maxR = 8) {
  if (!pointBlocked(x, z, margin)) return { x, z };
  for (let r = 1; r <= maxR; r += 1) {
    const steps = Math.max(8, Math.round(r * 6));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (!pointBlocked(px, pz, margin)) return { x: px, z: pz };
    }
  }
  return null;
}

/** Inclinação: diferença máxima de altura sob a pegada. */
export function slopeSpan(world, x, z, hw, hd, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  let lo = Infinity, hi = -Infinity;
  for (const lx of [-hw, 0, hw]) {
    for (const lz of [-hd, 0, hd]) {
      const h = world.heightAt(x + lx * c + lz * s, z - lx * s + lz * c);
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  return hi - lo;
}

/**
 * Procura o ponto livre mais próximo de (x, z) em anéis crescentes (espiral).
 * opts: { margin, maxRadius, step, maxSlope, world, validate(x,z) } -> { x, z } ou null.
 */
export function findSpot(x, z, hw, hd, ry, opts = {}) {
  const { margin = BUILDING_GAP, maxRadius = 18, step = 1.6, maxSlope = 3.2, world = null, validate = null, ignoreGroup = null, offset = null } = opts;
  const c = Math.cos(ry), s = Math.sin(ry);
  // offset = deslocamento local (lx, lz) do centro da pegada em relação à origem da construção
  const ox = offset ? offset.lx * c + offset.lz * s : 0;
  const oz = offset ? -offset.lx * s + offset.lz * c : 0;
  const ok = (px, pz) => {
    if (!canPlace(px + ox, pz + oz, hw, hd, ry, margin, ignoreGroup)) return false;
    if (world && slopeSpan(world, px + ox, pz + oz, hw, hd, ry) > maxSlope) return false;
    if (validate && !validate(px, pz)) return false;
    return true;
  };
  if (ok(x, z)) return { x, z };
  for (let r = step; r <= maxRadius; r += step) {
    const n = Math.max(8, Math.round((r * Math.PI * 2) / step));
    const phase = (r * 1.37) % (Math.PI * 2);
    for (let k = 0; k < n; k++) {
      const a = phase + (k / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (ok(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auditor: todas as sobreposições entre pegadas registradas
// ---------------------------------------------------------------------------
export function auditBuildings() {
  const overlaps = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.group === b.group) continue;
      const gap = Math.min(a.margin, b.margin);
      if (!separated(a.x, a.z, a.hw, a.hd, a.ry, b.x, b.z, b.hw, b.hd, b.ry, gap)) {
        overlaps.push(`${a.kind}:${a.id} (${a.x.toFixed(0)},${a.z.toFixed(0)}) x ${b.kind}:${b.id} (${b.x.toFixed(0)},${b.z.toFixed(0)})`);
      }
    }
  }
  const byKind = {};
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  return { total: entries.length, byKind, overlaps };
}

/** Auditor de pontos: tochas (ou qualquer lista {x,z,kind}) que estão DENTRO de uma pegada (além da parede). */
export function auditPoints(points, margin = -0.25) {
  const bad = [];
  for (const p of points) {
    const e = pointBlockedBy(p.x, p.z, margin);
    if (e) bad.push(`${p.kind || "ponto"} (${p.x.toFixed(1)},${p.z.toFixed(1)}) dentro de ${e.kind}:${e.id}`);
  }
  return { checked: points.length, inside: bad.length, bad };
}

if (typeof window !== "undefined") {
  window.__placement = { auditBuildings, auditPoints, getPlacements, canPlace, findSpot, reserve, pointBlocked, nearestFreePoint };
}
