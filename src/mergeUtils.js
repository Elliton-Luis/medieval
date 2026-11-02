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
