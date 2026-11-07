import * as THREE from "three";
import { PlayerInventory, PlayerStats, syncPlayerStatsToPlayer, getPlayerBuildingsPool } from "./rpg.js";
import { WorldDecay } from "./decay.js";

// ============================================================================
// hay.js — Feno bruto colhido com a FOICE
//  - cada fardo/monte guarda 50 de feno; a foice varre um arco e corta TODOS os fardos tocados
//  - cada fardo atingido entrega 10–14 de feno por golpe e vai murchando (escala) até sumir
//  - fardos do mundo somem ao esgotar e voltam no DIA SEGUINTE (WorldDecay.daysPassed)
//  - o bloco criado pelo jogador (10 de feno) também rende 50 e some de vez ao esgotar
// Estruturas leves: registro em array, sem alocação por frame (polling de dia a cada 0.5 s).
// ============================================================================
export const HAY_PER_BALE = 50;
const HAY_CAP = 999;
const SWEEP_HALF_ANGLE = 1.05; // ~60° para cada lado: "corta todos que ele toca"

const worldBales = []; // fardos do mundo: { kind: "group"|"mound", ... }
const _dummy = new THREE.Object3D();
let _lastDay = 1;
let _dayTimer = 0;

function _collider(world) {
  const list = world?.staticColliders;
  return list && list.length ? list[list.length - 1] : null;
}

/** Fardo em grupo (campos de plantação). O colisor estático deve ter sido criado logo antes desta chamada. */
export function registerGroupBale(group, x, z, world, radius = 1.0) {
  group.userData.noMerge = true; // fica fora da mesclagem estática do campo (muda de escala/visibilidade)
  worldBales.push({ kind: "group", obj: group, x, z, radius, remaining: HAY_PER_BALE, respawnDay: 0, col: _collider(world), baseY: group.scale.y });
}

/** Monte de feno instanciado do cenário (Clutter_HayMounds). */
export function registerMoundBale(mesh, index, x, y, z, ry, collider) {
  worldBales.push({ kind: "mound", mesh, index, x, y, z, ry, radius: 1.4, remaining: HAY_PER_BALE, respawnDay: 0, col: collider || null });
}

function _applyVisual(b) {
  const frac = Math.max(0, b.remaining / HAY_PER_BALE);
  const sy = 0.38 + 0.62 * frac; // o fardo murcha conforme é cortado
  if (b.kind === "group") {
    b.obj.visible = b.remaining > 0;
    b.obj.scale.set(1, sy, 1);
    b.obj.updateMatrix();
    b.obj.updateMatrixWorld(true);
  } else {
    _dummy.position.set(b.x, b.y, b.z);
    _dummy.rotation.set(0, b.ry, 0);
    if (b.remaining > 0) _dummy.scale.set(1, sy, 1);
    else _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    b.mesh.setMatrixAt(b.index, _dummy.matrix);
    b.mesh.instanceMatrix.needsUpdate = true;
  }
  if (b.col) b.col.disabled = b.remaining <= 0;
}

function _deactivatePlaced(building) {
  const boxes = building.userData.registeredBoxes;
  if (boxes) {
    for (let i = 0; i < boxes.length; i++) {
      const bx = boxes[i];
      if (bx) { bx.active = false; bx.move = false; bx.shot = false; bx.cam = false; }
    }
    boxes.length = 0;
  }
  building.visible = false;
  building.userData.collidersRegistered = false;
}

function _eachPlaced(fn) {
  const pool = getPlayerBuildingsPool();
  for (let i = 0; i < pool.length; i++) {
    const b = pool[i];
    if (b.visible && b.userData.type === "HAY_BALE" && (b.userData.hayLeft ?? 0) > 0) fn(b);
  }
}

