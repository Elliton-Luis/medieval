// Sistema das casas: portas com animação, interiores (telhado e paredes somem ao entrar),
// mobília interativa e destrutível, baús, camas e reação dos donos.
import * as THREE from "three";
import {
  PlayerStats,
  PlayerEquipment,
  interactWithChest,
  checkWitnesses,
  syncPlayerStatsToPlayer,
  getPlayerResidences,
} from "./rpg.js";

export const _activeOccluders = [];
const _OCCLUDER_POOL = Array.from({ length: 6 }, () => ({
  x: 0,
  z: 0,
  dist: 0,
  distSq: 0,
  minAngle: 0,
  maxAngle: 0,
}));
let _activeCameraPos = null;

export function isOccludedByHouses(x, z) {
  if (_activeOccluders.length === 0 || !_activeCameraPos) return false;
  const cx = x - _activeCameraPos.x;
  const cz = z - _activeCameraPos.z;
  const dSq = cx * cx + cz * cz;
  if (dSq < _activeOccluders[0].distSq) return false;
  const dist = Math.sqrt(dSq);
  const angle = Math.atan2(cx, cz);
  for (let i = 0; i < _activeOccluders.length; i++) {
    const occ = _activeOccluders[i];
    if (dist > occ.dist + 3.5 && angle >= occ.minAngle && angle <= occ.maxAngle) {
      return true;
    }
  }
  return false;
}

const LOOT_CHEST = { coins: [8, 20], items: [["potion", 0.3], ["gem", 0.2], ["bread", 0.4], ["bolts", 0.3], ["arrows", 0.3]] };
const _targetScratch = { type: null, house: null, data: null, label: null };

const SCRIPTURE_CHAPTERS = [
  {
    title: "Capítulo I — A Luz nos Vales e a Vigília Noturna",
    text: "«Quando a noite desce sobre as montanhas e as sombras engolem as estradas de Caldera, só a chama da fé e a vigília das tochas guardam os justos das feras e dos espíritos inquietos da floresta. Mantende vossa tocha acesa, pois a escuridão cede àquele que caminha com retidão e coragem.»",
  },
  {
    title: "Capítulo II — O Pão Compartilhado e a Caridade",
    text: "«Bem-aventurado o que reparte o feno e o pão com o mendigo na praça e socorre os que nada possuem, pois sua estima diante do povo brilhará mais que o ouro forjado. A avareza apodrece os celeiros, mas o coração generoso colhe lealdade em cada esquina do reino.»",
  },
  {
    title: "Capítulo III — O Perdão no Altar e a Graça Gratuita",
    text: "«Nenhum homem é rico o bastante para comprar a graça celestial, nem pobre demais para ser recusado diante do presbitério. O sacerdócio não negocia o perdão: as bênçãos e a confissão são gratuitas a todos os que buscam redenção no Altar Sagrado com o coração sincero.»",
  },
  {
    title: "Capítulo IV — A Santa Ceia e a Comunhão dos Fiéis",
    text: "«Reuni-vos sob o teto sagrado ao dobrar dos sinos. O sacerdote elevará a Hóstia imaculada e os fiéis se aproximarão do altar em santa paz. Aquele que comunga no santuário encontra renovação para as batalhas do mundo e paz duradoura para o seu espírito.»",
  },
];

const DETAIL_PARTS = ["wood", "ceiling", "dark"]; // partes de detalhe fino das casas (LOD)

export class HouseSystem {
  constructor({ houses, player, ui, effects, audio, npcs, drops, sleep, candle, input = null, wells = [], townBenches = [] }) {
    this.detailScale = 1; // reduzido pelo governador de desempenho (qualidade)
    this.cullDistSq = 115 * 115; // reduzido em tempo real pela distância de visibilidade da névoa (main.js)
    this.houses = houses;
    this.player = player;
    this.ui = ui;
    this.effects = effects;
    this.audio = audio;
    this.npcs = npcs;
    this.drops = drops;
    this.sleep = sleep;
    this.candle = candle;
    this.input = input;
    this.wells = wells;
    this.townBenches = townBenches;
    this.current = null;
    this.target = null;
    this.promptText = null;
    this._wellCooldown = 0;
    this._altarBlessCooldown = 0;
    this._scriptureIndex = 0;
    this.camera = null;
    this._camDir = new THREE.Vector3();

    // Estado do evento da celebração da Santa Missa (Random Church Mass Event)
    this.mass = {
      active: false,
      state: "IDLE", // IDLE, GATHERING, PREACHING, ELEVATION, COMMUNION, BLESSING, DISMISSAL
      timer: 0,
      church: null,
      priest: null,
      attendees: [],
      communionQueue: [],
      activeCommunionNpc: null,
      communionCooldown: 0,
      nextRandomCheck: 45, // Segundos até checar probabilidade de missa espontânea
    };
  }

  // Dono de cada casa: o morador civil mais próximo que ainda não tem casa.
  assignOwners() {
    const taken = new Set();
    for (const house of this.houses) {
      if (house.type !== "home") continue;
      let best = null;
      let bestDistance = 45 * 45;
      for (const npc of this.npcs.npcs) {
        if (npc.temporary || npc.roleKey === "guard" || taken.has(npc)) continue;
        const d = (npc.spawnX - house.x) ** 2 + (npc.spawnZ - house.z) ** 2;
        if (d < bestDistance) {
          bestDistance = d;
          best = npc;
        }
      }
      if (best) {
        house.owner = best;
        taken.add(best);
      }
    }
  }

  _ownerSees(house) {
    const owner = house.owner;
    if (!owner || !owner.alive || owner.mode !== "work" || owner.root?.userData?.isSleeping) return false;
    return checkWitnesses({ x: this.player.x, y: this.player.root.position.y, z: this.player.z }, [owner], undefined, false);
  }

