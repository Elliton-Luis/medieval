import * as THREE from "three";
import { WEAPONS_BY_ID } from "./weapondata.js";

const COIN_CAPACITY = 96;
const ITEM_CAPACITY = 10;
const GRAVITY = 17;
const MAGNET_RADIUS = 3.4;
const PICKUP_RADIUS = 2.7;
const LIFETIME = 90;

// Tabela de saque: moedas sempre; itens por chance.
const LOOT = {
  footman: { coins: [3, 6], items: [["bolts", 0.3], ["arrows", 0.3], ["knives", 0.15]], weapons: [["spear", 0.22], ["mace", 0.1], ["shortsword", 0.08]] },
  archer: { coins: [3, 6], items: [["arrows", 0.8]], weapons: [["longbow", 0.16], ["dagger", 0.12]] },
  crossbow: { coins: [4, 7], items: [["bolts", 0.8], ["potion", 0.1]], weapons: [["heavycrossbow", 0.14], ["knife", 0.12]] },
  knight: { coins: [8, 14], items: [["gem", 0.4], ["potion", 0.3], ["oil", 0.25]], weapons: [["longsword", 0.32], ["axe", 0.22], ["mace", 0.16], ["flail", 0.12], ["halberd", 0.16], ["warhammer", 0.12], ["greatsword", 0.08]] },
  cannoneer: { coins: [6, 10], items: [["potion", 0.4], ["gem", 0.25]] },
  villager: { coins: [2, 4], items: [["bread", 0.35], ["apple", 0.35]] },
  farmer: { coins: [2, 5], items: [["bread", 0.5], ["apple", 0.5]] },
  merchant: { coins: [8, 14], items: [["gem", 0.7], ["potion", 0.25]] },
  smith: { coins: [5, 9], items: [["bolts", 0.4]] },
  guard: { coins: [4, 8], items: [["bolts", 0.4], ["arrows", 0.4], ["potion", 0.12]], weapons: [["spear", 0.2], ["shortsword", 0.1], ["axe", 0.1], ["dagger", 0.08]] },
  cultist: { coins: [25, 50], items: [["parchment", 0.95], ["relic", 0.75], ["gem", 0.6], ["potion", 0.45]], weapons: [["dagger", 0.4], ["shortsword", 0.2]] },
  werewolf: { coins: [25, 45], items: [["gem", 0.8]] },
};

let _loreScrollIndex = 0;
const CULT_LORE_FRAGMENTS = [
  {
    title: "TRATADO GNÓSTICO · I",
    sub: "O Engano da Criação & A Prisão da Carne",
    tier: 1,
    text: "«Escrito em tinta cor de cinza e vinho: O Deus do Céu criou o reino invisível das almas puras, mas o Senhor deste Mundo — o Demiurgo, o Arconte Cego — forjou a matéria e trancafiou os espíritos na carne corruptível. A Igreja venera o carcereiro sem saber. Quem morre na ilusão da carne permanece aprisionado; quem quebra as amarras pelo fogo e pelo caos, contempla a verdadeira luz.»",
  },
  {
    title: "TRATADO GNÓSTICO · II",
    sub: "Os Quatro Altares dos Ermos",
    tier: 2,
    text: "«Nossos acampamentos foram fincados nos quatro cantos dos ermos de Caldera, a mais de duzentos passos das muralhas corruptas da cidade. Mantemos fogueiras de chama roxa e tochas carmesins. As sentinelas aguardam em vigília. Quando o sangue dos inocentes correr farto, o Olho que tudo vê descenderá dos céus para consumar a Grande Purificação.»",
  },
  {
    title: "TRATADO GNÓSTICO · III",
    sub: "O Olho Celestial & As Asas Negras",
    tier: 3,
    text: "«Não temas as feras da noite nem os lobisomens que rondam a escuridão: eles são apenas os primeiros arautos do massacre necessário. Antes do Arconte Supremo descer, anjos com asas de sangue e olhos violetas rodearão o centro da terra. A cidade inteira será reduzida a cinzas sagradas para que a nova vida comece.»",
  },
  {
    title: "TRATADO GNÓSTICO · IV",
    sub: "O Julgamento & A Espada Sagrada",
    tier: 4,
    text: "«Cuidado com os Cavaleiros Templários da Igreja! Se um guerreiro mantiver seus votos intactos e erguer o estandarte sagrado, a Ira de Deus poderá rasgar o céu em luz dourada, cravando a espada celestial no altar da igreja e banindo nossos irmãos pelo fogo do julgamento. A batalha entre a Luz e o Vazio nunca cessa.»",
  },
  {
    title: "TRATADO GNÓSTICO · V",
    sub: "As Vestes do Mensageiro do Demiurgo",
    tier: 5,
    text: "«Aquele que derrotar os sacerdotes das cinzas ou provar seu desapego pela carne será coroado com as Vestimentas do Demiurgo: a capa pontiaguda de púrpura e ébano e a máscara com chifres do Arconte. Com elas, o guerreiro torna-se veloz como o vento e letal como a lâmina do destino.»",
  },
];

