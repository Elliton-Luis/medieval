import { findSpot, reserve, PROP_GAP } from "./placement.js";
import * as THREE from "three";
import { EventBus, GAME_EVENTS } from "./EventBus.js";
import { WorldDecay } from "./decay.js";
import { PlayerInventory } from "./rpg.js";

// ============================================================================
// villageGenerator.js — Cidades Vivas, Profissões Inconfundíveis e Sinos de Sanidade
// Atrela casas a profissões com adereços físicos visíveis, tiers de loot
// e Sino de Bronze manipulável/destrutível como âncora de sanidade.
// ============================================================================

export const PROFESSIONS = Object.freeze({
  BLACKSMITH: "blacksmith",
  FARMER: "farmer",
  MERCHANT: "merchant",
  PRIEST: "priest",
  GUARD: "guard",
  VILLAGER: "villager",
});

export const HOUSE_TIERS = Object.freeze({
  POOR: { id: "poor", name: "Cabana Humilde", minGold: 4, maxGold: 10, scale: 0.82 },
  MEDIUM: { id: "medium", name: "Casa Padrão", minGold: 15, maxGold: 30, scale: 1.0 },
  RICH: { id: "rich", name: "Mansão Nobre", minGold: 45, maxGold: 85, scale: 1.25 },
});

// Materiais reutilizados
const _forgeEmissiveMat = new THREE.MeshStandardMaterial({
  color: "#ff7b1c",
  emissive: "#dd4511",
  emissiveIntensity: 1.8,
  roughness: 0.5,
  flatShading: true,
});
const _anvilMat = new THREE.MeshStandardMaterial({ color: "#2b2e30", metalness: 0.7, roughness: 0.35, flatShading: true });
const _fenceMat = new THREE.MeshStandardMaterial({ color: "#543e2b", roughness: 0.95, flatShading: true });
const _canopyMat = new THREE.MeshStandardMaterial({ color: "#a83232", roughness: 0.8, flatShading: true });
const _crateMat = new THREE.MeshStandardMaterial({ color: "#785838", roughness: 0.9, flatShading: true });
const _bronzeBellMat = new THREE.MeshStandardMaterial({
  color: "#c9893b",
  metalness: 0.82,
  roughness: 0.28,
  flatShading: true,
});

/**
 * Entidade manipulável do Sino de Bronze da Igreja (Âncora de Sanidade).
 */
export class BronzeBell {
  constructor({ scene, world, x, y, z, audio = null, ui = null, host = null }) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;
    this.ui = ui;
    this.originX = x;
    this.originY = y;
    this.originZ = z;
    this.x = x;
    this.y = y;
    this.z = z;
    this.state = "intact"; // 'intact' | 'fallen'
    this.swingTime = 0;
    // host = objeto da igreja: o sino de verdade já está pendurado no campanário (house.js); este controlador o adota
    this.host = host && host.bellRope && host.bellRope.bellPivot ? host : null;
    if (this.host) {
      this.pivot = this.host.bellRope.bellPivot;
      this._hostParent = this.pivot.parent;
      this._hostLocal = this.pivot.position.clone();
      this.root = new THREE.Group(); // só para compatibilidade (não entra na cena)
      this.collider = null;
      const wp = new THREE.Vector3();
      this.pivot.getWorldPosition(wp);
      this.x = wp.x;
      this.y = wp.y;
      this.z = wp.z;
      return;
    }

    // Grupo do Sino
    this.root = new THREE.Group();
    this.root.name = "SanityBronzeBell";
    this.root.position.set(x, y, z);