  // Invasão ou furto à vista do dono: grita e corre para chamar os guardas.
  _reportIntruder(house, text, severity) {
    if (house.type !== "home" || !this._ownerSees(house) || house.enterCooldown > 0) return;
    house.enterCooldown = 45;
    const owner = house.owner;
    owner.reportTarget = this.npcs._nearestGuard(owner);
    owner.startAlert("report", 28, this.player.x, this.player.z);
    this.effects.play("alert", owner.x, owner.root.position.y + 2.4, owner.z, "#ffffff", 1);
    this.ui.showToast(`${owner.name}: "${text}"`);
    this.npcs.notifyCrime(owner.x, owner.z, 18, null, severity);
  }

  update(dt, camera = null, isCutscene = false) {
    if (camera) this.camera = camera;
    const activeCam = this.camera;
    const player = this.player;

    // Regeneração de vitalidade do jogador sentado no pé da fogueira
    if (player.sitting && player.sittingAtCampfire) {
      this._cfHealTimer = (this._cfHealTimer || 0) + dt;
      if (this._cfHealTimer >= 2.0) {
        this._cfHealTimer = 0;
        if (player.health < player.maxHealth) {
          player.health = Math.min(player.maxHealth, player.health + 1);
          this.ui?.setVitals?.(player.health, player.maxHealth, player.coins, player.potions);
          this.effects?.play?.("star", player.x, player.root.position.y + 1.2, player.z, "#ff9933", 0.9);
        }
      }
    } else {
      this._cfHealTimer = 0;
    }

    let camX = 0, camY = 0, camZ = 0;
    let cdx = 0, cdz = 1;
    let hasCam = false;
    if (activeCam) {
      hasCam = true;
      camX = activeCam.position.x;
      camY = activeCam.position.y;
      camZ = activeCam.position.z;
      if (!this._camDir) this._camDir = new THREE.Vector3();
      activeCam.getWorldDirection(this._camDir);
      cdx = this._camDir.x;
      cdz = this._camDir.z;
      if (!_activeCameraPos) _activeCameraPos = new THREE.Vector3();
      _activeCameraPos.copy(activeCam.position);
    }

    // 1. Constrói a lista de oclusores rápidos (as maiores casas próximas diretamente à frente da câmera)
    _activeOccluders.length = 0;
    if (hasCam) {
      for (let i = 0; i < this.houses.length; i++) {
        const h = this.houses[i];
        if (h === this.current) continue;
        const cx = h.x - camX;
        const cz = h.z - camZ;
        const cDistSq = cx * cx + cz * cz;
        const cdot = cx * cdx + cz * cdz;
        if (cdot > 3.0 && cDistSq > 5 * 5 && cDistSq < 38 * 38) {
          const dist = Math.sqrt(cDistSq);
          const centerAngle = Math.atan2(cx, cz);
          const radius = Math.max(h.W, h.D) * 0.44;
          const halfAngle = Math.atan2(radius, dist);
          const occ = _OCCLUDER_POOL[_activeOccluders.length];
          occ.x = h.x;
          occ.z = h.z;
          occ.dist = dist;
          occ.distSq = cDistSq;
          occ.minAngle = centerAngle - halfAngle;
          occ.maxAngle = centerAngle + halfAngle;
          _activeOccluders.push(occ);
          if (_activeOccluders.length >= 6) break;
        }
      }
    }

    if (this._wellCooldown > 0) this._wellCooldown = Math.max(0, this._wellCooldown - dt);
    if (this._altarBlessCooldown > 0) this._altarBlessCooldown = Math.max(0, this._altarBlessCooldown - dt);

    // Atualiza a celebração e dinâmica da Santa Missa na igreja
    this.updateChurchMass(dt);

    let inside = null;
    let nearestDistance = 3.1 * 3.1;
    let hasTarget = false;

    // Se o jogador já está sentado ou ajoelhado em oração, prioriza o comando de rezar/levantar
    if (player.sitting || player.praying) {
      hasTarget = true;
      _targetScratch.house = this.current;
      _targetScratch.data = null;
      if (player.sitting && player.sittingInChurch) {
        _targetScratch.type = "church_pew_active";
        _targetScratch.label = player.praying
          ? "E · encerrar oração no banco | WASD / Espaço · levantar"
          : "E · rezar sentado no banco | WASD / Espaço · levantar";
      } else if (player.praying) {
        _targetScratch.type = "stand_up";
        _targetScratch.label = "E / WASD / Espaço · levantar da oração";
      } else if (player.sittingAtCampfire) {
        _targetScratch.type = "stand_up";
        _targetScratch.label = "E / WASD · levantar-se da fogueira";
      } else {
        _targetScratch.type = "stand_up";
        _targetScratch.label = "E / WASD / Espaço · levantar do banco";
      }
    }

    for (let i = 0; i < this.houses.length; i++) {
      const house = this.houses[i];
      if (house.enterCooldown > 0) house.enterCooldown -= dt;
      if (house.holyFont && house.holyFont.cooldown > 0) {
        house.holyFont.cooldown = Math.max(0, house.holyFont.cooldown - dt);
      }
      if (house.bellRope && house.bellRope.swingTimer > 0) {
        house.bellRope.swingTimer = Math.max(0, house.bellRope.swingTimer - dt);
        if (house.bellRope.bellPivot) {
          house.bellRope.bellPivot.rotation.x = Math.sin(house.bellRope.swingTimer * 7.5) * 0.55 * (house.bellRope.swingTimer / 4.5);
        }
      }

      // Em cutscenes: desativa todos os filtros de culling de casas e interiores para zero glitches visuais
      if (isCutscene) {
        if (!house.group.visible) house.group.visible = true;
        if (house.interior && !house.interior.visible) house.interior.visible = true;
        house.door.angle += (house.door.target - house.door.angle) * (1 - Math.exp(-9 * dt));
        continue;
      }

      const dx = player.x - house.x;
      const dz = player.z - house.z;
      const distanceSq = dx * dx + dz * dz;

      // 1. Culling ATRÁS DO PLAYER:
      // O usuário: "renderize só imediatamente atrás do player, o longe não"
      const toHouseX = house.x - player.x;
      const toHouseZ = house.z - player.z;
      const dot = toHouseX * cdx + toHouseZ * cdz;
      if (hasCam && dot < -3.0 && distanceSq > 14 * 14) {
        if (house.group.visible) house.group.visible = false;
        if (house.interior && house.interior.visible) house.interior.visible = false;
        continue;
      }

      // 2. Culling de DISTÂNCIA MÁXIMA (neblina):
      if (distanceSq > this.cullDistSq) {
        if (house.group.visible) house.group.visible = false;
        if (house.interior && house.interior.visible) house.interior.visible = false;
        continue;
      }

      // 3. Culling de OCLUSÃO ATRÁS DE OUTRAS CASAS:
      // O usuário: "não renderize o que está atrás das casas"
      if (hasCam && _activeOccluders.length > 0 && distanceSq > 18 * 18) {
        const cx = house.x - camX;
        const cz = house.z - camZ;
        const hDist = Math.hypot(cx, cz);
        const hAngle = Math.atan2(cx, cz);
        let occluded = false;
        for (let o = 0; o < _activeOccluders.length; o++) {
          const occ = _activeOccluders[o];
          if (hDist > occ.dist + 5.0 && hAngle >= occ.minAngle && hAngle <= occ.maxAngle) {
            occluded = true;
            break;
          }
        }
        if (occluded) {
          if (house.group.visible) house.group.visible = false;
          if (house.interior && house.interior.visible) house.interior.visible = false;
          continue;
        }
      }

      // Casa visível!
      if (!house.group.visible) house.group.visible = true;

      // 4. LOD de Fachada das Casas:
      // A mais de 38m, esconde vidraças/janelas finas para economia de polígonos
      if (house.meshes.glass) {
        const showGlass = distanceSq < 38 * 38;
        if (house.meshes.glass.visible !== showGlass) house.meshes.glass.visible = showGlass;
      }
      // LOD de detalhe: além de ~52 m só pedra, reboco e telhado (silhueta); madeira, vigas do teto e partes escuras
      // são detalhe fino que a névoa já apaga: 3 draw calls a menos por casa distante (HLOD simples).
      const showDetail = distanceSq < (52 * this.detailScale) * (52 * this.detailScale);
      if (house._detailShown !== showDetail) {
        house._detailShown = showDetail;
        for (const key of DETAIL_PARTS) {
          const m = house.meshes[key];
          if (m && m.visible !== showDetail) m.visible = showDetail;
        }
      }

      // 5. Culling do INTERIOR das Casas:
      // O usuário: "não renderize o interior das casas"
      // Só renderiza o interior se o jogador estiver dentro ou rente à porta aberta (< 5m)
      const door = house.door;
      const doorDistSq = (player.x - door.x) ** 2 + (player.z - door.z) ** 2;
      const showInterior = house.inside || (doorDistSq < 5.0 * 5.0 && door.open);
      if (house.interior && house.interior.visible !== showInterior) {
        house.interior.visible = showInterior;
      }

      // porta: abre e fecha suavemente
      door.angle += (door.target - door.angle) * (1 - Math.exp(-9 * dt));
      door.pivot.rotation.y = door.angle;
      if (house.chest.opened && house.chest.openAmount < 1 && house.chest.lid) {
        house.chest.openAmount = Math.min(1, house.chest.openAmount + dt * 3);
        house.chest.lid.rotation.x = -house.chest.openAmount * 1.7;
      }
      if (distanceSq > 16 * 16) continue;
      const isPlayerInside = house.contains(player.x, player.z);
      if (!inside && isPlayerInside && !player.mounted) inside = house;

      if (player.sitting || player.praying) continue;

      // interagíveis perto (Zero-GC)
      if (doorDistSq < 2.0 * 2.0 && doorDistSq < nearestDistance) {
        nearestDistance = doorDistSq;
        _targetScratch.type = "door";
        _targetScratch.house = house;
        _targetScratch.data = null;
        _targetScratch.label =
          house.type === "church"
            ? door.open
              ? "E · fechar porta da igreja"
              : "E · abrir porta da igreja"
            : door.open
              ? "E · fechar porta"
              : "E · abrir porta";
        hasTarget = true;
      }

      if (isPlayerInside) {
        // Bancos internos (bancos da igreja ou bancos da casa/pousada)
        if (house.seats) {
          for (let s = 0; s < house.seats.length; s++) {
            const seat = house.seats[s];
            const sDistSq = (player.x - seat.x) ** 2 + (player.z - seat.z) ** 2;
            if (sDistSq < 1.35 * 1.35 && sDistSq < nearestDistance) {
              nearestDistance = sDistSq;
              _targetScratch.type = "seat";
              _targetScratch.house = house;
              _targetScratch.data = seat;
              _targetScratch.label = seat.label || "E · sentar no banco";
              hasTarget = true;
            }
          }
        }

        if (house.type === "church") {
          // Altar-Mor Sagrado
          if (house.altar) {
            const aDistSq = (player.x - house.altar.x) ** 2 + (player.z - house.altar.z) ** 2;
            if (aDistSq < 1.9 * 1.9 && aDistSq < nearestDistance) {
              nearestDistance = aDistSq;
              _targetScratch.type = "altar";
              _targetScratch.house = house;
              _targetScratch.data = house.altar;
              _targetScratch.label = "E · ajoelhar e rezar no altar";
              hasTarget = true;
            }
          }
          // Pia de Água Benta
          if (house.holyFont) {
            const fDistSq = (player.x - house.holyFont.x) ** 2 + (player.z - house.holyFont.z) ** 2;
            if (fDistSq < 1.75 * 1.75 && fDistSq < nearestDistance) {
              nearestDistance = fDistSq;
              _targetScratch.type = "holy_font";
              _targetScratch.house = house;
              _targetScratch.data = house.holyFont;
              _targetScratch.label = "E · benzer-se na pia de água benta";
              hasTarget = true;
            }
          }
          // Corda do Sino da Torre
          if (house.bellRope) {
            const bDistSq = (player.x - house.bellRope.x) ** 2 + (player.z - house.bellRope.z) ** 2;
            if (bDistSq < 1.75 * 1.75 && bDistSq < nearestDistance) {
              nearestDistance = bDistSq;
              _targetScratch.type = "bell_rope";
              _targetScratch.house = house;
              _targetScratch.data = house.bellRope;
              _targetScratch.label = "E · tocar o sino da igreja";
              hasTarget = true;
            }
          }
          // Caixa de Ofertas da Igreja
          if (house.offeringBox) {
            const oDistSq = (player.x - house.offeringBox.x) ** 2 + (player.z - house.offeringBox.z) ** 2;
            if (oDistSq < 1.75 * 1.75 && oDistSq < nearestDistance) {
              nearestDistance = oDistSq;
              _targetScratch.type = "offering_box";
              _targetScratch.house = house;
              _targetScratch.data = house.offeringBox;
              _targetScratch.label = "E · depositar oferta na igreja (5 moedas · +1 CAR)";
              hasTarget = true;
            }
          }
          // Atril das Escrituras Sagradas
          if (house.lectern) {
            const lDistSq = (player.x - house.lectern.x) ** 2 + (player.z - house.lectern.z) ** 2;
            if (lDistSq < 1.75 * 1.75 && lDistSq < nearestDistance) {
              nearestDistance = lDistSq;
              _targetScratch.type = "lectern";
              _targetScratch.house = house;
              _targetScratch.data = house.lectern;
              _targetScratch.label = "E · ler as Crônicas Sagradas no atril";
              hasTarget = true;
            }
          }
        } else {
          if (!house.chest.opened) {
            const chestDistSq = (player.x - house.chest.x) ** 2 + (player.z - house.chest.z) ** 2;
            if (chestDistSq < 1.8 * 1.8 && chestDistSq < nearestDistance) {
              nearestDistance = chestDistSq;
              _targetScratch.type = "chest";
              _targetScratch.house = house;
              _targetScratch.data = null;
              _targetScratch.label = "E · abrir baú";
              hasTarget = true;
            }
          }
          const bedDistSq = (player.x - house.bed.x) ** 2 + (player.z - house.bed.z) ** 2;
          if (bedDistSq < 2.3 * 2.3 && bedDistSq < nearestDistance) {
            nearestDistance = bedDistSq;
            _targetScratch.type = "bed";
            _targetScratch.house = house;
            _targetScratch.data = null;
            _targetScratch.label = house.price > 0 ? `E · dormir (${house.price} moedas)` : "E · dormir";
            hasTarget = true;
          }
        }
      }
    }

    // Moradias construídas pelo jogador (Casas e Cabanas com cama e interior visível)
    const residences = getPlayerResidences?.() || [];
    for (let r = 0; r < residences.length; r++) {
      const res = residences[r];
      const rx = res.position.x;
      const rz = res.position.z;
      const ry = res.rotation.y;
      const cos = Math.cos(ry);
      const sin = Math.sin(ry);
      const relX = player.x - rx;
      const relZ = player.z - rz;
      const lx = relX * cos - relZ * sin;
      const lz = relX * sin + relZ * cos;
      const hx = res.userData.hx || 2.4;
      const hz = res.userData.hz || 2.0;

      const isInside = Math.abs(lx) <= hx && Math.abs(lz) <= hz;
      if (res.roofGroup) {
        res.roofGroup.visible = !isInside;
      }

      if (res.userData.bed) {
        const bedDistSq = (player.x - res.userData.bed.x) ** 2 + (player.z - res.userData.bed.z) ** 2;
        if (bedDistSq < 2.5 * 2.5 && bedDistSq < nearestDistance) {
          nearestDistance = bedDistSq;
          _targetScratch.type = "bed";
          _targetScratch.house = { price: 0, name: "Sua Moradia" };
          _targetScratch.data = null;
          _targetScratch.label = "E · dormir na sua moradia";
          hasTarget = true;
        }
      }
    }

    // Interagíveis externos (Fogueiras, Bancos da Praça e Poços de Água) quando em pé e fora de montaria
    if (!player.sitting && !player.praying && !player.mounted) {
      // 1. Fogueiras erguidas pelo jogador
      const campfires = (window.__game?.weapons?.playerBuildingsPool || []).filter(
        (b) => b && b.visible && b.userData?.type === "CAMPFIRE"
      );
      for (let i = 0; i < campfires.length; i++) {
        const cf = campfires[i];
        const cfDistSq = (player.x - cf.position.x) ** 2 + (player.z - cf.position.z) ** 2;
        if (cfDistSq < 2.85 * 2.85 && cfDistSq < nearestDistance) {
          nearestDistance = cfDistSq;
          _targetScratch.type = "campfire";
          _targetScratch.house = null;
          _targetScratch.data = { x: cf.position.x, z: cf.position.z };
          _targetScratch.label = "E · sentar no pé da fogueira (descansar e regenerar)";
          hasTarget = true;
        }
      }

      // 2. Fogueiras rituais dos postos cultistas
      const outposts = window.__game?.CultState?.outposts || [];
      for (let i = 0; i < outposts.length; i++) {
        const out = outposts[i];
        if (!out) continue;
        const oDistSq = (player.x - out.x) ** 2 + (player.z - out.z) ** 2;
        if (oDistSq < 3.2 * 3.2 && oDistSq < nearestDistance) {
          nearestDistance = oDistSq;
          _targetScratch.type = "campfire";
          _targetScratch.house = null;
          _targetScratch.data = { x: out.x, z: out.z };
          _targetScratch.label = "E · sentar no pé da fogueira do acampamento";
          hasTarget = true;
        }
      }

      if (this.townBenches) {
        for (let i = 0; i < this.townBenches.length; i++) {
          const bench = this.townBenches[i];
          const bDistSq = (player.x - bench.x) ** 2 + (player.z - bench.z) ** 2;
          if (bDistSq < 1.55 * 1.55 && bDistSq < nearestDistance) {
            nearestDistance = bDistSq;
            _targetScratch.type = "seat";
            _targetScratch.house = null;
            _targetScratch.data = bench;
            _targetScratch.label = bench.label || "E · sentar no banco da praça";
            hasTarget = true;
          }
        }
      }
      if (this.wells) {
        for (let i = 0; i < this.wells.length; i++) {
          const well = this.wells[i];
          const wDistSq = (player.x - well.x) ** 2 + (player.z - well.z) ** 2;
          if (wDistSq < 2.45 * 2.45 && wDistSq < nearestDistance) {
            nearestDistance = wDistSq;
            _targetScratch.type = "well";
            _targetScratch.house = null;
            _targetScratch.data = well;
            _targetScratch.label = "E · beber água fresca do poço (+1 vitalidade)";
            hasTarget = true;
          }
        }
      }
    }

    const nearest = hasTarget ? _targetScratch : null;
    this.target = nearest;

    if (inside !== this.current) {
      if (this.current) {
        this.current.inside = false;
        this._setGhost(this.current, false);
      }
      this.current = inside;
      player.inHouse = inside;
      if (inside) {
        inside.inside = true;
        this._setGhost(inside, true);
        if (inside.type === "church") {
          this.ui.showToast(`Entraste na ${inside.name} · Santuário de Paz`);
        } else {
          this._reportIntruder(inside, "Ladrão! Guardas!", 0.3);
        }
      }
    }

    // aviso de interação (não atropela o aviso dos itens do chão)
    const text = nearest ? nearest.label : this.candle?.promptText || this.riding?.promptText || null;
    if (text !== this.promptText) {
      if (text || !this.drops?._pickTarget) this.ui.setPrompt(text);
      this.promptText = text;
    }
  }

