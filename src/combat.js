import {
  PlayerStats,
  PlayerEquipment,
  NPC_TYPES,
  checkWitnesses,
  handleNPCDeath,
  notifyMissionFistHit,
  spawnLoot,
  takeDamage,
  syncPlayerStatsToPlayer,
} from "./rpg.js?v=16";

export class CombatSystem {
  constructor(player, npcs, input, effects, ui, settlement, audio, cameraRig) {
    this.audio = audio;
    this.drops = null;
    this.cameraRig = cameraRig;
    this.comboStep = 0;
    this.comboTimer = 0;
    this.pendingHit = 0;
    this.pendingYaw = 0;
    this.pendingStep = 0;
    this.pendingDef = null;
    this.pendingCharge = 0;
    this.player = player;
    this.npcs = npcs;
    this.input = input;
    this.effects = effects;
    this.ui = ui;
    this.respawnPoint = settlement.well;
    this.churches = settlement.churches || [];
    this.deathScreen = null;
    this.damageFx = null;
    this.houses = null;
    this.aim = null;
    this.attackCooldown = 0;
    this.guardCooldown = 0;
    this.armorCooldown = 0;
    this.knockoutTimer = 0;
  }

  update(dt) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.comboTimer > 0) this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.pendingHit > 0) {
      this.pendingHit -= dt;
      if (this.pendingHit <= 0) this._resolveSwing(this.pendingYaw, this.pendingStep, this.pendingDef, this.pendingCharge);
    }
    this.guardCooldown = Math.max(0, this.guardCooldown - dt);
    this.armorCooldown = Math.max(0, this.armorCooldown - dt);
    if (this.knockoutTimer > 0) {
      this.knockoutTimer -= dt;
      if (this.knockoutTimer <= 0) this.respawnAtChurch();
      return;
    }

    if (this.input.consumeUsePressed()) this._usePotion();
    this._guardCounter(dt);
  }

  // Ataque corpo a corpo da arma em mãos: combo de 3 golpes nas armas leves e golpe
  // carregado (charge 0..1) nas pesadas. Retorna false se ainda estiver em recarga.
  attackMelee(cameraYaw, def, charge = 0) {
    if (this.attackCooldown > 0 || this.pendingHit > 0) return false;
    this.player.cancelBlock();

    // Se a assistência de mira estiver ativa, orienta o golpe para o ser vivo mais próximo ao alcance
    if (this.aim?.assistEnabled) {
      const target = this.aim.findNearestBeing(this.player, (def.reach ?? 2.2) + 2.6);
      if (target) {
        const dx = target.x - this.player.x;
        const dz = target.z - this.player.z;
        if (dx * dx + dz * dz > 0.04) {
          cameraYaw = Math.atan2(-dx, -dz);
        }
      }
    }

    const light = Boolean(def.combo);
    const step = light && this.comboTimer > 0 ? (this.comboStep + 1) % 3 : 0;
    const finisher = light && step === 2;
    this.comboStep = step;
    this.comboTimer = light && !finisher ? 1.1 : 0;
    this.attackCooldown = def.cooldown * (finisher ? 1.5 : 1) * (charge > 0.3 ? 1.25 : 1);
    const length = def.length * (finisher ? 1.15 : 1);
    this.player.startAttack(def.anim[step % def.anim.length], length);
    this.player.faceYaw = cameraYaw + Math.PI;
    this.player.faceTimer = 0.5;
    this.audio.weaponSwing(def.sound, def.hands === 2 || finisher);

    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const lunge = (def.lunge ?? 3.4) * (finisher ? 1.4 : 1) * (1 + charge * 0.3);
    this.player.vx += forwardX * lunge;
    this.player.vz += forwardZ * lunge;

    this.pendingYaw = cameraYaw;
    this.pendingStep = step;
    this.pendingDef = def;
    this.pendingCharge = charge;
    this.pendingHit = def.hitDelay * (1 + charge * 0.2);
    return true;
  }

  _resolveSwing(cameraYaw, step, def, charge) {
    const light = Boolean(def.combo);
    const finisher = light && step === 2;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const player = this.player;
    // lança e alabarda a cavalo: mais alcance e dano com o galope
    const charging = player.mounted && def.pole && player.mounted.speed > 7;
    const reach = def.reach + (charging ? 1.1 : 0);
    const minFacing = def.arc;
    const baseDamage = def.damage + (finisher ? 1 : 0) + (charge > 0.6 ? 1 : 0) + (charging ? 1 : 0);
    const damage = Math.max(1, Math.round(baseDamage * PlayerStats.getMeleeMult() * PlayerEquipment.getWeaponMult() * 10) / 10);
    const knock = def.knock * (finisher ? 1.35 : 1) * (1 + charge * 0.8) * PlayerStats.getMeleeMult();
    const launch = def.launch ? def.launch * (0.5 + charge) : finisher ? 0.8 : 0;
    const big = def.hands === 2 || finisher;
    const color = def.type === "fists" ? "#f3dfaa" : big ? "#ffd89a" : "#f3dfaa";
    if (def.type !== "fists") this.effects.play("slash", player.x + forwardX * 1.3, player.root.position.y + 1.2, player.z + forwardZ * 1.3, color, big ? 2.3 : 1.7);

    let hitCount = 0;
    for (let i = 0; i < this.npcs.npcs.length; i++) {
      const npc = this.npcs.npcs[i];
      if (!npc.alive || npc.controlled) continue;
      const dx = npc.x - player.x;
      const dz = npc.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance > reach + (npc.hitRadius ?? 0.4) || distance < 0.0001) continue;
      const directionX = dx / distance;
      const directionZ = dz / distance;
      if (directionX * forwardX + directionZ * forwardZ < minFacing) continue;
      // Missão "A Cobrança" (DEBT): se o jogador usar Punhos no devedor, não o mata e registra o soco
      const isDebtorFistHit = def.type === "fists" && Boolean(npc.root?.userData?.isMissionDebtor);
      const effectiveDamage = isDebtorFistHit ? Math.min(damage, Math.max(0, npc.health - 2)) : damage;
      this.damageNPC(npc, effectiveDamage, directionX, directionZ, big ? "#ffcf7a" : "#f5d36e", big ? 1.2 : 0.95, knock, launch);
      if (isDebtorFistHit) {
        notifyMissionFistHit(npc.root);
      }
      hitCount++;
    }
    if (this.houses?.hitAt(player.x + forwardX * 1.5, player.root.position.y + 1.0, player.z + forwardZ * 1.5, 1.0, def.damage)) hitCount++;
    if (hitCount > 0) this.cameraRig.addShake(big ? 0.22 + charge * 0.12 : 0.1);
    else if (big) this.effects.play("smoke", player.x + forwardX * 1.9, player.root.position.y + 0.35, player.z + forwardZ * 1.9, "#cdbb97", 0.9);
  }

  damageNPC(npc, amount, directionX, directionZ, color = "#f5d36e", size = 0.95, force = 1.8, launch = 0, headshot = false, silent = false) {
    if (!npc.alive) return false;
    const defeated = npc.takeHit(amount, directionX, directionZ, force, launch);
    if (npc.roleKey === "werewolf") {
      if (defeated) {
        PlayerStats.cha += 1;
        spawnLoot(npc.root ? npc.root.position : { x: npc.x, z: npc.z }, 35);
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast("Lobisomem abatido! +35 moedas · Carisma +1");
      }
    } else if (npc.temporary) {
      if (defeated && npc.hostile && npc.roleKey !== "horse") this.npcs.addWantedPoints(0.3);
    } else if (defeated) {
      handleNPCDeath(npc.root, this.npcs.npcs);
    } else {
      const data = npc.root?.userData;
      const isProvenBandit = data && data.type === NPC_TYPES.BANDIT && data.hasStolenGems;
      if (!isProvenBandit) {
        const witnessed = checkWitnesses(npc.root ? npc.root.position : { x: npc.x, y: 0, z: npc.z }, this.npcs.npcs, undefined, false);
        if (witnessed || npc.roleKey === "guard") {
          this.npcs.notifyCrime(npc.x, npc.z, 24, npc, 0.25);
        } else if (npc.mode === "work") {
          npc.startAlert("flee", 5.5, this.player.x, this.player.z);
        }
      }
    }
    if (defeated) this.drops?.spawnFor(npc, force > 8 ? 1.7 : 1);
    this.effects.play("star", npc.x, npc.root.position.y + (headshot ? 1.8 : 1.35), npc.z, color, size);
    this.ui.hitMarker(defeated, headshot);
    if (!silent) this.audio.hit(defeated);
    if (defeated) {
      this.effects.play("smoke", npc.x, npc.root.position.y + 0.9, npc.z, "#d4c9ad", 1.55);
      if (!silent) this.ui.showToast(`${npc.name} foi derrotado${headshot ? " · tiro na cabeça" : ""}`);
    } else if (!silent) {
      this.ui.showToast(`${npc.name} · ${npc.health}/${npc.maxHealth} vigor`);
    }
    return defeated;
  }

  // Os golpes dos inimigos vêm do cérebro corpo a corpo (melee.js): fichas, preparação e recarga.
  _guardCounter() {}

  // Ponto único de dano ao jogador: aqui o escudo bloqueia o que vem pela frente.
  hurtPlayer(amount, fromX, fromZ, options = {}) {
    const player = this.player;
    if (player.health <= 0 || player.rolling || player.knockedOut || player.invuln > 0) return "ignored";
    const dx = player.x - fromX;
    const dz = player.z - fromZ;
    const inverse = 1 / Math.max(0.001, Math.hypot(dx, dz));
    const awayX = dx * inverse;
    const awayZ = dz * inverse;
    if (player.blocking) {
      const frontX = Math.sin(player.faceYaw);
      const frontZ = Math.cos(player.faceYaw);
      // dot entre a frente do escudo e a direção de onde veio o golpe
      if (-awayX * frontX - awayZ * frontZ > 0.2) {
        this.effects.play("star", player.x + frontX * 0.75, player.root.position.y + 1.2, player.z + frontZ * 0.75, "#cfe0ff", 1.15);
        this.audio.block();
        this.cameraRig.addShake(0.12);
        player.vx += awayX * (options.knock ?? 3) * 0.35;
        player.vz += awayZ * (options.knock ?? 3) * 0.35;
        player.invuln = 0.3;
        this.ui.showToast("Bloqueado!");
        return "blocked";
      }
    }
    this._damagePlayer(amount, awayX, awayZ, options.knock ?? 3.4, options.weapon || "blade");
    return "hit";
  }

  _damagePlayer(amount, awayX, awayZ, knock = 3.4, weapon = "blade") {
    if (this.player.health <= 0 || this.player.rolling) return;
    // Chance passiva de deflexão da armadura (0% a 70%) e redução pelo Colar da Bênção (15%)
    const dmgCheck = takeDamage(amount);
    if (dmgCheck.negated) {
      return;
    }
    if (this.player.armorLevel > 0 && this.armorCooldown <= 0 && PlayerEquipment.armorNegationChance <= 0) {
      this.armorCooldown = 1.6;
      this.effects.play("star", this.player.x, this.player.root.position.y + 1.5, this.player.z, "#d9c77e", 1.1);
      this.ui.showToast("A armadura absorveu o golpe.");
      return;
    }
    const actualDamage = dmgCheck.finalDamage;
    if (actualDamage <= 0) {
      this.ui.showToast("O Colar da Bênção protegeu você do golpe!");
      return;
    }
    this.player.health = Math.max(0, this.player.health - actualDamage);
    this.player.knockBack(awayX, awayZ, knock);
    this.player.invuln = 0.5;
    this.audio.impact(weapon);
    this.audio.pain();
    this.cameraRig.addShake(0.24);
    this.damageFx?.flash(1);
    this.effects.play("star", this.player.x, this.player.root.position.y + 1.5, this.player.z, "#e6d6a6", 0.9);
    if (this.player.health === 0) {
      this.player.knockedOut = true;
      this.player.die(awayX, awayZ);
      // perde uma parte do ouro ao perecer
      const coins = this.player.coins;
      const lost = Math.min(coins, Math.max(5, Math.ceil(coins * 0.3)));
      this.player.coins -= lost;
      PlayerStats.gold = this.player.coins;
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.effects.play("smoke", this.player.x, this.player.root.position.y + 0.8, this.player.z, "#d4c9ad", 1.6);
      this.audio.hit(true);
      this.deathScreen?.start({ coinsLost: lost });
    } else {
      this.ui.showToast(`Vitalidade ${this.player.health}/${this.player.maxHealth}`);
    }
  }

  // Acorda o jogador na igreja mais próxima de onde ele pereceu.
  respawnAtChurch() {
    const player = this.player;
    let church = null;
    let best = Infinity;
    for (const candidate of this.churches) {
      const d = (candidate.x - player.x) ** 2 + (candidate.z - player.z) ** 2;
      if (d < best) {
        best = d;
        church = candidate;
      }
    }
    const spot = church ? church.spawn : { x: this.respawnPoint.x + 2.5, z: this.respawnPoint.z + 1.8 };
    player.x = spot.x;
    player.z = spot.z;
    player.root.position.set(player.x, player.world.heightAt(player.x, player.z), player.z);
    player.root.visible = true;
    player.revive();
    player.health = player.maxHealth;
    player.knockedOut = false;
    player.vx = 0;
    player.vz = 0;
    player.verticalOffset = 0;
    player.verticalSpeed = 0;
    player.grounded = true;
    if (church) {
      // de frente para a porta da igreja
      player.model.rotation.y = Math.atan2(church.x - spot.x, church.z - spot.z);
    }
    this.input.setModalOpen(false);
    this.drops?.clear();
    this.npcs.clearWanted();
    this.ui.setVitals(player.health, player.maxHealth, player.coins, player.potions);
    this.ui.showToast(church ? `Despertaste na ${church.name}` : "Despertaste na vila");
  }

  _usePotion() {
    if (!this.player.potions) {
      this.ui.showToast("Você não tem poções.");
      return;
    }
    if (this.player.health >= this.player.maxHealth) {
      this.ui.showToast("Sua vitalidade já está cheia.");
      return;
    }
    this.player.potions--;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + 2);
    this.effects.play("star", this.player.x, this.player.root.position.y + 1.1, this.player.z, "#9dd69a", 1.1);
    this.ui.showToast("Poção usada · +2 vitalidade");
    this.ui.setVitals(this.player.health, this.player.maxHealth, this.player.coins, this.player.potions);
  }
}
