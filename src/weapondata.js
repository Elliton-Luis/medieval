import * as THREE from "three";
import { makeSkinnedMaterial } from "./skins.js";

// Catálogo de armas: estatísticas, slots 1-9, modelos 3D procedurais e ícones em canvas.
//
// type: fists | melee | bow | crossbow | throw
// hands: 1 permite escudo (Q); 2 não.
// grip (pose da arma na mão): none | blade | heavy | pole | bow | long | throw
// Armas leves (combo: true) fazem combo de 3 golpes; as pesadas (charge: true) têm ataque carregado.

export const WEAPON_LIST = [
  { id: "fists", name: "Mãos", slot: 1, type: "fists", grip: "none", hands: 1, damage: 1, reach: 1.9, arc: 0.45, cooldown: 0.3, length: 0.26, hitDelay: 0.09, weight: 1.0, knock: 2.2, combo: true, anim: [5, 6, 5], lunge: 2.4, sound: "punch", price: 0 },
  { id: "torch", name: "Tocha mágica", slot: 1, type: "melee", weaponType: "TORCH", grip: "torch", hands: 1, damage: 2, reach: 2.6, arc: 0.45, cooldown: 0.42, length: 0.36, hitDelay: 0.1, weight: 1.0, knock: 2.8, combo: true, anim: [0, 1, 2], lunge: 2.8, sound: "torch", price: 15 },
  { id: "makeshift_spear", name: "Lança Improvisada", slot: 6, type: "melee", weaponType: "SPEAR", grip: "pole", hands: 2, pole: true, damage: 2, reach: 3.8, arc: 0.5, cooldown: 0.65, length: 0.42, hitDelay: 0.13, weight: 0.9, knock: 3.8, anim: [4], lunge: 3.0, sound: "stab", price: 0, durability: 10, maxDurability: 10, isImprovised: true },
  { id: "makeshift_club", name: "Porrete Rústico", slot: 4, type: "melee", grip: "blade", hands: 1, damage: 2, reach: 2.6, arc: 0.45, cooldown: 0.6, length: 0.45, hitDelay: 0.15, weight: 0.95, knock: 5.2, combo: true, anim: [1, 0, 2], lunge: 2.5, sound: "smash", price: 0, durability: 15, maxDurability: 15, isImprovised: true },
  { id: "axe", name: "Machado de Lenhador", slot: 2, type: "melee", toolType: "AXE", grip: "blade", hands: 1, damage: 2, reach: 2.9, arc: 0.45, cooldown: 0.56, length: 0.42, hitDelay: 0.14, weight: 0.94, knock: 4.2, combo: true, anim: [1, 0, 2], lunge: 0, sound: "chop", price: 0 },
  { id: "dagger", name: "Adaga", slot: 2, type: "melee", grip: "blade", hands: 1, damage: 1, reach: 2.1, arc: 0.5, cooldown: 0.26, length: 0.24, hitDelay: 0.08, weight: 1.0, knock: 1.6, combo: true, anim: [4, 4, 0], lunge: 3.2, sound: "stab", price: 25 },
  { id: "knife", name: "Faca", slot: 2, type: "melee", grip: "blade", hands: 1, damage: 1, reach: 1.9, arc: 0.5, cooldown: 0.22, length: 0.22, hitDelay: 0.07, weight: 1.0, knock: 1.4, combo: true, anim: [4, 0, 4], lunge: 3, sound: "stab", price: 12 },
  { id: "pickaxe", name: "Picareta", slot: 3, type: "melee", toolType: "PICKAXE", grip: "blade", hands: 1, damage: 2, reach: 2.8, arc: 0.45, cooldown: 0.58, length: 0.44, hitDelay: 0.15, weight: 0.92, knock: 4.4, combo: true, anim: [2, 1, 0], lunge: 0, sound: "smash", price: 0 },
  { id: "scythe", name: "Foice de Colheita", slot: 3, type: "melee", toolType: "SCYTHE", grip: "blade", hands: 2, damage: 2, reach: 3.2, arc: 0.6, cooldown: 0.52, length: 0.5, hitDelay: 0.12, weight: 0.94, knock: 3.8, combo: true, anim: [0, 1, 2], lunge: 1.5, sound: "slash", price: 0 },
  { id: "shortsword", name: "Espada curta", slot: 4, type: "melee", grip: "blade", hands: 1, damage: 2, reach: 3.0, arc: 0.45, cooldown: 0.4, length: 0.34, hitDelay: 0.1, weight: 1.0, knock: 3.4, combo: true, anim: [0, 1, 2], lunge: 3.4, sound: "slash", price: 20 },
  { id: "longsword", name: "Espada longa", slot: 4, type: "melee", grip: "blade", hands: 1, damage: 3, reach: 3.5, arc: 0.4, cooldown: 0.58, length: 0.42, hitDelay: 0.13, weight: 0.95, knock: 4.4, combo: true, anim: [0, 1, 2], lunge: 3.6, sound: "slash", price: 60 },
  { id: "mace", name: "Maça", slot: 4, type: "melee", grip: "blade", hands: 1, damage: 2, reach: 2.7, arc: 0.45, cooldown: 0.66, length: 0.5, hitDelay: 0.17, weight: 0.92, knock: 5.6, combo: true, anim: [0, 1, 2], lunge: 3, sound: "smash", price: 40 },
  { id: "flail", name: "Mangual", slot: 4, type: "melee", grip: "blade", hands: 1, damage: 2, reach: 3.3, arc: 0.3, cooldown: 0.72, length: 0.5, hitDelay: 0.2, weight: 0.9, knock: 5, combo: true, anim: [1, 0, 2], lunge: 3, sound: "smash", price: 55 },
  { id: "warhammer", name: "Martelo de guerra", slot: 5, type: "melee", grip: "heavy", hands: 2, damage: 3, reach: 3.3, arc: 0.1, cooldown: 1.05, length: 0.72, hitDelay: 0.3, weight: 0.8, knock: 10, launch: 1.6, charge: true, anim: [2], lunge: 4.5, sound: "smash", price: 90 },
  { id: "greatsword", name: "Montante", slot: 5, type: "melee", grip: "heavy", hands: 2, damage: 3, reach: 4.1, arc: -0.1, cooldown: 0.95, length: 0.66, hitDelay: 0.27, weight: 0.82, knock: 9, launch: 1.4, charge: true, anim: [1], lunge: 4.5, sound: "slash", price: 120 },
  { id: "spear", name: "Lança", slot: 6, type: "melee", weaponType: "SPEAR", grip: "pole", hands: 2, pole: true, damage: 2, reach: 4.0, arc: 0.55, cooldown: 0.62, length: 0.42, hitDelay: 0.12, weight: 0.9, knock: 4.5, anim: [4], lunge: 3.2, sound: "stab", price: 50 },
  { id: "halberd", name: "Alabarda", slot: 6, type: "melee", grip: "pole", hands: 2, pole: true, damage: 3, reach: 4.9, arc: 0.1, cooldown: 1.0, length: 0.6, hitDelay: 0.24, weight: 0.82, knock: 7, launch: 0.8, anim: [2], lunge: 3.6, sound: "chop", price: 85 },
  { id: "shortbow", name: "Arco curto", slot: 7, type: "bow", grip: "bow", hands: 2, ammo: "arrows", projectile: "arrow", damage: 1, speed: 33, gravity: 8, cooldown: 0.68, spread: 0.015, kick: 0.018, recoil: 0.012, barrel: 0.7, weight: 0.95, color: "#96bd73", price: 35 },
  { id: "longbow", name: "Arco longo", slot: 7, type: "bow", grip: "bow", hands: 2, ammo: "arrows", projectile: "arrow", damage: 2, speed: 46, gravity: 6, cooldown: 0.95, spread: 0.01, kick: 0.025, recoil: 0.02, barrel: 0.8, weight: 0.88, color: "#b3d68a", price: 70 },
  { id: "lightcrossbow", name: "Balestra leve", slot: 8, type: "crossbow", grip: "long", hands: 2, ammo: "bolts", projectile: "bolt", damage: 2, speed: 48, gravity: 2.4, cooldown: 0.95, spread: 0.009, kick: 0.025, recoil: 0.035, barrel: 1.0, weight: 0.92, color: "#d6d0a1", price: 55 },
  { id: "heavycrossbow", name: "Balestra pesada", slot: 8, type: "crossbow", grip: "long", hands: 2, ammo: "bolts", projectile: "bolt", damage: 3, speed: 62, gravity: 1.6, cooldown: 1.7, spread: 0.006, kick: 0.04, recoil: 0.06, barrel: 1.15, weight: 0.8, color: "#e8d9a0", price: 110 },
  { id: "musket", name: "Mosquete", slot: 8, type: "musket", weaponType: "MUSKET", grip: "long", hands: 2, damage: 5, speed: 120, gravity: 0, cooldown: 3.5, spread: 0.003, kick: 0.06, recoil: 0.08, barrel: 1.25, weight: 0.84, color: "#ffd995", price: 95 },
  { id: "knives", name: "Facas de arremesso", slot: 9, type: "throw", grip: "throw", hands: 1, ammo: "knives", projectile: "knife", damage: 1, speed: 42, gravity: 12, cooldown: 0.36, spread: 0.012, kick: 0.012, recoil: 0, barrel: 0.5, weight: 1.0, color: "#cfd4cf", price: 15 },
  { id: "firebomb", name: "Bomba incendiária", slot: 9, type: "throw", grip: "throw", hands: 1, ammo: "bombs", projectile: "bomb", arc: true, damage: 6, speed: 12, gravity: 20, fuse: 2.0, radius: 6.5, cooldown: 1.0, spread: 0.02, kick: 0.02, recoil: 0, barrel: 0.5, weight: 1.0, color: "#f0a74f", price: 25 },
  { id: "oilpot", name: "Pote de óleo", slot: 9, type: "throw", grip: "throw", hands: 1, ammo: "oil", projectile: "oil", arc: true, damage: 1, speed: 12, gravity: 20, radius: 2.8, cooldown: 0.9, spread: 0.02, kick: 0.015, recoil: 0, barrel: 0.5, weight: 1.0, color: "#c9a24a", price: 14 },
];