    // Pivot articulado para o balanço do sino
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);

    // Malha do sino clássico com cone e anel
    const bellGeo = new THREE.CylinderGeometry(0.24, 0.58, 0.82, 10);
    const bellMesh = new THREE.Mesh(bellGeo, _bronzeBellMat);
    bellMesh.position.set(0, -0.42, 0);
    bellMesh.castShadow = true;
    this.pivot.add(bellMesh);

    // Badalo interno do sino
    const clapperGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const clapper = new THREE.Mesh(clapperGeo, _anvilMat);
    clapper.position.set(0, -0.84, 0);
    this.pivot.add(clapper);

    this.scene.add(this.root);

    // Registro de colisor estático no solo se cair
    this.collider = null;
  }

  ring() {
    if (this.state === "fallen") {
      this.ui?.showToast?.("✦ O sino está caído nos escombros! Pressione [E] para consertá-lo.");
      return;
    }

    this.swingTime = 2.4;
    this.audio?.deathBell?.();

    // Reduz a corrupção do mundo como purificação espiritual
    WorldDecay.decayLevel = Math.max(0, WorldDecay.decayLevel - 0.02);
    this.ui?.showToast?.("🔔 O sino da igreja ecoa pelas terras! A bênção recua a corrupção (-2%).");

    EventBus.emit(GAME_EVENTS.BELL_RUNG, { x: this.x, z: this.z });
  }

  collapse() {
    if (this.state === "fallen") return;
    this.state = "fallen";

    if (this.host) {
      // despenca da viga para o chão diante da porta da igreja, de lado
      const ry = this.host.ry || 0;
      const door = this.host.door || { x: this.host.x, z: this.host.z };
      const fx = door.x + Math.sin(ry) * 2.4;
      const fz = door.z + Math.cos(ry) * 2.4;
      this.scene.attach(this.pivot);
      this.pivot.position.set(fx, this.world.heightAt(fx, fz) + 0.45, fz);
      this.pivot.rotation.set(Math.PI / 2.3, 0.4, 0);
      this.x = fx;
      this.y = this.pivot.position.y;
      this.z = fz;
      WorldDecay.decayLevel = Math.min(1.0, WorldDecay.decayLevel + 0.1);
      this.ui?.showToast?.("⚡ O sino da igreja desabou da torre! O terror e a corrupção avançam!");
      EventBus.emit(GAME_EVENTS.HERESY_RISEN, { reason: "BELL_FALLEN", x: this.x, z: this.z });
      return;
    }

    // O sino despenca no solo em frente à igreja
    const groundY = this.world.heightAt(this.originX, this.originZ + 3.0);
    this.x = this.originX;
    this.y = groundY + 0.35;
    this.z = this.originZ + 3.0;

    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.set(Math.PI / 2.3, 0.4, 0);

    // Aumenta a corrupção quando a âncora de sanidade desaba
    WorldDecay.decayLevel = Math.min(1.0, WorldDecay.decayLevel + 0.1);
    this.ui?.showToast?.("⚡ O sino da igreja desabou da torre! O terror e a corrupção avançam!");

    EventBus.emit(GAME_EVENTS.HERESY_RISEN, { reason: "BELL_FALLEN", x: this.x, z: this.z });
  }

  repair() {
    if (this.state !== "fallen") return false;

    // Requer 2 Madeiras e 2 Pedras
    const wood = PlayerInventory.wood || 0;
    const stone = PlayerInventory.stone || 0;
    if (wood < 2 || stone < 2) {
      this.ui?.showToast?.("Necessitas de 2 Madeiras e 2 Pedras para reerguer o sino!");
      return false;
    }

    PlayerInventory.wood -= 2;
    PlayerInventory.stone -= 2;

    this.state = "intact";
    this.x = this.originX;
    this.y = this.originY;
    this.z = this.originZ;
    if (this.host) {
      this._hostParent.add(this.pivot); // volta para a viga do campanário
      this.pivot.position.copy(this._hostLocal);
      this.pivot.rotation.set(0, 0, 0);
    } else {
      this.root.position.set(this.x, this.y, this.z);
      this.root.rotation.set(0, 0, 0);
    }

    // Grande alívio de corrupção
    WorldDecay.decayLevel = Math.max(0, WorldDecay.decayLevel - 0.15);
    this.ui?.showToast?.("✦ Sino restaurado na torre! A sanidade e a esperança retornam ao povo (-15% corrupção).");
    this.audio?.deathBell?.();

    EventBus.emit(GAME_EVENTS.BELL_REPAIRED, { x: this.x, z: this.z });
    return true;
  }

  update(dt) {
    if (this.host) {
      // o sino gira em torno da viga (eixo X): balanço perpendicular ao eixo, como um sino de verdade
      if (this.state === "fallen") return;
      if (this.swingTime > 0) {
        this.swingTime -= dt;
        this.pivot.rotation.x = Math.sin(this.swingTime * 8) * 0.55 * (this.swingTime / 2.4);
      } else if (!(this.host.bellRope.swingTimer > 0) && this.pivot.rotation.x !== 0) {
        this.pivot.rotation.x = 0;
      }
      return;
    }
    if (this.swingTime > 0) {
      this.swingTime -= dt;
      const angle = Math.sin(this.swingTime * 8) * 0.38 * (this.swingTime / 2.4);
      this.pivot.rotation.z = angle;
    } else {
      this.pivot.rotation.z = 0;
    }
  }
}

