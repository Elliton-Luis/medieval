import {
  PlayerStats,
  PlayerEquipment,
  PlayerInventory,
  BUILD_COSTS,
  MissionState,
  buyUpgrade,
  equipArmor,
  consumeHeartyMeal,
  takeTemplarVow,
  interactWithPriest,
  interactWithBeggar,
  dropHayBait,
  buildStructure,
  sellResourcesToNPC,
  generateDeliveryMission,
  generateDebtMission,
  generateHorseTheftMission,
  generateBountyMission,
  startMission,
  failActiveMission,
  payDebtorMission,
  syncPlayerStatsToPlayer,
} from "./rpg.js";
import { checkAltarInteraction, investigateCultCamp } from "./cult.js";
import {
  checkDemiurgeDiaryNearby,
  interactWithDemiurgeDiary,
  getDemiurgeDiaryHint,
  openDemiurgeDiaryReader,
  closeDemiurgeDiaryReader,
  isDemiurgeDiaryReaderOpen,
} from "./demiurgeBook.js";
import { checkCrystalNearby, collectCrystalNode, applyTorchColor, CRYSTAL_PALETTE } from "./crystals.js";
import { checkGhostTownRubbleNearby, searchGhostTownRubble } from "./ghostTowns.js";

const CULTIST_RUMORS = [
  "«Eu vi fumaça negra além das árvores... deve ser apenas um raio.»",
  "«O padre diz que máscaras de pássaro são contos para assustar crianças.»",
  "«Se os Cátaros quisessem nosso fim, por que não invadem os portões? É tudo invenção.»",
  "«Dizem que eles adoram o Demiurgo e não temem a morte... que Deus nos guarde fora dos muros.»",
];

export class InteractionSystem {
  constructor(player, npcs, input, ui, weapons) {
    this.player = player;
    this.npcs = npcs;
    this.input = input;
    this.ui = ui;
    this.weapons = weapons;
    this.activeNPC = null;
    this.drops = null;
    this.candle = null;
    this.houses = null;
    this.horses = null;
    this.hayBales = null;
    this._vitalsTimer = 0;
    this.ui.onDialogAction = (action) => this._choose(action);
    this.ui.onDialogClose = () => this._close();
    this.ui.setVitals(player.health, player.maxHealth, player.coins, player.potions);
    this.ui.setRPGStats?.(PlayerStats, PlayerEquipment);
  }

  _price(base) {
    return Math.max(1, Math.round(base * PlayerStats.getPriceMult()));
  }

  update(dt) {
    if (this.player.knockedOut) {
      this.input.consumeInteractPressed();
      this.input.consumeHayBaitPressed();
      this.input.consumeCraftMenuPressed?.();
      return;
    }

    if (this.input.consumeCraftMenuPressed?.()) {
      if (!this.ui.dialoguePanel.hidden && !this.activeNPC) {
        this.ui.closeDialogue();
      } else {
        this.activeNPC = null;
        this.input.setModalOpen(true);
        if (document.pointerLockElement) document.exitPointerLock();
        this._showCraftingMenu();
      }
      return;
    }

    if (this.input.consumeWeaponsCodexPressed?.()) {
      if (document.pointerLockElement) document.exitPointerLock();
      import("./weaponsScreen.js").then(({ openWeaponsScreen }) => {
        openWeaponsScreen(window.__game || this);
      });
      return;
    }

    if (this.input.consumeDiaryPressed?.()) {
      if (isDemiurgeDiaryReaderOpen()) {
        closeDemiurgeDiaryReader();
      } else if (PlayerInventory.hasDemiurgeDiary) {
        if (document.pointerLockElement) document.exitPointerLock();
        openDemiurgeDiaryReader(0, this.audio);
      } else {
        this.ui.showToast(`✦ Não possuis o Diário dos Demiurgos... Dica: ${getDemiurgeDiaryHint()}`);
      }
      return;
    }

    if (this.input.consumeHayBaitPressed()) {
      this._tryDropHayBait();
    }

    if (this.input.consumeInteractPressed()) {
      if (!this.ui.dialoguePanel.hidden) this.ui.closeDialogue();
      else if (
        !this.weapons?.tryPickupSpear?.() &&
        !this.weapons?.tryPickupPlacedItem?.() &&
        !this.drops?.tryPickup() &&
        !this.candle?.interact() &&
        !this.houses?.interact() &&
        !this._tryGatherHayBale() &&
        !this._tryCollectCrystal() &&
        !this._tryInteractDemiurgeDiary() &&
        !this._tryInteractAltar() &&
        !this._trySearchGhostTown()
      ) {
        this._interactNearby();
      }
    }
    this._checkAltarNearby();
    this._checkDemiurgeDiaryNearby();
    this._checkCrystalNearby();
    this._checkGhostTownNearby();
    this._vitalsTimer += dt;
    if (this._vitalsTimer >= 0.25) {
      this._vitalsTimer = 0;
      syncPlayerStatsToPlayer(this.player, this.ui);
    }
  }