export const WEAPONS_BY_ID = Object.fromEntries(WEAPON_LIST.map((w) => [w.id, w]));
export const SLOTS = Array.from({ length: 9 }, (_, i) => WEAPON_LIST.filter((w) => w.slot === i + 1).map((w) => w.id));
export const STARTER_WEAPONS = ["fists", "axe", "pickaxe", "scythe"];
export const AMMO_LABELS = { bolts: "VIROTES", arrows: "FLECHAS", bombs: "BOMBAS", knives: "FACAS", oil: "POTES" };
// munição vendida no ferreiro: [tipo, quantidade, preço]
export const AMMO_SHOP = [["bolts", 4, 8], ["knives", 5, 15], ["oil", 2, 14]];

// ---------------------------------------------------------------------------
// Modelos 3D (ao longo de +Y, com a empunhadura na origem)
// ---------------------------------------------------------------------------
let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    wood: makeSkinnedMaterial("leather", "#593b27", 0, 0.9),
    darkWood: makeSkinnedMaterial("leather", "#342a22", 0, 0.92),
    iron: makeSkinnedMaterial("metal", "#93968b", 0.45, 0.56),
    steel: makeSkinnedMaterial("metal", "#c0c4b8", 0.6, 0.4),
    brass: makeSkinnedMaterial("metal", "#b4965d", 0.56, 0.45),
    leather: makeSkinnedMaterial("leather", "#513b2b", 0, 1),
    cloth: makeSkinnedMaterial("fabric", "#8e4c3c", 0, 0.9),
    clay: makeSkinnedMaterial("leather", "#a65c3c", 0, 0.9),
  };
  return mats;
}

