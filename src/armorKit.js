import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ============================================================================
// Kit de armaduras do jogador: peças detalhadas, mescladas por (categoria, pai, material).
// Cada categoria (tunic / leather / chainmail / plate) vira poucos meshes, em vez de dezenas,
// e todas as peças têm cor por vértice com oclusão falsa (escuro embaixo, reflexo no lado da luz).
// Os materiais são injetados por player.js (a paleta templária — quase preto/vermelho, cruz vermelha com
// borda branca e brilho pré-assado — continua sendo definida lá).
// ============================================================================

const _o = new THREE.Object3D();
const _c = new THREE.Color();

export class ArmorBuilder {
  constructor() {
    this.entries = new Map();
  }

  // p/r/s: transformação relativa ao pai. c: cor (multiplica o material). ao: força do escurecimento embaixo.
  add(category, parent, mat, geo, o = {}) {
    const { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], c = "#ffffff", ao = 0.28, shine = 0.1 } = o;
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
    }
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const h = bb.max.y - bb.min.y || 1;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    _c.set(c);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - bb.min.y) / h;
      let f = (1 - ao * (1 - t)) * (0.9 + 0.1 * nor.getY(i));
      f *= 1 + shine * Math.max(0, nor.getX(i) * 0.6 + nor.getZ(i) * 0.6);
      colors[i * 3] = _c.r * f;
      colors[i * 3 + 1] = _c.g * f;
      colors[i * 3 + 2] = _c.b * f;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    _o.position.set(p[0], p[1], p[2]);
    _o.rotation.set(r[0], r[1], r[2]);
    _o.scale.set(s[0], s[1], s[2]);
    _o.updateMatrix();
    g.applyMatrix4(_o.matrix);
    const key = `${category}|${parent.uuid}|${mat.uuid}`;
    let e = this.entries.get(key);
    if (!e) {
      e = { category, parent, mat, geos: [] };
      this.entries.set(key, e);
    }
    e.geos.push(g);
  }

  // Cria um mesh por (categoria, pai, material) e devolve { categoria: [meshes] }.
  // `separate` = { "categoria|nome": true } não é usado; peças que precisam de mesh próprio usam outro builder.
  build(castShadowFor = () => false) {
    const out = {};
    for (const e of this.entries.values()) {
      const merged = mergeGeometries(e.geos, false);
      for (const g of e.geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, e.mat);
      mesh.castShadow = castShadowFor(e);
      mesh.receiveShadow = false;
      mesh.name = `Armor_${e.category}`;
      e.parent.add(mesh);
      (out[e.category] ||= []).push(mesh);
    }
    this.entries.clear();
    return out;
  }
}

// --- primitivas ---------------------------------------------------------------
const cyl = (rBot, rTop, h, seg = 10, open = false, t0 = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open, t0, tl);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, ws = 10, hs = 7, pStart = 0, pLen = Math.PI * 2, tStart = 0, tLen = Math.PI) => new THREE.SphereGeometry(r, ws, hs, pStart, pLen, tStart, tLen);
const cone = (r, h, seg = 5) => new THREE.ConeGeometry(r, h, seg);
const tor = (R, r, seg = 10, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, 4, seg, arc);

// textura de malha de anéis (canvas pequeno, em cache)
let _mailTex = null;
export function mailTexture() {
  if (_mailTex) return _mailTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#555a58";
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#c9cfcb";
  g.lineWidth = 1.4;
  for (let y = 0; y < 72; y += 6) {
    for (let x = (y / 6) % 2 ? 0 : 3; x < 72; x += 6) {
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.stroke();
    }
  }
  _mailTex = new THREE.CanvasTexture(c);
  _mailTex.colorSpace = THREE.SRGBColorSpace;
  _mailTex.wrapS = THREE.RepeatWrapping;
  _mailTex.wrapT = THREE.RepeatWrapping;
  _mailTex.magFilter = THREE.NearestFilter;
  _mailTex.anisotropy = 2;
  return _mailTex;
}