  _setGhost(house, on) {
    const M = house.M;
    if (house.meshes.plaster) house.meshes.plaster.material = on ? M.ghostPlaster : M.plaster;
    if (house.meshes.wood) house.meshes.wood.material = on ? M.ghostWood : M.wood;
    if (house.meshes.roof) house.meshes.roof.visible = !on;
    if (house.meshes.ceiling) house.meshes.ceiling.visible = !on;
    if (house.meshes.towerTop) house.meshes.towerTop.visible = !on;
    if (house.interior) house.interior.visible = on;
  }

  // Tecla E. Retorna true se alguma interação aconteceu.
  interact() {
    const t = this.target;
    if (!t) return false;
    const house = t.house;

    if (t.type === "stand_up") {
      this.player.standUp();
      return true;
    }
    if (t.type === "campfire" && t.data) {
      const fx = t.data.x;
      const fz = t.data.z;
      const angle = Math.atan2(this.player.z - fz, this.player.x - fx);
      const seatX = fx + Math.cos(angle) * 1.25;
      const seatZ = fz + Math.sin(angle) * 1.25;
      const faceYaw = angle + Math.PI;
      this.player.sitAt(seatX, seatZ, faceYaw, false);
      this.player.sittingAtCampfire = true;
      this.audio.step(false, 0.8);
      this.ui.showToast("Sentado junto ao calor da fogueira · Vitalidade e vigor recuperando · Pressione E ou WASD para levantar");
      return true;
    }
    if (t.type === "church_pew_active") {
      const nowPraying = this.player.toggleSeatPrayer();
      if (nowPraying) {
        this.audio.choir?.();
        this.effects.play("glint", this.player.x, this.player.root.position.y + 1.5, this.player.z, "#fff2a8", 1.25);
        this.ui.showToast("Em oração silenciosa no banco da igreja... (Vitalidade regenerando)");
      } else {
        this.ui.showToast("Você encerrou a oração e permanece sentado.");
      }
      return true;
    }
    if (t.type === "seat" && t.data) {
      const seat = t.data;
      this.player.sitAt(seat.x, seat.z, seat.yaw, seat.isChurchPew);
      this.audio.step(false, 0.8);
      if (seat.isChurchPew) {
        this.ui.showToast("Sentado no banco da igreja · Pressione E para rezar ou WASD para levantar");
      } else {
        this.ui.showToast("Descansando no banco · Pressione WASD ou E para levantar");
      }
      return true;
    }
    if (t.type === "altar" && t.data) {
      const altar = t.data;
      this.player.startAltarPrayer(altar.x, altar.z, altar.yaw);
      this.audio.choir?.();
      this.effects.play("glint", this.player.x, this.player.root.position.y + 1.75, this.player.z, "#ffe896", 1.55);
      this.player.health = this.player.maxHealth;
      if (this._altarBlessCooldown <= 0) {
        this._altarBlessCooldown = 90;
        PlayerStats.cha = Math.min(20, PlayerStats.cha + 1);
        if (this.npcs.wanted > 0 && this.npcs.wanted <= 2) {
          this.npcs.clearWanted();
        }
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast("Oração no Altar Sagrado! Vitalidade restaurada · +1 Carisma · Paz espiritual");
      } else {
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast("Ajoelhado em oração diante do Altar Sagrado · Vitalidade restaurada");
      }
      return true;
    }
    if (t.type === "holy_font" && house?.holyFont) {
      this.audio.holyWater?.();
      this.effects.play("glint", house.holyFont.x, house.floorY + 1.25, house.holyFont.z, "#9be6ff", 1.3);
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 2);
      this.player.invuln = Math.max(this.player.invuln, 3.0);
      if (this.player.root?.userData) {
        this.player.root.userData.isOnFire = false;
      }
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("Você se benzeu na pia de água benta! +2 Vitalidade e proteção divina.");
      return true;
    }
    if (t.type === "bell_rope" && house?.bellRope) {
      house.bellRope.swingTimer = 4.5;
      this.audio.churchBell?.();
      this.effects.play("star", house.x, house.floorY + 9.5, house.z, "#ffe48f", 1.9);
      this.effects.play("glint", house.bellRope.x, house.floorY + 1.8, house.bellRope.z, "#ffe48f", 1.2);
      for (let i = 0; i < this.npcs.npcs.length; i++) {
        const npc = this.npcs.npcs[i];
        if (!npc.alive || npc.roleKey === "horse") continue;
        if ((npc.x - house.x) ** 2 + (npc.z - house.z) ** 2 < 40 * 40 && npc.mode === "work") {
          npc.pause = Math.max(npc.pause, 2.5);
        }
      }
      this.ui.showToast(`🔔 O sino da ${house.name} ecoa pelos vales de Caldera!`);
      return true;
    }
    if (t.type === "offering_box" && house?.offeringBox) {
      if (this.player.coins < 5) {
        this.ui.showToast("Você precisa de 5 moedas para depositar uma oferta na caixa da paróquia.");
        return true;
      }
      this.player.coins -= 5;
      PlayerStats.gold = this.player.coins;
      PlayerStats.cha = Math.min(20, PlayerStats.cha + 1);
      this.audio.coin?.();
      this.audio.choir?.();
      this.effects.play("star", house.offeringBox.x, house.floorY + 1.2, house.offeringBox.z, "#ffe27a", 1.25);
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("Oferta de 5 moedas depositada na igreja! +1 Carisma.");
      return true;
    }
    if (t.type === "lectern" && house?.lectern) {
      this.audio.choir?.();
      this.effects.play("glint", house.lectern.x, house.floorY + 1.35, house.lectern.z, "#fff0a8", 1.15);
      this.openScriptureModal(this._scriptureIndex);
      return true;
    }
    if (t.type === "well" && t.data) {
      if (this._wellCooldown > 0) {
        this.ui.showToast("Você acabou de beber água fresca do poço.");
        return true;
      }
      this._wellCooldown = 8;
      this.audio.holyWater?.();
      this.effects.play("star", t.data.x, this.player.root.position.y + 1.2, t.data.z, "#9be6ff", 1.1);
      if (this.player.health < this.player.maxHealth) {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast("Você bebeu água fresca do poço · +1 Vitalidade!");
      } else {
        this.ui.showToast("Água fresca e cristalina da nascente! Sua sede foi saciada.");
      }
      return true;
    }

