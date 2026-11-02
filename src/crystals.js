import * as THREE from "three";
import { PlayerInventory } from "./rpg.js";

// ============================================================================
// Catálogo das 6 Cores de Cristais e Tochas Místicas
// ============================================================================
export const CRYSTAL_PALETTE = {
  orange: {
    id: "orange",
    name: "Fogo Comum",
    label: "Laranja",
    flameHex: "#ff9933",
    coreHex: "#fff1aa",
    lightHex: 0xffb45a,
  },
  green: {
    id: "green",
    name: "Cristal de Esmeralda",
    label: "Verde",
    flameHex: "#18ff44",
    coreHex: "#b8ffcc",
    lightHex: 0x22ff55,
  },
  blue: {
    id: "blue",
    name: "Cristal de Safira",
    label: "Azul",
    flameHex: "#1188ff",
    coreHex: "#bee0ff",
    lightHex: 0x22aaff,
  },
  pink: {
    id: "pink",
    name: "Cristal de Quartzo Rosa",
    label: "Rosa",
    flameHex: "#ff33aa",
    coreHex: "#ffd6f2",
    lightHex: 0xff44bb,
  },
  red: {
    id: "red",
    name: "Cristal de Rubi",
    label: "Vermelho",
    flameHex: "#ff1122",
    coreHex: "#ffb5b8",
    lightHex: 0xff2233,
  },
  white: {
    id: "white",
    name: "Cristal de Diamante",
    label: "Branca",
    flameHex: "#eaf4ff",
    coreHex: "#ffffff",
    lightHex: 0xffffff,
  },
  purple: {
    id: "purple",
    name: "Cristal de Ametista",
    label: "Roxo",
    flameHex: "#aa22ff",
    coreHex: "#ecc4ff",
    lightHex: 0xbb33ff,
  },
};

export const ACTIVE_CRYSTAL_NODES = [];

// ============================================================================
// Criação e Spawn de Nós de Cristais no Terreno
// ============================================================================
export function spawnCrystalNodes({ scene, world, cityCenter }) {
  ACTIVE_CRYSTAL_NODES.length = 0;
  if (!scene || !world) return;

  const cx = cityCenter?.x ?? 0;
  const cz = cityCenter?.z ?? 0;

  // 48 Nós de Cristais com alta frequência e distribuição equilibrada
  const colors = ["green", "blue", "pink", "red", "white", "purple"];
  const nodeDefinitions = [];
  
  // Anel próximo (35m a 85m) - 12 nós
  const nearR = [38, 55, 70, 82, 45, 62, 75, 50, 68, 85, 42, 60];
  for (let i = 0; i < nearR.length; i++) {
    const ang = (i / nearR.length) * Math.PI * 2 + 0.2;
    nodeDefinitions.push({
      color: colors[i % colors.length],
      x: cx + Math.cos(ang) * nearR[i],
      z: cz + Math.sin(ang) * nearR[i],
    });
  }

  // Anel intermediário (90m a 160m) - 18 nós
  const midR = [95, 110, 125, 140, 155, 105, 120, 135, 150, 115, 130, 145, 160, 100, 128, 142, 118, 152];
  for (let i = 0; i < midR.length; i++) {
    const ang = (i / midR.length) * Math.PI * 2 + 0.5;
    nodeDefinitions.push({
      color: colors[(i + 1) % colors.length],
      x: cx + Math.cos(ang) * midR[i],
      z: cz + Math.sin(ang) * midR[i],
    });
  }

  // Anel distante e ermos (170m a 270m) - 18 nós
  const farR = [175, 195, 215, 235, 255, 185, 205, 225, 245, 265, 180, 200, 220, 240, 260, 190, 210, 250];
  for (let i = 0; i < farR.length; i++) {
    const ang = (i / farR.length) * Math.PI * 2 + 0.9;
    nodeDefinitions.push({
      color: colors[(i + 2) % colors.length],
      x: cx + Math.cos(ang) * farR[i],
      z: cz + Math.sin(ang) * farR[i],
    });
  }

  for (let i = 0; i < nodeDefinitions.length; i++) {
    const def = nodeDefinitions[i];
    const info = CRYSTAL_PALETTE[def.color];
    const y = world.heightAt(def.x, def.z);

    const group = new THREE.Group();
    group.position.set(def.x, y, def.z);

    // Material emissivo do cristal
    const crystalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(info.flameHex),
      emissive: new THREE.Color(info.flameHex),
      emissiveIntensity: 1.8,
      roughness: 0.15,
      metalness: 0.85,
      flatShading: true,
    });

    // 4 Prismas de cristal crescendo do solo
    const prismGeo = new THREE.ConeGeometry(0.14, 0.75, 5);
    const angles = [0, 1.4, 2.8, 4.3];
    const scales = [1.0, 0.75, 0.9, 0.6];
    const tilts = [0.15, -0.22, 0.18, -0.12];

    for (let p = 0; p < 4; p++) {
      const prism = new THREE.Mesh(prismGeo, crystalMat);
      prism.position.set(Math.cos(angles[p]) * 0.22, 0.35 * scales[p], Math.sin(angles[p]) * 0.22);
      prism.scale.set(scales[p], scales[p], scales[p]);
      prism.rotation.z = tilts[p];
      prism.rotation.x = tilts[p] * 0.8;
      group.add(prism);
    }

    // Base rochosa escura
    const baseRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.38, 0),
      new THREE.MeshStandardMaterial({ color: 0x333038, roughness: 0.9, flatShading: true })
    );
    baseRock.position.set(0, 0.08, 0);
    baseRock.scale.set(1.2, 0.45, 1.1);
    group.add(baseRock);

    scene.add(group);

    ACTIVE_CRYSTAL_NODES.push({
      id: i,
      color: def.color,
      name: info.name,
      label: info.label,
      info,
      x: def.x,
      y,
      z: def.z,
      group,
      collected: false,
    });
  }

  // Cria uma única PointLight compartilhada para todos os cristais do mundo,
  // mantendo visible=true estático e apenas reposicionando quando o jogador se aproxima (<10m).
  if (!_sharedCrystalLight && scene) {
    _sharedCrystalLight = new THREE.PointLight(0x00ffff, 0, 10.0, 1.8);
    _sharedCrystalLight.visible = true;
    _sharedCrystalLight.position.set(0, -9999, 0);
    scene.add(_sharedCrystalLight);
  }
}

