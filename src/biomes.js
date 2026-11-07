import * as THREE from "three";
import { noise2 } from "./utils.js";
import { VILLAGES } from "./kingdom.js";

// ============================================================================
// Biomas por gradiente: 3 campos de ruído de baixíssima frequência (centenas de metros) misturam
// a cor do chão por vértice. Calculado só na geração do chunk (zero custo por frame).
//   umidade  -> pântano / lodo verde-escuro
//   aridez   -> terra ocre e vermelha, ressecada
//   frio     -> cinzas azuladas e, nos extremos / altitudes, geada pálida
// Perto das vilas e da capital o efeito é atenuado, para entradas e estradas continuarem naturais.
// ============================================================================
export const BIOME_COLORS = {
  swamp: new THREE.Color("#3b4a2b"),
  swampMud: new THREE.Color("#2c3326"),
  ocre: new THREE.Color("#94683a"),
  redEarth: new THREE.Color("#7a3e2a"),
  ash: new THREE.Color("#686f74"),
  frost: new THREE.Color("#b3bbbd"),
};

const _tmp = new THREE.Color();
const SETTLEMENTS = [{ x: -2, z: -20, r: 62 }, ...VILLAGES.map((v) => ({ x: v.x, z: v.z, r: 34 }))];

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0 = dentro de uma povoação (bioma quase apagado) ... 1 = ermo aberto (bioma pleno). */
function wildness(x, z) {
  let best = Infinity;
  for (let i = 0; i < SETTLEMENTS.length; i++) {
    const s = SETTLEMENTS[i];
    const d = Math.hypot(x - s.x, z - s.z) - s.r;
    if (d < best) best = d;
  }
  return 0.18 + 0.82 * smooth(0, 70, best);
}

/**
 * Mistura a cor-base do chão (in/out em `color`) com o bioma da posição.
 * @param {THREE.Color} color cor base (modificada no lugar)
 */
export function applyBiome(color, x, z, height, seed) {
  const wet = noise2(x * 0.0042, z * 0.0042, seed + 11);
  const dry = noise2(x * 0.0031 + 50, z * 0.0031, seed + 23);
  const cold = noise2(x * 0.0023, z * 0.0023 + 90, seed + 37);
  const shade = noise2(x * 0.012, z * 0.012, seed + 61); // variação interna do bioma
  const k = wildness(x, z);

  const wSwamp = smooth(0.5, 0.64, wet) * k;
  const wArid = smooth(0.5, 0.64, dry) * (1 - wSwamp * 0.8) * k;
  const wAsh = smooth(0.5, 0.64, cold) * (1 - wSwamp * 0.6) * (1 - wArid * 0.7) * k;
  const wFrost = Math.max(smooth(0.66, 0.8, cold), smooth(5.5, 10, height) * smooth(0.4, 0.58, cold)) * k * 0.9;

  if (wSwamp > 0.001) {
    _tmp.copy(BIOME_COLORS.swamp).lerp(BIOME_COLORS.swampMud, shade);
    color.lerp(_tmp, wSwamp * 0.9);
  }
  if (wArid > 0.001) {
    _tmp.copy(BIOME_COLORS.ocre).lerp(BIOME_COLORS.redEarth, smooth(0.35, 0.75, shade));
    color.lerp(_tmp, wArid * 0.85);
  }
  if (wAsh > 0.001) color.lerp(BIOME_COLORS.ash, wAsh * 0.8);
  if (wFrost > 0.001) color.lerp(BIOME_COLORS.frost, wFrost);
  return color;
}
