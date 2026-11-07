import * as THREE from "three";
import { makeSkinnedMaterial } from "./skins.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeGlowTexture } from "./torches.js";

// Catálogo de armas: estatísticas, slots 1-9, modelos 3D procedurais e ícones em canvas.
//
// type: fists | melee | bow | crossbow | throw
// hands: 1 permite escudo (Q); 2 não.
// grip (pose da arma na mão): none | blade | heavy | pole | bow | long | throw
// Armas leves (combo: true) fazem combo de 3 golpes; as pesadas (charge: true) têm ataque carregado.

export const WEAPON_LIST = [
  { id: "fists", name: "Mãos", slot: 1, type: "fists", grip: "none", hands: 1, damage: 0.5, reach: 1.9, arc: 0.45, cooldown: 0.3, length: 0.26, hitDelay: 0.09, weight: 1.0, knock: 2.2, combo: true, anim: [5, 6, 5], lunge: 2.4, sound: "punch", price: 0 },
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
// Modelos 3D (ao longo de +Y, com a empunhadura na origem; faces chatas em ±Z, largura em X)
//
// Cada arma é montada a partir de peças (geometria + cor) que são fundidas em NO MÁXIMO 2 meshes
// (metal e orgânico: madeira/couro/pano), com:
//  - cor por vértice: gradiente de oclusão falsa (escuro embaixo, claro em cima) + reflexo "pré-assado"
//    nas faces voltadas para a luz, então o aço parece brilhar sem env map nem luz extra;
//  - poucos triângulos (alvo <= ~400 por arma) e draw calls mínimos.
// ---------------------------------------------------------------------------
let mats = null;
function materials() {
  if (mats) return mats;
  const metal = makeSkinnedMaterial("metal", "#ffffff", 0.62, 0.34);
  metal.vertexColors = true;
  metal.emissive = new THREE.Color("#171a1e"); // brilho discreto pré-assado
  metal.emissiveIntensity = 0.6;
  const organic = makeSkinnedMaterial("leather", "#ffffff", 0, 0.86);
  organic.vertexColors = true;
  mats = { metal, organic };
  return mats;
}

const C = {
  steel: "#d4d8cf", steelDark: "#9aa09a", iron: "#7f847d", ironDark: "#565a56", brass: "#c9a860", brassDark: "#8a7040",
  wood: "#7a5434", woodDark: "#4a3220", woodLight: "#946a40", leather: "#3b2a1f", leatherLight: "#5a4030", cloth: "#8e2f26", rope: "#b7a47a",
};

const _o = new THREE.Object3D();
const _col = new THREE.Color();

function newKit() {
  return { metal: [], organic: [], extra: new THREE.Group() };
}

// Registra uma peça. mat: "metal" | "organic". o: { p, r, s, c (cor), ao (0..1), shine (0..1) }
function add(kit, mat, geo, o = {}) {
  const { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], c = "#ffffff", ao = 0.32, shine = mat === "metal" ? 0.16 : 0.04 } = o;
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
  }
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const h = bb.max.y - bb.min.y || 1;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  _col.set(c);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / h;
    let f = (1 - ao * (1 - t)) * (0.9 + 0.1 * nor.getY(i));
    f *= 1 + shine * Math.max(0, nor.getX(i) * 0.7 + nor.getZ(i) * 0.5); // reflexo pré-assado do lado da luz
    colors[i * 3] = _col.r * f;
    colors[i * 3 + 1] = _col.g * f;
    colors[i * 3 + 2] = _col.b * f;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  _o.position.set(p[0], p[1], p[2]);
  _o.rotation.set(r[0], r[1], r[2]);
  _o.scale.set(s[0], s[1], s[2]);
  _o.updateMatrix();
  g.applyMatrix4(_o.matrix);
  kit[mat].push(g);
}

function finish(kit) {
  const M = materials();
  const group = kit.extra;
  for (const key of ["metal", "organic"]) {
    if (kit[key].length === 0) continue;
    const merged = mergeGeometries(kit[key], false);
    for (const g of kit[key]) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, M[key]);
    m.castShadow = false;
    m.receiveShadow = false;
    m.name = key === "metal" ? "WeaponMetal" : "WeaponOrganic";
    group.add(m);
  }
  return group;
}

// --- primitivas ---------------------------------------------------------------
const cyl = (r0, r1, len, seg = 7) => new THREE.CylinderGeometry(r1, r0, len, seg); // r0 = base (embaixo), r1 = topo
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function extrude(points, depth, bevel = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const opts = { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1 };
  const g = new THREE.ExtrudeGeometry(shape, opts);
  g.translate(0, 0, -depth / 2);
  return g;
}

// lâmina plana com ponta; o chanfro das bordas dá o fio e o brilho
function bladePoints(w, y0, y1, tipLen) {
  const h = w / 2;
  return [[-h, y0], [h, y0], [h * 0.93, y1 - tipLen], [0, y1], [-h * 0.93, y1 - tipLen]];
}

function grip(kit, y0, y1, r = 0.03, wrap = true) {
  add(kit, "organic", cyl(r, r * 0.95, y1 - y0, 7), { p: [0, (y0 + y1) / 2, 0], c: C.leather, ao: 0.2 });
  if (wrap) {
    const n = Math.max(3, Math.round((y1 - y0) / 0.045));
    for (let i = 0; i < n; i++) {
      const y = y0 + ((i + 0.5) / n) * (y1 - y0);
      add(kit, "organic", cyl(r * 1.16, r * 1.16, 0.014, 7), { p: [0, y, 0], c: i % 2 ? C.leatherLight : "#2a1d15", ao: 0.1, shine: 0.02 });
    }
  }
}