/**
 * Estrutura e Gerador de Vilas Vivas com Profissões.
 */
export class VillageGenerator {
  constructor({ scene, world, clutter = null, farmAnimals = null, audio = null, ui = null, churches = [], houses = [] }) {
    this.scene = scene;
    this.world = world;
    this.clutter = clutter;
    this.farmAnimals = farmAnimals;
    this.audio = audio;
    this.ui = ui;
    this.churches = churches;
    this.houses = houses;
    this.anchors = [];
    this.bells = [];
  }

  /**
   * Checa se a casa está em localização suburbana adequada para atividade agrícola:
   * 1. NUNCA a menos de 38m de nenhuma Igreja (Igreja de Caldera e templos das vilas)
   * 2. NUNCA no centro urbano ou praça da cidade (mínimo 32m do poço/centro)
   */
  canHouseBeFarmer(hx, hz) {
    if (this.churches) {
      for (let i = 0; i < this.churches.length; i++) {
        const c = this.churches[i];
        const cx = c.x || 0;
        const cz = c.z || 0;
        const dx = hx - cx;
        const dz = hz - cz;
        if (dx * dx + dz * dz < 38.0 * 38.0) return false;
      }
    }
    // Centro de Caldera é em torno de (0, -15) até (-14, -8)
    const distToCenterSq = hx * hx + (hz + 15) * (hz + 15);
    if (distToCenterSq < 32.0 * 32.0) return false;
    return true;
  }

  /**
   * Ponto livre para um adereço (forja, curral, barraca...) no referencial da casa: tenta cada candidato local
   * (lx, lz) em ordem e reserva a pegada. Nunca entra em paredes, em outras construções nem em outros adereços.
   */
  _propSpot(house, candidates, hw, hd, id) {
    const ry = house.ry || 0;
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const hx = house.x || 0;
    const hz = house.z || 0;
    for (let i = 0; i < candidates.length; i++) {
      const [lx, lz] = candidates[i];
      const wx = hx + lx * c + lz * s;
      const wz = hz - lx * s + lz * c;
      const spot = findSpot(wx, wz, hw, hd, ry, { world: this.world, margin: PROP_GAP, maxRadius: 2.6, step: 1.0, maxSlope: 1.4 });
      if (spot && !this.world.isBlockedAt(spot.x, spot.z, Math.min(hw, hd) * 0.6)) {
        reserve(spot.x, spot.z, hw, hd, ry, "prop", id);
        return { x: spot.x, z: spot.z, ry, c: Math.cos(ry), s: Math.sin(ry) };
      }
    }
    return null;
  }

