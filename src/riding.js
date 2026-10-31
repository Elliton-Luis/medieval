// Montaria: montar com F, galope com inércia, turbo (Shift) com fôlego, saltos (Space),
// atropelamento, batida em obstáculos e assobio (H) para chamar o cavalo.
import * as THREE from "three";
import { PlayerStats, checkWitnesses } from "./rpg.js?v=11";

const GALLOP = 13.5;
const TURBO = 21;
const TURN_SLOW = 3.4;
const TURN_FAST = 1.5;

const _dismountOffset = new THREE.Vector3(1.5, 0, 0);

/**
 * CORREÇÃO: Lógica de Desmontar do Cavalo.
 * Redefine explicitamente a rotação das pernas ao sair.
 * @param {object} player
 * @param {object} horse
 */
export function dismountHorse(player, horse) {
  if (!player) return;
  player.userData = player.userData || {};
  player.userData.isRiding = false;
  player.userData.mount = null;

  // Posiciona o jogador ao lado do cavalo, não dentro dele
  const hPos = horse?.position || horse?.root?.position;
  if (player.position && hPos) {
    player.position.copy(hPos).add(_dismountOffset);
  }

  // Reseta a pose das pernas (hierarquia de mesh com LegL e LegR)
  const legL = player.children?.find?.((c) => c.name === "LegL") || player.leftLeg;
  const legR = player.children?.find?.((c) => c.name === "LegR") || player.rightLeg;
  if (legL) {
    legL.rotation.x = 0;
    legL.rotation.y = 0;
    legL.rotation.z = 0;
  }
  if (legR) {
    legR.rotation.x = 0;
    legR.rotation.y = 0;
    legR.rotation.z = 0;
  }
  if (player.leftKnee) player.leftKnee.rotation.set(0, 0, 0);
  if (player.rightKnee) player.rightKnee.rotation.set(0, 0, 0);

  player.userData.state = "IDLE";
}

export class RidingSystem {
  constructor({ player, world, input, ui, effects, audio, npcs, combat, cameraRig, horses }) {
    this.player = player;
    this.world = world;
    this.input = input;
    this.ui = ui;
    this.effects = effects;
    this.audio = audio;
    this.npcs = npcs;
    this.combat = combat;
    this.cameraRig = cameraRig;
    this.horses = horses;
    this.myHorse = null;
    this.promptText = null;
    this.dustTimer = 0;
    this.hoofTimer = 0;
    this.trampleTimer = 0;
  }

  get mounted() {
    return this.player.mounted;
  }