function pommel(kit, y, r = 0.042, kind = "round") {
  if (kind === "wheel") {
    add(kit, "metal", cyl(r * 1.15, r * 1.15, r * 0.9, 8), { p: [0, y, 0], c: C.brass, ao: 0.15 });
    add(kit, "metal", cyl(r * 0.5, r * 0.5, r * 1.1, 6), { p: [0, y, 0], c: C.brassDark, ao: 0.1 });
  } else {
    add(kit, "metal", new THREE.IcosahedronGeometry(r, 0), { p: [0, y, 0], c: C.brass, ao: 0.15 });
  }
}

// espada: cabo enrolado, pomo, guarda com ponteiras, ricasso e lâmina com sulco (fuller)
function sword(kit, o) {
  const { gy, gripLen, guardW, bladeL, bladeW, thick = 0.026, pomR = 0.042, curved = false, wheel = false } = o;
  grip(kit, gy - gripLen, gy, 0.03);
  pommel(kit, gy - gripLen - pomR * 0.7, pomR, wheel ? "wheel" : "round");
  // guarda: barra + ponteiras (levemente curvada para baixo nas pontas)
  add(kit, "metal", box(guardW, 0.034, 0.05), { p: [0, gy + 0.012, 0], c: C.brass, ao: 0.2 });
  for (const sx of [-1, 1]) {
    add(kit, "metal", new THREE.IcosahedronGeometry(0.026, 0), { p: [sx * guardW * 0.5, gy + (curved ? -0.005 : 0.012), 0], c: C.brass, ao: 0.1 });
    if (curved) add(kit, "metal", box(guardW * 0.18, 0.03, 0.04), { p: [sx * guardW * 0.42, gy - 0.004, 0], r: [0, 0, sx * -0.35], c: C.brass });
  }
  // ricasso + lâmina
  add(kit, "metal", box(bladeW * 0.8, 0.06, thick * 1.1), { p: [0, gy + 0.05, 0], c: C.steelDark, ao: 0.1 });
  const y0 = gy + 0.075;
  add(kit, "metal", extrude(bladePoints(bladeW, y0, bladeL, bladeW * 1.5), thick * 0.55, thick * 0.225), { c: C.steel, ao: 0.18, shine: 0.3 });
  // sulco central escurecido em ambas as faces
  const fl = (bladeL - y0) * 0.62;
  add(kit, "metal", box(bladeW * 0.17, fl, thick * 1.12), { p: [0, y0 + 0.04 + fl / 2, 0], c: C.steelDark, ao: 0.05, shine: 0.05 });
}

