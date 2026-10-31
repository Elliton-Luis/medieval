import { ROADS, VILLAGES } from "./kingdom.js";
import { MissionState } from "./rpg.js?v=19";

const SIZE = 224;
const RADIUS = SIZE / 2 - 5;
const RANGE = 105; // unidades do mundo da borda ao centro
const SCALE = RADIUS / RANGE;
const CAPITAL = { name: "Caldera", x: -2, z: -20 };

// estradas internas da capital (as externas vêm de kingdom.js)
const CAPITAL_ROADS = [
  [0, 8, 0, -48],
  [-15, -21, 15, -21],
  [-28, 0, -10, 0],
  [9, -26, 30, -26],
  [-25, -26, -14, -26],
];

const RINGS = [0.33, 0.66];
const PLACES = [{ ...CAPITAL, capital: true }, ...VILLAGES];
const _ptA = [0, 0];
const _ptB = [0, 0];

// Minimapa circular que gira com a câmera: o que está à frente fica no alto.
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.timer = 0;
    this.time = 0;
    this.churches = [];
  }

  update(dt, player, cameraYaw, npcs, wanted) {
    if (!this.ctx) return;
    this.time += dt;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1 / 14;
    this._draw(player, cameraYaw, npcs, wanted);
  }

  _project(x, z, px, pz, cos, sin, out = _ptA) {
    const dx = x - px;
    const dz = z - pz;
    // direita da câmera = (cos, -sin); frente = (-sin, -cos)
    out[0] = SIZE / 2 + (dx * cos - dz * sin) * SCALE;
    out[1] = SIZE / 2 + (dx * sin + dz * cos) * SCALE;
    return out;
  }

  _drawRoadList(ctx, list, px, pz, cos, sin) {
    for (let i = 0; i < list.length; i++) {
      const road = list[i];
      this._project(road[0], road[1], px, pz, cos, sin, _ptA);
      this._project(road[2], road[3], px, pz, cos, sin, _ptB);
      ctx.beginPath();
      ctx.moveTo(_ptA[0], _ptA[1]);
      ctx.lineTo(_ptB[0], _ptB[1]);
      ctx.stroke();
    }
  }

  _draw(player, yaw, npcs, wanted) {
    const ctx = this.ctx;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const px = player.x;
    const pz = player.z;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#2a3a2b";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // anéis de distância
    ctx.strokeStyle = "#ffffff12";
    ctx.lineWidth = 1;
    for (let i = 0; i < RINGS.length; i++) {
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, RADIUS * RINGS[i], 0, Math.PI * 2);
      ctx.stroke();
    }

    // estradas
    ctx.lineCap = "round";
    ctx.strokeStyle = "#a99a72";
    ctx.lineWidth = 4;
    this._drawRoadList(ctx, ROADS, px, pz, cos, sin);
    this._drawRoadList(ctx, CAPITAL_ROADS, px, pz, cos, sin);

    // vilas e capital
    ctx.font = "bold 12px Georgia, serif";
    ctx.textAlign = "center";
    for (let i = 0; i < PLACES.length; i++) {
      const place = PLACES[i];
      this._project(place.x, place.z, px, pz, cos, sin, _ptA);
      const sx = _ptA[0];
      const sy = _ptA[1];
      const dist = Math.hypot(sx - SIZE / 2, sy - SIZE / 2);
      if (dist < RADIUS - 6) {
        ctx.fillStyle = "#16201a";
        ctx.beginPath();
        ctx.arc(sx, sy, place.capital ? 10 : 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = place.capital ? "#f0cf7a" : "#d8c58f";
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy + 3);
        ctx.lineTo(sx - 4, sy - 1);
        ctx.lineTo(sx, sy - 4.5);
        ctx.lineTo(sx + 4, sy - 1);
        ctx.lineTo(sx + 4, sy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f3ead2";
        ctx.strokeStyle = "#101713";
        ctx.lineWidth = 4;
        ctx.strokeText(place.name, sx, sy + 21);
        ctx.fillText(place.name, sx, sy + 21);
      } else {
        // marcador na borda indicando a direção
        const angle = Math.atan2(sy - SIZE / 2, sx - SIZE / 2);
        const ex = SIZE / 2 + Math.cos(angle) * (RADIUS - 6);
        const ey = SIZE / 2 + Math.sin(angle) * (RADIUS - 6);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(angle);
        ctx.fillStyle = place.capital ? "#f0cf7a" : "#d8c58f";
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-3, -4);
        ctx.lineTo(-3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // igrejas: onde o jogador desperta ao perecer
    ctx.fillStyle = "#f3ead2";
    ctx.strokeStyle = "#101713";
    ctx.lineWidth = 3;
    for (let i = 0; i < this.churches.length; i++) {
      const church = this.churches[i];
      this._project(church.x, church.z, px, pz, cos, sin, _ptA);
      const cx = _ptA[0];
      const cy = _ptA[1];
      if (Math.hypot(cx - SIZE / 2, cy - SIZE / 2) > RADIUS - 8) continue;
      ctx.strokeRect(cx - 1.5, cy - 6, 3, 12);
      ctx.strokeRect(cx - 5, cy - 2.5, 10, 3);
      ctx.fillRect(cx - 1.5, cy - 6, 3, 12);
      ctx.fillRect(cx - 5, cy - 2.5, 10, 3);
    }

    // NPCs
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(this.time * 6));
    const list = npcs.npcs;
    for (let i = 0; i < list.length; i++) {
      const npc = list[i];
      if (!npc.alive) continue;
      this._project(npc.x, npc.z, px, pz, cos, sin, _ptA);
      const sx = _ptA[0];
      const sy = _ptA[1];
      if (Math.hypot(sx - SIZE / 2, sy - SIZE / 2) > RADIUS - 3) continue;
      if (npc.hostile) {
        ctx.fillStyle = `rgba(255,86,70,${0.55 + 0.45 * pulse})`;
        ctx.beginPath();
        ctx.arc(sx, sy, npc.roleKey === "horse" ? 3 : 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (npc.roleKey === "guard") {
        ctx.fillStyle = npc.mode === "hunt" ? `rgba(255,86,70,${pulse})` : "#78aee0";
        ctx.beginPath();
        ctx.arc(sx, sy, npc.mode === "hunt" ? 5 : 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = npc.mode === "report" ? "#ffd24a" : npc.mode === "flee" ? "#ff9a4a" : "#e8e1c9a0";
        ctx.beginPath();
        ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Waypoint de Missão Ativa (diamante dourado pulsante no radar ou seta dourada na borda com distância em metros)
    let targetX = null;
    let targetZ = null;
    if (MissionState.activeId) {
      if (MissionState.targetLocation) {
        targetX = MissionState.targetLocation.x ?? 0;
        targetZ = MissionState.targetLocation.z ?? 0;
      } else if (MissionState.targetNPC) {
        const root = MissionState.targetNPC.root || MissionState.targetNPC;
        targetX = root.position ? root.position.x : root.x;
        targetZ = root.position ? root.position.z : root.z;
      }
    }

    if (targetX !== null && targetZ !== null) {
      const distM = Math.round(Math.hypot(targetX - px, targetZ - pz));
      this._project(targetX, targetZ, px, pz, cos, sin, _ptA);
      const wx = _ptA[0];
      const wy = _ptA[1];
      const wDist = Math.hypot(wx - SIZE / 2, wy - SIZE / 2);
      const rPulse = 5.5 + 2.5 * pulse;

      if (wDist < RADIUS - 10) {
        // Ondas de radar concêntricas em expansão ao redor do alvo
        ctx.save();
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.85 - 0.7 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx, wy, 8 + pulse * 12, 0, Math.PI * 2);
        ctx.stroke();

        // Diamante dourado de objetivo
        ctx.translate(wx, wy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#ffe26a";
        ctx.strokeStyle = "#181305";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-rPulse * 0.7, -rPulse * 0.7, rPulse * 1.4, rPulse * 1.4);
        ctx.stroke();
        ctx.fill();
        ctx.restore();

        // Texto de distância em metros acima do marcador
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.strokeStyle = "#101010";
        ctx.lineWidth = 3;
        ctx.strokeText(`${distM}m`, wx, wy - 11);
        ctx.fillStyle = "#ffe26a";
        ctx.fillText(`${distM}m`, wx, wy - 11);
      } else {
        // Marcador indicador na borda com seta direcionada
        const wAngle = Math.atan2(wy - SIZE / 2, wx - SIZE / 2);
        const ex = SIZE / 2 + Math.cos(wAngle) * (RADIUS - 8);
        const ey = SIZE / 2 + Math.sin(wAngle) * (RADIUS - 8);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(wAngle);
        ctx.fillStyle = "#ffe26a";
        ctx.strokeStyle = "#181305";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -6);
        ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.restore();

        // Distância em metros ligeiramente recuada da borda
        const distDist = RADIUS - 22;
        const tx = SIZE / 2 + Math.cos(wAngle) * distDist;
        const ty = SIZE / 2 + Math.sin(wAngle) * distDist;
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.strokeStyle = "#101010";
        ctx.lineWidth = 3;
        ctx.strokeText(`${distM}m`, tx, ty + 4);
        ctx.fillStyle = "#ffe26a";
        ctx.fillText(`${distM}m`, tx, ty + 4);
      }

      // Tarja informativa de missão ativa no topo do minimapa
      ctx.save();
      ctx.fillStyle = "rgba(13, 18, 16, 0.88)";
      ctx.strokeStyle = "#d2a969aa";
      ctx.lineWidth = 1;
      const bW = 104;
      const bH = 17;
      const bX = SIZE / 2 - bW / 2;
      const bY = 8;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bX, bY, bW, bH, 3) : ctx.rect(bX, bY, bW, bH);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 10px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe26a";
      ctx.fillText(`✦ ALVO: ${distM}m`, SIZE / 2, bY + 12);
      ctx.restore();
    }

    // jogador: seta apontando para onde o personagem olha
    const facing = player.model.rotation.y;
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    const ax = fx * cos - fz * sin;
    const ay = fx * sin + fz * cos;
    const angle = Math.atan2(ay, ax);
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(angle);
    ctx.fillStyle = wanted > 0 ? "#ff7a64" : "#ffe08a";
    ctx.strokeStyle = "#101713";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
}
