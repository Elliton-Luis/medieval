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
  constructor({ scene, world, settlement = null, effects = null, audio = null, ui = null }) {
    this.scene = scene;
    this.world = world;
    this.settlement = settlement || world?.settlement || null;
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
   * Checa se uma coordenada (x, z) cai dentro ou muito perto do perímetro de uma casa,
   * capela ou construção com piso/paredes sólidas, impedindo que plantações invadam o interior.
   */
  isInsideOrNearBuilding(x, z, margin = 2.4) {
    // 1. Checa todas as casas e capelas do assentamento (Caldera e vilas)
    const settlement = this.settlement || this.world?.settlement || window.__game?.settlement;
    if (settlement) {
      if (Array.isArray(settlement.houses)) {
        for (let i = 0; i < settlement.houses.length; i++) {
          const h = settlement.houses[i];
          if (!h) continue;
          if (h.outer) {
            if (
              x >= h.outer.minX - margin &&
              x <= h.outer.maxX + margin &&
              z >= h.outer.minZ - margin &&
              z <= h.outer.maxZ + margin
            ) {
              return true;
            }
          }
          if (h.rect) {
            if (
              x >= h.rect.minX - margin &&
              x <= h.rect.maxX + margin &&
              z >= h.rect.minZ - margin &&
              z <= h.rect.maxZ + margin
            ) {
              return true;
            }
          }
          if (h.x !== undefined && h.z !== undefined) {
            const rMax = Math.max(h.W || 6.2, h.D || 5.8) * 0.5 + margin;
            const dx = x - h.x;
            const dz = z - h.z;
            if (dx * dx + dz * dz < rMax * rMax) {
              return true;
            }
          }
        }
      }

      if (Array.isArray(settlement.churches)) {
        for (let i = 0; i < settlement.churches.length; i++) {
          const ch = settlement.churches[i];
          if (!ch) continue;
          if (ch.outer) {
            if (
              x >= ch.outer.minX - margin &&
              x <= ch.outer.maxX + margin &&
              z >= ch.outer.minZ - margin &&
              z <= ch.outer.maxZ + margin
            ) {
              return true;
            }
          }
          const cdx = x - (ch.x || 0);
          const cdz = z - (ch.z || 0);
          if (cdx * cdx + cdz * cdz < (13.0 + margin) * (13.0 + margin)) {
            return true;
          }
        }
      }

      if (settlement.blacksmith) {
        const bdx = x - settlement.blacksmith.x;
        const bdz = z - settlement.blacksmith.z;
        if (bdx * bdx + bdz * bdz < (9.5 + margin) * (9.5 + margin)) return true;
      }
      if (settlement.market) {
        const mdx = x - settlement.market.x;
        const mdz = z - settlement.market.z;
        if (mdx * mdx + mdz * mdz < (9.5 + margin) * (9.5 + margin)) return true;
      }
      if (settlement.gate) {
        const gdx = x - settlement.gate.x;
        const gdz = z - settlement.gate.z;
        if (gdx * gdx + gdz * gdz < (9.0 + margin) * (9.0 + margin)) return true;
      }
      if (settlement.well) {
        const wdx = x - settlement.well.x;
        const wdz = z - settlement.well.z;
        if (wdx * wdx + wdz * wdz < (3.5 + margin) * (3.5 + margin)) return true;
      }
    }

    // 2. Checa todos os pisos de construções registrados no mundo (world.floors)
    if (this.world && Array.isArray(this.world.floors)) {
      for (let i = 0; i < this.world.floors.length; i++) {
        const f = this.world.floors[i];
        if (!f) continue;
        if (
          x >= f.minX - margin &&
          x <= f.maxX + margin &&
          z >= f.minZ - margin &&
          z <= f.maxZ + margin
        ) {
          return true;
        }
      }
    }

    // 3. Checa caixas de colisão de paredes e estruturas sólidas (world.boxes)
    if (this.world && Array.isArray(this.world.boxes)) {
      for (let i = 0; i < this.world.boxes.length; i++) {
        const b = this.world.boxes[i];
        if (!b || !b.active || (!b.move && !b.shot)) continue;
        if (
          x >= b.minX - margin &&
          x <= b.maxX + margin &&
          z >= b.minZ - margin &&
          z <= b.maxZ + margin
        ) {
          return true;
        }
      }
    }

    // 4. Checa colisores estáticos
    if (this.world && typeof this.world.isBlockedAt === "function") {
      if (this.world.isBlockedAt(x, z, margin * 0.65)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Adiciona um campo agrícola completo com canteiros arados, fardos e slots de cultivo.
   * Canteiros que caírem dentro ou rente a casas são limpos automaticamente sem quebrar o layout.
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

        // Se este canteiro estiver dentro ou rente a uma casa ou construção, pula para nunca invadir a casa!
        if (this.isInsideOrNearBuilding(rx, rz, 2.2)) {
          continue;
        }

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
    const bz1 = baleEdgeZ - 1.2;
    const bz2 = baleEdgeZ + 1.2;
    if (!this.isInsideOrNearBuilding(baleEdgeX, bz1, 1.8)) {
      const by1 = this.world.heightAt(baleEdgeX, bz1);
      fieldGroup.add(createHayBaleMesh(baleEdgeX, by1, bz1, 0.15));
      this.world.addStaticCollider(baleEdgeX, bz1, 0.8, 1.2);
    }
    if (!this.isInsideOrNearBuilding(baleEdgeX, bz2, 1.8)) {
      const by2 = this.world.heightAt(baleEdgeX, bz2);
      fieldGroup.add(createHayBaleMesh(baleEdgeX, by2, bz2, -0.22));
      this.world.addStaticCollider(baleEdgeX, bz2, 0.8, 1.2);
    }

    // 4. Mourões de madeira rústica e cerca nas extremidades
    for (let c = 0; c <= cols; c += 2) {
      const pz = centerZ - (totalDepth * 0.5) + c * spacingZ;
      const leftX = centerX - (totalWidth * 0.5) - 0.7;
      const rightX = centerX + (totalWidth * 0.5) + 0.7;

      if (!this.isInsideOrNearBuilding(leftX, pz, 1.6)) {
        const yL = this.world.heightAt(leftX, pz);
        const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 5), _timberFenceMat);
        postL.position.set(leftX, yL + 0.55, pz);
        fieldGroup.add(postL);
        this.world.addStaticCollider(leftX, pz, 0.15, 1.1);
      }

      if (!this.isInsideOrNearBuilding(rightX, pz, 1.6)) {
        const yR = this.world.heightAt(rightX, pz);
        const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 5), _timberFenceMat);
        postR.position.set(rightX, yR + 0.55, pz);
        fieldGroup.add(postR);
        this.world.addStaticCollider(rightX, pz, 0.15, 1.1);
      }
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