// ---------------------------------------------------------------------------
// Construtores por arma
// ---------------------------------------------------------------------------
const builders = {
  // Tocha: cabo de madeira, cesto de ferro e cabeça de pano/piche carbonizada. A chama é animada em updateTorchFx.
  torch(kit) {
    grip(kit, -0.22, 0.12, 0.034, true);
    add(kit, "organic", cyl(0.034, 0.03, 0.46, 7), { p: [0, 0.35, 0], c: C.wood, ao: 0.2 });
    add(kit, "organic", new THREE.IcosahedronGeometry(0.036, 0), { p: [0, -0.24, 0], c: C.woodDark });
    add(kit, "metal", cyl(0.044, 0.044, 0.03, 7), { p: [0, 0.14, 0], c: C.ironDark });
    add(kit, "metal", cyl(0.042, 0.042, 0.03, 7), { p: [0, 0.5, 0], c: C.ironDark });
    // cabeça: pano embebido em piche, amarrado com corda
    add(kit, "organic", new THREE.CylinderGeometry(0.075, 0.048, 0.2, 8), { p: [0, 0.63, 0], c: "#2b1b12", ao: 0.45, shine: 0 });
    for (const y of [0.57, 0.63, 0.69]) add(kit, "organic", cyl(0.072, 0.072, 0.012, 8), { p: [0, y, 0], c: C.rope, ao: 0.1, shine: 0 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      add(kit, "metal", box(0.014, 0.2, 0.014), { p: [Math.cos(a) * 0.072, 0.63, Math.sin(a) * 0.072], c: C.iron, ao: 0.1 }); // aros do cesto
    }
    add(kit, "metal", cyl(0.08, 0.08, 0.018, 8), { p: [0, 0.735, 0], c: C.iron }); // aro superior
    // fogo: cones aninhados (vermelho -> laranja -> amarelo) + línguas laterais + halo aditivo + brasas
    const g = kit.extra;
    const mk = (r, h, color, op) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 6, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
      );
      m.userData.h = h;
      m.userData.baseY = 0.72 + h / 2;
      m.position.y = m.userData.baseY;
      g.add(m);
      return m;
    };
    const flames = [mk(0.1, 0.36, 0xff3a08, 0.78), mk(0.072, 0.3, 0xff8a18, 0.88), mk(0.042, 0.2, 0xffe79a, 0.96)];
    const tongues = [];
    for (let i = 0; i < 2; i++) {
      const t = mk(0.04, 0.22, i ? 0xff6a10 : 0xff9a28, 0.8);
      t.userData.side = i ? 1 : -1;
      t.userData.baseY = 0.74 + 0.11;
      t.position.x = t.userData.side * 0.045;
      tongues.push(t);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7, toneMapped: false }));
    glow.position.y = 0.86;
    glow.scale.set(0.62, 0.74, 1);
    g.add(glow);
    const embers = [];
    for (let i = 0; i < 3; i++) {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color: 0xffb050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, toneMapped: false }));
      e.scale.setScalar(0.05);
      g.add(e);
      embers.push(e);
    }
    g.userData.fx = { flames, tongues, glow, embers };
  },

  // Mosquete de pederneira: coronha com placa de latão, cano oitavado com braçadeiras, fecho (cão + caçoleta),
  // guarda-mato, vareta de socar e alça de mira. Eixo: coronha em -Y, boca do cano em +Y.
  musket(kit) {
    // coronha (cunha de madeira) e antebraço
    add(kit, "organic", box(0.1, 0.5, 0.15), { p: [0, -0.14, 0.015], r: [0, 0, 0], c: C.wood, ao: 0.3 });
    add(kit, "organic", box(0.115, 0.14, 0.2), { p: [0, -0.4, 0.0], c: C.woodDark, ao: 0.25 });
    add(kit, "organic", box(0.074, 0.84, 0.07), { p: [0, 0.46, 0.012], c: C.woodLight, ao: 0.25 });
    add(kit, "metal", box(0.12, 0.05, 0.2), { p: [0, -0.475, 0.0], c: C.brass, ao: 0.2 }); // placa da coronha
    // cano
    add(kit, "metal", cyl(0.03, 0.026, 1.12, 8), { p: [0, 0.72, 0.062], c: C.steelDark, ao: 0.15, shine: 0.3 });
    add(kit, "metal", cyl(0.036, 0.036, 0.05, 8), { p: [0, 1.29, 0.062], c: C.iron }); // boca
    for (const y of [0.3, 0.62, 0.95]) add(kit, "metal", cyl(0.04, 0.04, 0.03, 8), { p: [0, y, 0.054], c: C.brass, ao: 0.1 }); // braçadeiras
    add(kit, "metal", cone(0.014, 0.05, 4), { p: [0, 1.25, 0.1], c: C.brass }); // massa de mira
    // vareta de socar sob o cano
    add(kit, "organic", cyl(0.011, 0.011, 0.95, 5), { p: [0, 0.6, -0.002], c: C.woodDark, ao: 0.1, shine: 0 });
    // fecho de pederneira (lado direito)
    add(kit, "metal", box(0.02, 0.17, 0.05), { p: [0.052, 0.31, 0.032], r: [0, 0, 0.08], c: C.ironDark });
    add(kit, "metal", box(0.02, 0.06, 0.025), { p: [0.068, 0.37, 0.055], r: [0, 0, -0.5], c: C.brass }); // cão
    add(kit, "metal", box(0.02, 0.07, 0.02), { p: [0.062, 0.4, 0.066], r: [0, 0, 0.7], c: C.steelDark }); // pederneira
    add(kit, "metal", box(0.026, 0.05, 0.04), { p: [0.052, 0.34, 0.07], c: C.steel }); // caçoleta / ferrolho
    // guarda-mato e gatilho
    add(kit, "metal", new THREE.TorusGeometry(0.05, 0.007, 4, 8, Math.PI), { p: [0, 0.17, -0.02], r: [0, Math.PI / 2, Math.PI], c: C.brass });
    add(kit, "metal", box(0.01, 0.045, 0.012), { p: [0, 0.19, 0.012], r: [0.3, 0, 0], c: C.iron });
  },

  dagger(kit) {
    sword(kit, { gy: 0.1, gripLen: 0.2, guardW: 0.2, bladeL: 0.47, bladeW: 0.06, thick: 0.02, pomR: 0.034 });
  },

  // Faca: lâmina de um gume com dorso reto e ventre curvo, cabo de madeira com rebites
  knife(kit) {
    add(kit, "organic", cyl(0.03, 0.026, 0.2, 6), { p: [0, -0.04, 0], c: C.wood, ao: 0.2 });
    for (const y of [-0.08, 0.0]) add(kit, "metal", new THREE.IcosahedronGeometry(0.011, 0), { p: [0, y, 0.03], c: C.brass });
    add(kit, "metal", box(0.054, 0.025, 0.04), { p: [0, 0.075, 0], c: C.brass });
    const pts = [[-0.022, 0.085], [0.022, 0.085], [0.03, 0.2], [0.018, 0.33], [-0.005, 0.4], [-0.024, 0.2]];
    add(kit, "metal", extrude(pts, 0.012, 0.004), { c: C.steel, ao: 0.15, shine: 0.3 });
  },

  shortsword(kit) {
    sword(kit, { gy: 0.14, gripLen: 0.2, guardW: 0.26, bladeL: 1.0, bladeW: 0.07, thick: 0.024, pomR: 0.04, curved: true });
  },

  longsword(kit) {
    sword(kit, { gy: 0.2, gripLen: 0.36, guardW: 0.4, bladeL: 1.17, bladeW: 0.09, thick: 0.026, pomR: 0.046, wheel: true });
  },

  greatsword(kit) {
    sword(kit, { gy: 0.26, gripLen: 0.6, guardW: 0.56, bladeL: 1.58, bladeW: 0.125, thick: 0.03, pomR: 0.058, curved: true, wheel: true });
    // ganchos de aparar (parrying lugs) no ricasso
    for (const sx of [-1, 1]) add(kit, "metal", box(0.06, 0.03, 0.03), { p: [sx * 0.08, 0.37, 0], r: [0, 0, sx * 0.3], c: C.steelDark });
  },

  // Machado de lenhador: cabo com veio e pomo, cabeça forjada com gume côncavo (barba) e martelo atrás
  axe(kit) {
    add(kit, "organic", cyl(0.032, 0.026, 1.0, 7), { p: [0, 0.3, 0], c: C.wood, ao: 0.2 });
    add(kit, "organic", new THREE.IcosahedronGeometry(0.04, 0), { p: [0, -0.21, 0], c: C.woodDark });
    for (const y of [-0.04, 0.1]) add(kit, "organic", cyl(0.036, 0.036, 0.018, 7), { p: [0, y, 0], c: C.leatherLight, ao: 0.1 });
    const head = [[0.02, 0.5], [0.12, 0.47], [0.25, 0.4], [0.235, 0.52], [0.215, 0.6], [0.26, 0.75], [0.12, 0.7], [0.02, 0.68]];
    add(kit, "metal", extrude(head, 0.05, 0.008), { c: C.steel, ao: 0.2, shine: 0.3 });
    add(kit, "metal", box(0.08, 0.2, 0.08), { p: [-0.012, 0.59, 0], c: C.iron, ao: 0.15 }); // cubo
    add(kit, "metal", box(0.075, 0.1, 0.07), { p: [-0.075, 0.59, 0], c: C.ironDark }); // martelo traseiro
  },

  // Picareta: cabo longo, cubo e duas pontas curvas
  pickaxe(kit) {
    add(kit, "organic", cyl(0.032, 0.026, 1.0, 7), { p: [0, 0.3, 0], c: C.wood, ao: 0.2 });
    add(kit, "organic", new THREE.IcosahedronGeometry(0.04, 0), { p: [0, -0.21, 0], c: C.woodDark });
    add(kit, "metal", box(0.09, 0.14, 0.085), { p: [0, 0.72, 0], c: C.iron, ao: 0.15 });
    for (const sx of [-1, 1]) {
      add(kit, "metal", cyl(0.042, 0.03, 0.2, 5), { p: [sx * 0.15, 0.73, 0], r: [0, 0, -sx * 1.35], c: C.steelDark, ao: 0.2 });
      add(kit, "metal", cone(0.03, 0.2, 5), { p: [sx * 0.3, 0.7, 0], r: [0, 0, -sx * 1.95], c: C.steel, ao: 0.15, shine: 0.3 });
    }
  },

  // Foice de colheita: cabo com duas manoplas, lâmina em meia-lua afiada
  scythe(kit) {
    add(kit, "organic", cyl(0.03, 0.025, 1.18, 7), { p: [0, 0.38, 0], c: C.woodLight, ao: 0.2 });
    add(kit, "organic", box(0.1, 0.03, 0.03), { p: [0.06, 0.42, 0], r: [0, 0, 0.3], c: C.wood }); // manopla
    add(kit, "organic", box(0.09, 0.03, 0.03), { p: [0.05, 0.08, 0], r: [0, 0, 0.3], c: C.wood });
    add(kit, "metal", box(0.07, 0.07, 0.06), { p: [0, 0.95, 0], c: C.iron }); // encaixe da lâmina
    const cx = -0.04;
    const cy = 0.46;
    const R = 0.53;
    const outer = [];
    const inner = [];
    for (let i = 0; i <= 9; i++) {
      const a = ((90 - i * 9) * Math.PI) / 180;
      const w = 0.075 * (1 - Math.pow(i / 9, 1.4)) + 0.004;
      outer.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
      inner.push([cx + Math.cos(a) * (R - w), cy + Math.sin(a) * (R - w)]);
    }
    const pts = outer.concat(inner.reverse());
    add(kit, "metal", extrude(pts, 0.014, 0.003), { c: C.steel, ao: 0.1, shine: 0.35 });
  },

  // Maça: cabo com punho de couro e cabeça flangeada (6 aletas) com ponta
  mace(kit) {
    grip(kit, -0.18, 0.18, 0.032, true);
    add(kit, "organic", cyl(0.03, 0.026, 0.5, 7), { p: [0, 0.4, 0], c: C.wood, ao: 0.2 });
    add(kit, "metal", cyl(0.052, 0.052, 0.04, 7), { p: [0, 0.62, 0], c: C.ironDark });
    add(kit, "metal", cyl(0.06, 0.07, 0.2, 8), { p: [0, 0.74, 0], c: C.iron, ao: 0.25 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(kit, "metal", box(0.1, 0.19, 0.022), { p: [Math.cos(a) * 0.1, 0.74, Math.sin(a) * 0.1], r: [0, -a, 0], c: C.steel, ao: 0.2, shine: 0.25 });
    }
    add(kit, "metal", cone(0.04, 0.12, 6), { p: [0, 0.89, 0], c: C.steel });
  },

  // Mangual: cabo curto, corrente de elos alternados e bola com espigões
  flail(kit) {
    grip(kit, -0.18, 0.22, 0.032, true);
    add(kit, "organic", cyl(0.03, 0.028, 0.34, 7), { p: [0, 0.4, 0], c: C.wood, ao: 0.2 });
    add(kit, "metal", cyl(0.045, 0.045, 0.03, 7), { p: [0, 0.58, 0], c: C.ironDark });
    for (let i = 0; i < 5; i++) {
      add(kit, "metal", new THREE.TorusGeometry(0.03, 0.009, 4, 6), { p: [0, 0.64 + i * 0.075, 0], r: [0, i % 2 ? Math.PI / 2 : 0, 0], c: C.iron, ao: 0.1 });
    }
    add(kit, "metal", new THREE.IcosahedronGeometry(0.13, 0), { p: [0.03, 1.1, 0], c: C.ironDark, ao: 0.3 });
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0]];
    for (const [x, y, z] of dirs) {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
      const e = new THREE.Euler().setFromQuaternion(q);
      add(kit, "metal", cone(0.033, 0.12, 4), { p: [0.03 + x * 0.17, 1.1 + y * 0.17, z * 0.17], r: [e.x, e.y, e.z], c: C.steel });
    }
  },

  // Martelo de guerra: cabo longo com langetes de ferro, cabeça com face, bico e espigão
  warhammer(kit) {
    add(kit, "organic", cyl(0.04, 0.034, 1.4, 7), { p: [0, 0.4, 0], c: C.wood, ao: 0.2 });
    grip(kit, -0.28, 0.2, 0.04, true);
    add(kit, "metal", cyl(0.046, 0.046, 0.04, 7), { p: [0, -0.31, 0], c: C.ironDark }); // regatão
    for (const sx of [-1, 1]) add(kit, "metal", box(0.014, 0.4, 0.02), { p: [sx * 0.04, 0.85, 0], c: C.ironDark, ao: 0.1 }); // langetes
    add(kit, "metal", box(0.12, 0.2, 0.17), { p: [0, 1.08, 0], c: C.iron, ao: 0.2 }); // cubo da cabeça
    add(kit, "metal", box(0.1, 0.2, 0.2), { p: [0.11, 1.08, 0], c: C.steelDark, ao: 0.15, shine: 0.25 }); // face do martelo
    add(kit, "metal", cone(0.05, 0.3, 4), { p: [-0.2, 1.08, 0], r: [0, 0, Math.PI / 2], c: C.steel, shine: 0.25 }); // bico
    add(kit, "metal", cone(0.04, 0.24, 4), { p: [0, 1.31, 0], c: C.steel });
  },

  makeshift_spear(kit) {
    add(kit, "organic", cyl(0.034, 0.024, 1.75, 6), { p: [0, 0.45, 0], r: [0, 0, 0.015], c: C.wood, ao: 0.25 });
    add(kit, "organic", new THREE.IcosahedronGeometry(0.03, 0), { p: [0.005, 0.7, 0], c: C.woodDark }); // nós do galho
    add(kit, "organic", new THREE.IcosahedronGeometry(0.028, 0), { p: [-0.01, 0.2, 0], c: C.woodDark });
    add(kit, "organic", cone(0.04, 0.4, 5), { p: [0.016, 1.55, 0], c: C.woodLight, ao: 0.3 }); // ponta endurecida no fogo
    for (const y of [1.34, 1.38, 1.42]) add(kit, "organic", cyl(0.036, 0.036, 0.016, 6), { p: [0.012, y, 0], c: C.rope, ao: 0.1 });
  },

  makeshift_club(kit) {
    grip(kit, -0.22, 0.2, 0.04, false);
    for (const y of [-0.12, 0.0, 0.12]) add(kit, "organic", cyl(0.046, 0.046, 0.025, 6), { p: [0, y, 0], c: C.rope, ao: 0.1 }); // cordas
    add(kit, "organic", new THREE.CylinderGeometry(0.1, 0.05, 0.62, 7), { p: [0, 0.5, 0], c: C.woodDark, ao: 0.35 });
    add(kit, "organic", new THREE.IcosahedronGeometry(0.05, 0), { p: [0.09, 0.62, 0.02], c: C.woodLight }); // nós
    for (const [x, y, z] of [[0.08, 0.7, 0.04], [-0.07, 0.58, 0.05], [0.02, 0.78, -0.08], [-0.03, 0.66, -0.08]]) {
      add(kit, "metal", cone(0.022, 0.07, 4), { p: [x, y, z], r: [z > 0 ? 1.2 : -1.2, 0, x > 0 ? -1.2 : 1.2], c: C.iron }); // pregos
    }
  },

  // Lança: haste longa com empunhadura, folha forjada, cubo com langetes, borla de pano e regatão
  spear(kit) {
    add(kit, "organic", cyl(0.032, 0.026, 2.0, 7), { p: [0, 0.45, 0], c: C.wood, ao: 0.2 });
    grip(kit, -0.3, 0.1, 0.034, true);
    add(kit, "metal", cone(0.036, 0.1, 6), { p: [0, -0.6, 0], r: [Math.PI, 0, 0], c: C.ironDark }); // regatão
    add(kit, "metal", cyl(0.04, 0.034, 0.14, 7), { p: [0, 1.5, 0], c: C.iron, ao: 0.2 }); // soquete
    for (const sx of [-1, 1]) add(kit, "metal", box(0.012, 0.32, 0.016), { p: [sx * 0.03, 1.33, 0], c: C.ironDark }); // langetes
    add(kit, "metal", extrude([[-0.02, 1.55], [0.02, 1.55], [0.065, 1.67], [0.052, 1.8], [0, 1.95], [-0.052, 1.8], [-0.065, 1.67]], 0.018, 0.005), { c: C.steel, ao: 0.1, shine: 0.3 });
    add(kit, "organic", cone(0.05, 0.16, 6), { p: [0, 1.4, 0], r: [Math.PI, 0, 0], c: C.cloth, ao: 0.2, shine: 0 }); // borla
  },

  // Alabarda: haste, lâmina de machado, pico no topo e gancho traseiro
  halberd(kit) {
    add(kit, "organic", cyl(0.036, 0.03, 2.05, 7), { p: [0, 0.45, 0], c: C.wood, ao: 0.2 });
    grip(kit, -0.3, 0.12, 0.038, true);
    add(kit, "metal", cone(0.04, 0.1, 6), { p: [0, -0.6, 0], r: [Math.PI, 0, 0], c: C.ironDark });
    for (const sx of [-1, 1]) add(kit, "metal", box(0.014, 0.5, 0.02), { p: [sx * 0.04, 1.3, 0], c: C.ironDark });
    add(kit, "metal", cyl(0.046, 0.04, 0.12, 7), { p: [0, 1.5, 0], c: C.iron });
    add(kit, "metal", extrude([[0.03, 1.28], [0.14, 1.24], [0.3, 1.2], [0.27, 1.38], [0.25, 1.52], [0.3, 1.68], [0.14, 1.64], [0.03, 1.62]], 0.034, 0.007), { c: C.steel, ao: 0.2, shine: 0.3 });
    add(kit, "metal", extrude([[-0.03, 1.36], [-0.2, 1.38], [-0.26, 1.46], [-0.17, 1.44], [-0.03, 1.5]], 0.03, 0.006), { c: C.steelDark, ao: 0.15 }); // gancho
    add(kit, "metal", extrude([[-0.035, 1.56], [0.035, 1.56], [0.03, 1.8], [0, 1.96], [-0.03, 1.8]], 0.03, 0.006), { c: C.steel, shine: 0.3 }); // pico
  },

  // Pote de óleo: ânfora de barro com alças e pavio de pano
  oilpot(kit) {
    add(kit, "organic", new THREE.SphereGeometry(0.2, 9, 7), { p: [0, 0.1, 0], s: [1, 1.08, 1], c: "#b0623f", ao: 0.4, shine: 0.1 });
    add(kit, "organic", cyl(0.075, 0.09, 0.12, 7), { p: [0, 0.31, 0], c: "#a25a3a", ao: 0.3 });
    add(kit, "organic", cyl(0.1, 0.1, 0.03, 7), { p: [0, 0.38, 0], c: "#8a4a30" });
    for (const sx of [-1, 1]) add(kit, "organic", new THREE.TorusGeometry(0.07, 0.016, 4, 7, Math.PI), { p: [sx * 0.1, 0.24, 0], r: [0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2], c: "#9a5535" });
    add(kit, "organic", cyl(0.032, 0.026, 0.12, 5), { p: [0, 0.45, 0], c: C.cloth, ao: 0.1, shine: 0 });
    add(kit, "organic", new THREE.TorusGeometry(0.19, 0.012, 3, 10), { p: [0, 0.12, 0], r: [Math.PI / 2, 0, 0], c: C.rope, ao: 0.1, shine: 0 });
  },

  // Bomba incendiária: esfera de ferro/barro com cinta de metal e pavio aceso
  firebomb(kit) {
    add(kit, "metal", new THREE.IcosahedronGeometry(0.27, 1), { p: [0, 0.12, 0], c: "#4a4a48", ao: 0.45, shine: 0.2 });
    for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]]) add(kit, "metal", new THREE.TorusGeometry(0.275, 0.014, 4, 12), { p: [0, 0.12, 0], r: rot, c: C.brassDark });
    add(kit, "metal", cyl(0.06, 0.05, 0.08, 6), { p: [0, 0.4, 0], c: C.brass });
    add(kit, "organic", cyl(0.014, 0.014, 0.16, 4), { p: [0.005, 0.5, 0], r: [0, 0, 0.2], c: C.rope, ao: 0.1, shine: 0 });
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff7a18, toneMapped: false }));
    spark.position.set(0.04, 0.6, 0);
    kit.extra.add(spark);
  },

  // Arco: haste curva com empunhadura, pontas com nock, corda e flecha encaixada. (a curva é em +X; o grupo é girado em weapons.js)
  shortbow(kit) { bow(kit, 1); },
  longbow(kit) { bow(kit, 1); },

  // Besta: coronha de madeira, canal com virote, arco de aço (prod) com estribo e corda
  lightcrossbow(kit) { crossbow(kit, 1); },
  heavycrossbow(kit) { crossbow(kit, 1.22); },

  knives(kit) {
    for (const x of [-0.08, 0, 0.08]) {
      const sub = newKit();
      builders.knife(sub);
      // reaproveita a geometria da faca menor, inclinada em leque
      const rot = x * 1.4;
      for (const key of ["metal", "organic"]) {
        for (const g of sub[key]) {
          g.rotateZ(rot);
          g.translate(x, 0, 0);
          kit[key].push(g);
        }
      }
    }
  },
};

