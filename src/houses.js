// Sistema das casas: portas com animação, interiores (telhado e paredes somem ao entrar),
// mobília interativa e destrutível, baús, camas e reação dos donos.
import {
  PlayerStats,
  PlayerEquipment,
  interactWithChest,
  checkWitnesses,
  syncPlayerStatsToPlayer,
} from "./rpg.js?v=11";

const LOOT_CHEST = { coins: [8, 20], items: [["potion", 0.3], ["gem", 0.2], ["bread", 0.4], ["bolts", 0.3], ["arrows", 0.3]] };
const _targetScratch = { type: null, house: null, data: null, label: null };

const SCRIPTURE_VERSES = [
  "«Livro I das Crônicas de Caldera: Quando a noite desce sobre os vales, só a chama da fé e a vigília das tochas guardam os justos das feras da floresta.»",
  "«Livro II dos Salmos da Montanha: Bem-aventurado o que reparte o pão com o mendigo na praça, pois sua estima diante do povo brilhará como ouro.»",
  "«Livro III da Ordem Real: Aquele que busca redenção no altar encontrará abrigo sob o teto sagrado e perdão para suas faltas.»",
];

export class HouseSystem {
  constructor({ houses, player, ui, effects, audio, npcs, drops, sleep, candle, wells = [], townBenches = [] }) {
    this.houses = houses;
    this.player = player;
    this.ui = ui;
    this.effects = effects;
    this.audio = audio;
    this.npcs = npcs;
    this.drops = drops;
    this.sleep = sleep;
    this.candle = candle;
    this.wells = wells;
    this.townBenches = townBenches;
    this.current = null;
    this.target = null;
    this.promptText = null;
    this._wellCooldown = 0;
    this._altarBlessCooldown = 0;
    this._scriptureIndex = 0;
  }

  // Dono de cada casa: o morador civil mais próximo que ainda não tem casa.
  assignOwners() {
    const taken = new Set();
    for (const house of this.houses) {
      if (house.type !== "home") continue;
      let best = null;
      let bestDistance = 45 * 45;
      for (const npc of this.npcs.npcs) {
        if (npc.temporary || npc.roleKey === "guard" || taken.has(npc)) continue;
        const d = (npc.spawnX - house.x) ** 2 + (npc.spawnZ - house.z) ** 2;
        if (d < bestDistance) {
          bestDistance = d;
          best = npc;
        }
      }
      if (best) {
        house.owner = best;
        taken.add(best);
      }
    }
  }

  _ownerSees(house) {
    const owner = house.owner;
    if (!owner || !owner.alive || owner.mode !== "work" || owner.root?.userData?.isSleeping) return false;
    return checkWitnesses({ x: this.player.x, y: this.player.root.position.y, z: this.player.z }, [owner], undefined, false);
  }

  // Invasão ou furto à vista do dono: grita e corre para chamar os guardas.
  _reportIntruder(house, text, severity) {
    if (house.type !== "home" || !this._ownerSees(house) || house.enterCooldown > 0) return;
    house.enterCooldown = 45;
    const owner = house.owner;
    owner.reportTarget = this.npcs._nearestGuard(owner);
    owner.startAlert("report", 28, this.player.x, this.player.z);
    this.effects.play("alert", owner.x, owner.root.position.y + 2.4, owner.z, "#ffffff", 1);
    this.ui.showToast(`${owner.name}: "${text}"`);
    this.npcs.notifyCrime(owner.x, owner.z, 18, null, severity);
  }