function mesh(parent, geometry, material, x, y, z) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function handle(g, M, from, to, radius = 0.032) {
  const m = mesh(g, new THREE.CylinderGeometry(radius, radius * 1.1, to - from, 6), M.wood, 0, (from + to) / 2, 0);
  return m;
}

function blade(g, M, width, from, to, thick = 0.028) {
  mesh(g, new THREE.BoxGeometry(width, to - from, thick), M.steel, 0, (from + to) / 2, 0);
  mesh(g, new THREE.ConeGeometry(width * 0.7, width * 1.6, 4), M.steel, 0, to + width * 0.7, 0).scale.z = thick / (width * 1.4);
}

function crossguard(g, M, width, y) {
  mesh(g, new THREE.BoxGeometry(width, 0.05, 0.07), M.brass, 0, y, 0);
}

function pommel(g, M, y) {
  mesh(g, new THREE.SphereGeometry(0.045, 6, 5), M.brass, 0, y, 0);
}

const builders = {
  torch(g, M) {
    // Cabo de madeira roliça reforçada
    handle(g, M, -0.22, 0.54, 0.034);
    // Anéis de reforço de ferro no cabo
    mesh(g, new THREE.CylinderGeometry(0.038, 0.038, 0.04, 7), M.iron, 0, 0.12, 0);
    mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 0.04, 7), M.iron, 0, 0.38, 0);
    // Cesto superior de ferro forjado
    mesh(g, new THREE.CylinderGeometry(0.065, 0.045, 0.16, 8), M.iron, 0, 0.60, 0);
    mesh(g, new THREE.CylinderGeometry(0.07, 0.065, 0.04, 8), M.brass, 0, 0.68, 0);
    // Miolo de brasas ardentes
    const emberMat = new THREE.MeshBasicMaterial({ color: "#ff5500", toneMapped: false });
    mesh(g, new THREE.SphereGeometry(0.05, 6, 5), emberMat, 0, 0.68, 0);
    // Chamas vibrantes em camadas cônicas
    const flameMat = new THREE.MeshBasicMaterial({ color: "#ff9933", toneMapped: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: "#fff3bb", toneMapped: false });
    mesh(g, new THREE.ConeGeometry(0.09, 0.28, 7), flameMat, 0, 0.81, 0);
    mesh(g, new THREE.ConeGeometry(0.05, 0.18, 6), coreMat, 0, 0.77, 0);
  },
  musket(g, M) {
    mesh(g, new THREE.BoxGeometry(0.11, 0.48, 0.14), M.darkWood, 0, -0.12, 0.02);
    mesh(g, new THREE.BoxGeometry(0.08, 0.78, 0.09), M.wood, 0, 0.42, 0);
    mesh(g, new THREE.CylinderGeometry(0.028, 0.034, 1.18, 8), M.steel, 0, 0.66, 0.04);
    mesh(g, new THREE.CylinderGeometry(0.042, 0.032, 0.08, 8), M.brass, 0, 1.24, 0.04);
    mesh(g, new THREE.BoxGeometry(0.09, 0.04, 0.11), M.brass, 0, 0.35, 0.02);
    mesh(g, new THREE.BoxGeometry(0.09, 0.04, 0.11), M.brass, 0, 0.72, 0.02);
  },
  dagger(g, M) {
    handle(g, M, -0.12, 0.08); crossguard(g, M, 0.2, 0.1); blade(g, M, 0.06, 0.1, 0.45, 0.022); pommel(g, M, -0.14);
  },
  knife(g, M) {
    handle(g, M, -0.12, 0.08); blade(g, M, 0.05, 0.08, 0.36, 0.02); pommel(g, M, -0.13);
  },
  longsword(g, M) {
    handle(g, M, -0.2, 0.16, 0.034); crossguard(g, M, 0.4, 0.2); blade(g, M, 0.1, 0.2, 1.15, 0.03); pommel(g, M, -0.22);
  },
  axe(g, M) {
    handle(g, M, -0.2, 0.78, 0.035);
    mesh(g, new THREE.BoxGeometry(0.34, 0.3, 0.05), M.steel, 0.15, 0.68, 0);
    mesh(g, new THREE.BoxGeometry(0.07, 0.34, 0.07), M.iron, -0.02, 0.68, 0);
  },
  pickaxe(g, M) {
    handle(g, M, -0.2, 0.78, 0.035);
    mesh(g, new THREE.BoxGeometry(0.08, 0.12, 0.08), M.iron, 0, 0.7, 0);
    const tipR = mesh(g, new THREE.ConeGeometry(0.045, 0.32, 4), M.steel, 0.18, 0.69, 0);
    tipR.rotation.z = -Math.PI / 2 - 0.15;
    const tipL = mesh(g, new THREE.ConeGeometry(0.04, 0.28, 4), M.steel, -0.16, 0.69, 0);
    tipL.rotation.z = Math.PI / 2 + 0.15;
  },
  scythe(g, M) {
    handle(g, M, -0.2, 0.95, 0.035);
    mesh(g, new THREE.BoxGeometry(0.06, 0.18, 0.06), M.wood, 0.08, 0.55, 0);
    const blade = mesh(g, new THREE.BoxGeometry(0.38, 0.08, 0.04), M.steel, 0.18, 0.92, 0);
    blade.rotation.z = -0.35;
  },
  mace(g, M) {
    handle(g, M, -0.18, 0.62, 0.035);
    mesh(g, new THREE.IcosahedronGeometry(0.16, 0), M.iron, 0, 0.74, 0);
    mesh(g, new THREE.ConeGeometry(0.04, 0.1, 4), M.steel, 0.17, 0.74, 0).rotation.z = -Math.PI / 2;
    mesh(g, new THREE.ConeGeometry(0.04, 0.1, 4), M.steel, -0.17, 0.74, 0).rotation.z = Math.PI / 2;
    mesh(g, new THREE.ConeGeometry(0.04, 0.1, 4), M.steel, 0, 0.74, 0.17).rotation.x = Math.PI / 2;
    mesh(g, new THREE.ConeGeometry(0.04, 0.1, 4), M.steel, 0, 0.74, -0.17).rotation.x = -Math.PI / 2;
    mesh(g, new THREE.ConeGeometry(0.04, 0.1, 4), M.steel, 0, 0.93, 0);
  },
  flail(g, M) {
    handle(g, M, -0.18, 0.5, 0.033);
    const chain = [0.56, 0.66, 0.76, 0.86];
    for (const y of chain) mesh(g, new THREE.TorusGeometry(0.04, 0.012, 4, 6), M.iron, 0, y, 0);
    mesh(g, new THREE.IcosahedronGeometry(0.15, 0), M.iron, 0.05, 1.03, 0);
    for (const [x, z] of [[0.2, 0], [-0.1, 0.15], [-0.1, -0.15]]) mesh(g, new THREE.ConeGeometry(0.035, 0.09, 4), M.steel, x, 1.03, z).rotation.z = -Math.PI / 2;
  },
  warhammer(g, M) {
    handle(g, M, -0.3, 1.0, 0.04);
    mesh(g, new THREE.BoxGeometry(0.22, 0.22, 0.2), M.iron, 0, 1.05, 0);
    mesh(g, new THREE.ConeGeometry(0.06, 0.28, 4), M.steel, 0.26, 1.05, 0).rotation.z = -Math.PI / 2;
    mesh(g, new THREE.ConeGeometry(0.05, 0.14, 4), M.steel, 0, 1.25, 0);
  },
  greatsword(g, M) {
    handle(g, M, -0.35, 0.2, 0.038); crossguard(g, M, 0.55, 0.26); blade(g, M, 0.14, 0.26, 1.55, 0.034); pommel(g, M, -0.38);
  },
  makeshift_spear(g, M) {
    handle(g, M, -0.5, 1.4, 0.032);
    // Ponta de madeira lascada afiada
    mesh(g, new THREE.ConeGeometry(0.065, 0.38, 4), M.wood, 0, 1.58, 0);
    // Amarração rústica de cipó/couro
    mesh(g, new THREE.CylinderGeometry(0.042, 0.042, 0.12, 6), M.leather, 0, 1.38, 0);
  },
  makeshift_club(g, M) {
    handle(g, M, -0.22, 0.65, 0.045);
    // Tronco grosso com pedras encravadas
    mesh(g, new THREE.CylinderGeometry(0.09, 0.06, 0.42, 6), M.darkWood, 0, 0.62, 0);
    mesh(g, new THREE.DodecahedronGeometry(0.12, 0), M.iron, 0.04, 0.72, 0.02);
    mesh(g, new THREE.ConeGeometry(0.04, 0.12, 4), M.iron, -0.09, 0.66, 0).rotation.z = Math.PI / 2;
  },
  spear(g, M) {
    handle(g, M, -0.55, 1.5, 0.03);
    mesh(g, new THREE.ConeGeometry(0.07, 0.34, 5), M.steel, 0, 1.67, 0);
    mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), M.brass, 0, 1.48, 0);
  },
  halberd(g, M) {
    handle(g, M, -0.55, 1.55, 0.034);
    mesh(g, new THREE.BoxGeometry(0.34, 0.34, 0.04), M.steel, 0.17, 1.4, 0);
    mesh(g, new THREE.ConeGeometry(0.05, 0.4, 4), M.steel, 0, 1.78, 0);
    mesh(g, new THREE.ConeGeometry(0.05, 0.26, 4), M.steel, -0.17, 1.4, 0).rotation.z = Math.PI / 2;
  },
  oilpot(g, M) {
    const pot = mesh(g, new THREE.SphereGeometry(0.2, 8, 6), M.clay, 0, 0.1, 0);
    pot.scale.set(1, 1.1, 1);
    mesh(g, new THREE.CylinderGeometry(0.07, 0.1, 0.1, 6), M.clay, 0, 0.3, 0);
    mesh(g, new THREE.CylinderGeometry(0.045, 0.045, 0.1, 5), M.cloth, 0, 0.38, 0);
  },
  knives(g, M) {
    for (const x of [-0.07, 0, 0.07]) {
      const k = new THREE.Group();
      k.position.set(x, 0, 0);
      k.rotation.z = x * 1.2;
      handle(k, M, -0.1, 0.06, 0.025);
      blade(k, M, 0.045, 0.06, 0.3, 0.018);
      g.add(k);
    }
  },
};