  _showCraftingMenu(message = "") {
    const inv = PlayerInventory;
    const body =
      message ||
      `Recursos na mochila: ${inv.wood} Madeira · ${inv.stone} Pedra · ${inv.hay} Feno · ${inv.torches} Tocha(s) · ${inv.gold} Moedas.\nUse o Machado (2) em árvores e a Picareta (3) em rochas para coletar materiais.`;
    const canTorch = inv.wood >= 1 && inv.hay >= 1;
    const canSpear = inv.wood >= 3;
    const canClub = inv.wood >= 2 && inv.stone >= 1;
    const canHouse = inv.wood >= BUILD_COSTS.HOUSE.wood && inv.stone >= BUILD_COSTS.HOUSE.stone;
    const canCorral = inv.wood >= BUILD_COSTS.CORRAL.wood && inv.hay >= BUILD_COSTS.CORRAL.hay;

    const actions = [];

    if (inv.hasDemiurgeDiary) {
      actions.push({
        id: "read:demiurge_diary",
        label: "📖 Ler Diário dos Demiurgos (Códice Proibido · Tecla L)",
      });
    }

    actions.push(
      {
        id: "view:weapons_codex",
        label: "⚔️ Compêndio de Armas (Dano, Velocidade, Melhorias & Status)",
      },
      {
        id: "craft:makeshift_spear",
        label: "Criar Lança Improvisada (3 Madeira · 10 usos de durabilidade)",
        disabled: !canSpear,
      },
      {
        id: "craft:makeshift_club",
        label: "Criar Porrete Rústico (2 Madeira + 1 Pedra · 15 usos)",
        disabled: !canClub,
      },
      {
        id: "craft:torch",
        label: `Criar Tocha (1 Madeira + 1 Feno) · tens ${inv.torches}`,
        disabled: !canTorch,
      },
      {
        id: "craft:candle",
        label: `Criar Vela de Sebo (1 Madeira + 1 Feno) · tens ${this.candle?.count ?? 0}`,
        disabled: !canTorch,
      },
      {
        id: "build:house",
        label: `Construir Casa Própria (${BUILD_COSTS.HOUSE.wood} Madeira + ${BUILD_COSTS.HOUSE.stone} Pedra)`,
        disabled: !canHouse,
      },
      {
        id: "build:corral",
        label: `Construir Curral de Cavalos (${BUILD_COSTS.CORRAL.wood} Madeira + ${BUILD_COSTS.CORRAL.hay} Feno)`,
        disabled: !canCorral,
      }
    );

    // Opções de Infusão de Cor da Tocha com Cristais Coletados
    const availableColors = ["orange"];
    const crys = inv.crystals || {};
    if (crys.green > 0) availableColors.push("green");
    if (crys.blue > 0) availableColors.push("blue");
    if (crys.pink > 0) availableColors.push("pink");
    if (crys.red > 0) availableColors.push("red");
    if (crys.white > 0) availableColors.push("white");
    if (crys.purple > 0) availableColors.push("purple");

    for (const cKey of availableColors) {
      if (cKey === (inv.torchColor || "orange")) continue;
      const cInfo = CRYSTAL_PALETTE[cKey];
      if (cInfo) {
        actions.push({
          id: `torch_color:${cKey}`,
          label: `🔥 ${cInfo.label}`,
        });
      }
    }

    actions.push({ id: "close", label: "Fechar menu (I)" });
    this.ui.showDialogue("Ofício & Sobrevivência (Camponês)", body, actions, {
      role: "Bancada do Trabalhador",
      roleKey: "farmer",
      eyebrow: "CALDERA · CONSTRUÇÃO & OFÍCIO",
      funds: {
        coins: this.player.coins,
        wood: inv.wood,
        stone: inv.stone,
        clay: inv.clay || 0,
        hay: inv.hay,
      },
    });
  }

  _tryGatherHayBale() {
    if (!this.hayBales) return false;
    for (let i = 0; i < this.hayBales.length; i++) {
      const bale = this.hayBales[i];
      if (!bale || bale.burning || bale.burned) continue;
      const dx = bale.x - this.player.x;
      const dz = bale.z - this.player.z;
      if (dx * dx + dz * dz < 2.5 * 2.5) {
        if (PlayerInventory.hay >= 20) {
          this.ui.showToast("Alforje de feno cheio (20/20) · venda ao fazendeiro ou use G");
          return true;
        }
        PlayerInventory.hay = Math.min(20, PlayerInventory.hay + 2);
        PlayerStats.hay = PlayerInventory.hay;
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast(`+2 Feno recolhido (Total: ${PlayerInventory.hay}) · use G p/ isca ou I p/ criar tocha`);
        return true;
      }
    }
    return false;
  }

  _tryDropHayBait() {
    if (PlayerInventory.hay <= 0) {
      this.ui.showToast("Sem feno no alforje · recolha num fardo (E) ou corte arbustos");
      return;
    }
    PlayerInventory.hay--;
    PlayerStats.hay = PlayerInventory.hay;
    const { attractedCount } = dropHayBait(
      { x: this.player.x, y: this.player.root.position.y, z: this.player.z },
      this.horses?.horses || [],
    );
    syncPlayerStatsToPlayer(this.player, this.ui);
    if (attractedCount > 0) {
      this.ui.showToast(`Isca de feno largada! ${attractedCount} cavalo(s) atraído(s) pelo faro`);
    } else {
      this.ui.showToast(`Isca de feno largada no chão (${PlayerInventory.hay} restante)`);
    }
  }

  _checkAltarNearby() {
    const isNight = this.dayNight ? this.dayNight.isNight : true;
    const altar = checkAltarInteraction(this.player.root.position, isNight);
    if (altar && !this.ui.dialoguePanel.hidden) {
      this.ui.setPrompt(`✦ ${altar.name ? altar.name.toUpperCase() : "ACAMPAMENTO DO DEMIURGO"} [E] Investigar Pistas & Notas`);
    }
  }