  update(dt) {
    const player = this.player;
    if (this._wellCooldown > 0) this._wellCooldown = Math.max(0, this._wellCooldown - dt);
    if (this._altarBlessCooldown > 0) this._altarBlessCooldown = Math.max(0, this._altarBlessCooldown - dt);

    let inside = null;
    let nearestDistance = 3.1 * 3.1;
    let hasTarget = false;

    // Se o jogador já está sentado ou ajoelhado em oração, prioriza o comando de rezar/levantar
    if (player.sitting || player.praying) {
      hasTarget = true;
      _targetScratch.house = this.current;
      _targetScratch.data = null;
      if (player.sitting && player.sittingInChurch) {
        _targetScratch.type = "church_pew_active";
        _targetScratch.label = player.praying
          ? "E · encerrar oração no banco | WASD / Espaço · levantar"
          : "E · rezar sentado no banco | WASD / Espaço · levantar";
      } else if (player.praying) {
        _targetScratch.type = "stand_up";
        _targetScratch.label = "E / WASD / Espaço · levantar da oração";
      } else {
        _targetScratch.type = "stand_up";
        _targetScratch.label = "E / WASD / Espaço · levantar do banco";
      }
    }

    for (let i = 0; i < this.houses.length; i++) {
      const house = this.houses[i];
      if (house.enterCooldown > 0) house.enterCooldown -= dt;
      if (house.holyFont && house.holyFont.cooldown > 0) {
        house.holyFont.cooldown = Math.max(0, house.holyFont.cooldown - dt);
      }
      if (house.bellRope && house.bellRope.swingTimer > 0) {
        house.bellRope.swingTimer = Math.max(0, house.bellRope.swingTimer - dt);
        if (house.bellRope.bellPivot) {
          house.bellRope.bellPivot.rotation.x = Math.sin(house.bellRope.swingTimer * 7.5) * 0.55 * (house.bellRope.swingTimer / 4.5);
        }
      }

      const dx = player.x - house.x;
      const dz = player.z - house.z;
      const distanceSq = dx * dx + dz * dz;

      // porta: abre e fecha suavemente
      const door = house.door;
      door.angle += (door.target - door.angle) * (1 - Math.exp(-9 * dt));
      door.pivot.rotation.y = door.angle;
      if (house.chest.opened && house.chest.openAmount < 1 && house.chest.lid) {
        house.chest.openAmount = Math.min(1, house.chest.openAmount + dt * 3);
        house.chest.lid.rotation.x = -house.chest.openAmount * 1.7;
      }
      if (distanceSq > 16 * 16) continue;
      const isPlayerInside = house.contains(player.x, player.z);
      if (!inside && isPlayerInside && !player.mounted) inside = house;

      if (player.sitting || player.praying) continue;

      // interagíveis perto (Zero-GC)
      const doorDistSq = (player.x - door.x) ** 2 + (player.z - door.z) ** 2;
      if (doorDistSq < 2.0 * 2.0 && doorDistSq < nearestDistance) {
        nearestDistance = doorDistSq;
        _targetScratch.type = "door";
        _targetScratch.house = house;
        _targetScratch.data = null;
        _targetScratch.label =
          house.type === "church"
            ? door.open
              ? "E · fechar porta da igreja"
              : "E · abrir porta da igreja"
            : door.open
              ? "E · fechar porta"
              : "E · abrir porta";
        hasTarget = true;
      }

      if (isPlayerInside) {
        // Bancos internos (bancos da igreja ou bancos da casa/pousada)
        if (house.seats) {
          for (let s = 0; s < house.seats.length; s++) {
            const seat = house.seats[s];
            const sDistSq = (player.x - seat.x) ** 2 + (player.z - seat.z) ** 2;
            if (sDistSq < 1.35 * 1.35 && sDistSq < nearestDistance) {
              nearestDistance = sDistSq;
              _targetScratch.type = "seat";
              _targetScratch.house = house;
              _targetScratch.data = seat;
              _targetScratch.label = seat.label || "E · sentar no banco";
              hasTarget = true;
            }
          }
        }

        if (house.type === "church") {
          // Altar-Mor Sagrado
          if (house.altar) {
            const aDistSq = (player.x - house.altar.x) ** 2 + (player.z - house.altar.z) ** 2;
            if (aDistSq < 1.9 * 1.9 && aDistSq < nearestDistance) {
              nearestDistance = aDistSq;
              _targetScratch.type = "altar";
              _targetScratch.house = house;
              _targetScratch.data = house.altar;
              _targetScratch.label = "E · ajoelhar e rezar no altar";
              hasTarget = true;
            }
          }
          // Pia de Água Benta
          if (house.holyFont) {
            const fDistSq = (player.x - house.holyFont.x) ** 2 + (player.z - house.holyFont.z) ** 2;
            if (fDistSq < 1.75 * 1.75 && fDistSq < nearestDistance) {
              nearestDistance = fDistSq;
              _targetScratch.type = "holy_font";
              _targetScratch.house = house;
              _targetScratch.data = house.holyFont;
              _targetScratch.label = "E · benzer-se na pia de água benta";
              hasTarget = true;
            }
          }
          // Corda do Sino da Torre
          if (house.bellRope) {
            const bDistSq = (player.x - house.bellRope.x) ** 2 + (player.z - house.bellRope.z) ** 2;
            if (bDistSq < 1.75 * 1.75 && bDistSq < nearestDistance) {
              nearestDistance = bDistSq;
              _targetScratch.type = "bell_rope";
              _targetScratch.house = house;
              _targetScratch.data = house.bellRope;
              _targetScratch.label = "E · tocar o sino da igreja";
              hasTarget = true;
            }
          }
          // Caixa de Ofertas da Igreja
          if (house.offeringBox) {
            const oDistSq = (player.x - house.offeringBox.x) ** 2 + (player.z - house.offeringBox.z) ** 2;
            if (oDistSq < 1.75 * 1.75 && oDistSq < nearestDistance) {
              nearestDistance = oDistSq;
              _targetScratch.type = "offering_box";
              _targetScratch.house = house;
              _targetScratch.data = house.offeringBox;
              _targetScratch.label = "E · depositar oferta na igreja (5 moedas · +1 CAR)";
              hasTarget = true;
            }
          }
          // Atril das Escrituras Sagradas
          if (house.lectern) {
            const lDistSq = (player.x - house.lectern.x) ** 2 + (player.z - house.lectern.z) ** 2;
            if (lDistSq < 1.75 * 1.75 && lDistSq < nearestDistance) {
              nearestDistance = lDistSq;
              _targetScratch.type = "lectern";
              _targetScratch.house = house;
              _targetScratch.data = house.lectern;
              _targetScratch.label = "E · ler as Crônicas Sagradas no atril";
              hasTarget = true;
            }
          }
        } else {
          if (!house.chest.opened) {
            const chestDistSq = (player.x - house.chest.x) ** 2 + (player.z - house.chest.z) ** 2;
            if (chestDistSq < 1.8 * 1.8 && chestDistSq < nearestDistance) {
              nearestDistance = chestDistSq;
              _targetScratch.type = "chest";
              _targetScratch.house = house;
              _targetScratch.data = null;
              _targetScratch.label = "E · abrir baú";
              hasTarget = true;
            }
          }
          const bedDistSq = (player.x - house.bed.x) ** 2 + (player.z - house.bed.z) ** 2;
          if (bedDistSq < 2.3 * 2.3 && bedDistSq < nearestDistance) {
            nearestDistance = bedDistSq;
            _targetScratch.type = "bed";
            _targetScratch.house = house;
            _targetScratch.data = null;
            _targetScratch.label = house.price > 0 ? `E · dormir (${house.price} moedas)` : "E · dormir";
            hasTarget = true;
          }
        }
      }
    }

    // Interagíveis externos (Bancos da Praça e Poços de Água) quando em pé e fora de montaria
    if (!player.sitting && !player.praying && !player.mounted) {
      if (this.townBenches) {
        for (let i = 0; i < this.townBenches.length; i++) {
          const bench = this.townBenches[i];
          const bDistSq = (player.x - bench.x) ** 2 + (player.z - bench.z) ** 2;
          if (bDistSq < 1.55 * 1.55 && bDistSq < nearestDistance) {
            nearestDistance = bDistSq;
            _targetScratch.type = "seat";
            _targetScratch.house = null;
            _targetScratch.data = bench;
            _targetScratch.label = bench.label || "E · sentar no banco da praça";
            hasTarget = true;
          }
        }
      }
      if (this.wells) {
        for (let i = 0; i < this.wells.length; i++) {
          const well = this.wells[i];
          const wDistSq = (player.x - well.x) ** 2 + (player.z - well.z) ** 2;
          if (wDistSq < 2.45 * 2.45 && wDistSq < nearestDistance) {
            nearestDistance = wDistSq;
            _targetScratch.type = "well";
            _targetScratch.house = null;
            _targetScratch.data = well;
            _targetScratch.label = "E · beber água fresca do poço (+1 vitalidade)";
            hasTarget = true;
          }
        }
      }
    }

    const nearest = hasTarget ? _targetScratch : null;
    this.target = nearest;

    if (inside !== this.current) {
      if (this.current) {
        this.current.inside = false;
        this._setGhost(this.current, false);
      }
      this.current = inside;
      player.inHouse = inside;
      if (inside) {
        inside.inside = true;
        this._setGhost(inside, true);
        if (inside.type === "church") {
          this.ui.showToast(`Entraste na ${inside.name} · Santuário de Paz`);
        } else {
          this._reportIntruder(inside, "Ladrão! Guardas!", 0.3);
        }
      }
    }

    // aviso de interação (não atropela o aviso dos itens do chão)
    const text = nearest ? nearest.label : this.candle?.promptText || this.riding?.promptText || null;
    if (text !== this.promptText) {
      if (text || !this.drops?._pickTarget) this.ui.setPrompt(text);
      this.promptText = text;
    }
  }

