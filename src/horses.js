import { Horse } from "./horse.js";
import { hash2 } from "./utils.js";

const COATS = ["#4a3022", "#2f2a28", "#6a5a48", "#3b2418", "#8a6a44", "#b8b2a4", "#5a4030"];
const MAX_HORSES = 14;
const SPAWN_CHUNK_RADIUS = 2;
const DESPAWN_DISTANCE = 190;

// Cavalos no mapa: manadas selvagens geradas por chunk (com limite total) e
// cavalos amarrados junto às casas de alguns NPCs.
export class HorseManager {
  constructor({ scene, world, effects, npcs, audio, player }) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.npcs = npcs;
    this.audio = audio;
    this.player = player;
    this.horses = [];
    this.processed = new Map();
    this.coat = 0;
  }

  _acquire() {
    let horse = this.horses.find((h) => h.removed);
    if (!horse) {
      if (this.horses.length >= MAX_HORSES + 4) return null;
      horse = new Horse(this.scene, this.world, this.effects, COATS[this.coat++ % COATS.length]);
      horse.kind = "field";
      horse.hostile = false;
      horse.mode = "work";
      horse.manager = this;
      horse.name = "Cavalo";
      horse.title = "Montaria";
      this.horses.push(horse);
      this.npcs.npcs.push(horse);
    }
    return horse;
  }

  get activeCount() {
    let n = 0;
    for (const horse of this.horses) if (!horse.removed) n++;
    return n;
  }

  spawnHorse(x, z, options = {}) {
    let horse = options.isMissionHorse
      ? this.horses.find((h) => h.isMissionHorse) || this._acquire() || this.horses.find((h) => !h.controlled)
      : this._acquire();
    if (!horse) return null;
    horse.activate(x, z, Math.random() * Math.PI * 2);
    horse.kind = "field";
    horse.mode = "work";
    horse.wild = options.wild ?? true;
    horse.tamed = false;
    horse.tame = 0;
    horse.owner = options.owner || null;
    horse.home = options.home || null;
    horse.stay = Boolean(options.stay);
    horse.isMissionHorse = Boolean(options.isMissionHorse);
    if (horse.root) {
      horse.root.userData = horse.root.userData || {};
      horse.root.userData.isMissionHorse = Boolean(options.isMissionHorse);
    }
    horse.state = horse.stay ? "stand" : "graze";
    horse.fieldTimer = 2 + Math.random() * 6;
    horse.task = options.task || (horse.owner ? "Amarrado" : "Pastando");
    horse.name = options.name || (horse.owner ? "Cavalo de " + horse.owner.name.split(" ")[0] : "Cavalo selvagem");
    horse.title = options.title || "Montaria";
    return horse;
  }

  spawnHerd(x, z, count, key = null) {
    const home = { x, z, r: 11 };
    for (let i = 0; i < count; i++) {
      const hx = x + (Math.random() - 0.5) * 9;
      const hz = z + (Math.random() - 0.5) * 9;
      if (this.world.isBlockedAt(hx, hz, 1)) continue;
      const horse = this.spawnHorse(hx, hz, { wild: true, home });
      if (horse) horse.chunkKey = key;
    }
  }

  // Cavalos de NPCs: amarrados ao lado de algumas casas, com o morador como dono.
  spawnOwned(houses) {
    houses.forEach((house, index) => {
      if (!house.owner || index % 3 !== 1) return;
      const o = house.outer;
      for (const [x, z] of [[o.maxX + 2.6, o.maxZ - 1.2], [o.minX - 2.6, o.maxZ - 1.2], [o.maxX - 1.2, o.maxZ + 2.8]]) {
        if (this.world.isBlockedAt(x, z, 1.1)) continue;
        this.spawnHorse(x, z, { wild: false, owner: house.owner, home: { x, z, r: 3 }, stay: true });
        break;
      }
    });
  }

  // Alarme: explosão, tiro ou briga — os cavalos por perto fogem.
  scare(x, z, radius) {
    const limit = radius * radius;
    for (const horse of this.horses) {
      if (horse.removed || !horse.alive || horse.controlled) continue;
      if ((horse.x - x) ** 2 + (horse.z - z) ** 2 < limit) horse.flee(x, z, 5);
    }
  }

  update(dt) {
    const player = this.player;
    const size = this.world.chunkSize;
    const pcx = Math.floor(player.x / size);
    const pcz = Math.floor(player.z / size);

    // gera manadas nos chunks que entram no alcance (probabilidade fixa por chunk)
    for (let dz = -SPAWN_CHUNK_RADIUS; dz <= SPAWN_CHUNK_RADIUS; dz++) {
      for (let dx = -SPAWN_CHUNK_RADIUS; dx <= SPAWN_CHUNK_RADIUS; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx}:${cz}`;
        if (this.processed.has(key)) continue;
        this.processed.set(key, true);
        if (this.activeCount >= MAX_HORSES) continue;
        const roll = hash2(cx, cz, this.world.seed + 777);
        if (roll > 0.34) continue;
        const x = (cx + 0.2 + hash2(cx, cz, 5) * 0.6) * size;
        const z = (cz + 0.2 + hash2(cx, cz, 9) * 0.6) * size;
        if (this.world._isSettlementClear(x, z)) continue;
        this.spawnHerd(x, z, 2 + Math.floor(hash2(cx, cz, 13) * 3), key);
      }
    }

    // some o que ficou muito para trás (e libera o chunk para gerar de novo)
    for (const horse of this.horses) {
      if (horse.removed || horse.tamed || horse.controlled || horse.owner || horse.isMissionHorse) continue;
      if ((horse.x - player.x) ** 2 + (horse.z - player.z) ** 2 > DESPAWN_DISTANCE * DESPAWN_DISTANCE) {
        horse.remove();
        if (horse.chunkKey) this.processed.delete(horse.chunkKey);
      }
    }
  }
}