  _tryInteractAltar() {
    const isNight = this.dayNight ? this.dayNight.isNight : true;
    const altar = checkAltarInteraction(this.player.root.position, isNight);
    if (altar) {
      return investigateCultCamp(altar, this.ui, this.audio, this.input);
    }
    return false;
  }

  _checkCrystalNearby() {
    const node = checkCrystalNearby(this.player.root.position);
    if (node && !this.ui.dialoguePanel.hidden) {
      this.ui.setPrompt?.(`✦ ${node.name.toUpperCase()} [E] Coletar Cristal ${node.label}`);
    }
  }

  _tryCollectCrystal() {
    const node = checkCrystalNearby(this.player.root.position);
    if (node) {
      return collectCrystalNode(node, this.ui, this.audio, this.weapons);
    }
    return false;
  }

  _checkDemiurgeDiaryNearby() {
    if (checkDemiurgeDiaryNearby(this.player.root.position)) {
      this.ui.setPrompt?.("✦ DIÁRIO DOS DEMIURGOS [E] Recolher Diário Proibido");
    }
  }

  _tryInteractDemiurgeDiary() {
    return interactWithDemiurgeDiary(this.player.root.position, this.ui, this.audio, this.input);
  }

  _checkGhostTownNearby() {
    const town = checkGhostTownRubbleNearby(this.player.root.position);
    if (town && !this.ui.dialoguePanel.hidden) {
      this.ui.setPrompt?.(`✦ ${town.name.toUpperCase()} [E] Vasculhar Escombros & Códices`);
    }
  }

  _trySearchGhostTown() {
    const town = checkGhostTownRubbleNearby(this.player.root.position);
    if (town) {
      return searchGhostTownRubble(town, this.ui, this.audio);
    }
    return false;
  }