/** Golpe da foice: corta todos os fardos dentro do arco à frente do jogador. */
export function scytheSweep(player, yaw, def, env = {}) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const px = player.x;
  const pz = player.z;
  const reach = (def?.reach ?? 3.2) + 0.5;
  const cosMin = Math.cos(SWEEP_HALF_ANGLE);
  let total = 0;
  let hits = 0;
  let lastX = px;
  let lastZ = pz;

  const touches = (x, z, radius) => {
    const dx = x - px;
    const dz = z - pz;
    const d = Math.hypot(dx, dz);
    if (d > reach + radius) return false;
    if (d > radius + 0.6) {
      const dot = (dx * fx + dz * fz) / d;
      if (dot < cosMin) return false;
    }
    return true;
  };
  const burst = (x, y, z) => {
    env.effects?.play?.("dust", x, y + 0.7, z, "#e3c26a", 1.2);
    env.effects?.play?.("star", x, y + 1.0, z, "#f0d47a", 0.7);
  };

  for (let i = 0; i < worldBales.length; i++) {
    const b = worldBales[i];
    if (b.remaining <= 0 || !touches(b.x, b.z, b.radius)) continue;
    const take = Math.min(b.remaining, 10 + Math.floor(Math.random() * 5));
    b.remaining -= take;
    total += take;
    hits++;
    lastX = b.x;
    lastZ = b.z;
    if (b.remaining <= 0) b.respawnDay = (WorldDecay?.daysPassed ?? 1) + 1;
    _applyVisual(b);
    burst(b.x, b.kind === "group" ? b.obj.position.y : b.y, b.z);
  }
  _eachPlaced((building) => {
    if (!touches(building.position.x, building.position.z, 0.9)) return;
    const take = Math.min(building.userData.hayLeft, 10 + Math.floor(Math.random() * 5));
    building.userData.hayLeft -= take;
    total += take;
    hits++;
    lastX = building.position.x;
    lastZ = building.position.z;
    if (building.userData.hayLeft <= 0) {
      _deactivatePlaced(building); // bloco do jogador: some de vez
    } else {
      building.scale.set(1, 0.38 + 0.62 * (building.userData.hayLeft / HAY_PER_BALE), 1);
    }
    burst(building.position.x, building.position.y, building.position.z);
  });

  if (total <= 0) return 0;
  PlayerInventory.hay = Math.min(HAY_CAP, (PlayerInventory.hay || 0) + total);
  PlayerStats.hay = PlayerInventory.hay;
  env.audio?.weaponSwing?.("slash", false);
  env.ui?.showToast?.(`🌾 Foice! +${total} Feno de ${hits} ${hits > 1 ? "fardos" : "fardo"} (Feno: ${PlayerInventory.hay})`);
  syncPlayerStatsToPlayer();
  return total;
}

/** Fardos do mundo voltam no dia seguinte (checagem leve, 2x por segundo). */
export function updateHay(dt) {
  _dayTimer -= dt;
  if (_dayTimer > 0) return;
  _dayTimer = 0.5;
  const day = WorldDecay?.daysPassed ?? 1;
  if (day === _lastDay) return;
  _lastDay = day;
  for (let i = 0; i < worldBales.length; i++) {
    const b = worldBales[i];
    if (b.remaining < HAY_PER_BALE && day >= b.respawnDay) {
      b.remaining = HAY_PER_BALE;
      b.respawnDay = 0;
      _applyVisual(b);
    }
  }
}

/** Prompt de HUD: foice na mão e fardo ao alcance. Retorna true se mostrou. */
export function hayPrompt(player, ui, weaponId) {
  if (weaponId !== "scythe" || !ui?.setPrompt) return false;
  const px = player.x;
  const pz = player.z;
  const near = 3.8;
  let best = null;
  let bestD = near * near;
  for (let i = 0; i < worldBales.length; i++) {
    const b = worldBales[i];
    if (b.remaining <= 0) continue;
    const d = (b.x - px) ** 2 + (b.z - pz) ** 2;
    if (d < bestD) { bestD = d; best = b.remaining; }
  }
  _eachPlaced((building) => {
    const d = (building.position.x - px) ** 2 + (building.position.z - pz) ** 2;
    if (d < bestD) { bestD = d; best = building.userData.hayLeft; }
  });
  if (best === null) return false;
  ui.setPrompt(`🌾 FARDO DE FENO (${best}/${HAY_PER_BALE}) · golpeie com a Foice para colher`);
  return true;
}

/** Estado para o save (índices por ordem de registro: determinística pela geração do mundo). */
export function getHayState() {
  return worldBales.map((b) => [b.remaining, b.respawnDay]);
}

export function restoreHayState(state) {
  if (!Array.isArray(state)) return;
  for (let i = 0; i < Math.min(state.length, worldBales.length); i++) {
    worldBales[i].remaining = state[i][0];
    worldBales[i].respawnDay = state[i][1];
    _applyVisual(worldBales[i]);
  }
}