// ============================================================================
// Monta todas as peças. `m` = materiais (todos com vertexColors); `body` = grupos do corpo.
// Retorna { armorPieces, chestArmor }.
// ============================================================================
export function buildPlayerArmor(m, body) {
  const { model, head, leftArm, rightArm, leftForearm, rightForearm, leftLeg, rightLeg, leftKnee, rightKnee } = body;
  const arms = [[leftArm, -1], [rightArm, 1]];
  const forearms = [[leftForearm, -1], [rightForearm, 1]];
  const legs = [[leftLeg, -1], [rightLeg, 1]];
  const knees = [[leftKnee, -1], [rightKnee, 1]];
  const B = new ArmorBuilder();
  const chestB = new ArmorBuilder();

  // ------------------------------------------------------------------ TÚNICA (sempre visível)
  B.add("tunic", model, m.cloth, cyl(0.2, 0.28, 0.34, 12), { p: [0, 0.66, 0], s: [1, 1, 0.78], c: "#ffffff", ao: 0.4, shine: 0.03 });
  // barra e pregas da saia
  B.add("tunic", model, m.cloth, cyl(0.28, 0.285, 0.03, 12), { p: [0, 0.495, 0], s: [1, 1, 0.78], c: "#b7bdb0", ao: 0.1, shine: 0 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    B.add("tunic", model, m.cloth, box(0.012, 0.3, 0.02), { p: [Math.cos(a) * 0.235, 0.66, Math.sin(a) * 0.235 * 0.78], r: [0, -a, 0], c: "#9aa090", ao: 0.1, shine: 0 });
  }
  // cinto largo com fivela de latão e bolsa
  B.add("tunic", model, m.leather, cyl(0.215, 0.215, 0.075, 12), { p: [0, 0.84, 0], s: [1, 1, 0.78], c: "#6b4a34", ao: 0.15, shine: 0.05 });
  B.add("tunic", model, m.gold, box(0.085, 0.07, 0.03), { p: [0, 0.84, 0.17], c: "#d8b867", ao: 0.1 });
  B.add("tunic", model, m.gold, box(0.045, 0.036, 0.034), { p: [0, 0.84, 0.172], c: "#6b5430", ao: 0 });
  B.add("tunic", model, m.leather, box(0.09, 0.1, 0.06), { p: [-0.2, 0.76, 0.07], r: [0, 0.3, 0.06], c: "#5a4030", ao: 0.25 });

  // ------------------------------------------------------------------ COURO (nível 1)
  B.add("leather", model, m.leather, cyl(0.21, 0.23, 0.46, 12), { p: [0, 1.14, 0], s: [1, 1, 0.78], c: "#8a6a4e", ao: 0.35, shine: 0.06 });
  B.add("leather", model, m.leather, cyl(0.232, 0.232, 0.03, 12), { p: [0, 0.92, 0], s: [1, 1, 0.78], c: "#3b2a1f", ao: 0.1 }); // bainha
  // cordões do peitilho em X + costuras
  for (let i = 0; i < 4; i++) {
    const y = 1.0 + i * 0.1;
    B.add("leather", model, m.leather, box(0.14, 0.012, 0.014), { p: [0, y, 0.168], r: [0, 0, 0.45], c: "#d9c9a0", ao: 0, shine: 0 });
    B.add("leather", model, m.leather, box(0.14, 0.012, 0.014), { p: [0, y, 0.168], r: [0, 0, -0.45], c: "#d9c9a0", ao: 0, shine: 0 });
  }
  for (const sx of [-1, 1]) {
    B.add("leather", model, m.leather, box(0.075, 0.05, 0.3), { p: [sx * 0.15, 1.45, 0], r: [0, 0, sx * -0.12], c: "#6a4c36", ao: 0.2 }); // alças de ombro
    for (let i = 0; i < 3; i++) B.add("leather", model, m.gold, sph(0.012, 5, 4), { p: [sx * 0.15, 1.475, -0.08 + i * 0.08], c: "#b99a58", ao: 0 });
  }
  for (const [fore] of forearms) B.add("leather", fore, m.leather, cyl(0.056, 0.05, 0.19, 8), { p: [0, -0.15, 0], c: "#6a4c36", ao: 0.25 }); // braçais de couro

  // ------------------------------------------------------------------ MALHA (nível 2+)
  B.add("chainmail", head, m.mail, cyl(0.12, 0.17, 0.2, 10, true), { p: [0, -0.115, 0], c: "#d6dcd8", ao: 0.3 });
  B.add("chainmail", model, m.mail, cyl(0.205, 0.255, 0.3, 12, true), { p: [0, 0.66, 0], s: [1, 1, 0.8], c: "#c8cec9", ao: 0.35 }); // cota até a coxa
  B.add("chainmail", model, m.mail, cyl(0.17, 0.2, 0.12, 12), { p: [0, 1.46, 0], s: [1, 1, 0.78], c: "#cfd5d0", ao: 0.25 }); // gola de malha
  for (const [arm] of arms) B.add("chainmail", arm, m.mail, cyl(0.068, 0.06, 0.34, 8), { p: [0, -0.17, 0], c: "#c8cec9", ao: 0.25 });
  for (const [fore] of forearms) B.add("chainmail", fore, m.mail, cyl(0.06, 0.054, 0.26, 8), { p: [0, -0.14, 0], c: "#c0c6c1", ao: 0.25 });

  // ------------------------------------------------------------------ PLACAS TEMPLÁRIAS (nível 3)
  // Couraça (mesh próprio: chestArmor, para o traje do Demiurgo poder escondê-la inteira)
  chestB.add("chest", model, m.tplPlate, new THREE.LatheGeometry(
    [[0.01, 0.12], [0.16, 0.14], [0.18, 0.3], [0.22, 0.46], [0.226, 0.54], [0.17, 0.62], [0.01, 0.62]].map(([r, y]) => new THREE.Vector2(r, y)), 14),
    { p: [0, 0.82, 0.015], s: [1.04, 1, 0.76], ao: 0.3, shine: 0.14 });
  chestB.add("chest", model, m.tplPlate, box(0.03, 0.46, 0.04), { p: [0, 1.2, 0.188], r: [0.12, 0, 0], ao: 0.1, shine: 0.3 }); // crista mediana
  chestB.add("chest", model, m.tplPlate, box(0.03, 0.4, 0.035), { p: [0, 1.2, -0.172], ao: 0.1, shine: 0.2 }); // crista das costas
  for (let i = 0; i < 3; i++) { // faldão: lâminas sobrepostas sobre o quadril
    chestB.add("chest", model, m.tplPlate, cyl(0.222 + i * 0.012, 0.226 + i * 0.012, 0.058, 14), { p: [0, 0.935 - i * 0.052, 0], s: [1.04, 1, 0.8], ao: 0.25, shine: 0.14 });
  }
  chestB.add("chest", model, m.tplPlate, cyl(0.105, 0.118, 0.11, 10), { p: [0, 1.5, 0], s: [1, 1, 0.9], ao: 0.25 }); // gorjal
  chestB.add("chest", model, m.tplPlate, cyl(0.15, 0.13, 0.05, 12), { p: [0, 1.44, 0], s: [1.2, 1, 0.9], ao: 0.15 }); // base do gorjal
  const chestOut = chestB.build((e) => true);
  const chestArmor = chestOut.chest[0];
  chestArmor.name = "PlateArmor";

  // acabamentos escuros/dourados no corpo
  B.add("plate", model, m.tplTrim, tor(0.12, 0.012, 12), { p: [0, 1.555, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.9, 1], ao: 0 }); // borda do gorjal
  B.add("plate", model, m.tplTrim, cyl(0.229, 0.229, 0.014, 14), { p: [0, 0.99, 0], s: [1.04, 1, 0.8], ao: 0 }); // borda do faldão
  B.add("plate", model, m.tplTrim, tor(0.2, 0.01, 14), { p: [0, 1.405, 0.0], r: [Math.PI / 2, 0, 0], s: [1.12, 0.78, 1], ao: 0 }); // contorno da couraça

  // Cruz vermelha de borda branca no peito
  B.add("plate", model, m.tplWhite, box(0.125, 0.4, 0.016), { p: [0, 1.29, 0.176], r: [0.1, 0, 0], ao: 0, shine: 0 });
  B.add("plate", model, m.tplWhite, box(0.3, 0.125, 0.016), { p: [0, 1.37, 0.168], r: [0.1, 0, 0], ao: 0, shine: 0 });
  B.add("plate", model, m.tplRed, box(0.08, 0.34, 0.02), { p: [0, 1.29, 0.186], r: [0.1, 0, 0], ao: 0, shine: 0.1 });
  B.add("plate", model, m.tplRed, box(0.24, 0.07, 0.02), { p: [0, 1.37, 0.178], r: [0.1, 0, 0], ao: 0, shine: 0.1 });

  // Tabardo (frente e costas) com cruz de borda branca, barra com friso
  B.add("plate", model, m.tplCloth, cyl(0.155, 0.19, 0.44, 4).rotateY(Math.PI / 4), { p: [0, 0.62, 0.188], s: [1, 1, 0.1], ao: 0.4, shine: 0 });
  B.add("plate", model, m.tplCloth, cyl(0.155, 0.19, 0.44, 4).rotateY(Math.PI / 4), { p: [0, 0.62, -0.17], s: [1, 1, 0.1], ao: 0.4, shine: 0 });
  B.add("plate", model, m.tplTrim, box(0.27, 0.02, 0.02), { p: [0, 0.405, 0.195], ao: 0, shine: 0.1 });
  B.add("plate", model, m.tplWhite, box(0.085, 0.27, 0.01), { p: [0, 0.62, 0.208], ao: 0, shine: 0 });
  B.add("plate", model, m.tplWhite, box(0.17, 0.085, 0.01), { p: [0, 0.7, 0.208], ao: 0, shine: 0 });
  B.add("plate", model, m.tplRed, box(0.05, 0.25, 0.014), { p: [0, 0.62, 0.212], ao: 0, shine: 0.1 });
  B.add("plate", model, m.tplRed, box(0.15, 0.05, 0.014), { p: [0, 0.7, 0.212], ao: 0, shine: 0.1 });

  // Escarcelas (tassets): 3 lâminas por perna, presas à coxa
  for (const [leg, sx] of legs) {
    for (let i = 0; i < 3; i++) {
      B.add("plate", leg, m.tplPlate, box(0.15 - i * 0.012, 0.085, 0.03), { p: [sx * 0.012, -0.075 - i * 0.07, 0.092 + i * 0.006], r: [-0.12 - i * 0.04, 0, 0], ao: 0.25, shine: 0.16 });
      B.add("plate", leg, m.tplTrim, box(0.152 - i * 0.012, 0.011, 0.034), { p: [sx * 0.012, -0.112 - i * 0.07, 0.096 + i * 0.006], r: [-0.12 - i * 0.04, 0, 0], ao: 0, shine: 0.1 });
    }
    // coxote (cuisse): meia-calha frontal
    B.add("plate", leg, m.tplDark, cyl(0.087, 0.082, 0.26, 8, true, -Math.PI / 2, Math.PI), { p: [0, -0.22, 0.0], ao: 0.3, shine: 0.14 });
  }

  // Ombreiras sobrepostas: cúpula + 2 lâminas + aro; cotoveleiras e braçais; manoplas
  for (const [arm, sx] of arms) {
    B.add("plate", arm, m.tplPlate, sph(0.112, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52), { p: [sx * 0.01, 0.035, 0], s: [1.28, 0.9, 1.18], ao: 0.3, shine: 0.2 });
    B.add("plate", arm, m.tplDark, cyl(0.118, 0.13, 0.045, 10), { p: [sx * 0.014, -0.012, 0], s: [1.25, 1, 1.12], ao: 0.25, shine: 0.14 });
    B.add("plate", arm, m.tplPlate, cyl(0.108, 0.12, 0.045, 10), { p: [sx * 0.02, -0.055, 0], s: [1.2, 1, 1.08], ao: 0.25, shine: 0.14 });
    B.add("plate", arm, m.tplTrim, tor(0.118, 0.01, 10), { p: [sx * 0.01, 0.0, 0], r: [Math.PI / 2, 0, 0], s: [1.28, 1.18, 1], ao: 0 });
    B.add("plate", arm, m.tplDark, cyl(0.064, 0.058, 0.2, 8), { p: [0, -0.2, 0], ao: 0.3, shine: 0.14 }); // braçal
  }
  for (const [fore, sx] of forearms) {
    B.add("plate", fore, m.tplPlate, sph(0.064, 8, 6), { p: [0, 0, 0.012], s: [1, 0.9, 1.05], ao: 0.25, shine: 0.2 }); // cotoveleira
    B.add("plate", fore, m.tplTrim, cone(0.034, 0.1, 4), { p: [0, 0.0, -0.075], r: [-Math.PI / 2, 0, 0], ao: 0.1 }); // asa traseira
    B.add("plate", fore, m.tplPlate, cyl(0.058, 0.049, 0.21, 8), { p: [0, -0.15, 0], ao: 0.3, shine: 0.16 }); // antebraço
    B.add("plate", fore, m.tplTrim, cyl(0.064, 0.064, 0.022, 8), { p: [0, -0.255, 0], ao: 0 }); // punho
    B.add("plate", fore, m.tplDark, box(0.092, 0.095, 0.1), { p: [0, -0.32, 0.005], ao: 0.3, shine: 0.14 }); // manopla
    for (let i = 0; i < 3; i++) B.add("plate", fore, m.tplTrim, box(0.085, 0.016, 0.018), { p: [0, -0.285 - i * 0.025, 0.055], ao: 0.1 }); // articulações dos dedos
  }

  // Grevas, joelheiras, sabatões
  for (const [knee, sx] of knees) {
    B.add("plate", knee, m.tplPlate, cyl(0.076, 0.066, 0.31, 8, true, -Math.PI / 2, Math.PI), { p: [0, -0.2, 0.0], ao: 0.3, shine: 0.18 }); // greva frontal
    B.add("plate", knee, m.tplDark, cyl(0.074, 0.064, 0.24, 8, true, Math.PI / 2, Math.PI), { p: [0, -0.2, 0.0], ao: 0.3 }); // panturrilha
    B.add("plate", knee, m.tplPlate, sph(0.074, 8, 6), { p: [0, 0.0, 0.034], s: [1, 0.9, 1.08], ao: 0.25, shine: 0.22 }); // joelheira
    B.add("plate", knee, m.tplTrim, cone(0.034, 0.09, 4), { p: [sx * 0.07, 0, 0.0], r: [0, 0, -sx * Math.PI / 2], ao: 0.1 }); // aba lateral
    B.add("plate", knee, m.tplDark, box(0.128, 0.04, 0.19), { p: [0, -0.37, 0.102], ao: 0.3, shine: 0.14 }); // sabatão
    B.add("plate", knee, m.tplPlate, cone(0.062, 0.1, 4), { p: [0, -0.385, 0.235], r: [Math.PI / 2, Math.PI / 4, 0], s: [1, 1, 0.55], ao: 0.15, shine: 0.14 }); // biqueira
  }

  // Elmo: calota, aro, protetores de bochecha e nuca, nasal, crista e plumas
  B.add("plate", head, m.tplPlate, sph(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), { p: [0, 0.03, -0.008], s: [1, 1.06, 1.1], ao: 0.3, shine: 0.22 });
  B.add("plate", head, m.tplTrim, cyl(0.152, 0.152, 0.038, 14), { p: [0, 0.052, -0.004], s: [1, 1, 1.08], ao: 0, shine: 0.1 });
  for (const sx of [-1, 1]) {
    B.add("plate", head, m.tplDark, box(0.022, 0.13, 0.15), { p: [sx * 0.13, -0.045, 0.01], r: [0, 0, sx * 0.1], ao: 0.3, shine: 0.14 }); // bochechas
    B.add("plate", head, m.tplTrim, box(0.024, 0.014, 0.16), { p: [sx * 0.133, -0.112, 0.012], ao: 0 });
  }
  B.add("plate", head, m.tplTrim, box(0.03, 0.15, 0.03), { p: [0, -0.03, 0.147], r: [0.08, 0, 0], ao: 0.1, shine: 0.2 }); // nasal
  B.add("plate", head, m.tplDark, cyl(0.145, 0.165, 0.1, 10, true, Math.PI / 2, Math.PI), { p: [0, -0.07, -0.01], ao: 0.3 }); // guarda de nuca
  B.add("plate", head, m.tplPlate, box(0.12, 0.1, 0.03), { p: [0, -0.04, -0.158], r: [0.5, 0, 0], ao: 0.25 }); // cauda do elmo
  B.add("plate", head, m.tplTrim, box(0.026, 0.045, 0.3), { p: [0, 0.19, -0.005], r: [-0.08, 0, 0], ao: 0.1, shine: 0.2 }); // crista de metal
  B.add("plate", head, m.tplRed, cone(0.04, 0.2, 4), { p: [0, 0.28, -0.12], r: [-0.5, Math.PI / 4, 0], s: [1, 1, 0.6], ao: 0.2, shine: 0.1 }); // pluma
  B.add("plate", head, m.tplRed, cone(0.03, 0.16, 4), { p: [0, 0.25, -0.2], r: [-0.95, Math.PI / 4, 0], s: [1, 1, 0.6], ao: 0.2, shine: 0.1 });

  const built = B.build((e) => e.parent === model);
  const armorPieces = { tunic: built.tunic || [], leather: built.leather || [], chainmail: built.chainmail || [], plate: [chestArmor, ...(built.plate || [])] };
  // marca o que fica no tronco, para o traje do Demiurgo poder esconder
  for (const mesh of armorPieces.plate) mesh.userData.bodyPlate = mesh.parent === model;
  return { armorPieces, chestArmor };
}
