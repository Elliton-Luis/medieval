import * as THREE from "three";
import { PlayerInventory, PlayerStats, syncPlayerStatsToPlayer } from "./rpg.js";
import { WorldDecay } from "./decay.js";

// ============================================================================
// farming.js — Plantações Orgânicas, Visual Aprimorado e Sistema de Colheita/Plantio
// Campos fora das muralhas da capital e nas vilas agrícolas.
// Permite colher feno [E] e replantar feno no solo fértil [E] com crescimento dinâmico.
// ============================================================================

// Materiais Estáticos Reutilizados (Zero-GC)
const _soilMat = new THREE.MeshStandardMaterial({
  color: "#3a2617",
  roughness: 0.95,
  metalness: 0.05,
  flatShading: true,
});

const _ridgeMat = new THREE.MeshStandardMaterial({
  color: "#4e3522",
  roughness: 0.92,
  metalness: 0.04,
  flatShading: true,
});

const _timberFenceMat = new THREE.MeshStandardMaterial({
  color: "#523c2a",
  roughness: 0.98,
  flatShading: true,
});

const _wheatStalkMat = new THREE.MeshStandardMaterial({
  color: "#e8c456",
  roughness: 0.85,
  flatShading: true,
});

const _wheatHeadMat = new THREE.MeshStandardMaterial({
  color: "#dfa735",
  roughness: 0.78,
  flatShading: true,
});

const _wheatDarkHeadMat = new THREE.MeshStandardMaterial({
  color: "#c28828",
  roughness: 0.82,
  flatShading: true,
});

const _sproutMat = new THREE.MeshStandardMaterial({
  color: "#6c9937",
  roughness: 0.9,
  flatShading: true,
});

const _hayMat = new THREE.MeshStandardMaterial({
  color: "#d8ba5a",
  roughness: 0.9,
  flatShading: true,
});

/**
 * Cria a geometria combinada de um feixe de trigo dourado maduro (Wheat Sheaf).
 */
function createWheatSheafGroup() {
  const group = new THREE.Group();

  // 6 caules finos com pequenas variações de ângulo e altura
  const stalkGeo = new THREE.CylinderGeometry(0.022, 0.03, 1.15, 4);
  const headGeo = new THREE.ConeGeometry(0.075, 0.38, 5);

  const offsets = [
    { x: 0.0, z: 0.0, h: 1.15, rotX: 0.02, rotZ: 0.01 },
    { x: -0.09, z: 0.08, h: 1.05, rotX: 0.08, rotZ: -0.09 },
    { x: 0.11, z: -0.07, h: 1.12, rotX: -0.06, rotZ: 0.11 },
    { x: 0.08, z: 0.10, h: 1.02, rotX: 0.11, rotZ: 0.08 },
    { x: -0.10, z: -0.08, h: 1.08, rotX: -0.08, rotZ: -0.07 },
    { x: 0.0, z: 0.12, h: 1.18, rotX: 0.05, rotZ: 0.04 },
  ];

  offsets.forEach((off, i) => {
    // Caule
    const stalk = new THREE.Mesh(stalkGeo, _wheatStalkMat);
    stalk.position.set(off.x, off.h * 0.5, off.z);
    stalk.rotation.set(off.rotX, 0, off.rotZ);
    stalk.scale.set(1.0, off.h / 1.15, 1.0);
    group.add(stalk);

    // Espiga de trigo dourado no topo
    const headMat = i % 2 === 0 ? _wheatHeadMat : _wheatDarkHeadMat;
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(off.x + off.rotZ * 0.4, off.h + 0.14, off.z - off.rotX * 0.4);
    head.rotation.set(off.rotX * 1.5, (i * Math.PI) / 3, off.rotZ * 1.5);
    group.add(head);
  });

  return group;
}

/**
 * Cria a malha de brotos jovens verdes para cultivo recém-plantado.
 */
function createSproutGroup() {
  const group = new THREE.Group();
  const shootGeo = new THREE.ConeGeometry(0.03, 0.35, 4);

  const sprouts = [
    { x: -0.06, z: 0.04, ry: 0.2 },
    { x: 0.05, z: -0.03, ry: -0.3 },
    { x: 0.0, z: 0.06, ry: 0.8 },
  ];

  sprouts.forEach((s) => {
    const shoot = new THREE.Mesh(shootGeo, _sproutMat);
    shoot.position.set(s.x, 0.17, s.z);
    shoot.rotation.z = s.ry * 0.3;
    group.add(shoot);
  });

  return group;
}

/**
 * Cria um fardo retangular rústico de feno.
 */
function createHayBaleMesh(x, y, z, ry = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;

  const baleGeo = new THREE.BoxGeometry(1.25, 0.75, 0.82);
  const bale = new THREE.Mesh(baleGeo, _hayMat);
  bale.position.y = 0.38;
  bale.castShadow = true;
  group.add(bale);

  // Cordas de amarração do fardo
  const ropeMat = new THREE.MeshStandardMaterial({ color: "#8a6d41", roughness: 1 });
  for (const bx of [-0.32, 0.32]) {
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.77, 0.84), ropeMat);
    rope.position.set(bx, 0.38, 0);
    group.add(rope);
  }

  return group;
}