  _setGhost(house, on) {
    const M = house.M;
    if (house.meshes.plaster) house.meshes.plaster.material = on ? M.ghostPlaster : M.plaster;
    if (house.meshes.wood) house.meshes.wood.material = on ? M.ghostWood : M.wood;
    if (house.meshes.roof) house.meshes.roof.visible = !on;
    if (house.meshes.ceiling) house.meshes.ceiling.visible = !on;
    if (house.meshes.towerTop) house.meshes.towerTop.visible = !on;
  }

  // Tecla E. Retorna true se alguma interação aconteceu.
  interact() {
    const t = this.target;
    if (!t) return false;
    const house = t.house;

    if (t.type === "stand_up") {
      this.player.standUp();
      return true;
    }
    if (t.type === "church_pew_active") {
      const nowPraying = this.player.toggleSeatPrayer();
      if (nowPraying) {
        this.audio.choir?.();
        this.effects.play("glint", this.player.x, this.player.root.position.y + 1.5, this.player.z, "#fff2a8", 1.25);
        this.ui.showToast("Em oração silenciosa no banco da igreja... (Vitalidade regenerando)");
      } else {
        this.ui.showToast("Você encerrou a oração e permanece sentado.");
      }
      return true;
    }
    if (t.type === "seat" && t.data) {
      const seat = t.data;
      this.player.sitAt(seat.x, seat.z, seat.yaw, seat.isChurchPew);
      this.audio.step(false, 0.8);
      if (seat.isChurchPew) {
        this.ui.showToast("Sentado no banco da igreja · Pressione E para rezar ou WASD para levantar");
      } else {
        this.ui.showToast("Descansando no banco · Pressione WASD ou E para levantar");
      }
      return true;
    }
    if (t.type === "altar" && t.data) {
      const altar = t.data;
      this.player.startAltarPrayer(altar.x, altar.z, altar.yaw);
      this.audio.choir?.();
      this.effects.play("glint", this.player.x, this.player.root.position.y + 1.75, this.player.z, "#ffe896", 1.55);
      this.player.health = this.player.maxHealth;
      if (this._altarBlessCooldown <= 0) {
        this._altarBlessCooldown = 90;
        PlayerStats.cha = Math.min(20, PlayerStats.cha + 1);
        if (this.npcs.wanted > 0 && this.npcs.wanted <= 2) {
          this.npcs.clearWanted();
        }
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast("Oração no Altar Sagrado! Vitalidade restaurada · +1 Carisma · Paz espiritual");
      } else {
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast("Ajoelhado em oração diante do Altar Sagrado · Vitalidade restaurada");
      }
      return true;
    }
    if (t.type === "holy_font" && house?.holyFont) {
      this.audio.holyWater?.();
      this.effects.play("glint", house.holyFont.x, house.floorY + 1.25, house.holyFont.z, "#9be6ff", 1.3);
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 2);
      this.player.invuln = Math.max(this.player.invuln, 3.0);
      if (this.player.root?.userData) {
        this.player.root.userData.isOnFire = false;
      }
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("Você se benzeu na pia de água benta! +2 Vitalidade e proteção divina.");
      return true;
    }
    if (t.type === "bell_rope" && house?.bellRope) {
      house.bellRope.swingTimer = 4.5;
      this.audio.churchBell?.();
      this.effects.play("star", house.x, house.floorY + 9.5, house.z, "#ffe48f", 1.9);
      this.effects.play("glint", house.bellRope.x, house.floorY + 1.8, house.bellRope.z, "#ffe48f", 1.2);
      for (let i = 0; i < this.npcs.npcs.length; i++) {
        const npc = this.npcs.npcs[i];
        if (!npc.alive || npc.roleKey === "horse") continue;
        if ((npc.x - house.x) ** 2 + (npc.z - house.z) ** 2 < 40 * 40 && npc.mode === "work") {
          npc.pause = Math.max(npc.pause, 2.5);
        }
      }
      this.ui.showToast(`🔔 O sino da ${house.name} ecoa pelos vales de Caldera!`);
      return true;
    }
    if (t.type === "offering_box" && house?.offeringBox) {
      if (this.player.coins < 5) {
        this.ui.showToast("Você precisa de 5 moedas para depositar uma oferta na caixa da paróquia.");
        return true;
      }
      this.player.coins -= 5;
      PlayerStats.gold = this.player.coins;
      PlayerStats.cha = Math.min(20, PlayerStats.cha + 1);
      this.audio.coin?.();
      this.audio.choir?.();
      this.effects.play("star", house.offeringBox.x, house.floorY + 1.2, house.offeringBox.z, "#ffe27a", 1.25);
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("Oferta de 5 moedas depositada na igreja! +1 Carisma.");
      return true;
    }
    if (t.type === "lectern" && house?.lectern) {
      const verse = SCRIPTURE_VERSES[this._scriptureIndex % SCRIPTURE_VERSES.length];
      this._scriptureIndex++;
      this.audio.choir?.();
      this.effects.play("glint", house.lectern.x, house.floorY + 1.35, house.lectern.z, "#fff0a8", 1.15);
      this.ui.showToast(verse);
      return true;
    }
    if (t.type === "well" && t.data) {
      if (this._wellCooldown > 0) {
        this.ui.showToast("Você acabou de beber água fresca do poço.");
        return true;
      }
      this._wellCooldown = 8;
      this.audio.holyWater?.();
      this.effects.play("star", t.data.x, this.player.root.position.y + 1.2, t.data.z, "#9be6ff", 1.1);
      if (this.player.health < this.player.maxHealth) {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast("Você bebeu água fresca do poço · +1 Vitalidade!");
      } else {
        this.ui.showToast("Água fresca e cristalina da nascente! Sua sede foi saciada.");
      }
      return true;
    }