function cone(r, h, seg = 6) { return new THREE.ConeGeometry(r, h, seg); }

function bow(kit, scale) {
  // haste: tubo seguindo a curva (um pouco mais grosso no meio)
  const pts = [[0, -0.6], [0.16, -0.46], [0.3, -0.24], [0.36, 0], [0.3, 0.24], [0.16, 0.46], [0, 0.62]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const curve = new THREE.CatmullRomCurve3(pts);
  add(kit, "organic", new THREE.TubeGeometry(curve, 14, 0.026, 5, false), { c: C.woodLight, ao: 0.2 });
  add(kit, "organic", cyl(0.036, 0.036, 0.2, 6), { p: [0.36, 0, 0], c: C.leather, ao: 0.15 }); // empunhadura de couro
  for (const sy of [-1, 1]) {
    add(kit, "metal", cone(0.022, 0.05, 5), { p: [0.0, sy * 0.63, 0], r: [0, 0, 0], c: C.brass }); // nock
  }
  // corda
  add(kit, "organic", cyl(0.005, 0.005, 1.2, 4), { p: [0.0, 0.01, 0.0], c: "#e0d6b6", ao: 0, shine: 0 });
  // flecha encaixada, apontando para +X (a frente do arco)
  add(kit, "organic", cyl(0.009, 0.009, 0.78, 5), { p: [0.38, 0, 0.0], r: [0, 0, Math.PI / 2], c: C.woodLight, ao: 0.05, shine: 0 });
  add(kit, "metal", cone(0.022, 0.07, 4), { p: [0.8, 0, 0], r: [0, 0, -Math.PI / 2], c: C.steel });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(kit, "organic", box(0.1, 0.035, 0.004), { p: [0.02 + 0.03, Math.cos(a) * 0.018, Math.sin(a) * 0.018], r: [a, 0, 0], c: i === 0 ? C.cloth : "#e8e0cc", ao: 0, shine: 0 });
  }
}

