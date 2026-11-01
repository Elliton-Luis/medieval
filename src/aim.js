import * as THREE from "three";
import { rayTarget } from "./hitboxes.js";

const MAX_RANGE = 120;
const STEP = 0.35;
const ASSIST_MAX_RANGE = 56;

export class AimSystem {
  constructor(camera, world, npcs, input, ui) {
    this.camera = camera;
    this.world = world;
    this.npcs = npcs;
    this.input = input;
    this.ui = ui;
    this.active = false;
    this.wasActive = false;
    this.ranged = false;
    this.point = new THREE.Vector3();
    this._rawPoint = new THREE.Vector3();
    this.origin = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.target = null;
    this.assistTarget = null;
    this.assistPoint = new THREE.Vector3();
    this.assistLocked = false;
    this.assistEnabled = this._loadAssistPref();
    this.distance = MAX_RANGE;
    this.spread = 0;
    this.elevation = 0;
    this.bloom = 0;
    this._hold = 0;
    this._pointInitialized = false;
    this.onAssistChange = null;
  }

  _loadAssistPref() {
    try {
      const saved = localStorage.getItem("puris_aim_assist");
      return saved === null ? true : saved !== "0";
    } catch {
      return true;
    }
  }

  setAssistEnabled(enabled) {
    this.assistEnabled = Boolean(enabled);
    try {
      localStorage.setItem("puris_aim_assist", this.assistEnabled ? "1" : "0");
    } catch {
      // ignore storage errors
    }
    if (!this.assistEnabled) {
      this.assistTarget = null;
      this.assistLocked = false;
    }
    this.onAssistChange?.(this.assistEnabled);
    return this.assistEnabled;
  }

  toggleAssist() {
    return this.setAssistEnabled(!this.assistEnabled);
  }

  // Cada tiro abre a mira; ela fecha sozinha com o tempo.
  kick(amount) {
    this.bloom = Math.min(0.12, this.bloom + amount);
  }