  /**
   * Atrela adereços físicos à casa de acordo com a profissão da âncora.
   */
  decorateProfessionHouse(house, profession = PROFESSIONS.VILLAGER) {
    if (house.isChurch || house.type === "church" || (house.name && house.name.includes("Igreja"))) {
      return;
    }
    const group = house.root || house.group || house;
    const hx = house.x || group.position.x || 0;
    const hz = house.z || group.position.z || 0;
    const hy = this.world.heightAt(hx, hz);

    // Validação estrita: se a profissão for FARMER mas a casa estiver no centro da vila ou perto de igrejas,
    // converte imediatamente para VILLAGER para impedir plantações e fenos dentro da cidade ou igreja.
    if (profession === PROFESSIONS.FARMER && !this.canHouseBeFarmer(hx, hz)) {
      profession = PROFESSIONS.VILLAGER;
    }

    const anchorData = {
      id: house.id || `anchor_${this.anchors.length}`,
      profession,
      house,
      x: hx,
      z: hz,
      sick: false,
      blighted: false,
    };
    this.anchors.push(anchorData);

    // 1. Ferreiro: Forja externa emissiva, bigorna e ferramentas
    const HW = (house.W || 6) / 2;
    const HD = (house.D || 5.5) / 2;
    if (profession === PROFESSIONS.BLACKSMITH) {
      const spot = this._propSpot(house, [[HW + 2.7, 0.4], [-(HW + 2.7), 0.4], [0, HD + 3.0]], 1.6, 1.3, `${anchorData.id}-forge`);
      if (spot) {
        const forge = new THREE.Group();
        forge.name = "Blacksmith_Forge";
        forge.position.set(spot.x, this.world.heightAt(spot.x, spot.z), spot.z);
        forge.rotation.y = spot.ry;

        // Base da forja de tijolos refratários
        const baseGeo = new THREE.BoxGeometry(1.4, 0.9, 1.4);
        const base = new THREE.Mesh(baseGeo, _anvilMat);
        base.position.y = 0.45;
        base.castShadow = true;
        forge.add(base);

        // Brasa ardente (emissivo laranja)
        const coalGeo = new THREE.BoxGeometry(0.9, 0.1, 0.9);
        const coal = new THREE.Mesh(coalGeo, _forgeEmissiveMat);
        coal.position.y = 0.95;
        forge.add(coal);

        // Bigorna de ferro forjado
        const anvilGeo = new THREE.BoxGeometry(0.48, 0.55, 0.88);
        const anvil = new THREE.Mesh(anvilGeo, _anvilMat);
        anvil.position.set(1.4, 0.28, 0.6);
        anvil.castShadow = true;
        forge.add(anvil);

        this.scene.add(forge);
        this.world.addStaticCollider(spot.x, spot.z, 1.0, 1.8);
        const ax = spot.x + 1.4 * spot.c + 0.6 * spot.s;
        const az = spot.z - 1.4 * spot.s + 0.6 * spot.c;
        this.world.addStaticCollider(ax, az, 0.5, 0.9);

        if (this.clutter) {
          this.clutter.addStonePile(spot.x - 1.8 * spot.s, spot.z - 1.8 * spot.c);
        }
      }
    }

    // 2. Fazendeiro: Curral cercado acoplado, FarmZone com espantalho e plantação
    else if (profession === PROFESSIONS.FARMER) {
      const spot = this._propSpot(house, [[-(HW + 3.6), 1.0], [HW + 3.6, 1.0], [0, HD + 4.0]], 2.9, 2.8, `${anchorData.id}-pen`);
      if (spot) {
        const pen = new THREE.Group();
        pen.name = "Farmer_Pen";
        const penX = spot.x;
        const penZ = spot.z;
        const penY = this.world.heightAt(penX, penZ);
        pen.position.set(penX, penY, penZ);
        pen.rotation.y = spot.ry;

        // Cercado retangular de mourões e tábuas
        const createFenceLine = (w, d, px, pz) => {
          const fenceGeo = new THREE.BoxGeometry(w, 0.8, d);
          const f = new THREE.Mesh(fenceGeo, _fenceMat);
          f.position.set(px, 0.4, pz);
          f.castShadow = true;
          pen.add(f);
        };
        createFenceLine(5.2, 0.12, 0, -2.5);
        createFenceLine(5.2, 0.12, 0, 2.5);
        createFenceLine(0.12, 5.0, -2.5, 0);
        createFenceLine(0.12, 3.2, 2.5, -0.9); // vão para entrada

        this.scene.add(pen);
        this.world.addStaticCollider(penX, penZ, 2.6, 1.2);

        // Spawna os animais da fazenda com Habitat Acoplado restrito à caixa do curral
        if (this.farmAnimals) {
          const penBounds = {
            minX: penX - 2.4,
            maxX: penX + 2.4,
            minZ: penZ - 2.3,
            maxZ: penZ + 2.3,
          };
          this.farmAnimals.spawnPenAnimals(penX, penZ, 4, 2, 1.8, "coupled_pen", penBounds, anchorData.id);
        }
      }

      // Aloca a FarmZone adjacente (grid ordenado de trigo/cenouras com espantalho no centro)
      if (this.clutter) {
        const zone = this._propSpot(house, [[HW + 6.4, -0.5], [-(HW + 6.4), -0.5], [0, -(HD + 5.6)], [0, HD + 7.2]], 2.9, 2.9, `${anchorData.id}-farmzone`);
        if (zone) this.clutter.createFarmZone(zone.x, zone.z, 4, 4, 1.15);
      }
    }

    // 3. Mercador: Toldo frontal listrado com caixas e sacos
    else if (profession === PROFESSIONS.MERCHANT) {
      const spot = this._propSpot(house, [[0.2, HD + 3.0], [HW + 2.6, HD + 0.5], [-(HW + 2.6), HD + 0.5]], 1.8, 1.4, `${anchorData.id}-stall`);
      if (spot) {
        const stall = new THREE.Group();
        stall.name = "Merchant_Stall";
        stall.position.set(spot.x, this.world.heightAt(spot.x, spot.z), spot.z);
        stall.rotation.y = spot.ry;

        // Toldo de tecido vermelho/marrom
        const roofGeo = new THREE.BoxGeometry(3.2, 0.1, 1.8);
        roofGeo.rotateX(0.18);
        const canopy = new THREE.Mesh(roofGeo, _canopyMat);
        canopy.position.y = 2.2;
        canopy.castShadow = true;
        stall.add(canopy);

        // Postes do toldo
        for (const sx of [-1.45, 1.45]) {
          const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.3, 6);
          const post = new THREE.Mesh(postGeo, _fenceMat);
          post.position.set(sx, 1.15, 0.8);
          stall.add(post);
        }

        // Caixas de madeira e mercadorias
        const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.7), _crateMat);
        crate1.position.set(-0.6, 0.32, 0.2);
        stall.add(crate1);