function crossbow(kit, k) {
  // coronha / tronco com canal
  add(kit, "organic", box(0.1, 0.82, 0.12), { p: [0, 0.12, 0], c: C.wood, ao: 0.28 });
  add(kit, "organic", box(0.12, 0.3, 0.16), { p: [0, -0.32, 0.0], c: C.woodDark, ao: 0.3 });
  add(kit, "metal", box(0.03, 0.62, 0.04), { p: [0, 0.2, 0.065], c: C.iron }); // trilho
  // virote no canal
  add(kit, "organic", cyl(0.011, 0.011, 0.58, 5), { p: [0, 0.34, 0.09], c: C.woodLight, ao: 0.1, shine: 0 });
  add(kit, "metal", cone(0.022, 0.07, 4), { p: [0, 0.68, 0.09], c: C.steel });
  // arco (prod) de aço levemente curvo + estribo + noz com gatilho
  const half = 0.48 * k;
  const pr = [[-half, 0.54], [-half * 0.55, 0.585], [0, 0.6], [half * 0.55, 0.585], [half, 0.54]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  add(kit, "metal", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pr), 10, 0.024, 5, false), { c: C.steelDark, ao: 0.2, shine: 0.25 });
  add(kit, "metal", new THREE.TorusGeometry(0.075, 0.012, 4, 8), { p: [0, 0.72, 0], r: [0, Math.PI / 2, 0], c: C.iron }); // estribo
  // corda: duas pernas das pontas do prod até a noz
  for (const sx of [-1, 1]) {
    const dx = sx * half;
    const dy = 0.54 - 0.28;
    const len = Math.hypot(dx, dy);
    add(kit, "organic", cyl(0.005, 0.005, len, 4), { p: [dx / 2, 0.54 - dy / 2, 0.06], r: [0, 0, Math.atan2(dx, dy) * -1], c: "#e0d6b6", ao: 0, shine: 0 });
  }
  add(kit, "metal", box(0.06, 0.07, 0.07), { p: [0, 0.28, 0.04], c: C.brass }); // noz
  add(kit, "metal", box(0.014, 0.1, 0.014), { p: [0, 0.1, -0.1], c: C.iron }); // gatilho
  if (k > 1) add(kit, "metal", box(0.1 * k, 0.03, 0.06), { p: [0, 0.5, 0], c: C.brass }); // reforço de latão da balestra pesada
}