const ITEMS = {
  bread: { name: "Pão", geometry: () => new THREE.BoxGeometry(0.36, 0.17, 0.2), color: "#a5703a", emissive: "#000000", lift: 0.1 },
  apple: { name: "Maçã", geometry: () => new THREE.SphereGeometry(0.14, 8, 6), color: "#b53a2c", emissive: "#000000", lift: 0.14 },
  gem: { name: "Joia", geometry: () => new THREE.OctahedronGeometry(0.17, 0), color: "#58d4c8", emissive: "#1c8f86", lift: 0.2 },
  bolts: { name: "Virotes", geometry: () => new THREE.BoxGeometry(0.4, 0.07, 0.12), color: "#c9b27a", emissive: "#000000", lift: 0.08 },
  arrows: { name: "Flechas", geometry: () => new THREE.BoxGeometry(0.46, 0.06, 0.1), color: "#8bae62", emissive: "#000000", lift: 0.08 },
  weapon: { name: "Arma", geometry: () => new THREE.BoxGeometry(0.95, 0.07, 0.16), color: "#c0c4b8", emissive: "#303a3a", lift: 0.08 },
  knives: { name: "Facas de arremesso", geometry: () => new THREE.BoxGeometry(0.3, 0.05, 0.1), color: "#cfd4cf", emissive: "#000000", lift: 0.08 },
  oil: { name: "Pote de óleo", geometry: () => new THREE.SphereGeometry(0.15, 7, 5), color: "#a65c3c", emissive: "#000000", lift: 0.14 },
  potion: { name: "Poção", geometry: () => new THREE.CylinderGeometry(0.09, 0.13, 0.26, 7), color: "#69c46d", emissive: "#2c8a3a", lift: 0.14 },
  parchment: { name: "Pergaminho Herético do Demiurgo", geometry: () => new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), color: "#f3dfb5", emissive: "#9933cc", lift: 0.12 },
  relic: { name: "Relíquia Negra do Demiurgo", geometry: () => new THREE.OctahedronGeometry(0.18, 0), color: "#4a126d", emissive: "#c0392b", lift: 0.15 },
};

const ITEM_KINDS = Object.keys(ITEMS);
const _bestTarget = { kind: null, index: 0, weaponId: null };

function roll(range) {
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

function makeSet(scene, geometry, material, capacity) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const data = [];
  const dummy = new THREE.Object3D();
  dummy.scale.setScalar(0);
  dummy.position.set(0, -500, 0);
  dummy.updateMatrix();
  for (let i = 0; i < capacity; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
    data.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, spin: 0, life: 0, bounces: 0, rest: false, phase: Math.random() * 6 });
  }
  scene.add(mesh);
  return { mesh, data, cursor: 0, dirty: true };
}