    if (t.type === "door") {
      house.door.open = !house.door.open;
      house.door.target = house.door.open ? -1.75 : 0;
      house.door.box.active = !house.door.open;
      this.audio.step(false, 1.4);
      return true;
    }
    if (t.type === "chest") {
      house.chest.opened = true;
      const chestObj = house.chest.lid || house.chest;
      chestObj.userData = chestObj.userData || {};
      chestObj.userData.lid = house.chest.lid;
      const res = interactWithChest(
        chestObj,
        { x: this.player.x, y: this.player.root.position.y, z: this.player.z },
        this.npcs.npcs,
      );
      this.audio.coin();
      this.drops.spawnLoot(house.chest.x, house.floorY + 0.8, house.chest.z, LOOT_CHEST);
      if (res.isWitnessed) {
        this.ui.showToast(`Furto visto! +${res.gold} moedas · Carisma -2 · Procurado +1`);
        this._reportIntruder(house, "Ladrão! Largue isso!", 0.5);
      } else {
        this.ui.showToast(`Baú saqueado em silêncio · +${res.gold} moedas`);
      }
      return true;
    }
    if (t.type === "bed") {
      this.sleep.trySleep(house);
      return true;
    }
    return false;
  }

  // Golpes, tiros e explosões quebram a mobília.
  hitAt(x, y, z, radius, damage) {
    let broken = false;
    for (const house of this.houses) {
      if ((house.x - x) ** 2 + (house.z - z) ** 2 > 14 * 14) continue;
      for (const prop of house.props) {
        if (prop.broken) continue;
        const dx = prop.x - x;
        const dz = prop.z - z;
        const reach = radius + prop.radius;
        if (dx * dx + dz * dz > reach * reach || Math.abs(prop.y - y) > prop.h / 2 + radius + 0.2) continue;
        prop.hp -= damage;
        this.effects.play("dust", prop.x, prop.y, prop.z, "#b89a6a", 0.6);
        if (prop.hp > 0) continue;
        prop.broken = true;
        broken = true;
        prop.mesh.parent?.remove(prop.mesh);
        if (prop.box) prop.box.active = false;
        this.effects.play("smoke", prop.x, prop.y, prop.z, "#c9b48c", 0.9);
        this.audio.hit(true);
        if (prop.loot) this.drops.spawnLoot(prop.x, prop.y + 0.2, prop.z, prop.loot);
        this._reportIntruder(house, "Meus bens! Guardas!", 0.3);
      }
    }
    return broken;
  }
}