let _sharedCrystalLight = null;

/**
 * Atualiza a luz compartilhada dos cristais. Se o jogador estiver perto (<10m), ilumina; senão intensidade = 0.
 * Zero recompilação de shader.
 */
export function updateCrystalLight(playerPos) {
  if (!_sharedCrystalLight || !playerPos) return;
  const px = playerPos.x ?? playerPos.position?.x ?? 0;
  const pz = playerPos.z ?? playerPos.position?.z ?? 0;

  let nearest = null;
  let nearestDistSq = 100.0; // raio de 10m

  for (let i = 0; i < ACTIVE_CRYSTAL_NODES.length; i++) {
    const node = ACTIVE_CRYSTAL_NODES[i];
    if (node.collected || !node.group.visible) continue;
    const dx = node.x - px;
    const dz = node.z - pz;
    const dSq = dx * dx + dz * dz;
    if (dSq < nearestDistSq) {
      nearestDistSq = dSq;
      nearest = node;
    }
  }

  if (nearest) {
    _sharedCrystalLight.position.set(nearest.x, nearest.y + 0.6, nearest.z);
    _sharedCrystalLight.color.setHex(nearest.info.lightHex);
    _sharedCrystalLight.intensity = 1.8;
  } else {
    _sharedCrystalLight.intensity = 0;
    _sharedCrystalLight.position.set(0, -9999, 0);
  }
}
}

// ============================================================================
// Interação e Coleta de Cristais no Solo
// ============================================================================
export function checkCrystalNearby(playerPos) {
  if (!playerPos) return null;
  const px = playerPos.x ?? playerPos.position?.x ?? 0;
  const pz = playerPos.z ?? playerPos.position?.z ?? 0;

  for (let i = 0; i < ACTIVE_CRYSTAL_NODES.length; i++) {
    const node = ACTIVE_CRYSTAL_NODES[i];
    if (node.collected || !node.group.visible) continue;
    const dx = node.x - px;
    const dz = node.z - pz;
    if (dx * dx + dz * dz < 2.3 * 2.3) {
      return node;
    }
  }
  return null;
}

export function collectCrystalNode(node, ui, audio, weapons) {
  if (!node || node.collected) return false;
  node.collected = true;
  node.group.visible = false;

  // Registra no inventário do jogador
  PlayerInventory.crystals = PlayerInventory.crystals || {
    green: 0,
    blue: 0,
    pink: 0,
    red: 0,
    white: 0,
    purple: 0,
  };
  PlayerInventory.crystals[node.color] = (PlayerInventory.crystals[node.color] || 0) + 1;

  // Infunde a Tocha imediatamente com a nova cor coletada
  applyTorchColor(node.color, weapons);

  if (audio?.coin) audio.coin();
  ui?.showToast?.(`✦ Coletaste ${node.name}! Tua Tocha agora arde em chama ${node.label.toUpperCase()}!`);
  return true;
}

// ============================================================================
// Aplicação da Cor na Tocha Equipada (Materiais e Luz)
// ============================================================================
export function applyTorchColor(colorKey, weapons) {
  const info = CRYSTAL_PALETTE[colorKey] || CRYSTAL_PALETTE.orange;
  PlayerInventory.torchColor = info.id;

  if (weapons) {
    // Altera a cor da luz dinâmica da tocha
    if (weapons.torchLight) {
      weapons.torchLight.color.setHex(info.lightHex);
    }

    // Altera a cor das chamas 3D na mão do jogador
    const torchModel = weapons.models?.torch;
    if (torchModel) {
      torchModel.traverse((child) => {
        if (child.isMesh && child.geometry?.type === "ConeGeometry") {
          if (child.material) {
            // A chama externa recebe a cor vibrante, o cone interno recebe o núcleo claro
            if (child.scale.x > 0.8 || child.geometry.parameters?.radius > 0.06) {
              child.material.color.set(info.flameHex);
            } else {
              child.material.color.set(info.coreHex);
            }
          }
        }
      });
    }
  }
}
