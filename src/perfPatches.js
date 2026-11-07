// ============================================================================
// perfPatches.js — correções de desempenho no nível do three.js (carregar ANTES de criar a cena).
//
// 1) Subárvores ESCONDIDAS não atualizam matrizes.
//    Object3D.updateMatrixWorld percorre TODOS os nós da cena a cada frame (~23 mil aqui), inclusive os de NPCs
//    distantes, casas culladas, LODs desligados e monstros dormindo. Medido: ~27% do tempo de JS. Um nó invisível
//    apenas marca `matrixWorldNeedsUpdate = true` e não desce nos filhos; ao reaparecer, a próxima atualização
//    recalcula tudo (force propaga). getWorldPosition/localToWorld não dependem disso (usam updateWorldMatrix).
//
// 2) Materiais transparentes de DUAS faces em passada única.
//    O three desenha material transparente + DoubleSide em duas passadas (costas e frente) e marca
//    `material.needsUpdate = true` a cada passada, o que refaz getParameters/getProgram por objeto por frame
//    (~20% do JS medido) e dobra os draw calls desses objetos (chamas, feixes de luz, almas, teias...).
//    forceSinglePass = true mantém o visual (aditivo/translúcido sem escrita de profundidade) com 1 passada.
// ============================================================================
import * as THREE from "three";

const _origUpdateMatrixWorld = THREE.Object3D.prototype.updateMatrixWorld;
THREE.Object3D.prototype.updateMatrixWorld = function patchedUpdateMatrixWorld(force) {
  if (this.visible === false && this.parent !== null) {
    this.matrixWorldNeedsUpdate = true; // recalcula tudo quando voltar a ficar visível
    return;
  }
  _origUpdateMatrixWorld.call(this, force);
};

// ----------------------------------------------------------------------------
// 3) DITHERING ordenado estilo PS1/PS2 (opcional: ?dither=1). Cor de 16 bits = 5 bits por canal; o degradê (névoa,
//    sombra noturna) vira padrão de pontos em vez de faixas. Reaproveita o gancho `material.dithering` do three
//    (que roda por último no fragment shader, já em sRGB): troca o ruído sutil dele por matriz de Bayer 4x4 e
//    quantiza em 32 níveis por canal. Sem passada extra de tela e sem render target.
// ----------------------------------------------------------------------------
export const DITHER_ON = typeof location !== "undefined" && new URLSearchParams(location.search).get("dither") === "1";

if (DITHER_ON) {
  THREE.ShaderChunk.dithering_pars_fragment = /* glsl */ `
#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		const mat4 bayer = mat4(
			0.0,  8.0,  2.0, 10.0,
			12.0, 4.0, 14.0,  6.0,
			3.0, 11.0,  1.0,  9.0,
			15.0, 7.0, 13.0,  5.0 );
		ivec2 p = ivec2( mod( floor( gl_FragCoord.xy ), 4.0 ) );
		float threshold = bayer[ p.x ][ p.y ] / 16.0 - 0.5;
		const float LEVELS = 31.0;
		return floor( color * LEVELS + 0.5 + threshold ) / LEVELS;
	}
#endif
`;
}

const _seen = new WeakSet();

/** Marca forceSinglePass nos materiais transparentes de duas faces ainda não tratados. Retorna quantos mudou. */
export function fixDoubleSidedTransparent(root) {
  let changed = 0;
  root.traverse((o) => {
    const mat = o.material;
    if (!mat) return;
    if (Array.isArray(mat)) {
      for (const m of mat) changed += _fix(m);
    } else {
      changed += _fix(mat);
    }
  });
  return changed;
}

function _fix(m) {
  if (_seen.has(m)) return 0;
  _seen.add(m);
  if (DITHER_ON && m.dithering === false) m.dithering = true;
  if (m.transparent === true && m.side === THREE.DoubleSide && m.forceSinglePass === false) {
    m.forceSinglePass = true;
    return 1;
  }
  return 0;
}
