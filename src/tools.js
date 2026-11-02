import * as THREE from "three";
import { PlayerInventory } from "./rpg.js";
import { WorldDecay } from "./decay.js";

// ============================================================================
// tools.js — Sistema Especializado de Ferramentas Agrícolas e Extrativistas
// Machado (Lenha), Picareta (Minério) e Foice (Ceifa de Feno e Plantações).
// Colheita de feno remove instâncias via matriz (Zero-GC) e recua a corrupção.
// ============================================================================

export const TOOL_TYPES = Object.freeze({
  AXE: "AXE",
  PICKAXE: "PICKAXE",
  SCYTHE: "SCYTHE",
});

const _dummyMat = new THREE.Matrix4();
const _zeroScale = new THREE.Vector3(0, 0, 0);

/**
 * Cria a malha procedural 3D da Foice de Colheita (Scythe).
 */
export function buildScytheMesh(materials) {
  const group = new THREE.Group();
  group.name = "ScytheMesh";

  const woodMat = materials?.wood || new THREE.MeshStandardMaterial({ color: "#543e2b", roughness: 0.9, flatShading: true });
  const bladeMat = materials?.blade || new THREE.MeshStandardMaterial({ color: "#d8dede", metalness: 0.85, roughness: 0.25, flatShading: true });

  // Cabo longo e curvilíneo de madeira
  const shaftGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.75, 6);
  shaftGeo.translate(0, 0.75, 0);
  const shaft = new THREE.Mesh(shaftGeo, woodMat);
  shaft.castShadow = true;
  group.add(shaft);

  // Punho auxiliar lateral (Snath peg)
  const pegGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6);
  pegGeo.rotateZ(Math.PI / 2);
  pegGeo.translate(0.12, 0.65, 0);
  const peg = new THREE.Mesh(pegGeo, woodMat);
  group.add(peg);

  // Lâmina curva em meia-lua afiada no topo
  const bladeGeo = new THREE.BufferGeometry();
  const points = [
    // Lâmina arqueada
    0, 1.55, 0,
    0.05, 1.58, 0.35,
    0.01, 1.62, 0.65,
    -0.08, 1.65, 0.92,
    -0.22, 1.62, 1.15,
  ];
  // Box extrudada em arco
  const bladeBox = new THREE.BoxGeometry(0.04, 0.16, 0.88);
  bladeBox.rotateX(0.42);
  bladeBox.translate(0, 1.62, 0.42);
  const blade = new THREE.Mesh(bladeBox, bladeMat);
  blade.castShadow = true;
  group.add(blade);

  // Abraçadeira de ferro que fixa a lâmina no topo
  const collarGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6);
  collarGeo.translate(0, 1.58, 0);
  const collar = new THREE.Mesh(collarGeo, bladeMat);
  group.add(collar);

  return group;
}

/**
 * Executa a ceifa de uma plantação ou feno instanciado via Foice.
 */
export function harvestCropOrHay(hit, player, drops = null, ui = null, effects = null) {
  if (!hit || hit.instanceId === undefined || !hit.object) return false;

  const mesh = hit.object;

  // Oculta a instância ceifada rebaixando a matriz (Zero-GC)
  mesh.getMatrixAt(hit.instanceId, _dummyMat);
  _dummyMat.scale(_zeroScale);
  mesh.setMatrixAt(hit.instanceId, _dummyMat);
  mesh.instanceMatrix.needsUpdate = true;

  // Recompensa com Feno no inventário
  const gainedHay = 2 + Math.floor(Math.random() * 2);
  PlayerInventory.hay = (PlayerInventory.hay || 0) + gainedHay;

  // Drop físico do feno ou trigo
  const pt = hit.point || { x: player.x, y: 0, z: player.z };
  if (drops && drops._spawn) {
    drops._spawn("bread", pt.x + 0.3, pt.z + 0.3, 0, 0, 1);
  }

  // Efeito de palha cortada e partículas douradas
  if (effects && effects.play) {
    effects.play("dust", pt.x, (pt.y || 0) + 0.4, pt.z, "#e3c26a", 0.9);
  }

  // Mecânica de Survival: O trabalho nobre na terra recua a corrupção do mundo!
  WorldDecay.decayLevel = Math.max(0, WorldDecay.decayLevel - 0.015);

  ui?.showToast?.(`🌾 Colheita com a Foice! +${gainedHay} Feno · A terra floresce (-1.5% Corrupção)`);
  return true;
}
