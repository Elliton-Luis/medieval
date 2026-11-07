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
  if (m.transparent === true && m.side === THREE.DoubleSide && m.forceSinglePass === false) {
    m.forceSinglePass = true;
    return 1;
  }
  return 0;
}