let _glowTex = null;
function getGlowTex() {
  if (!_glowTex) _glowTex = makeGlowTexture("255,235,170");
  return _glowTex;
}

// Constrói o modelo de uma arma (null para punhos).
export function buildWeaponModel(id) {
  const build = builders[id];
  if (!build) return null;
  const kit = newKit();
  build(kit);
  const g = finish(kit);
  g.name = "Weapon_" + id;
  return g;
}

// Anima o fogo da tocha empunhada: cones aninhados que oscilam em escala/rotação/deslocamento, línguas
// laterais que piscam, halo aditivo pulsante e 3 brasas recicladas subindo. Custo desprezível (poucas contas por frame).
export function updateTorchFx(model, t) {
  const fx = model?.userData?.fx;
  if (!fx) return;
  const f = 1 + Math.sin(t * 21) * 0.14 + Math.sin(t * 13.7 + 1.1) * 0.1 + Math.sin(t * 34) * 0.05;
  for (let i = 0; i < fx.flames.length; i++) {
    const m = fx.flames[i];
    const sy = f * (1 - i * 0.06) + Math.sin(t * (17 + i * 5) + i) * 0.1;
    m.scale.set(1 + Math.sin(t * 15 + i * 2) * 0.14, sy, 1 + Math.cos(t * 12 + i) * 0.14);
    m.rotation.y = t * (2.4 + i * 1.3);
    m.rotation.z = Math.sin(t * 7.3 + i * 1.7) * 0.13;
    m.position.x = Math.sin(t * 9 + i) * 0.012;
    m.position.y = m.userData.baseY - m.userData.h * (1 - sy) * 0.5;
  }
  for (let i = 0; i < fx.tongues.length; i++) {
    const m = fx.tongues[i];
    const k = 0.5 + 0.5 * Math.sin(t * (11 + i * 4.3) + i * 2);
    m.scale.set(1, 0.35 + k * 0.95, 1);
    m.position.y = m.userData.baseY - m.userData.h * (1 - m.scale.y) * 0.5;
    m.position.x = m.userData.side * (0.04 + Math.sin(t * 8 + i) * 0.014);
    m.rotation.z = -m.userData.side * (0.35 + Math.sin(t * 10 + i) * 0.14);
    m.material.opacity = 0.35 + k * 0.5;
  }
  const g = 0.62 + Math.sin(t * 19) * 0.07 + Math.sin(t * 7.1) * 0.06;
  fx.glow.scale.set(g, g * 1.18, 1);
  fx.glow.material.opacity = 0.55 + Math.sin(t * 23) * 0.12;
  for (let i = 0; i < fx.embers.length; i++) {
    const e = fx.embers[i];
    const ph = (t * 0.9 + i / fx.embers.length) % 1;
    e.position.set(Math.sin(ph * 9 + i * 2.3) * 0.07, 0.8 + ph * 0.55, Math.cos(ph * 7 + i) * 0.05);
    e.material.opacity = (1 - ph) * 0.9;
    e.scale.setScalar(0.03 + 0.035 * (1 - ph));
  }
}