  _hasLineOfSight(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.5) return true;
    const steps = Math.min(28, Math.max(4, Math.ceil(dist / 1.1)));
    const world = this.world;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      const z = z0 + dz * t;
      if (y < world.heightAt(x, z) + 0.05 || world.isBlockedAtHeight(x, y, z, 0.04)) {
        return false;
      }
    }
    return true;
  }

  // Encontra o melhor alvo vivo na frente do jogador (com persistência de mira e verificação de linha de visão).
  findNearestBeing(player, maxRange = ASSIST_MAX_RANGE) {
    const npcs = this.npcs.npcs;
    const px = player.x;
    const py = player.root.position.y + 1.42;
    const pz = player.z;
    const maxDistSq = maxRange * maxRange;

    // 1. Target Stickiness: se já temos um alvo travado vivo no alcance e com visão, MANTÉM ELE!
    if (this.assistTarget && this.assistTarget.alive && this.assistTarget.root?.visible && !this.assistTarget.controlled) {
      const curDx = this.assistTarget.x - px;
      const curDz = this.assistTarget.z - pz;
      const curDistSq = curDx * curDx + curDz * curDz;
      if (curDistSq < (maxRange * 1.25) * (maxRange * 1.25)) {
        const curTargetY = this.assistTarget.root.position.y + (this.assistTarget.roleKey === "horse" ? 1.08 : 1.3);
        if (this._hasLineOfSight(px, py, pz, this.assistTarget.x, curTargetY, this.assistTarget.z)) {
          return this.assistTarget;
        }
      }
    }

    // 2. Se o alvo anterior morreu ou não é mais válido, busca o melhor alvo no cone frontal
    const dxCam = this.direction.x || 0;
    const dzCam = this.direction.z || 1;

    let bestScore = -Infinity;
    let bestNpc = null;

    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      if (!npc.alive || !npc.root.visible || npc.controlled) continue;
      const dx = npc.x - px;
      const dz = npc.z - pz;
      const dSq = dx * dx + dz * dz;
      if (dSq > maxDistSq || dSq < 0.04) continue;

      const dist = Math.sqrt(dSq);
      const toDirX = dx / dist;
      const toDirZ = dz / dist;
      const dot = toDirX * dxCam + toDirZ * dzCam;

      // Prioriza alvos no campo de visão frontal
      if (dot < -0.3 && dist > 10) continue;

      const targetY = npc.root.position.y + (npc.roleKey === "horse" ? 1.08 : 1.28);
      if (!this._hasLineOfSight(px, py, pz, npc.x, targetY, npc.z)) continue;

      const isHostile = npc.hostile || npc.roleKey === "werewolf" || npc.roleKey === "cultist";
      const hostileBonus = isHostile ? 50 : 0;
      const score = (dot * 40) - dist + hostileBonus;

      if (score > bestScore) {
        bestScore = score;
        bestNpc = npc;
      }
    }

    return bestNpc;
  }

  prepare(player, weapon, enabled) {
    this.ranged = Boolean(weapon && (weapon.ammo || weapon.type === "throw" || weapon.type === "bow" || weapon.type === "crossbow" || weapon.type === "musket"));
    this.wasActive = this.active;
    this.active = Boolean(enabled && this.input.aimHeld && !player.blocking);

    if (this.assistEnabled && enabled && !player.knockedOut) {
      const range = this.ranged ? ASSIST_MAX_RANGE : 16;
      this.assistTarget = this.findNearestBeing(player, range);
      if (this.assistTarget) {
        const npc = this.assistTarget;
        const baseAimY = npc.root.position.y + (npc.roleKey === "horse" ? 1.08 : 1.3);
        const dist = Math.hypot(npc.x - player.x, npc.z - player.z);
        const projSpeed = weapon?.speed || 42;
        const leadTime = this.ranged && !weapon?.arc ? Math.min(0.45, dist / Math.max(18, projSpeed)) : 0;
        const vx = npc.vx || 0;
        const vz = npc.vz || 0;
        this.assistPoint.set(
          npc.x + vx * leadTime,
          baseAimY,
          npc.z + vz * leadTime,
        );
      }
    } else {
      this.assistTarget = null;
    }
  }

  update(dt, player, weapon, enabled) {
    this.bloom *= Math.exp(-6 * dt);

    const shouldShow = enabled && (this.active || this.ranged || Boolean(weapon));
    if (!shouldShow) {
      this.target = null;
      this.assistLocked = false;
      this.ui.setReticle(false, 0, false, false, false);
      this.ui.updateLockMarker?.(null, false, this.camera);
      return;
    }

    const camera = this.camera;
    camera.updateMatrixWorld();
    camera.getWorldPosition(this.origin);
    camera.getWorldDirection(this.direction);
    const ox = this.origin.x;
    const oy = this.origin.y;
    const oz = this.origin.z;
    const dx = this.direction.x;
    const dy = this.direction.y;
    const dz = this.direction.z;

    // Ignora o que está entre a câmera e o jogador.
    const toPlayer = (player.x - ox) * dx + (player.root.position.y + 1.3 - oy) * dy + (player.z - oz) * dz;
    const start = Math.max(0.5, toPlayer);
    let best = MAX_RANGE;
    let target = null;

    const npcs = this.npcs.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      if (!npc.alive || !npc.root.visible || npc.controlled) continue;
      const t = rayTarget(npc, ox, oy, oz, dx, dy, dz, start, best);
      if (t >= start && t < best) {
        best = t;
        target = npc;
      }
    }

    const world = this.world;
    let previous = start;
    for (let t = start; t < best; t += STEP) {
      const x = ox + dx * t;
      const y = oy + dy * t;
      const z = oz + dz * t;
      if (y < world.heightAt(x, z) || world.isBlockedAtHeight(x, y, z, 0.04)) {
        let lo = previous;
        let hi = t;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) * 0.5;
          const mx = ox + dx * mid;
          const my = oy + dy * mid;
          const mz = oz + dz * mid;
          if (my < world.heightAt(mx, mz) || world.isBlockedAtHeight(mx, my, mz, 0.04)) hi = mid;
          else lo = mid;
        }
        if (hi < best) {
          best = hi;
          target = null;
        }
        break;
      }
      previous = t;
    }

    this._rawPoint.set(ox + dx * best, oy + dy * best, oz + dz * best);

    // Se o Assist Aim estiver ativo e o jogador estiver mirando (ou com alvo próximo na mira),
    // trava suavemente no ser mais próximo ao jogador.
    if (this.assistEnabled && this.assistTarget && this.active) {
      target = this.assistTarget;
      this.assistLocked = true;
      this._rawPoint.copy(this.assistPoint);
      best = this.origin.distanceTo(this._rawPoint);
    } else {
      this.assistLocked = false;
    }

    this.distance = best;
    this.target = target;

    if (!this._pointInitialized) {
      this.point.copy(this._rawPoint);
      this._pointInitialized = true;
    } else {
      const pointLerp = 1 - Math.exp(-(this.assistLocked ? 38 : 30) * dt);
      this.point.lerp(this._rawPoint, pointLerp);
    }

    const flat = Math.hypot(this.point.x - player.x, this.point.z - player.z);
    this.elevation = Math.max(-0.75, Math.min(0.9, Math.atan2(this.point.y - (player.root.position.y + 1.32), Math.max(flat, 1.5))));

    const speed = player.speedRatio;
    const base = weapon?.spread ?? 0.02;
    const wanted = (this.active ? base * (this.assistLocked ? 0.35 : 0.75) : base * 2.2) + speed * (this.active ? 0.01 : 0.026) + this.bloom;
    this.spread += (wanted - this.spread) * (1 - Math.exp(-16 * dt));
    this.ui.setReticle(true, this.spread, target !== null, this.active, this.assistLocked);
    this.ui.updateLockMarker?.(this.assistPoint, this.assistLocked && this.assistTarget !== null, this.camera);
  }
}