export class DropSystem {
  constructor(scene, world, player, ui, audio, effects) {
    this.world = world;
    this.player = player;
    this.ui = ui;
    this.audio = audio;
    this.effects = effects;
    this.weapons = null;
    this.dummy = new THREE.Object3D();
    this.glintTimer = 0;
    this.pendingCoins = 0;
    this.coinToast = 0;
    this.promptKind = null;
    this._pickTarget = null;

    this.coins = makeSet(
      scene,
      new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10),
      new THREE.MeshStandardMaterial({ color: "#e0b43f", emissive: "#8a5d0a", emissiveIntensity: 0.55, metalness: 0.7, roughness: 0.35, flatShading: true }),
      COIN_CAPACITY,
    );
    this.items = {};
    for (const [kind, spec] of Object.entries(ITEMS)) {
      this.items[kind] = makeSet(
        scene,
        spec.geometry(),
        new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.emissive, emissiveIntensity: spec.emissive === "#000000" ? 0 : 0.7, roughness: 0.7, flatShading: true }),
        ITEM_CAPACITY,
      );
    }
  }

  _spawn(set, x, y, z, power, lift, weaponId = null) {
    const drop = set.data[set.cursor];
    set.cursor = (set.cursor + 1) % set.data.length;
    const angle = Math.random() * Math.PI * 2;
    const speed = (1.2 + Math.random() * 2.6) * power;
    drop.active = true;
    drop.x = x;
    drop.y = y;
    drop.z = z;
    drop.vx = Math.cos(angle) * speed;
    drop.vz = Math.sin(angle) * speed;
    drop.vy = 3.5 + Math.random() * 4.2 * Math.min(1.6, power);
    drop.rx = Math.random() * 6;
    drop.rz = Math.random() * 6;
    drop.spin = 6 + Math.random() * 9;
    drop.life = LIFETIME;
    drop.bounces = 0;
    drop.rest = false;
    drop.lift = lift;
    drop.weaponId = weaponId;
    set.dirty = true;
  }

  // Todo NPC derrotado larga ouro; o resto depende do ofício.
  spawnFor(npc, power = 1) {
    if (npc.roleKey === "horse") return;
    const loot = LOOT[npc.roleKey] || LOOT.villager;
    const count = roll(loot.coins);
    const y = npc.root.position.y + 1.1;
    for (let i = 0; i < count; i++) this._spawn(this.coins, npc.x, y, npc.z, power, 0.04);
    for (const [id, chance] of loot.weapons || []) {
      if (Math.random() < chance) {
        this._spawn(this.items.weapon, npc.x, y, npc.z, power * 0.8, ITEMS.weapon.lift, id);
        break;
      }
    }
    for (const [kind, chance] of loot.items) {
      if (Math.random() < chance) this._spawn(this.items[kind], npc.x, y, npc.z, power * 0.8, ITEMS[kind].lift);
    }
    this.effects.play("glint", npc.x, y, npc.z, "#ffe08a", 0.9);
  }

  // Solta um saque arbitrário (baús, potes): { coins: [min, max], items: [[tipo, chance], ...] }
  spawnLoot(x, y, z, loot, power = 0.8) {
    const count = roll(loot.coins);
    for (let i = 0; i < count; i++) this._spawn(this.coins, x, y, z, power, 0.04);
    for (const [kind, chance] of loot.items || []) {
      if (Math.random() < chance) this._spawn(this.items[kind], x, y, z, power, ITEMS[kind].lift);
    }
    this.effects.play("glint", x, y, z, "#ffe08a", 0.9);
  }

  _physics(set, dt, isCoin) {
    const player = this.player;
    const data = set.data;
    const px = player.x;
    const py = player.root.position.y + 1;
    const pz = player.z;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        this._hide(set, i);
        continue;
      }

      if (isCoin && !player.knockedOut) {
        const dx = px - d.x;
        const dy = py - d.y;
        const dz = pz - d.z;
        const distance = Math.hypot(dx, dy, dz);
        if (distance < 0.75) {
          d.active = false;
          this._hide(set, i);
          this._collectCoin(d);
          continue;
        }
        if (distance < MAGNET_RADIUS && (d.rest || d.bounces > 0)) {
          // efeito ímã: acelera em direção ao jogador
          const pull = (1 - distance / MAGNET_RADIUS) * 46 + 8;
          d.vx += (dx / distance) * pull * dt;
          d.vy += (dy / distance) * pull * dt + GRAVITY * dt;
          d.vz += (dz / distance) * pull * dt;
          d.rest = false;
          const drag = Math.exp(-2.2 * dt);
          d.vx *= drag;
          d.vy *= drag;
          d.vz *= drag;
        }
      }

      if (!d.rest) {
        d.vy -= GRAVITY * dt;
        const nx = d.x + d.vx * dt;
        const nz = d.z + d.vz * dt;
        if (this.world.isBlockedAt(nx, nz, 0.1)) {
          d.vx *= -0.3;
          d.vz *= -0.3;
        } else {
          d.x = nx;
          d.z = nz;
        }
        d.y += d.vy * dt;
        const floor = this.world.heightAt(d.x, d.z) + d.lift;
        if (d.y <= floor) {
          d.y = floor;
          if (d.vy < -1.6 && d.bounces < 4) {
            d.vy = -d.vy * 0.46;
            d.vx *= 0.7;
            d.vz *= 0.7;
            d.bounces++;
            if (isCoin && d.bounces === 1) this.audio.coinDrop();
          } else {
            d.vy = 0;
            d.vx *= Math.exp(-6 * dt);
            d.vz *= Math.exp(-6 * dt);
            if (Math.hypot(d.vx, d.vz) < 0.08) d.rest = true;
          }
        }
        d.rx += d.spin * dt * (d.vy === 0 ? Math.min(1, Math.hypot(d.vx, d.vz) / 2) : 1);
        d.rz += d.spin * 0.6 * dt * (d.vy === 0 ? 0 : 1);
      } else if (!isCoin) {
        d.rx = 0;
        d.rz = 0;
      }

      let scale = 1;
      if (d.life < 6) scale = 0.55 + 0.45 * Math.abs(Math.sin(d.life * 6));
      if (d.life < 0.5) scale *= d.life / 0.5;
      const dummy = this.dummy;
      dummy.position.set(d.x, d.y + (d.rest && !isCoin ? Math.sin(d.phase + this._time * 2.2) * 0.04 : 0), d.z);
      if (d.rest && isCoin) dummy.rotation.set(0, d.rx * 0.3, 0);
      else if (d.rest) dummy.rotation.set(0, d.phase + this._time * 1.2, 0);
      else dummy.rotation.set(d.rx, d.rz * 0.5, d.rz);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      set.mesh.setMatrixAt(i, dummy.matrix);
      set.dirty = true;
    }
    if (set.dirty) {
      set.mesh.instanceMatrix.needsUpdate = true;
      set.dirty = false;
    }
  }

  _hide(set, index) {
    this.dummy.scale.setScalar(0);
    this.dummy.position.set(0, -500, 0);
    this.dummy.updateMatrix();
    set.mesh.setMatrixAt(index, this.dummy.matrix);
    set.dirty = true;
  }

  _collectCoin() {
    this.player.coins += 1;
    this.pendingCoins += 1;
    this.coinToast = 0.45;
    this.audio.coin();
  }

  update(dt) {
    this._time = (this._time || 0) + dt;
    this._physics(this.coins, dt, true);
    for (let i = 0; i < ITEM_KINDS.length; i++) {
      this._physics(this.items[ITEM_KINDS[i]], dt, false);
    }

    if (this.pendingCoins > 0) {
      this.coinToast -= dt;
      if (this.coinToast <= 0) {
        this.ui.showToast(`+${this.pendingCoins} moeda${this.pendingCoins > 1 ? "s" : ""}`);
        this.pendingCoins = 0;
      }
    }

    // Brilho ocasional nos itens parados, para serem vistos de longe.
    this.glintTimer -= dt;
    if (this.glintTimer <= 0) {
      this.glintTimer = 0.18;
      const set = Math.random() < 0.55 ? this.coins : this.items[ITEM_KINDS[Math.floor(Math.random() * 6)]];
      const d = set.data[Math.floor(Math.random() * set.data.length)];
      if (d.active && d.rest && (d.x - this.player.x) ** 2 + (d.z - this.player.z) ** 2 < 28 * 28) {
        this.effects.play("glint", d.x, d.y + 0.25, d.z, set === this.coins ? "#ffe08a" : "#ffffff", 0.5);
      }
    }

    // Item mais próximo ao alcance: mostra o aviso para pegar com E. (Zero-GC)
    let best = null;
    let bestDistance = PICKUP_RADIUS * PICKUP_RADIUS;
    if (!this.player.knockedOut) {
      for (let k = 0; k < ITEM_KINDS.length; k++) {
        const kind = ITEM_KINDS[k];
        const data = this.items[kind].data;
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          if (!d.active || !d.rest) continue;
          const dist = (d.x - this.player.x) ** 2 + (d.z - this.player.z) ** 2;
          if (dist < bestDistance) {
            bestDistance = dist;
            _bestTarget.kind = kind;
            _bestTarget.index = i;
            _bestTarget.weaponId = d.weaponId;
            best = _bestTarget;
          }
        }
      }
    }
    this._pickTarget = best;
    const kind = best ? best.kind + (best.weaponId || "") : null;
    if (kind !== this.promptKind) {
      this.promptKind = kind;
      const label = best ? (best.kind === "weapon" ? WEAPONS_BY_ID[best.weaponId].name : ITEMS[best.kind].name) : null;
      this.ui.setPrompt(label ? `E · pegar ${label}` : null);
    }
  }

  // Limpa o chão: moedas e itens soltos somem (usado quando o jogador perece).
  clear() {
    const sets = [this.coins, ...Object.values(this.items)];
    for (const set of sets) {
      for (let i = 0; i < set.data.length; i++) {
        set.data[i].active = false;
        this._hide(set, i);
      }
      set.mesh.instanceMatrix.needsUpdate = true;
    }
    this.pendingCoins = 0;
    this._pickTarget = null;
    this.promptKind = null;
    this.ui.setPrompt(null);
  }

  // Chamado pela tecla E. Retorna true se pegou algo.
  tryPickup() {
    const target = this._pickTarget;
    if (!target) return false;
    const set = this.items[target.kind];
    const drop = set.data[target.index];
    if (!drop.active) return false;
    drop.active = false;
    this._hide(set, target.index);
    set.mesh.instanceMatrix.needsUpdate = true;
    this._pickTarget = null;
    this.promptKind = null;
    this.ui.setPrompt(null);

    const player = this.player;
    this.effects.play("star", drop.x, drop.y + 0.3, drop.z, "#ffe9a8", 0.7);
    this.audio.coin();
    const name = target.kind === "weapon" ? WEAPONS_BY_ID[drop.weaponId].name : ITEMS[target.kind].name;
    switch (target.kind) {
      case "bread":
      case "apple":
        if (player.health < player.maxHealth) {
          player.health++;
          this.ui.showToast(`${name} · +1 vitalidade`);
        } else {
          player.coins += 3;
          this.ui.showToast(`${name} vendido · +3 moedas`);
        }
        break;
      case "gem":
        player.coins += 15;
        this.ui.showToast("Joia vendida · +15 moedas");
        break;
      case "potion":
        if (player.potions < 4) {
          player.potions++;
          this.ui.showToast("Poção guardada no alforje");
        } else {
          player.coins += 8;
          this.ui.showToast("Poção vendida · +8 moedas");
        }
        break;
      case "bolts":
        this.weapons?.buyAmmo("bolts", 3);
        this.ui.showToast("+3 virotes");
        break;
      case "arrows":
        this.weapons?.buyAmmo("arrows", 5);
        this.ui.showToast("+5 flechas");
        break;
      case "knives":
        this.weapons?.buyAmmo("knives", 3);
        this.ui.showToast("+3 facas de arremesso");
        break;
      case "oil":
        this.weapons?.buyAmmo("oil", 1);
        this.ui.showToast("+1 pote de óleo");
        break;
      case "weapon": {
        const id = drop.weaponId;
        if (this.weapons && !this.weapons.owned.has(id)) {
          this.weapons.unlock(id);
        } else {
          player.coins += 12;
          this.ui.showToast(`${WEAPONS_BY_ID[id].name} vendida · +12 moedas`);
        }
        break;
      }
      case "parchment": {
        const loreIndex = _loreScrollIndex % CULT_LORE_FRAGMENTS.length;
        _loreScrollIndex++;
        const lore = CULT_LORE_FRAGMENTS[loreIndex];
        import("./decay.js").then(({ showDemiurgeModal }) => {
          showDemiurgeModal(lore.text, lore.tier, null, null, lore.title, lore.sub);
        }).catch(() => {});
        player.coins += 15;
        this.ui.showToast("📜 Pergaminho Cátaro lido · Revelação Gnóstica (+15 Ouro)");
        break;
      }
      case "relic": {
        player.coins += 40;
        this.ui.showToast("🔮 Relíquia Negra do Demiurgo recolhida (+40 Ouro)");
        break;
      }
      default:
        break;
    }
    this.ui.setVitals(player.health, player.maxHealth, player.coins, player.potions);
    return true;
  }
}