// Constrói o modelo de uma arma (null para punhos e para as armas de projétil já tratadas à parte).
export function buildWeaponModel(id) {
  const build = builders[id];
  if (!build) return null;
  const g = new THREE.Group();
  build(g, materials());
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return g;
}

// ---------------------------------------------------------------------------
// Ícones simples desenhados em canvas
// ---------------------------------------------------------------------------
const icons = {
  fists(c) { c.fillRect(8, 22, 14, 14); c.fillRect(30, 14, 14, 14); c.strokeRect(8, 22, 14, 14); c.strokeRect(30, 14, 14, 14); },
  torch(c) { line(c, 16, 48, 30, 22); c.beginPath(); c.moveTo(30, 22); c.quadraticCurveTo(22, 12, 34, 6); c.quadraticCurveTo(44, 14, 30, 22); c.fill(); },
  musket(c) { line(c, 8, 44, 46, 10); line(c, 6, 46, 16, 42); line(c, 22, 30, 28, 34); c.beginPath(); c.arc(46, 10, 2.5, 0, 6.28); c.fill(); },
  dagger(c) { c.beginPath(); c.moveTo(14, 42); c.lineTo(36, 10); c.lineTo(40, 14); c.lineTo(20, 44); c.closePath(); c.stroke(); line(c, 10, 34, 24, 44); },
  knife(c) { c.beginPath(); c.moveTo(16, 40); c.quadraticCurveTo(38, 30, 42, 10); c.lineTo(30, 28); c.closePath(); c.stroke(); line(c, 10, 46, 18, 38); },
  shortsword(c) { line(c, 12, 42, 38, 10); line(c, 38, 10, 42, 12); line(c, 18, 30, 26, 38); line(c, 8, 46, 14, 40); },
  longsword(c) { line(c, 10, 46, 42, 6); line(c, 42, 6, 46, 10); line(c, 16, 28, 28, 40); line(c, 6, 48, 12, 42); },
  axe(c) { line(c, 12, 46, 36, 10); c.beginPath(); c.moveTo(30, 8); c.quadraticCurveTo(48, 12, 44, 30); c.lineTo(34, 20); c.closePath(); c.stroke(); },
  pickaxe(c) { line(c, 14, 48, 34, 14); c.beginPath(); c.arc(28, 22, 16, 3.6, 5.9, false); c.stroke(); },
  scythe(c) { line(c, 10, 48, 38, 12); c.beginPath(); c.arc(32, 16, 14, 4.2, 6.28); c.stroke(); },
  mace(c) { line(c, 12, 46, 32, 20); c.beginPath(); c.arc(36, 15, 9, 0, 6.28); c.stroke(); for (const [a, b] of [[36, 3], [48, 15], [44, 7], [26, 8]]) line(c, 36, 15, a, b); },
  flail(c) { line(c, 10, 46, 24, 28); c.setLineDash([3, 3]); line(c, 24, 28, 38, 14); c.setLineDash([]); c.beginPath(); c.arc(42, 10, 7, 0, 6.28); c.stroke(); },
  warhammer(c) { line(c, 14, 48, 34, 14); c.strokeRect(24, 6, 22, 12); line(c, 46, 12, 52, 12); },
  greatsword(c) { line(c, 8, 50, 44, 4); line(c, 44, 4, 48, 8); line(c, 14, 30, 30, 44); line(c, 4, 52, 10, 46); },
  spear(c) { line(c, 8, 50, 40, 12); c.beginPath(); c.moveTo(38, 6); c.lineTo(46, 18); c.lineTo(34, 14); c.closePath(); c.stroke(); },
  makeshift_spear(c) { line(c, 8, 50, 40, 12); line(c, 36, 16, 46, 6); line(c, 46, 6, 38, 20); },
  makeshift_club(c) { line(c, 10, 48, 26, 26); c.lineWidth = 6; line(c, 26, 26, 44, 8); c.lineWidth = 3; },
  halberd(c) { line(c, 8, 50, 38, 10); c.beginPath(); c.moveTo(36, 6); c.lineTo(46, 12); c.lineTo(34, 24); c.closePath(); c.stroke(); line(c, 40, 14, 28, 16); },
  shortbow(c) { c.beginPath(); c.arc(34, 28, 18, 2.1, 4.2, false); c.stroke(); line(c, 24, 14, 24, 42); line(c, 14, 28, 42, 28); line(c, 38, 24, 42, 28); line(c, 38, 32, 42, 28); },
  longbow(c) { c.beginPath(); c.arc(38, 28, 26, 2.3, 4.0, false); c.stroke(); line(c, 21, 6, 21, 50); line(c, 10, 28, 46, 28); line(c, 42, 24, 46, 28); line(c, 42, 32, 46, 28); },
  lightcrossbow(c) { line(c, 8, 28, 46, 28); line(c, 40, 22, 46, 28); line(c, 40, 34, 46, 28); c.beginPath(); c.arc(20, 28, 14, 4.4, 1.9, true); c.stroke(); },
  heavycrossbow(c) { line(c, 6, 28, 46, 28); line(c, 40, 22, 46, 28); line(c, 40, 34, 46, 28); c.lineWidth = 4; c.beginPath(); c.arc(18, 28, 16, 4.4, 1.9, true); c.stroke(); line(c, 6, 34, 14, 34); },
  knives(c) { for (const o of [-8, 0, 8]) { c.beginPath(); c.moveTo(12 + o + 8, 44); c.lineTo(28 + o, 10); c.lineTo(32 + o, 14); c.closePath(); c.stroke(); } },
  firebomb(c) { c.beginPath(); c.arc(26, 32, 13, 0, 6.28); c.stroke(); line(c, 32, 20, 38, 12); c.beginPath(); c.moveTo(38, 12); c.quadraticCurveTo(46, 6, 44, 16); c.quadraticCurveTo(40, 14, 38, 12); c.fill(); },
  oilpot(c) { c.beginPath(); c.ellipse(26, 34, 14, 13, 0, 0, 6.28); c.stroke(); c.strokeRect(20, 14, 12, 10); line(c, 26, 14, 26, 8); c.beginPath(); c.moveTo(26, 8); c.quadraticCurveTo(34, 2, 32, 10); c.fill(); },
};

function line(c, x0, y0, x1, y1) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}

// Desenha o ícone de uma arma num canvas 56x56 (com cor dourada suave).
export function drawWeaponIcon(canvas, id, active = false) {
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (!id || !icons[id]) return;
  c.save();
  c.scale(canvas.width / 56, canvas.height / 56);
  c.lineWidth = 3;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = active ? "#ffe39a" : "#cfc59c";
  c.fillStyle = active ? "#ffe39a" : "#cfc59c";
  icons[id](c);
  c.restore();
}