/**
 * Gerenciador de Plantações, Colheitas e Agricultura de Puris.
 */
export class FarmFieldManager {
  constructor({ scene, world, effects = null, audio = null, ui = null }) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.audio = audio;
    this.ui = ui;

    this.root = new THREE.Group();
    this.root.name = "FarmlandsSystem";
    this.scene.add(this.root);

    // Array de slots individuais de cultivo
    this.slots = [];
    this._windTimer = 0;
  }

  /**
   * Adiciona um campo agrícola completo com canteiros arados, fardos e slots de cultivo.
   */
  createFarmlandField(centerX, centerZ, rows = 4, cols = 8, spacingX = 1.6, spacingZ = 1.35) {
    const fieldGroup = new THREE.Group();
    fieldGroup.name = `FarmField_${Math.round(centerX)}_${Math.round(centerZ)}`;
    this.root.add(fieldGroup);

    const totalWidth = rows * spacingX;
    const totalDepth = cols * spacingZ;

    // 1. Canteiros de Terra Arada com Cristas Elevadas
    for (let r = 0; r < rows; r++) {
      const rx = centerX - (totalWidth * 0.5) + (r + 0.5) * spacingX;
      for (let c = 0; c < cols; c++) {
        const rz = centerZ - (totalDepth * 0.5) + (c + 0.5) * spacingZ;
        const groundY = this.world.heightAt(rx, rz);

        // Base do sulco de terra fértil
        const furrowBase = new THREE.Mesh(
          new THREE.BoxGeometry(spacingX * 0.88, 0.09, spacingZ * 0.95),
          _soilMat
        );
        furrowBase.position.set(rx, groundY + 0.04, rz);
        furrowBase.receiveShadow = true;
        fieldGroup.add(furrowBase);

        // Crista de terra arada elevada
        const ridge = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.18, spacingZ * 0.92, 4),
          _ridgeMat
        );
        ridge.position.set(rx, groundY + 0.11, rz);
        ridge.rotation.x = Math.PI * 0.5;
        fieldGroup.add(ridge);

        // 2. Criação do Slot de Cultivo Interativo
        const slot = {
          id: `crop_${this.slots.length}`,
          x: rx,
          y: groundY,
          z: rz,
          state: "mature", // "mature" | "growing" | "empty"
          growthTimer: 0,
          growthDuration: 42.0 + (r * 3 + c * 5) % 15, // ~42 a 57 segundos para amadurecer
          wheatGroup: createWheatSheafGroup(),
          sproutGroup: createSproutGroup(),
        };

        // Posiciona grupo de trigo maduro
        slot.wheatGroup.position.set(rx, groundY + 0.08, rz);
        slot.wheatGroup.rotation.y = ((r * 17 + c * 29) % 360) * (Math.PI / 180);
        fieldGroup.add(slot.wheatGroup);

        // Posiciona grupo de broto (inicialmente invisível)
        slot.sproutGroup.position.set(rx, groundY + 0.08, rz);
        slot.sproutGroup.visible = false;
        fieldGroup.add(slot.sproutGroup);

        this.slots.push(slot);
      }
    }

    // 3. Fardos de feno empilhados ordenadamente na margem do campo
    const baleEdgeX = centerX + (totalWidth * 0.5) + 1.2;
    const baleEdgeZ = centerZ;
    const by1 = this.world.heightAt(baleEdgeX, baleEdgeZ - 1.2);
    const by2 = this.world.heightAt(baleEdgeX, baleEdgeZ + 1.2);
    fieldGroup.add(createHayBaleMesh(baleEdgeX, by1, baleEdgeZ - 1.2, 0.15));
    fieldGroup.add(createHayBaleMesh(baleEdgeX, by2, baleEdgeZ + 1.2, -0.22));
    this.world.addStaticCollider(baleEdgeX, baleEdgeZ - 1.2, 0.8, 1.2);
    this.world.addStaticCollider(baleEdgeX, baleEdgeZ + 1.2, 0.8, 1.2);

    // 4. Mourões de madeira rústica e cerca nas extremidades
    for (let c = 0; c <= cols; c += 2) {
      const pz = centerZ - (totalDepth * 0.5) + c * spacingZ;
      const leftX = centerX - (totalWidth * 0.5) - 0.7;
      const rightX = centerX + (totalWidth * 0.5) + 0.7;
      const yL = this.world.heightAt(leftX, pz);
      const yR = this.world.heightAt(rightX, pz);

      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 5), _timberFenceMat);
      postL.position.set(leftX, yL + 0.55, pz);
      fieldGroup.add(postL);

      const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 5), _timberFenceMat);
      postR.position.set(rightX, yR + 0.55, pz);
      fieldGroup.add(postR);

      this.world.addStaticCollider(leftX, pz, 0.15, 1.1);
      this.world.addStaticCollider(rightX, pz, 0.15, 1.1);
    }
  }

  /**
   * Busca o slot de plantação mais próximo ao jogador para interação e HUD prompt.
   */
  getNearestSlot(px, pz, maxDist = 2.4) {
    let bestSlot = null;
    let minDistSq = maxDist * maxDist;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const dx = slot.x - px;
      const dz = slot.z - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }

  /**
   * Checa se há plantação próxima e atualiza o prompt do HUD na tela.
   */
  checkPrompt(playerX, playerZ, ui) {
    const slot = this.getNearestSlot(playerX, playerZ, 2.3);
    if (!slot) return false;

    if (slot.state === "mature") {
      ui?.setPrompt?.("✦ PLANTAÇÃO DE TRIGO [E] Colher Feno (+2)");
      return true;
    } else if (slot.state === "empty") {
      const hayCount = PlayerInventory.hay || 0;
      if (hayCount >= 1) {
        ui?.setPrompt?.(`✦ SOLO ARADO FÉRTIL [E] Plantar Feno (${hayCount} no alforje)`);
      } else {
        ui?.setPrompt?.("✦ SOLO ARADO FÉRTIL (Sem feno no alforje para plantar)");
      }
      return true;
    } else if (slot.state === "growing") {
      const remainingSec = Math.max(1, Math.ceil(slot.growthDuration - slot.growthTimer));
      ui?.setPrompt?.(`✦ BROTOS DE TRIGO (Crescendo no solo... ~${remainingSec}s)`);
      return true;
    }

    return false;
  }

  /**
   * Executa a ação de colher ou plantar ao pressionar [E].
   */
  interact(player, ui, audio, effects) {
    const slot = this.getNearestSlot(player.x, player.z, 2.4);
    if (!slot) return false;

    // 1. COLHEITA DE TRIGO MADURO
    if (slot.state === "mature") {
      slot.state = "empty";
      slot.wheatGroup.visible = false;
      slot.sproutGroup.visible = false;

      const gainedHay = 2;
      PlayerInventory.hay = Math.min(20, (PlayerInventory.hay || 0) + gainedHay);
      PlayerStats.hay = PlayerInventory.hay;
      syncPlayerStatsToPlayer(player, ui);

      // Recua a degradação e corrupção do mundo (Ação Virtuosa de Cuidado com a Terra)
      WorldDecay.decayLevel = Math.max(0, WorldDecay.decayLevel - 0.015);

      // Efeitos audiovisuais
      if (effects?.play) {
        effects.play("dust", slot.x, slot.y + 0.45, slot.z, "#eec85a", 1.4);
        effects.play("star", slot.x, slot.y + 0.75, slot.z, "#ffe388", 0.9);
      }
      if (audio?.step) audio.step(true, 1.2);

      ui?.showToast?.(`🌾 Feno colhido! (+${gainedHay} Feno no alforje · Total: ${PlayerInventory.hay}/20)`);
      return true;
    }

    // 2. PLANTIO NO SOLO ARADO
    if (slot.state === "empty") {
      if ((PlayerInventory.hay || 0) <= 0) {
        ui?.showToast?.("✦ Precisas de feno no alforje para plantar nesta terra fértil.");
        return true;
      }

      PlayerInventory.hay--;
      PlayerStats.hay = PlayerInventory.hay;
      syncPlayerStatsToPlayer(player, ui);

      slot.state = "growing";
      slot.growthTimer = 0;
      slot.wheatGroup.visible = false;
      slot.sproutGroup.visible = true;

      // Efeitos audiovisuais
      if (effects?.play) {
        effects.play("dust", slot.x, slot.y + 0.25, slot.z, "#523a24", 1.1);
      }
      if (audio?.step) audio.step(false, 0.9);

      ui?.showToast?.(`🌱 Feno plantado! O trigo crescerá na terra fértil. (Restam: ${PlayerInventory.hay})`);
      return true;
    }

    return false;
  }

  /**
   * Atualização por frame: crescimento contínuo de brotos para trigo maduro.
   */
  update(dt) {
    this._windTimer += dt * 2.2;
    const windAngle = Math.sin(this._windTimer) * 0.04;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];

      if (slot.state === "growing") {
        slot.growthTimer += dt;
        const progress = slot.growthTimer / slot.growthDuration;
        const sproutScale = 0.5 + progress * 0.7;
        slot.sproutGroup.scale.set(sproutScale, sproutScale, sproutScale);

        // Conclusão do crescimento: broto se transforma em trigo dourado maduro
        if (slot.growthTimer >= slot.growthDuration) {
          slot.state = "mature";
          slot.sproutGroup.visible = false;
          slot.wheatGroup.visible = true;
          slot.wheatGroup.scale.set(1, 1, 1);

          if (this.effects?.play) {
            this.effects.play("star", slot.x, slot.y + 0.8, slot.z, "#ffd566", 0.8);
          }
        }
      } else if (slot.state === "mature" && slot.wheatGroup.visible) {
        // Leve brisa nas espigas de trigo
        slot.wheatGroup.rotation.z = windAngle + ((i % 3) - 1) * 0.02;
      }
    }
  }
}