  _nearestMountable() {
    let best = null;
    let bestDistance = 3.3 * 3.3;
    for (const horse of this.horses.horses) {
      if (horse.removed || !horse.alive || horse.controlled || horse.hostile) continue;
      const d = (horse.x - this.player.x) ** 2 + (horse.z - this.player.z) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = horse;
      }
    }
    return best;
  }

  _tryMount(horse) {
    const player = this.player;
    // cavalo selvagem: pode empinar e derrubar nas primeiras tentativas
    if (!horse.tamed && horse.wild) {
      if (horse.tame < 2 && Math.random() < 0.72) {
        horse.tame++;
        horse.buck();
        this.audio.neigh();
        horse.flee(player.x, player.z, 2.2);
        this.cameraRig.addShake(0.25);
        this.combat.hurtPlayer(1, horse.x, horse.z, { knock: 8, weapon: "trample" });
        this.ui.showToast("O cavalo empinou e te derrubou!");
        return;
      }
    }
    // Se o cavalo estava comendo isca de feno, consome o feno e recolhe ao pool
    if (horse.userData?.targetHay) {
      horse.userData.targetHay.visible = false;
      horse.userData.targetHay = null;
      horse.userData.state = "";
    }
    // roubar o cavalo de um NPC é crime se testemunhado
    if (horse.owner && horse.owner.alive) {
      const owner = horse.owner;
      const witnessed = checkWitnesses(horse.root.position, this.npcs.npcs, undefined, false);
      if (witnessed && (owner.x - horse.x) ** 2 + (owner.z - horse.z) ** 2 < 32 * 32) {
        owner.reportTarget = this.npcs._nearestGuard(owner);
        owner.startAlert("report", 28, player.x, player.z);
        this.effects.play("alert", owner.x, owner.root.position.y + 2.4, owner.z, "#ffffff", 1);
        this.ui.showToast(`${owner.name}: "Ladrão de cavalos! Guardas!"`);
        this.npcs.notifyCrime(horse.x, horse.z, 26, null, 0.6);
      }
      horse.owner = null;
    }
    horse.wild = false;
    horse.tamed = true;
    horse.controlled = true;
    horse.stay = false;
    horse.state = "stand";
    horse.name = "Seu cavalo";
    horse.task = "Montado";
    player.mounted = horse;
    player.userData.isRiding = true;
    player.userData.mount = horse;
    player.userData.state = "RIDING";
    player.blockLocked = true;
    player.vx = 0;
    player.vz = 0;
    this.myHorse = horse;
    this.ui.showToast("Montaste o cavalo · Shift: turbo · Espaço: saltar · F: desmontar");
  }

  dismount(forced = false) {
    const player = this.player;
    const horse = player.mounted;
    if (!horse) return;
    dismountHorse(player, horse);
    const side = horse.heading + Math.PI / 2;
    const sideX = horse.x + Math.sin(side) * 1.5;
    const sideZ = horse.z + Math.cos(side) * 1.5;
    const offsetFree = !this.world.isBlockedAt(player.position.x, player.position.z, player.radius);
    const sideFree = !this.world.isBlockedAt(sideX, sideZ, player.radius);
    player.x = sideFree ? sideX : offsetFree ? player.position.x : horse.x;
    player.z = sideFree ? sideZ : offsetFree ? player.position.z : horse.z;
    player.root.position.set(player.x, this.world.heightAt(player.x, player.z), player.z);
    player.mounted = null;
    player.vx = 0;
    player.vz = 0;
    horse.controlled = false;
    horse.stay = true;
    horse.state = "stand";
    horse.speed = 0;
    horse.height = 0;
    horse.vy = 0;
    horse.fieldTimer = 3;
    this.ui.setStamina(null);
    this.cameraRig.setRide(0);
    if (!forced) this.ui.showToast("Desmontaste · H assobia para chamar o cavalo");
  }

  update(dt, cameraYaw) {
    const player = this.player;
    const input = this.input;
    this.trampleTimer = Math.max(0, this.trampleTimer - dt);

    if (input.consumeWhistlePressed() && !player.knockedOut && !player.dead) {
      const horse = this.myHorse;
      if (!horse || !horse.alive || horse.removed) {
        this.ui.showToast("Ainda não tens um cavalo");
      } else if (player.mounted) {
        this.ui.showToast("Já estás montado");
      } else if ((horse.x - player.x) ** 2 + (horse.z - player.z) ** 2 > 170 * 170) {
        this.ui.showToast("O cavalo está longe demais para ouvir");
      } else {
        this.audio.whistle();
        horse.summon();
        this.ui.showToast("Assobiaste ao teu cavalo");
      }
    }

    if (player.knockedOut || player.dead) {
      if (player.mounted) this.dismount(true);
      return;
    }

    if (input.consumeMountPressed()) {
      if (player.mounted) this.dismount();
      else {
        const horse = this._nearestMountable();
        if (horse) this._tryMount(horse);
      }
    }

    if (!player.mounted) {
      const near = this._nearestMountable();
      this.promptText = near ? (near.owner ? "F · roubar cavalo" : near.tamed ? "F · montar" : "F · montar cavalo selvagem") : null;
      this.ui.setStamina(null);
      this.cameraRig.setRide(0);
      return;
    }
    this.promptText = null;
    this._ride(dt, cameraYaw, player.mounted);
  }

  _ride(dt, cameraYaw, horse) {
    const player = this.player;
    const input = this.input;
    const world = this.world;

    input.readMovement(player._move);
    const forward = player._move.z;
    const strafe = player._move.x;
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    let dirX = strafe * cos - forward * sin;
    let dirZ = -strafe * sin - forward * cos;
    const length = Math.hypot(dirX, dirZ);
    const steering = length > 0.05;
    const braking = forward < -0.5 && !steering ? true : forward < -0.5 && Math.abs(strafe) < 0.1;

    // turbo gasta o fôlego do cavalo (escalado pelo atributo Velocidade do jogador)
    const speedMult = PlayerStats.getSpeedMult();
    const wantsTurbo = player._move.run && steering && !braking;
    const turbo = wantsTurbo && player.stamina > 4;
    const drainRate = 24 / Math.max(0.7, speedMult);
    const regenRate = (steering ? 6 : 16) * speedMult;
    player.stamina = Math.max(0, Math.min(100, player.stamina + (turbo ? -drainRate : regenRate) * dt));
    this.ui.setStamina(player.stamina / 100);

    let wantSpeed = 0;
    if (steering && !braking) wantSpeed = (turbo ? TURBO : GALLOP) * Math.min(1.3, 0.85 + speedMult * 0.15);
    const grounded = horse.height <= 0.02;
    const accel = grounded ? (wantSpeed > horse.speed ? (turbo ? 10 : 7.5) : braking ? 26 : 9) : 1.5;
    horse.speed += Math.max(-accel * dt, Math.min(accel * dt, wantSpeed - horse.speed));
    if (braking && horse.speed < 0.3) horse.speed = 0;

    // direção com inércia: gira devagar em alta velocidade e derrapa nas curvas fechadas
    if (steering) {
      const target = Math.atan2(dirX / length, dirZ / length);
      const diff = Math.atan2(Math.sin(target - horse.heading), Math.cos(target - horse.heading));
      const speedRatio = Math.min(1, horse.speed / TURBO);
      const rate = (TURN_SLOW + (TURN_FAST - TURN_SLOW) * speedRatio) * (grounded ? 1 : 0.4);
      horse.heading += Math.max(-rate * dt, Math.min(rate * dt, diff));
      if (Math.abs(diff) > 1.1 && horse.speed > 10 && grounded) {
        horse.speed *= Math.exp(-1.6 * dt);
        this.dustTimer -= dt * 3;
      }
    }

    // salto
    if (input.consumeJumpPressed() && grounded) {
      horse.vy = 8.2;
      horse.height = 0.05;
      this.audio.neigh(0.5);
    }
    if (horse.height > 0.02 || horse.vy > 0) {
      horse.vy -= 22 * dt;
      horse.height = Math.max(0, horse.height + horse.vy * dt);
      if (horse.height <= 0) {
        horse.height = 0;
        horse.vy = 0;
        this.effects.play("dust", horse.x, world.heightAt(horse.x, horse.z) + 0.1, horse.z, "#cdbb97", 1);
        this.cameraRig.addShake(0.08);
      }
    }

    // movimento em sub-passos (não atravessa paredes em alta velocidade).
    // Pedra: o cavalo passa por cima. Árvore: bate e machuca. Paredes e afins: só barram.
    const total = horse.speed * dt;
    const steps = Math.max(1, Math.ceil(total / 0.35));
    const stepLength = total / steps;
    let hitTree = false;
    for (let i = 0; i < steps && !hitTree; i++) {
      const nx = horse.x + Math.sin(horse.heading) * stepLength;
      const nz = horse.z + Math.cos(horse.heading) * stepLength;
      const front = this._probeObstacle(horse, nx, nz);
      if (!front) {
        horse.x = nx;
        horse.z = nz;
      } else if (front === "tree" && horse.speed > 5) {
        hitTree = true;
      } else if (!this._probeObstacle(horse, nx, horse.z)) {
        horse.x = nx;
        horse.speed *= 0.9;
      } else if (!this._probeObstacle(horse, horse.x, nz)) {
        horse.z = nz;
        horse.speed *= 0.9;
      } else {
        horse.speed *= 0.5;
      }
    }
    if (hitTree) {
      const speed = horse.speed;
      horse.speed = 0;
      horse.buck();
      this.audio.neigh();
      this.cameraRig.addShake(0.5);
      this.dismount(true);
      this.combat.hurtPlayer(speed > 16 ? 2 : 1, horse.x - Math.sin(horse.heading), horse.z - Math.cos(horse.heading), { knock: 6, weapon: "blunt" });
      this.ui.showToast("Bateste numa árvore!");
      return;
    }

    // atropela quem estiver no caminho
    if (horse.speed > 7 && this.trampleTimer <= 0) {
      for (const npc of this.npcs.npcs) {
        if (!npc.alive || npc === horse || npc.controlled || npc.roleKey === "horse") continue;
        const dx = npc.x - horse.x;
        const dz = npc.z - horse.z;
        if (dx * dx + dz * dz > 1.35 * 1.35) continue;
        const inverse = 1 / Math.max(0.001, Math.hypot(dx, dz));
        this.combat.damageNPC(npc, horse.speed > 15 ? 3 : 2, dx * inverse, dz * inverse, "#ffd89a", 1.2, 9 + horse.speed * 0.4, 1.4);
        this.trampleTimer = 0.25;
        this.cameraRig.addShake(0.15);
        break;
      }
    }

    horse._animate(dt);

    // o jogador acompanha a sela
    player.x = horse.x;
    player.z = horse.z;
    player.speedRatio = Math.min(1, horse.speed / TURBO);
    player.vx = Math.sin(horse.heading) * horse.speed;
    player.vz = Math.cos(horse.heading) * horse.speed;
    player.grounded = true;
    player.model.rotation.y = horse.heading;
    player.root.position.set(horse.x, horse.root.position.y + 0.62 + horse.bob, horse.z);

    // sensação de velocidade: poeira, cascos e balanço da câmera
    this.dustTimer -= dt;
    if (horse.speed > 8 && this.dustTimer <= 0 && horse.height < 0.1) {
      this.dustTimer = turbo ? 0.07 : 0.13;
      this.effects.play("dust", horse.x - Math.sin(horse.heading) * 1.1, world.heightAt(horse.x, horse.z) + 0.15, horse.z - Math.cos(horse.heading) * 1.1, "#cdbb97", turbo ? 1.0 : 0.7);
    }
    this.hoofTimer -= dt;
    if (horse.speed > 2 && horse.height < 0.1 && this.hoofTimer <= 0) {
      this.hoofTimer = Math.max(0.14, 0.62 - horse.speed * 0.028);
      this.audio.hoof(horse.speed / TURBO);
    }
    // galope: só um balanço suave da câmera, no ritmo da passada
    this.cameraRig.setRide(horse.speed > 3 ? Math.min(1, horse.speed / 14) * (turbo ? 1.2 : 1) : 0);
  }

  _probeObstacle(horse, x, z) {
    const world = this.world;
    const airborne = horse.height > 0.2;
    const found = world.obstacleAt(x, z, 0.7);
    if (found === "rock") return null;
    if (airborne && found !== "tree" && !world.isBlockedAtHeight(x, world.heightAt(horse.x, horse.z) + horse.height + 0.7, z, 0.7)) return null;
    return found;
  }
}
