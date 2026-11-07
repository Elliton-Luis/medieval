import * as THREE from "three";
import { mergeGeometries as threeMergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ============================================================================
// Utilitário de Condensação Estática de Geometrias (Redução para 1 Draw Call)
// ============================================================================
export function mergeGeometries(geometries, useGroups = false) {
  if (typeof threeMergeGeometries === "function") {
    try {
      const res = threeMergeGeometries(geometries, useGroups);
      if (res) return res;
    } catch {
      // Fallback para merge interno
    }
  }
  return mergeBufferGeometries(geometries);
}

export function mergeBufferGeometries(geometries) {
  if (!geometries || geometries.length === 0) return null;

  let totalPositions = 0;
  let totalNormals = 0;
  let totalUvs = 0;
  let totalIndices = 0;

  for (let i = 0; i < geometries.length; i++) {
    const geo = geometries[i];
    if (!geo.attributes.position) continue;
    totalPositions += geo.attributes.position.array.length;
    totalNormals += geo.attributes.normal ? geo.attributes.normal.array.length : 0;
    totalUvs += geo.attributes.uv ? geo.attributes.uv.array.length : 0;
    totalIndices += geo.index ? geo.index.array.length : geo.attributes.position.count;
  }

  const mergedPositions = new Float32Array(totalPositions);
  const mergedNormals = new Float32Array(totalNormals);
  const mergedUvs = new Float32Array(totalUvs);
  const mergedIndices = new Uint32Array(totalIndices);

  let posOffset = 0;
  let normOffset = 0;
  let uvOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;

  for (let i = 0; i < geometries.length; i++) {
    const geo = geometries[i];
    if (!geo.attributes.position) continue;

    const pos = geo.attributes.position.array;
    mergedPositions.set(pos, posOffset);
    posOffset += pos.length;

    if (geo.attributes.normal) {
      const norm = geo.attributes.normal.array;
      mergedNormals.set(norm, normOffset);
      normOffset += norm.length;
    }

    if (geo.attributes.uv) {
      const uv = geo.attributes.uv.array;
      mergedUvs.set(uv, uvOffset);
      uvOffset += uv.length;
    }

    if (geo.index) {
      const idx = geo.index.array;
      for (let j = 0; j < idx.length; j++) {
        mergedIndices[indexOffset + j] = idx[j] + vertexOffset;
      }
      indexOffset += idx.length;
    } else {
      const count = geo.attributes.position.count;
      for (let j = 0; j < count; j++) {
        mergedIndices[indexOffset + j] = j + vertexOffset;
      }
      indexOffset += count;
    }

    vertexOffset += geo.attributes.position.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(mergedPositions, 3));
  if (totalNormals > 0) {
    merged.setAttribute("normal", new THREE.BufferAttribute(mergedNormals, 3));
  } else {
    merged.computeVertexNormals();
  }
  if (totalUvs > 0) {
    merged.setAttribute("uv", new THREE.BufferAttribute(mergedUvs, 2));
  }
  merged.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
  return merged;
}

// ============================================================================
// Mescla meshes ESTÁTICOS de uma árvore em poucos meshes (1 por material/célula).
// Milhares de malhas individuais viram dezenas: menos draw calls, menos objetos
// percorridos pelo frustum culling a cada frame e menos memória de JS.
//  - células espaciais (cell metros) preservam o culling por frustum e a sombra local
//  - ignora instanced, skinned, transparentes, invisíveis e qualquer subárvore com userData.noMerge
//  - congela as matrizes do que sobrou (matrixAutoUpdate = false)
// ============================================================================
const _inv = new THREE.Matrix4();
const _rel = new THREE.Matrix4();
const _pos = new THREE.Vector3();

function _underNoMerge(obj, root) {
  for (let o = obj; o && o !== root.parent; o = o.parent) {
    if (o.userData && o.userData.noMerge) return true;
  }
  return false;
}

export function mergeStaticMeshes(root, { cell = 48 } = {}) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = new Map();
  const removable = [];

  root.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh) return;
    if (!obj.visible || _underNoMerge(obj, root)) return;
    const mat = obj.material;
    if (!mat || Array.isArray(mat) || mat.transparent) return;
    const geo = obj.geometry;
    const attrs = geo?.attributes;
    if (!attrs || !attrs.position || !attrs.normal) return;
    if (geo.morphAttributes && Object.keys(geo.morphAttributes).length) return;
    obj.getWorldPosition(_pos);
    const key = [
      mat.uuid,
      attrs.uv ? 1 : 0,
      attrs.color ? 1 : 0,
      obj.castShadow ? 1 : 0,
      obj.receiveShadow ? 1 : 0,
      Math.floor(_pos.x / cell),
      Math.floor(_pos.z / cell),
    ].join("|");
    let b = buckets.get(key);
    if (!b) {
      b = { mat, cast: obj.castShadow, receive: obj.receiveShadow, hasUv: Boolean(attrs.uv), hasColor: Boolean(attrs.color), geos: [], parent: root };
      buckets.set(key, b);
    }
    // geometria no espaço local da raiz
    _rel.multiplyMatrices(_inv, obj.matrixWorld);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(_rel);
    for (const name of Object.keys(g.attributes)) {
      if (name !== "position" && name !== "normal" && !(name === "uv" && b.hasUv) && !(name === "color" && b.hasColor)) g.deleteAttribute(name);
    }
    b.geos.push(g);
    removable.push(obj);
  });

  if (removable.length === 0) return { before: 0, after: 0 };

  for (const obj of removable) obj.parent?.remove(obj);

  let after = 0;
  for (const b of buckets.values()) {
    let merged = null;
    try {
      merged = threeMergeGeometries(b.geos, false);
    } catch {
      merged = null;
    }
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.matrixAutoUpdate = false;
    mesh.name = "MergedStatic";
    root.add(mesh);
    after++;
  }

  // poda grupos que ficaram vazios (menos nós para o three percorrer)
  const prune = (node) => {
    for (let i = node.children.length - 1; i >= 0; i--) {
      const ch = node.children[i];
      if (ch.isGroup || ch.type === "Object3D") {
        prune(ch);
        if (ch.children.length === 0 && !(ch.userData && ch.userData.noMerge)) node.remove(ch);
      }
    }
  };
  prune(root);

  // congela as matrizes do que é estático (marcadores e subárvores noMerge continuam dinâmicos)
  root.updateMatrixWorld(true);
  const freeze = (node) => {
    if (node.userData && node.userData.noMerge) return;
    node.matrixAutoUpdate = false;
    for (let i = 0; i < node.children.length; i++) freeze(node.children[i]);
  };
  freeze(root);
  return { before: removable.length, after };
}