        const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.6), _crateMat);
        crate2.position.set(0.5, 0.28, 0.3);
        stall.add(crate2);

        this.scene.add(stall);
        this.world.addStaticCollider(spot.x, spot.z, 1.5, 1.8);
      }

      if (this.clutter) {
        const cart = this._propSpot(house, [[HW + 3.4, HD + 3.2], [-(HW + 3.4), HD + 3.2], [HW + 3.4, -(HD + 1.0)]], 1.4, 2.1, `${anchorData.id}-cart`);
        if (cart) this.clutter.addAbandonedCart(cart.x, cart.z, cart.ry + 0.4);
      }
    }

    return anchorData;
  }

  /**
   * Instancia um Sino de Bronze na torre da igreja.
   */
  createChurchBell(churchX, churchY, churchZ) {
    const host = (this.churches || []).find((c) => Math.abs((c.x || 0) - churchX) < 0.01 && Math.abs((c.z || 0) - churchZ) < 0.01) || null;
    const bell = new BronzeBell({
      host,
      scene: this.scene,
      world: this.world,
      x: churchX,
      y: churchY + 8.2, // campanário alto da torre
      z: churchZ + 3.4,
      audio: this.audio,
      ui: this.ui,
    });
    this.bells.push(bell);
    return bell;
  }

  update(dt) {
    for (let i = 0; i < this.bells.length; i++) {
      this.bells[i].update(dt);
    }
  }
}
