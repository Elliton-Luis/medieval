// Sistema das casas: portas com animação, interiores (telhado e paredes somem ao entrar),
// mobília interativa e destrutível, baús, camas e reação dos donos.
import { interactWithChest, checkWitnesses } from "./rpg.js?v=10";

const LOOT_CHEST = { coins: [8, 20], items: [["potion", 0.3], ["gem", 0.2], ["bread", 0.4], ["bolts", 0.3], ["arrows", 0.3]] };
const _targetScratch = { type: null, house: null, label: null };

export class HouseSystem {
  constructor({ houses, player, ui, effects, audio, npcs, drops, sleep, candle }) {
    this.houses = houses;
    this.player = player;
    this.ui = ui;
    this.effects = effects;
    this.audio = audio;
    this.npcs = npcs;
    this.drops = drops;
    this.sleep = sleep;
    this.candle = candle;
    this.current = null;
    this.target = null;
    this.promptText = null;
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
    let inside = null;
    let nearestDistance = 3.1 * 3.1;
    let hasTarget = false;

    for (let i = 0; i < this.houses.length; i++) {
      const house = this.houses[i];
      if (house.enterCooldown > 0) house.enterCooldown -= dt;
      const dx = player.x - house.x;
      const dz = player.z - house.z;
      const distanceSq = dx * dx + dz * dz;

      // porta: abre e fecha suavemente
      const door = house.door;
      door.angle += (door.target - door.angle) * (1 - Math.exp(-9 * dt));
      door.pivot.rotation.y = door.angle;
      if (house.chest.opened && house.chest.openAmount < 1) {
        house.chest.openAmount = Math.min(1, house.chest.openAmount + dt * 3);
        house.chest.lid.rotation.x = -house.chest.openAmount * 1.7;
      }
      if (distanceSq > 14 * 14) continue;
      const isPlayerInside = house.contains(player.x, player.z);
      if (!inside && isPlayerInside && !player.mounted) inside = house;

      // interagíveis perto (Zero-GC)
      const doorDistSq = (player.x - door.x) ** 2 + (player.z - door.z) ** 2;
      if (doorDistSq < 1.9 * 1.9 && doorDistSq < nearestDistance) {
        nearestDistance = doorDistSq;
        _targetScratch.type = "door";
        _targetScratch.house = house;
        _targetScratch.label = door.open ? "E · fechar porta" : "E · abrir porta";
        hasTarget = true;
      }
      if (isPlayerInside) {
        if (!house.chest.opened) {
          const chestDistSq = (player.x - house.chest.x) ** 2 + (player.z - house.chest.z) ** 2;
          if (chestDistSq < 1.8 * 1.8 && chestDistSq < nearestDistance) {
            nearestDistance = chestDistSq;
            _targetScratch.type = "chest";
            _targetScratch.house = house;
            _targetScratch.label = "E · abrir baú";
            hasTarget = true;
          }
        }
        const bedDistSq = (player.x - house.bed.x) ** 2 + (player.z - house.bed.z) ** 2;
        if (bedDistSq < 2.3 * 2.3 && bedDistSq < nearestDistance) {
          nearestDistance = bedDistSq;
          _targetScratch.type = "bed";
          _targetScratch.house = house;
          _targetScratch.label = house.price > 0 ? `E · dormir (${house.price} moedas)` : "E · dormir";
          hasTarget = true;
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
        this._reportIntruder(inside, "Ladrão! Guardas!", 0.3);
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
  }

  // Tecla E. Retorna true se alguma interação aconteceu.
  interact() {
    const t = this.target;
    if (!t) return false;
    const house = t.house;
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