    if (t.type === "door") {
      house.door.open = !house.door.open;
      house.door.target = house.door.open ? -1.75 : 0;
      house.door.box.active = !house.door.open;
      this.audio.step(false, 1.4);
      return true;
    }
    if (t.type === "chest") {
      house.chest.opened = true;
      const chestObj = house.chest.lid || house.chest;
      chestObj.userData = chestObj.userData || {};
      chestObj.userData.lid = house.chest.lid;
      const res = interactWithChest(
        chestObj,
        { x: this.player.x, y: this.player.root.position.y, z: this.player.z },
        this.npcs.npcs,
      );
      this.audio.coin();
      this.drops.spawnLoot(house.chest.x, house.floorY + 0.8, house.chest.z, LOOT_CHEST);
      if (res.isWitnessed) {
        this.ui.showToast(`Furto visto! +${res.gold} moedas · Carisma -2 · Procurado +1`);
        this._reportIntruder(house, "Ladrão! Largue isso!", 0.5);
      } else {
        this.ui.showToast(`Baú saqueado em silêncio · +${res.gold} moedas`);
      }
      return true;
    }
    if (t.type === "bed") {
      this.sleep.trySleep(house);
      return true;
    }
    return false;
  }

  // Abre modal persistente de leitura das Escrituras Sagradas
  openScriptureModal(chapterIndex = 0) {
    this._scriptureIndex = (chapterIndex + SCRIPTURE_CHAPTERS.length) % SCRIPTURE_CHAPTERS.length;
    const chapter = SCRIPTURE_CHAPTERS[this._scriptureIndex];
    if (this.input) this.input.setModalOpen(true);
    if (document.pointerLockElement) document.exitPointerLock();

    const actions = [
      {
        id: "scripture:prev",
        label: "◀ Capítulo Anterior",
      },
      {
        id: "scripture:next",
        label: "Próximo Capítulo ▶",
      },
      {
        id: "scripture:close",
        label: "Fechar Leitura (Retornar ao Jogo)",
      },
    ];

    const prevAction = this.ui.onDialogAction;
    const prevClose = this.ui.onDialogClose;

    const cleanup = () => {
      this.ui.onDialogAction = prevAction;
      this.ui.onDialogClose = prevClose;
      if (this.input) this.input.setModalOpen(false);
    };

    this.ui.onDialogAction = (actionId) => {
      if (actionId === "scripture:close") {
        this.ui.closeDialogue();
        cleanup();
      } else if (actionId === "scripture:prev") {
        this.openScriptureModal(this._scriptureIndex - 1);
      } else if (actionId === "scripture:next") {
        this.openScriptureModal(this._scriptureIndex + 1);
      }
    };

    this.ui.onDialogClose = () => {
      cleanup();
    };

    this.ui.showDialogue(
      `Crônicas Sagradas do Reino — ${chapter.title}`,
      `${chapter.text}\n\n(Lendo no atril sagrado · Podes permanecer lendo pelo tempo que desejar)`,
      actions,
    );
  }

  // --------------------------------------------------------------------------
  // Celebração da Santa Missa (Random Church Mass Event)
  // --------------------------------------------------------------------------
  // Raio (m) em torno da igreja que conta como "dentro da cidade": só aí o jogador recebe avisos da missa
  static MASS_CITY_RADIUS = 85;

  _playerInCity(church = this.mass.church) {
    if (!church) return false;
    return Math.hypot(this.player.x - church.x, this.player.z - church.z) <= HouseSystem.MASS_CITY_RADIUS;
  }

  // Avisos da missa só aparecem para quem está na cidade da igreja
  _massToast(text) {
    if (this._playerInCity()) this.ui.showToast(text);
  }

  // Monta uma missa VIÁVEL para a igreja: padre vivo e livre + fiéis civis vivos, todos perto da igreja.
  _planMass(church) {
    const near = (npc, r) => Math.hypot(npc.x - church.x, npc.z - church.z) <= r;
    let priest = null;
    let priestD = Infinity;
    for (const npc of this.npcs.npcs) {
      if (!npc.alive || npc.temporary || npc.controlled || npc.roleKey !== "priest") continue;
      if (npc.mode !== "work" || npc.massTask || !near(npc, 55)) continue;
      const d = Math.hypot(npc.x - church.x, npc.z - church.z);
      if (d < priestD) { priest = npc; priestD = d; }
    }
    if (!priest) return null;
    const attendees = [];
    for (const npc of this.npcs.npcs) {
      if (attendees.length >= 4) break;
      if (!npc.alive || npc.temporary || npc.controlled || npc === priest || npc.massTask) continue;
      if (npc.mode !== "work" || npc.hostile || npc.isBandit) continue;
      if (npc.roleKey === "guard" || npc.roleKey === "horse" || npc.roleKey === "werewolf" || npc.roleKey === "priest") continue;
      if (npc.root?.userData?.isSleeping || npc.root?.userData?.state === "SLEEP") continue;
      if (!near(npc, 60)) continue;
      attendees.push(npc);
    }
    if (attendees.length === 0) return null;
    return { priest, attendees };
  }

  startChurchMass(force = false) {
    if (this.mass.active) return false;
    const churches = this.houses.filter((h) => h.type === "church");
    if (churches.length === 0) return false;

    // Só celebra de dia (os fiéis dormem à noite)
    const daylight = window.__game?.dayNight?.daylight ?? 1;
    if (daylight < 0.5) return false;

    // Igrejas candidatas, da mais próxima do jogador para a mais distante.
    // Missa espontânea só perto do jogador (os NPCs só são simulados perto dele — assim a missa acontece de verdade);
    // missa pedida ao padre (force) vale para a igreja onde o jogador está.
    const maxPlayerDist = force ? 40 : HouseSystem.MASS_CITY_RADIUS;
    const sorted = churches
      .map((c) => ({ c, d: Math.hypot(this.player.x - c.x, this.player.z - c.z) }))
      .filter((o) => o.d <= maxPlayerDist)
      .sort((x, y) => x.d - y.d);

    let church = null;
    let plan = null;
    for (const o of sorted) {
      plan = this._planMass(o.c);
      if (plan) { church = o.c; break; }
    }
    if (!plan) return false;
    const { priest, attendees } = plan;

    this.mass.active = true;
    this.mass.state = "GATHERING";
    this.mass.timer = 0;
    this.mass.church = church;
    this.mass.priest = priest;
    this.mass.attendees = attendees;
    this.mass.communionQueue = [];
    this.mass.activeCommunionNpc = null;
    this.mass.communionCooldown = 0;

    // Abre a porta da igreja e toca o sino sagrado
    church.door.open = true;
    church.door.target = -1.65;
    if (church.bellRope) church.bellRope.swingTimer = 5.0;
    this.audio.churchBell?.();
    this.audio.choir?.();

    // Posiciona o Padre no Altar-Mor
    priest.massTask = "PREACHING";
    priest.massTarget = {
      x: church.altar ? church.altar.x : church.x,
      z: church.altar ? church.altar.z + 0.35 : church.z - 2.5,
      yaw: (church.ry || 0) + Math.PI,
    };

    // Aloca cada fiel a um banco da igreja
    const seats = church.seats || [];
    for (let i = 0; i < attendees.length; i++) {
      const npc = attendees[i];
      const seat = seats[i % seats.length];
      npc.massTask = "GO_TO_PEW";
      npc.massTarget = seat
        ? { x: seat.x, z: seat.z, yaw: seat.yaw }
        : { x: church.x + (i % 2 === 0 ? -1.5 : 1.5), z: church.z, yaw: (church.ry || 0) + Math.PI };
      npc.communionTarget = {
        x: church.altar ? church.altar.x + (i % 2 === 0 ? -0.4 : 0.4) : church.x,
        z: church.altar ? church.altar.z + 1.25 : church.z - 1.2,
      };
      npc.exitTarget = {
        x: church.doorFront?.x ?? church.x,
        z: church.doorFront?.z ? church.doorFront.z + 4.5 : church.z + 8.0,
      };
      npc.hasReceivedCommunion = false;
    }

    this._massToast(`🔔 A celebração da Santa Missa está começando na ${church.name}!`);
    return true;
  }

  updateChurchMass(dt) {
    if (!this.mass.active) {
      this.mass.nextRandomCheck -= dt;
      if (this.mass.nextRandomCheck <= 0) {
        this.mass.nextRandomCheck = 75 + Math.random() * 60; // Checa a cada ~1.5 - 2 minutos
        // 45% de chance de iniciar missa espontânea (só de dia e se for viável: padre + fiéis perto da igreja)
        if (Math.random() < 0.45) {
          this.startChurchMass(false);
        }
      }
      return;
    }

    this.mass.timer += dt;
    const { church, priest, attendees } = this.mass;

    // Missa interrompida: padre morto/alarmado ou fiéis todos mortos/alarmados -> encerra com segurança
    const priestOk = priest.alive && !priest.removed && priest.mode === "work";
    const faithful = attendees.filter((n) => n.alive && !n.removed && n.mode === "work").length;
    if (this.mass.state !== "DISMISSAL" && (!priestOk || faithful === 0)) {
      for (const n of attendees) { n.massTask = null; n.hasReceivedCommunion = false; }
      priest.massTask = null;
      if (priest.hostMesh) priest.hostMesh.visible = false;
      this._massToast("A Santa Missa foi interrompida.");
      this.mass.active = false;
      this.mass.state = "IDLE";
      this.mass.timer = 0;
      this.mass.attendees = [];
      this.mass.church = null;
      this.mass.priest = null;
      return;
    }

    switch (this.mass.state) {
      case "GATHERING": {
        // Aguarda os fiéis chegarem e sentarem nos bancos
        let allSeated = true;
        for (let i = 0; i < attendees.length; i++) {
          if (attendees[i].massTask !== "SITTING_IN_PEW") {
            allSeated = false;
            break;
          }
        }
        if (allSeated || this.mass.timer > 16.0) {
          for (let i = 0; i < attendees.length; i++) attendees[i].massTask = "SITTING_IN_PEW";
          this.mass.state = "PREACHING";
          this.mass.timer = 0;
          priest.massTask = "PREACHING";
          this._massToast("Padre no Altar: «O Senhor esteja convosco. Ouvi as santas palavras...»");
        }
        break;
      }

      case "PREACHING": {
        if (this.mass.timer > 9.0) {
          // Passa para a oferta e elevação da Hóstia
          this.mass.state = "ELEVATION";
          this.mass.timer = 0;
          priest.massTask = "ELEVATION";
          this.audio.choir?.();
          this.effects.play("star", priest.x, priest.root.position.y + 2.2, priest.z, "#fff1a8", 1.85);
          this._massToast("Padre no Altar: «Eis o Cordeiro de Deus que tira o pecado do mundo!»");
        }
        break;
      }

      case "ELEVATION": {
        if (this.mass.timer > 6.0) {
          // Inicia a fila da comunhão
          this.mass.state = "COMMUNION";
          this.mass.timer = 0;
          priest.massTask = "DISTRIBUTE_COMMUNION";
          this.mass.communionQueue = [...attendees];
          this.mass.activeCommunionNpc = null;
          this.mass.communionCooldown = 0.5;
          this._massToast("Início da Comunhão: Os fiéis se levantam e vão ao altar receber a bênção.");
        }
        break;
      }

      case "COMMUNION": {
        this.mass.communionCooldown = Math.max(0, this.mass.communionCooldown - dt);

        if (!this.mass.activeCommunionNpc && this.mass.communionQueue.length > 0 && this.mass.communionCooldown <= 0) {
          const nextNpc = this.mass.communionQueue.shift();
          this.mass.activeCommunionNpc = nextNpc;
          nextNpc.massTask = "WALK_TO_COMMUNION";
        }

        if (this.mass.activeCommunionNpc) {
          const curr = this.mass.activeCommunionNpc;
          if (curr.hasReceivedCommunion && curr.massTask === "SITTING_IN_PEW") {
            this.mass.activeCommunionNpc = null;
            this.mass.communionCooldown = 1.0;
          }
        }

        // Se toda a fila terminou e todos voltaram a sentar nos bancos
        if (this.mass.communionQueue.length === 0 && !this.mass.activeCommunionNpc) {
          let everyoneSeated = true;
          for (let i = 0; i < attendees.length; i++) {
            if (attendees[i].massTask !== "SITTING_IN_PEW") {
              everyoneSeated = false;
              break;
            }
          }
          if (everyoneSeated || this.mass.timer > 35.0) {
            this.mass.state = "FINAL_BLESSING";
            this.mass.timer = 0;
            priest.massTask = "FINAL_BLESSING";
            this.audio.choir?.();
            this.effects.play("glint", priest.x, priest.root.position.y + 2.0, priest.z, "#ffe57d", 2.0);
            this._massToast("Padre: «A bênção de Deus Todo-Poderoso desça sobre vós. Ide em paz!»");
          }
        }
        break;
      }

      case "FINAL_BLESSING": {
        if (this.mass.timer > 6.0) {
          // Fiéis se levantam e saem da igreja
          this.mass.state = "DISMISSAL";
          this.mass.timer = 0;
          for (let i = 0; i < attendees.length; i++) {
            attendees[i].massTask = "LEAVE_CHURCH";
          }
          priest.massTask = null;
          if (priest.hostMesh) priest.hostMesh.visible = false;
          priest.endAlert?.();
          this._massToast("A Santa Missa foi encerrada. Os fiéis saem em paz.");
        }
        break;
      }

      case "DISMISSAL": {
        let allExited = true;
        for (let i = 0; i < attendees.length; i++) {
          if (attendees[i].massTask) {
            allExited = false;
            break;
          }
        }
        if (allExited || this.mass.timer > 20.0) {
          for (let i = 0; i < attendees.length; i++) {
            attendees[i].massTask = null;
            attendees[i].endAlert?.();
          }
          this.mass.active = false;
          this.mass.state = "IDLE";
          this.mass.timer = 0;
          this.mass.attendees = [];
          this.mass.church = null;
          this.mass.priest = null;
        }
        break;
      }
    }
  }

  // Golpes, tiros e explosões quebram a mobília.
  hitAt(x, y, z, radius, damage) {
    let broken = false;
    for (const house of this.houses) {
      if ((house.x - x) ** 2 + (house.z - z) ** 2 > 14 * 14) continue;
      for (const prop of house.props) {
        if (prop.broken) continue;
        const dx = prop.x - x;
        const dz = prop.z - z;
        const reach = radius + prop.radius;
        if (dx * dx + dz * dz > reach * reach || Math.abs(prop.y - y) > prop.h / 2 + radius + 0.2) continue;
        prop.hp -= damage;
        this.effects.play("dust", prop.x, prop.y, prop.z, "#b89a6a", 0.6);
        if (prop.hp > 0) continue;
        prop.broken = true;
        broken = true;
        prop.mesh.parent?.remove(prop.mesh);
        if (prop.box) prop.box.active = false;
        this.effects.play("smoke", prop.x, prop.y, prop.z, "#c9b48c", 0.9);
        this.audio.hit(true);
        if (prop.loot) this.drops.spawnLoot(prop.x, prop.y + 0.2, prop.z, prop.loot);
        this._reportIntruder(house, "Meus bens! Guardas!", 0.3);
      }
    }
    return broken;
  }
}