  _interactNearby() {
    let target = null;
    let best = 3.8 * 3.8;
    for (let i = 0; i < this.npcs.npcs.length; i++) {
      const npc = this.npcs.npcs[i];
      if (!npc.alive || npc.temporary || npc.root?.userData?.isSleeping) continue;
      const dx = npc.x - this.player.x;
      const dz = npc.z - this.player.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < best) { best = distSq; target = npc; }
    }
    if (!target) {
      this.ui.showToast("Chegue mais perto de alguém para conversar.");
      return;
    }
    this.activeNPC = target;
    this.input.setModalOpen(true);
    if (document.pointerLockElement) document.exitPointerLock();
    this._showNPCDialogue();
  }

  _nextArmorTier() {
    const cur = PlayerEquipment.armorNegationChance;
    if (cur < 0.3) return { chance: 0.3, cost: this._price(25), label: "Cota de Malha (30% chance de anular dano)" };
    if (cur < 0.5) return { chance: 0.5, cost: this._price(45), label: " couraça Real (50% chance de anular dano)" };
    if (cur < 0.7) return { chance: 0.7, cost: this._price(75), label: "Armadura Completa (70% máx anulação)" };
    return null;
  }

  _showNPCDialogue(message = "") {
    const npc = this.activeNPC;
    if (!npc || !npc.alive) { this.ui.closeDialogue(); return; }
    const mult = PlayerStats.getPriceMult();
    const discountPct = Math.round((1 - mult) * 100);
    const chaNote = discountPct > 0
      ? ` (Carisma ${PlayerStats.cha}: -${discountPct}% nos preços)`
      : discountPct < 0
        ? ` (Carisma ${PlayerStats.cha}: +${Math.abs(discountPct)}% nos preços)`
        : "";

    let body = `${npc.task}.${chaNote}`;
    let actions = [{ id: "close", label: "Encerrar conversa" }];

    if (npc.root?.userData?.isMissionDebtor) {
      body =
        message ||
        "Piedade! A geada estragou minha lavoura e ainda não tenho as 20 moedas que devo à estalagem! Não me espanque!";
      actions = [
        {
          id: "mission:pay_debt",
          label: "Pagar a dívida pelo camponês (-20 moedas · +4 Carisma)",
          disabled: this.player.coins < 20,
        },
        {
          id: "close",
          label: "Cobrar na marra (use os Punhos [Slot 1] sem matá-lo!)",
        },
      ];
      this.ui.showDialogue(npc.name, body, actions, {
        role: npc.title || "Aldeão",
        roleKey: npc.roleKey,
        funds: {
          coins: this.player.coins,
          wood: PlayerInventory.wood,
          stone: PlayerInventory.stone,
          clay: PlayerInventory.clay || 0,
          hay: PlayerInventory.hay,
        },
      });
      return;
    }

    if (npc.roleKey === "smith") {
      body = (message || "Aço novo, direto da forja. Escolha com cuidado: cada arma tem seu peso e seu jeito.") + chaNote;
      const wares = this.weapons.shopWeapons().slice(0, 5);
      const nextArmor = this._nextArmorTier();
      const pWeaponUp = this._price(20 + PlayerEquipment.weaponLevel * 10);
      const pRepair = this._price(8);
      const pBolts = this._price(8);
      const pKnives = this._price(15);
      const pOil = this._price(14);
      const pTrainStr = this._price(18);
      actions = [
        {
          id: "sell:blacksmith",
          label: `Trabalhar: Vender 10 Madeiras para a fornalha (+25 moedas) · tens ${PlayerInventory.wood} Mad`,
          disabled: PlayerInventory.wood < 10,
        },
        {
          id: "sell:stone",
          label: `Trabalhar: Vender 5 Pedras brutas (+15 moedas) · tens ${PlayerInventory.stone} Ped`,
          disabled: PlayerInventory.stone < 5,
        },
        nextArmor
          ? { id: "upgrade:armor", label: `Forjar ${nextArmor.label} · ${nextArmor.cost} moedas`, disabled: this.player.coins < nextArmor.cost }
          : { id: "upgrade:armor", label: "Armadura Real Completa (70% deflexão) · adquirida", disabled: true },
        { id: "upgrade:weapon", label: `Afiar Arsenal (Nível ${PlayerEquipment.weaponLevel} → ${PlayerEquipment.weaponLevel + 1}, +25% dano) · ${pWeaponUp} moedas`, disabled: this.player.coins < pWeaponUp },
        { id: "repair", label: `Reparar vitalidade/placas · ${pRepair} moedas`, disabled: this.player.coins < pRepair || this.player.health >= this.player.maxHealth },
        { id: "train:str", label: `Treinar Força na bigorna (+1 FOR, atual ${PlayerStats.str}) · ${pTrainStr} moedas`, disabled: this.player.coins < pTrainStr },
        ...wares.map((w) => {
          const wp = this._price(w.price);
          return { id: `buy:${w.id}:${wp}`, label: `${w.name} · ${wp} moedas (slot ${w.slot}${w.hands === 2 ? ", duas mãos" : ""})`, disabled: this.player.coins < wp };
        }),
        { id: "bolts", label: `Virotes de balestra ×4 · ${pBolts} moedas`, disabled: this.player.coins < pBolts },
        { id: "knives", label: `Facas de arremesso ×5 · ${pKnives} moedas`, disabled: this.player.coins < pKnives },
        { id: "oil", label: `Potes de óleo ×2 · ${pOil} moedas`, disabled: this.player.coins < pOil },
        { id: "close", label: "Encerrar conversa" },
      ];
    } else if (npc.roleKey === "merchant") {
      body = (message || "Tenho provisões, relíquias e serviços urgentes para quem busca moedas rápidas.") + chaNote;
      const pCandle = this._price(6);
      const pPotion = this._price(10);
      const pArrows = this._price(7);
      const pBombs = this._price(15);
      const pTrainCha = this._price(16);
      const pBlessing = this._price(35);
      const pMeal = this._price(15);
      actions = [
        {
          id: "tavern:meal",
          label: `Banquete Reforçado da Taverna (+1 CON permanente e Cura Total) · ${pMeal} moedas`,
          disabled: this.player.coins < pMeal,
        },
        {
          id: "mission:deliver",
          label: "✦ Missão: Entrega de Suprimentos (+30 moedas, +2 CAR)",
        },
        {
          id: "mission:debt",
          label: "✦ Missão: A Cobrança na Vila (+40 moedas nos Punhos ou +4 CAR)",
        },
        ...(MissionState.activeId
          ? [{ id: "mission:cancel", label: `✕ Cancelar missão ativa (${MissionState.title})` }]
          : []),
        { id: "blessing", label: PlayerEquipment.blessingActive ? "Colar da Bênção · equipado" : `Colar da Bênção (15% chance de cortar dano ao meio) · ${pBlessing} moedas`, disabled: PlayerEquipment.blessingActive || this.player.coins < pBlessing },
        { id: "candle", label: `Vela · ${pCandle} moedas`, disabled: this.player.coins < pCandle },
        { id: "potion", label: `Poção de vigor · ${pPotion} moedas (${this.player.potions} no alforje)`, disabled: this.player.coins < pPotion || this.player.potions >= 4 },
        { id: "arrows", label: `Flechas · ${pArrows} moedas`, disabled: this.player.coins < pArrows },
        { id: "bombs", label: `Duas bombas de mão · ${pBombs} moedas`, disabled: this.player.coins < pBombs },
        { id: "train:cha", label: `Cortesia e Retórica (+1 CAR, atual ${PlayerStats.cha}) · ${pTrainCha} moedas`, disabled: this.player.coins < pTrainCha },
        { id: "rumor:demiurge_book", label: "✦ Boatos da Taverna: Indagar sobre o Diário dos Demiurgos" },
        { id: "close", label: "Encerrar conversa" },
      ];
    } else if (npc.roleKey === "farmer") {
      body = (message || "Pão fresco da horta e feno aromático para domar cavalos pelo faro.") + chaNote;
      const pBread = this._price(5);
      const pHay = this._price(4);
      const pTrainCon = this._price(20);
      const pTrainSpd = this._price(16);
      actions = [
        {
          id: "sell:farmer",
          label: `Trabalhar: Vender 5 Fenos colhidos (+10 moedas) · tens ${PlayerInventory.hay} Feno`,
          disabled: PlayerInventory.hay < 5,
        },
        { id: "bread", label: `Pão da horta · ${pBread} moedas`, disabled: this.player.coins < pBread || this.player.health >= this.player.maxHealth },
        { id: "hay", label: `Fardo de feno ×2 (isca G) · ${pHay} moedas (${PlayerInventory.hay}/20)`, disabled: this.player.coins < pHay || PlayerInventory.hay >= 20 },
        { id: "train:con", label: `Vigor do Campo (+2 CON, atual ${PlayerStats.con}) · ${pTrainCon} moedas`, disabled: this.player.coins < pTrainCon },
        { id: "train:spd", label: `Passo Ligeiro (+1 VEL, atual ${PlayerStats.spd}) · ${pTrainSpd} moedas`, disabled: this.player.coins < pTrainSpd },
        { id: "close", label: "Encerrar conversa" },
      ];
    } else if (npc.roleKey === "priest") {
      body =
        message ||
        "A paz esteja convosco, viajante. Na Casa do Pai, as bênçãos e o perdão dos céus são sempre dons gratuitos da graça divina para todos os corações contritos.";
      actions = [
        {
          id: "priest:templar_vow",
          label: PlayerStats.isTemplar
            ? (PlayerStats.hasBrokenVow
                ? "⚠️ VOTO TEMPLÁRIO QUEBRADO (Abata um lobisomem nos ermos para purificar)"
                : "✦ Cavaleiro da Ordem dos Templários (Juramento Sagrado Ativo)")
            : "⚔ Juramento dos Cavaleiros Templários (Exige Carisma 15 · Concede Armadura de Placas)",
          disabled: PlayerStats.isTemplar || PlayerStats.cha < 15,
        },
        {
          id: "priest:heal",
          label: "Receber Bênção de Cura dos Enfermos (Sempre Gratuito · Restaura Vitalidade)",
          disabled: this.player.health >= this.player.maxHealth,
        },
        {
          id: "priest:confess",
          label: "Confissão e Absolvição dos Pecados (Sempre Gratuito · Zera Procurado e +2 CAR)",
        },
        {
          id: "blessing",
          label: PlayerEquipment.blessingActive
            ? "Colar da Bênção · já consagrado"
            : "Consagrar Colar da Bênção (Graça Protetora · Gratuito)",
          disabled: PlayerEquipment.blessingActive,
        },
        {
          id: "priest:mass",
          label: "✦ Celebrar a Santa Missa na Paróquia (Reunir os Fiéis e a Comunhão)",
        },
        {
          id: "priest:offering:small",
          label: "Fazer Oferta Voluntária de 5 moedas à paróquia (+1 CAR)",
          disabled: this.player.coins < 5,
        },
        {
          id: "priest:offering:generous",
          label: "Fazer Oferta Voluntária de 20 moedas à paróquia (+3 CAR)",
          disabled: this.player.coins < 20,
        },
        { id: "priest:guide", label: "Ouvir ensinamentos sobre os mistérios da Igreja" },
        { id: "rumor:demiurge_book", label: "✦ Indagar sobre o Diário dos Demiurgos (Heresia)" },
        { id: "close", label: "Encerrar conversa" },
      ];
    } else if (npc.roleKey === "beggar") {
      const alreadyGave = Boolean(npc.root?.userData?.hasReceivedAlms);
      body = message || (alreadyGave
        ? "Que os céus iluminem o teu caminho, benfeitor! Jamais esquecerei tua bondade."
        : "Uma moeda para um pobre faminto, nobre viajante? Deus lhe pagará em dobro na estima do povo.");
      actions = [
        {
          id: "beggar:alms",
          label: alreadyGave ? "Esmola já entregue · +1 Carisma recebido" : "Dar esmola ao pobre (+1 CAR) · 5 moedas",
          disabled: alreadyGave || this.player.coins < 5,
        },
        { id: "rumor:demiurge_book", label: "✦ Sussurros da Rua: Indagar sobre o Diário dos Demiurgos" },
        { id: "close", label: "Encerrar conversa" },
      ];
    } else if (npc.roleKey === "guard") {
      body = message || "Mantenha a estrada principal. Há bandidos acampados além das muralhas com recompensa pela cabeça.";
      actions = [
        {
          id: "mission:bounty",
          label: "✦ Missão: Caça ao Bandido nas terras ermas (+65 moedas, +2 CAR)",
        },
        ...(MissionState.activeId
          ? [{ id: "mission:cancel", label: `✕ Cancelar missão ativa (${MissionState.title})` }]
          : []),
        { id: "close", label: "Encerrar conversa" },
      ];
    } else {
      body = message || "Psst... Um comprador discreto paga 60 moedas por um Cavalo Puro-Sangue furtado da muralha leste.";
      actions = [
        {
          id: "mission:horse_theft",
          label: "✦ Missão: Roubo de Montaria Puro-Sangue (+60 moedas, +1 CAR)",
        },
        {
          id: "rumor:cult",
          label: "Ouvir boatos sobre as sombras além dos muros",
        },
        {
          id: "rumor:demiurge_book",
          label: "✦ Boatos do Submundo: Indagar sobre o Diário dos Demiurgos",
        },
        ...(MissionState.activeId
          ? [{ id: "mission:cancel", label: `✕ Cancelar missão ativa (${MissionState.title})` }]
          : []),
        { id: "close", label: "Encerrar conversa" },
      ];
    }
    this.ui.showDialogue(npc.name, body, actions, {
      role: npc.title || "Habitante de Caldera",
      roleKey: npc.roleKey,
      eyebrow: "CALDERA · CONVERSA & COMÉRCIO",
      funds: {
        coins: this.player.coins,
        wood: PlayerInventory.wood,
        stone: PlayerInventory.stone,
        clay: PlayerInventory.clay || 0,
        hay: PlayerInventory.hay,
      },
    });
  }

  _choose(action) {
    if (action === "close") { this.ui.closeDialogue(); return; }

    const cityAnchors = this.npcs?.settlement?.cityData?.anchors || null;
    if (action === "mission:deliver") {
      const m = generateDeliveryMission(this.activeNPC, cityAnchors);
      startMission(m);
      this.ui.closeDialogue();
      this.ui.showToast("Missão Iniciada: Entrega de Suprimentos! Siga o pilar de luz dourado.");
      return;
    }
    if (action === "mission:debt") {
      const m = generateDebtMission(this.activeNPC, cityAnchors);
      startMission(m);
      this.ui.closeDialogue();
      this.ui.showToast("Missão Iniciada: A Cobrança! Use os Punhos (Slot 1) no devedor ou pague por ele.");
      return;
    }
    if (action === "mission:horse_theft") {
      const m = generateHorseTheftMission(this.activeNPC, cityAnchors);
      startMission(m);
      this.ui.closeDialogue();
      this.ui.showToast("Missão Iniciada: Roubo de Montaria! Furte o Puro-Sangue na muralha leste.");
      return;
    }
    if (action === "mission:bounty") {
      const m = generateBountyMission(this.activeNPC, cityAnchors);
      startMission(m);
      this.ui.closeDialogue();
      this.ui.showToast("Missão Iniciada: Caça ao Bandido! Elimine o alvo fora da muralha.");
      return;
    }
    if (action === "mission:pay_debt") {
      if (payDebtorMission(this.activeNPC?.root)) {
        this.ui.closeDialogue();
      }
      return;
    }
    if (action === "mission:cancel") {
      failActiveMission("Missão cancelada.");
      this._showNPCDialogue("Sem problemas. Avise se mudar de ideia.");
      return;
    }
    if (action === "rumor:cult") {
      const rumor = CULTIST_RUMORS[Math.floor(Math.random() * CULTIST_RUMORS.length)];
      this._showNPCDialogue(rumor);
      return;
    }
    if (action === "rumor:demiurge_book") {
      const hint = getDemiurgeDiaryHint();
      let speech = `«O aldeão olha ao redor temeroso e sussurra: "${hint}"»`;
      if (this.activeNPC?.roleKey === "priest") {
        speech = `«O sacerdote faz o sinal da cruz com horror: 'Não deves buscar tais blasfêmias... Mas dizem os que guardam a vigília: "${hint}"'»`;
      } else if (this.activeNPC?.roleKey === "beggar") {
        speech = `«O mendigo se aproxima trêmulo: 'Eu vi vultos na calada da noite, nobre viajante... "${hint}"'»`;
      } else if (this.activeNPC?.roleKey === "thief") {
        speech = `«O bandido sorri de soslaio: 'Procuras o livro proibido? Boas moedas pagam essa informação: "${hint}"'»`;
      }
      this._showNPCDialogue(speech);
      return;
    }

    if (action.startsWith("torch_color:")) {
      const color = action.split(":")[1];
      applyTorchColor(color, this.weapons);
      const cInfo = CRYSTAL_PALETTE[color];
      this.ui.showToast(`✦ Tocha infundida com sucesso! Chama ${cInfo ? cInfo.label : color}.`);
      this._showCraftingMenu(`A chama da tua tocha agora queima em resplendor ${cInfo ? cInfo.label : color}!`);
      return;
    }

    if (action === "read:demiurge_diary") {
      this.ui.closeDialogue();
      if (document.pointerLockElement) document.exitPointerLock();
      openDemiurgeDiaryReader(0, this.audio);
      return;
    }

    if (action === "view:weapons_codex") {
      this.ui.closeDialogue();
      import("./weaponsScreen.js").then(({ openWeaponsScreen }) => {
        openWeaponsScreen(window.__game || this);
      });
      return;
    }

    if (action === "craft:makeshift_spear") {
      if (PlayerInventory.craftMakeshiftSpear()) {
        this.ui.showToast("Lança de Madeira Improvisada pronta (Slot 6 · 10 usos)!");
        this._showCraftingMenu("Lança confeccionada com ponta afiada! Ela quebra após 10 golpes.");
      }
      return;
    }
    if (action === "craft:makeshift_club") {
      if (PlayerInventory.craftMakeshiftClub()) {
        this.ui.showToast("Porrete Rústico pronto (Slot 4 · 15 usos)!");
        this._showCraftingMenu("Porrete robusto pronto! Alta força de impacto por 15 golpes.");
      }
      return;
    }
    if (action === "craft:torch") {
      if (PlayerInventory.craftTorch()) {
        this.ui.showToast("Tocha confeccionada e equipada (Slot 1)!");
        this._showCraftingMenu("Tocha pronta! Ela não se apaga com o vento e incendeia inimigos.");
      }
      return;
    }
    if (action === "craft:candle") {
      if (PlayerInventory.wood >= 1 && PlayerInventory.hay >= 1) {
        PlayerInventory.wood--;
        PlayerInventory.hay--;
        PlayerStats.hay = PlayerInventory.hay;
        if (this.candle) {
          this.candle.count++;
          this.candle._sync?.();
        }
        syncPlayerStatsToPlayer(this.player, this.ui);
        this.ui.showToast("Vela de sebo confeccionada! Pressione V para acender.");
        this._showCraftingMenu("Vela pronta! Pressione V durante a noite para acendê-la.");
      }
      return;
    }
    if (action === "build:house" || action === "build:corral") {
      const type = action === "build:house" ? "HOUSE" : "CORRAL";
      const built = buildStructure(
        this.player.root.position,
        this.player.model.rotation,
        type,
        this.weapons?.playerBuildingsPool,
      );
      if (built) {
        this.ui.closeDialogue();
        this.ui.showToast(type === "HOUSE" ? "Casa Própria erguida à sua frente!" : "Curral de Cavalos erguido à sua frente!");
      }
      return;
    }

    if (action === "sell:blacksmith") {
      if (sellResourcesToNPC("BLACKSMITH")) {
        this.ui.showToast("+25 moedas! Vendeste 10 madeiras ao ferreiro.");
        this._showNPCDialogue("Boa lenha seca! A fornalha vai arder forte hoje. Aqui estão tuas 25 moedas.");
      }
      return;
    }
    if (action === "sell:stone") {
      if (sellResourcesToNPC("STONE")) {
        this.ui.showToast("+15 moedas! Vendeste 5 pedras brutas ao ferreiro.");
        this._showNPCDialogue("Minério firme! Bom trabalho na picareta, toma tuas 15 moedas.");
      }
      return;
    }
    if (action === "sell:farmer") {
      if (sellResourcesToNPC("FARMER")) {
        this.ui.showToast("+10 moedas! Vendeste 5 fenos ao fazendeiro.");
        this._showNPCDialogue("Feno fresco de primeira! Os animais agradecem. Toma tuas 10 moedas.");
      }
      return;
    }
    const nextArmor = this._nextArmorTier();
    const pWeaponUp = this._price(20 + PlayerEquipment.weaponLevel * 10);
    const pRepair = this._price(8);
    const pPotion = this._price(10);
    const pCandle = this._price(6);
    const pBread = this._price(5);
    const pHay = this._price(4);
    const pBolts = this._price(8);
    const pArrows = this._price(7);
    const pBombs = this._price(15);
    const pKnives = this._price(15);
    const pOil = this._price(14);
    const pTrainStr = this._price(18);
    const pTrainCha = this._price(16);
    const pTrainCon = this._price(20);
    const pTrainSpd = this._price(16);
    const pBlessing = this._price(35);

    if (action === "upgrade:armor" && nextArmor) {
      if (buyUpgrade("ARMOR", nextArmor.cost, nextArmor.chance)) {
        equipArmor(Math.min(3, (PlayerStats.armorLevel || 0) + 1), this.player);
        const pct = Math.round(PlayerEquipment.armorNegationChance * 100);
        this.ui.showToast(`Armadura Nível ${PlayerStats.armorLevel} forjada: ${pct}% de deflexão de golpes!`);
        this._showNPCDialogue(`Placas temperadas! Agora tens Armadura Nível ${PlayerStats.armorLevel} com ${pct}% de chance de defletir qualquer golpe sem sofrer dano.`);
      }
    } else if (action === "tavern:meal") {
      if (consumeHeartyMeal(this.player, this.ui, this.audio)) {
        this._showNPCDialogue("Um banquete farto e suculento! Sente a vitalidade e constituição renovadas.");
      }
      return;
    } else if (action === "priest:templar_vow") {
      if (takeTemplarVow(this.player, this.ui, this.audio)) {
        this._showNPCDialogue("«Non nobis, Domine, non nobis, sed nomini tuo da gloriam!» Que a espada da retidão e tua Armadura de Placas sirvam aos céus. Não cometas pecados contra inocentes!");
      }
      return;
    } else if (action === "upgrade:weapon") {
      if (buyUpgrade("WEAPON", pWeaponUp)) {
        this.ui.showToast(`Armas aprimoradas para Nível ${PlayerEquipment.weaponLevel}!`);
        this._showNPCDialogue("Fio de navalha! Suas armas agora causam muito mais estrago.");
      }
    } else if (action === "blessing") {
      if (buyUpgrade("BLESSING", 0)) {
        this.ui.showToast("Colar da Bênção consagrado com a graça celestial! (15% redução de dano)");
        this._showNPCDialogue("«A graça de Deus é dom gratuito». Que este colar abençoado guarde o teu peito.");
      }
    } else if (action === "priest:heal") {
      this.player.health = this.player.maxHealth;
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("Bênção de Cura concedida gratuitamente! Vitalidade totalmente restaurada.");
      this._showNPCDialogue("«Levanta-te e anda em paz». Que a luz sagrada renove tuas forças.");
      return;
    } else if (action === "priest:confess") {
      if (interactWithPriest(this.player.root.position, this.activeNPC, 0)) {
        this.ui.showToast("Absolvição concedida gratuitamente! Procurado zerado · Carisma +2");
        this._showNPCDialogue("«Ego te absolvo a peccatis tuis». Seus pecados estão perdoados pela graça.");
      }
      return;
    } else if (action === "priest:offering:small" && this.player.coins >= 5) {
      this.player.coins -= 5;
      PlayerStats.gold = this.player.coins;
      PlayerStats.cha = Math.min(20, PlayerStats.cha + 1);
      this.audio.coin?.();
      this.audio.choir?.();
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("Oferta espontânea de 5 moedas entregue ao padre! +1 Carisma.");
      this._showNPCDialogue("Deus abençoe vossa generosidade espontânea! Os frutos apoiarão os necessitados.");
      return;
    } else if (action === "priest:offering:generous" && this.player.coins >= 20) {
      this.player.coins -= 20;
      PlayerStats.gold = this.player.coins;
      PlayerStats.cha = Math.min(20, PlayerStats.cha + 3);
      this.audio.coin?.();
      this.audio.choir?.();
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("Oferta generosa de 20 moedas entregue ao padre! +3 Carisma.");
      this._showNPCDialogue("Tua generosidade enche de júbilo a paróquia! Os céus recompensam os que ofertam com amor.");
      return;
    } else if (action === "priest:mass") {
      if (this.houses?.startChurchMass) {
        const started = this.houses.startChurchMass(true);
        if (started) {
          this.ui.closeDialogue();
          this.ui.showToast("🔔 A celebração da Santa Missa foi iniciada na Igreja!");
          return;
        }
      }
      this._showNPCDialogue("A celebração eucarística já está em andamento no Altar-Mor!");
      return;
    } else if (action === "priest:guide") {
      this._showNPCDialogue(
        "Na Casa do Senhor tudo é graça: confissões e bênçãos são sempre gratuitas. Podes fazer ofertas espontâneas, ajoelhar no altar, benzer-te na pia ou ler as Escrituras Sagradas sem pressa no atril.",
      );
      return;
    } else if (action === "beggar:alms" && this.activeNPC) {
      if (interactWithBeggar(this.player.root.position, this.activeNPC.root)) {
        this.ui.showToast("Deste esmola ao pobre · Carisma +1!");
        this._showNPCDialogue("Mil bênçãos sobre a tua cabeça! Povo de Caldera, vede que alma generosa!");
      }
    } else if (action === "repair" && this.player.coins >= pRepair && this.player.health < this.player.maxHealth) {
      this.player.coins -= pRepair;
      this.player.health = this.player.maxHealth;
      this.ui.showToast("Armadura e vitalidade restauradas.");
      this._showNPCDialogue("Pronto. As fivelas e placas estão firmes de novo.");
    } else if (action === "train:str" && this.player.coins >= pTrainStr) {
      this.player.coins -= pTrainStr;
      PlayerStats.str += 1;
      this.ui.showToast(`Força aumentou para ${PlayerStats.str}! (+5% dano corpo a corpo)`);
      this._showNPCDialogue("Belo golpe no malho! Seus braços estão mais fortes.");
    } else if (action === "train:cha" && this.player.coins >= pTrainCha) {
      this.player.coins -= pTrainCha;
      PlayerStats.cha = Math.min(20, PlayerStats.cha + 1);
      this.ui.showToast(`Carisma aumentou para ${PlayerStats.cha}! (Melhores preços)`);
      this._showNPCDialogue("Boa lábia abre portas e baixa preços em todo o reino.");
    } else if (action === "train:con" && this.player.coins >= pTrainCon) {
      this.player.coins -= pTrainCon;
      PlayerStats.con += 2;
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast(`Constituição aumentou para ${PlayerStats.con}! (+Vida máxima e firmeza)`);
      this._showNPCDialogue("Com essa saúde de ferro, nenhum golpe vai te derrubar fácil.");
    } else if (action === "train:spd" && this.player.coins >= pTrainSpd) {
      this.player.coins -= pTrainSpd;
      PlayerStats.spd += 1;
      this.ui.showToast(`Velocidade aumentou para ${PlayerStats.spd}! (+3% velocidade e fôlego)`);
      this._showNPCDialogue("Pés leves como o vento da colina!");
    } else if (action === "potion" && this.player.coins >= pPotion && this.player.potions < 4) {
      this.player.coins -= pPotion;
      this.player.potions++;
      this.ui.showToast("Poção guardada no alforje.");
      this._showNPCDialogue("Uma poção a mais no alforje. Volte quando precisar.");
    } else if (action === "candle") {
      if (this.candle?.buy(pCandle)) this._showNPCDialogue("Uma boa vela para as noites sem lua.");
    } else if (action === "bread" && this.player.coins >= pBread && this.player.health < this.player.maxHealth) {
      this.player.coins -= pBread;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
      this.ui.showToast("Pão comprado: +1 vitalidade.");
      this._showNPCDialogue("Feito hoje cedo. Vai recuperar suas forças.");
    } else if (action === "hay" && this.player.coins >= pHay && PlayerInventory.hay < 20) {
      this.player.coins -= pHay;
      PlayerInventory.gold = this.player.coins;
      PlayerInventory.hay = Math.min(20, PlayerInventory.hay + 2);
      PlayerStats.hay = PlayerInventory.hay;
      this.ui.showToast(`Feno guardado (${PlayerInventory.hay}/20) · use G para atrair cavalos`);
      this._showNPCDialogue("Basta largar no chão com G: qualquer cavalo num raio de 30m vem comer mansinho.");
    } else if (action === "bolts") {
      this._buyAmmo("bolts", 4, pBolts, "Virotes adicionados ao alforje.");
    } else if (action === "arrows") {
      this._buyAmmo("arrows", 6, pArrows, "Flechas adicionadas ao alforje.");
    } else if (action === "bombs") {
      this._buyAmmo("bombs", 2, pBombs, "Bombas de mão adicionadas ao alforje.");
    } else if (action === "knives") {
      this._buyAmmo("knives", 5, pKnives, "Facas de arremesso adicionadas ao alforje.");
    } else if (action === "oil") {
      this._buyAmmo("oil", 2, pOil, "Potes de óleo adicionadas ao alforje.");
    } else if (action.startsWith("buy:")) {
      const parts = action.split(":");
      const id = parts[1];
      const cost = Number(parts[2]);
      if (this.weapons.purchase(id, cost)) this._showNPCDialogue("Boa escolha. Aço que não falha.");
    }
    PlayerStats.gold = this.player.coins;
    syncPlayerStatsToPlayer(this.player, this.ui);
    this.ui.setRPGStats?.(PlayerStats, PlayerEquipment);
  }

  _buyAmmo(type, amount, cost, message) {
    if (this.player.coins < cost || !this.weapons.buyAmmo(type, amount)) return;
    this.player.coins -= cost;
    this.ui.showToast(message);
    this._showNPCDialogue("Mercadoria entregue. Boa sorte na estrada.");
  }

  _close() {
    this.activeNPC = null;
    this.input.setModalOpen(false);
  }
}