// ---------------------------------------------------------------------------
// Ícones simples desenhados em canvas
// ---------------------------------------------------------------------------
const icons = {
  fists(c) { c.fillRect(8, 22, 14, 14); c.fillRect(30, 14, 14, 14); c.strokeRect(8, 22, 14, 14); c.strokeRect(30, 14, 14, 14); },
  torch(c) {
    line(c, 14, 50, 28, 26); line(c, 28, 26, 30, 22); c.strokeRect(25, 21, 8, 6); line(c, 24, 28, 34, 28);
    c.beginPath(); c.moveTo(29, 20); c.quadraticCurveTo(18, 12, 27, 3); c.quadraticCurveTo(29, 9, 34, 7); c.quadraticCurveTo(42, 14, 29, 20); c.fill();
    c.beginPath(); c.moveTo(29, 18); c.quadraticCurveTo(25, 13, 29, 9); c.quadraticCurveTo(33, 13, 29, 18); c.stroke();
  },
  musket(c) {
    line(c, 6, 46, 14, 40); line(c, 14, 40, 22, 34); line(c, 20, 36, 48, 8); line(c, 22, 38, 50, 10);
    c.strokeRect(21, 31, 6, 4); line(c, 34, 22, 38, 26); line(c, 28, 34, 30, 40); c.beginPath(); c.arc(49, 9, 2, 0, 6.28); c.fill();
  },
  dagger(c) { c.beginPath(); c.moveTo(14, 42); c.lineTo(36, 10); c.lineTo(40, 14); c.lineTo(20, 44); c.closePath(); c.stroke(); line(c, 10, 34, 24, 44); },
  knife(c) { c.beginPath(); c.moveTo(16, 40); c.quadraticCurveTo(38, 30, 42, 10); c.lineTo(30, 28); c.closePath(); c.stroke(); line(c, 10, 46, 18, 38); },
  shortsword(c) {
    c.beginPath(); c.moveTo(24, 36); c.lineTo(38, 8); c.lineTo(41, 11); c.lineTo(28, 38); c.closePath(); c.stroke();
    line(c, 18, 36, 34, 42); line(c, 21, 40, 15, 48); c.beginPath(); c.arc(14, 49, 2, 0, 6.28); c.fill();
  },
  longsword(c) {
    c.beginPath(); c.moveTo(22, 34); c.lineTo(44, 4); c.lineTo(47, 7); c.lineTo(27, 38); c.closePath(); c.stroke();
    line(c, 14, 34, 32, 44); line(c, 19, 40, 11, 50); c.beginPath(); c.arc(10, 51, 2.4, 0, 6.28); c.fill(); line(c, 31, 22, 40, 12);
  },
  axe(c) {
    line(c, 10, 50, 36, 10); c.beginPath(); c.moveTo(30, 18); c.lineTo(46, 24); c.quadraticCurveTo(40, 14, 44, 4); c.lineTo(32, 10); c.closePath(); c.stroke(); line(c, 28, 14, 22, 20);
  },
  pickaxe(c) { line(c, 14, 48, 34, 14); c.beginPath(); c.arc(28, 22, 16, 3.6, 5.9, false); c.stroke(); },
  scythe(c) { line(c, 10, 48, 38, 12); c.beginPath(); c.arc(32, 16, 14, 4.2, 6.28); c.stroke(); },
  mace(c) { line(c, 12, 46, 32, 20); c.beginPath(); c.arc(36, 15, 9, 0, 6.28); c.stroke(); for (const [a, b] of [[36, 3], [48, 15], [44, 7], [26, 8]]) line(c, 36, 15, a, b); },
  flail(c) { line(c, 10, 46, 24, 28); c.setLineDash([3, 3]); line(c, 24, 28, 38, 14); c.setLineDash([]); c.beginPath(); c.arc(42, 10, 7, 0, 6.28); c.stroke(); },
  warhammer(c) { line(c, 14, 48, 34, 14); c.strokeRect(24, 6, 22, 12); line(c, 46, 12, 52, 12); },
  greatsword(c) {
    c.beginPath(); c.moveTo(20, 32); c.lineTo(46, 2); c.lineTo(50, 6); c.lineTo(26, 38); c.closePath(); c.stroke();
    line(c, 10, 32, 32, 46); line(c, 17, 40, 7, 52); line(c, 22, 34, 20, 40); line(c, 30, 24, 42, 10); c.beginPath(); c.arc(6, 53, 2.6, 0, 6.28); c.fill();
  },
  spear(c) {
    line(c, 6, 52, 40, 12); c.beginPath(); c.moveTo(38, 4); c.lineTo(46, 14); c.lineTo(40, 20); c.lineTo(32, 14); c.closePath(); c.stroke();
    line(c, 34, 18, 38, 22);
  },
  makeshift_spear(c) { line(c, 8, 50, 40, 12); line(c, 36, 16, 46, 6); line(c, 46, 6, 38, 20); },
  makeshift_club(c) { line(c, 10, 48, 26, 26); c.lineWidth = 6; line(c, 26, 26, 44, 8); c.lineWidth = 3; },
  halberd(c) {
    line(c, 8, 52, 38, 12); c.beginPath(); c.moveTo(34, 18); c.quadraticCurveTo(52, 14, 48, 32); c.lineTo(40, 26); c.closePath(); c.stroke();
    line(c, 36, 14, 40, 4); line(c, 32, 22, 22, 24);
  },
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
