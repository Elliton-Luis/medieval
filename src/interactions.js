import { hayPrompt } from "./hay.js";
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
import { NpcLife } from "./npcLife.js";
import { checkAltarInteraction, investigateCultCamp, CULT_LEADER_PORTRAIT } from "./cult.js";
import {
  checkDemiurgeDiaryNearby,
  interactWithDemiurgeDiary,
  getDemiurgeDiaryHint,
  openDemiurgeDiaryReader,
  closeDemiurgeDiaryReader,
  isDemiurgeDiaryReaderOpen,
} from "./demiurgeBook.js";
import { checkCrystalNearby, collectCrystalNode, applyTorchColor, CRYSTAL_PALETTE } from "./crystals.js";
import {
  checkGhostTownRubbleNearby,
  searchGhostTownRubble,
  checkGhostTownHouseNearby,
  lootGhostTownHouse,
} from "./ghostTowns.js";
import { WorldDecay } from "./decay.js";

const CULTIST_RUMORS = [
  "«Ouvi dizer de uma seita que destruiu algumas cidades proximas, eles deixaram alguns itens escondidos dentros das casas, talvez eu vá dar uma olhada...»",
  "«Eu vi fumaça negra além das árvores... deve ser apenas um raio.»",
  "«O padre diz que máscaras de pássaro são contos para assustar crianças.»",
  "«Se os Cátaros quisessem nosso fim, por que não invadem os portões? É tudo invenção.»",
  "«Dizem que eles adoram o Demiurgo e não temem a morte... que Deus nos guarde fora dos muros.»",
  "«Cavalos selvagens nos ermos sentem teu cheiro a léguas. Se segurares um fardo de feno [G], eles se aproximam mansos e deixam montar [E].»",
  "«No Modo Construção [C], aperte [E] com uma tocha ou vela em mãos para cravá-la na parede ou no solo. Ela queimará dia e noite para guiar teus passos.»",
  "«Se a guarda decretar tua cabeça a prêmio, fuja para a paróquia: a absolvição do Padre Anselmo no confessionário anula qualquer nível de Procurado.»",
  "«Contra guerreiros protegidos por escudos pesados, mantenha o golpe premido: o ataque carregado despedaça a postura de guarda e lança o inimigo ao chão.»",
  "«Pelos ermos brotam prismas brilhantes de cristais. Se colheres um [E], tua tocha absorve aquela cor na hora e fende a escuridão.»",
];

export const OBSCURE_TUTORIAL_HINTS = [
  "«Ouvi dizer de uma seita que destruiu algumas cidades proximas, eles deixaram alguns itens escondidos dentros das casas, talvez eu vá dar uma olhada... Olhe para o céu à noite: halos de névoa arroxeada marcam onde essas ruínas jazem.»",
  "«Cavalos selvagens nos ermos têm pavor de gente correndo. Segure um fardo de feno [G] na mão e caminhe devagar. O bicho sente o faro da cevada e te deixará montar [E] sem disparar em fuga.»",
  "«A noite é um breu assassino e o vento apaga tua vela se correr. Mas se entrares no Modo Construção [C] empunhando uma tocha ou vela e apertares [E], podes fincá-la na parede ou no chão! Ela nunca mais se apaga e cria faróis pelo caminho.»",
  "«Se cometeres deslizes e os guardas caçarem tua cabeça, corre para a Igreja de Caldera. Ajoelhar-se no confessionário com o Padre Anselmo zera o status de Procurado e ainda te concede +2 Carisma perante o povo.»",
  "«Contra guardas de escudo ou bestas blindadas, golpes rápidos batem na lata. Segure o ataque com martelo, machado ou maça até o fim: o golpe pesado carrega e quebra a defesa de qualquer inimigo, atordoando-o.»",
  "«Os cristais brilhantes nos ermos guardam essências antigas. Quando recolhes um prisma colorido no solo [E], tua tocha absorve a cor dele na hora (azul, verde, rosa, vermelho, roxo), iluminando a noite com propriedades místicas.»",
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
    // perguntas prontas do menu de conversa: a resposta vem do motor de diálogo/diário (npcLife.js)
    this.ui.onChatAsk = (id) => {
      const npc = this.activeNPC;
      if (!npc || !npc.alive) return;
      const res = NpcLife.ask(npc, id);
      this.ui.chatReply(res, id === "bye");
    };
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
      } else if (PlayerInventory.hasDemiurgeDiary || (Array.isArray(PlayerInventory.discoveredBookPages) && PlayerInventory.discoveredBookPages.length > 0)) {
        if (document.pointerLockElement) document.exitPointerLock();
        openDemiurgeDiaryReader(0, this.audio);
      } else {
        this.ui.showToast(`✦ Não possuis o Diário dos Demiurgos nem qualquer folha avulsa... Dica: ${getDemiurgeDiaryHint()}`);
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
        !this._tryInteractDemiurgeDiary() &&
        !this.farming?.interact(this.player, this.ui, this.audio, this.effects) &&
        !this._tryGatherHayBale() &&
        !this._tryCollectCrystal() &&
        !this._tryInteractAltar() &&
        !this._trySearchGhostTown() &&
        !this._tryInteractBell()
      ) {
        this._interactNearby();
      }
    }
    const diaryPrompted = this._checkDemiurgeDiaryNearby();
    if (!diaryPrompted) {
      const cropPrompted = this.farming?.checkPrompt(this.player.x, this.player.z, this.ui) || hayPrompt(this.player, this.ui, this.weapons?.currentId);
      if (!cropPrompted) {
        this._checkAltarNearby();
        this._checkCrystalNearby();
        this._checkGhostTownNearby();
        this._checkBellNearby();
      }
    }
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
      return true;
    }
    return false;
  }

  _tryInteractDemiurgeDiary() {
    return interactWithDemiurgeDiary(this.player.root.position, this.ui, this.audio, this.input);
  }

  _checkGhostTownNearby() {
    // 1. Checa se está no interior de uma casa abandonada com baú de despojos
    const house = checkGhostTownHouseNearby(this.player.root.position);
    if (house && this.ui.dialoguePanel.hidden) {
      this.ui.setPrompt?.(
        house.hasPage
          ? (house.hasBloodEye ? "✦ OLHO DE SANGUE · [E] pegar página" : "✦ [E] · pegar página")
          : "✦ CASA ARRUINADA [E] Saquear Baú & Despojos",
      );
      return;
    }

    // 2. Checa se está na praça central das ruínas
    const town = checkGhostTownRubbleNearby(this.player.root.position);
    if (town && this.ui.dialoguePanel.hidden) {
      this.ui.setPrompt?.(`✦ ${town.name.toUpperCase()} [E] Vasculhar Escombros & Códices`);
    }
  }

  _trySearchGhostTown() {
    const house = checkGhostTownHouseNearby(this.player.root.position);
    if (house) {
      return lootGhostTownHouse(house, this.ui, this.audio, this.weapons);
    }
    const town = checkGhostTownRubbleNearby(this.player.root.position);
    if (town) {
      return searchGhostTownRubble(town, this.ui, this.audio);
    }
    return false;
  }

  _checkBellNearby() {
    const bells = this.villageGenerator?.bells || window.__game?.villageGenerator?.bells;
    if (!bells || bells.length === 0) return;
    const px = this.player.x;
    const pz = this.player.z;
    for (let i = 0; i < bells.length; i++) {
      const bell = bells[i];
      const dx = bell.x - px;
      const dz = bell.z - pz;
      if (dx * dx + dz * dz < 4.2 * 4.2) {
        if (bell.state === "fallen") {
          this.ui.setPrompt?.("✦ SINO CAÍDO DA IGREJA [E] Reerguer Sino (2 Madeiras + 2 Pedras)");
        } else {
          this.ui.setPrompt?.("✦ SINO DA IGREJA [E] Badalar Sino Sagrado (-2% Corrupção)");
        }
        return;
      }
    }
  }

  _tryInteractBell() {
    const bells = this.villageGenerator?.bells || window.__game?.villageGenerator?.bells;
    if (!bells || bells.length === 0) return false;
    const px = this.player.x;
    const pz = this.player.z;
    for (let i = 0; i < bells.length; i++) {
      const bell = bells[i];
      const dx = bell.x - px;
      const dz = bell.z - pz;
      if (dx * dx + dz * dz < 4.2 * 4.2) {
        if (bell.state === "fallen") {
          return bell.repair();
        } else {
          bell.ring();
          return true;
        }
      }
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
    this._chatSession = (this._chatSession || 0) + 1;
    this._chatFresh = true;
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

  // Metadados do menu pessoal (retrato de rosto, humor, confiança, perguntas). Hostis/cultistas mantêm o menu antigo.
  _chatMeta(npc, message = "") {
    if (!npc || npc.isBandit || !["guard", "smith", "merchant", "farmer", "villager", "priest", "beggar"].includes(npc.roleKey)) return null;
    const key = `${npc.name}#${this._chatSession || 0}`;
    if (this._chatFresh) {
      this._chatFresh = false;
      return { ...NpcLife.chatMeta(npc), key };
    }
    const st = NpcLife.status(npc);
    return { ...st, key, say: message || "" };
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

    let eclipseHeader = "";
    if (WorldDecay && WorldDecay.isEclipse) {
      const quotes = [
        "O maligno que habita nesse mundo decidiu nos mostrar a sua face, cuidado jovem, coisas ruins acontecerão.",
        "O sol sangrou e o dia virou trevas... O maligno que habita nesse mundo decidiu nos mostrar a sua face! Cuidado jovem, coisas ruins acontecerão.",
        "Cuidado jovem, coisas ruins acontecerão. O maligno decidiu nos mostrar sua face sob este manto escarlate.",
        "Os sinos dobram sozinhos e as feras uivam apavoradas... O maligno que habita nesse mundo decidiu nos mostrar sua face neste eclipse!",
      ];
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      eclipseHeader = `🌑 « ${q} »\n\n`;
    }

    let body = `${eclipseHeader}${npc.task}.${chaNote}`;
    let actions = [{ id: "close", label: "Encerrar conversa" }];

    if (npc.sick) {
      body =
        message ||
        "« Coff... coff... A peste negra queima minhas entranhas e o ar me falta... Por piedade, viajante, tens uma poção de cura para salvar minha vida? »";
      actions = [
        {
          id: "cure_plague",
          label: `💊 Entregar Poção e Curar a Peste Negra (-1 Poção · tens ${this.player.potions})`,
          disabled: this.player.potions <= 0,
        },
        { id: "close", label: "Afastar-se do enfermo" },
      ];
      this.ui.showDialogue(npc.name, body, actions, {
        role: "Enfermo da Peste",
        roleKey: npc.roleKey,
        chat: this._chatMeta(npc, message),
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
        chat: this._chatMeta(npc, message),
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
        {
          id: "charity:smith",
          label: "🪙 Caridade: Auxiliar os aprendizes e a forja de Caldera (-5 moedas · +1 CAR)",
          disabled: this.player.coins < 5,
        },
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
          id: "charity:merchant",
          label: "🪙 Caridade: Doar ao fundo de socorro aos peregrinos pobres (-5 moedas · +1 CAR)",
          disabled: this.player.coins < 5,
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
        { id: "rumor:secrets", label: "✦ Segredos dos Viajantes: Mecânicas e boatos dos ermos" },
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
          id: "charity:farmer",
          label: "🪙 Caridade: Auxílio solidário às famílias camponesas (-5 moedas · +1 CAR)",
          disabled: this.player.coins < 5,
        },
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
          label: "Confissão e Absolvição dos Pecados (1× por dia · Reduz 10% da Maldade, Zera Procurado e +2 CAR)",
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
          id: "charity:guard",
          label: "🪙 Caridade: Doar para o auxílio a veteranos da vigília (-5 moedas · +1 CAR)",
          disabled: this.player.coins < 5,
        },
        {
          id: "mission:bounty",
          label: "✦ Missão: Caça ao Bandido nas terras ermas (+65 moedas, +2 CAR)",
        },
        ...(MissionState.activeId
          ? [{ id: "mission:cancel", label: `✕ Cancelar missão ativa (${MissionState.title})` }]
          : []),
        { id: "close", label: "Encerrar conversa" },
      ];
    } else if (npc.roleKey === "cult_leader") {
      const hasBook = Boolean(PlayerInventory.hasDemiurgeDiary);
      body = message || (hasBook
        ? "«Morvath curva a cabeça com reverência sombria, sua máscara de porcelana e chifres de ébano reluzindo à luz púrpura: 'Vejo que carregas o Tractatus de Carcere... Sentes a podridão da matéria pulsando em tuas veias, caminhante? O Arquiteto Cego tece o barro para nos escravizar. Mas tua centelha ainda pode retornar ao Pleroma.'»"
        : "«Morvath ergue o cajado de ametista e fala com voz grave e hipnótica: 'Caminhante cego... a igreja te ensina a amar tua masmorra. A matéria é um tumor cósmico forjado por Rex Mundi. Vem, escuta as escrituras da Endura antes que o véu rasgue.'»");
      actions = [
        {
          id: "cult_leader:about_book",
          label: hasBook ? "✦ Indagar sobre a Criação no Tractatus de Carcere" : "✦ Receber o Tractatus de Carcere (O Livro do Barro)",
        },
        {
          id: "cult_leader:endura",
          label: "✦ Compreender a Endura: A recusa do barro e o jejum",
        },
        {
          id: "cult_leader:sacraments",
          label: "✦ Os Sacramentos da Ruína: O fogo e o Observador dos Seis Olhos",
        },
        {
          id: "cult_leader:blessing",
          label: "✦ Aceitar a Bênção de Morvath (Manto Cerimonial, Fragmento & +2 CAR)",
        },
        {
          id: "cult_leader:challenge",
          label: "⚔️ Desafiar o Grão-Mestre: 'Tua seita é uma abominação herética!'",
        },
        {
          id: "charity:cult_leader",
          label: "🪙 Caridade: Fazer oferta de moedas a Morvath (-5 moedas)",
          disabled: this.player.coins < 5,
        },
        { id: "close", label: "Retirar-se em silêncio nas sombras" },
      ];
    } else if (npc.name === "Vasco Corvino" || npc.title === "Andarilho") {
      body =
        message ||
        "«Vasco ajeita o capuz de couro, olha de esguelha e sussurra: 'Ouvi dizer de uma seita que destruiu algumas cidades proximas, eles deixaram alguns itens escondidos dentros das casas, talvez eu vá dar uma olhada...'»";
      actions = [
        {
          id: "charity:vasco",
          label: "🪙 Caridade: Oferecer moedas de ajuda a Vasco (-5 moedas)",
          disabled: this.player.coins < 5,
        },
        {
          id: "tutorial:ghost_towns",
          label: "✦ Segredo das Ruínas: 'O que há escondido nas casas destruídas?'",
        },
        {
          id: "tutorial:tame_horses",
          label: "✦ Domar Montaria: Como aproximar de cavalos selvagens com Feno [G]",
        },
        {
          id: "tutorial:torch_placing",
          label: "✦ Fincar Tochas [C + E]: Como iluminar caminhos no breu eterno",
        },
        {
          id: "tutorial:church_absolution",
          label: "✦ Limpar Crimes: O segredo da Confissão na Igreja com o Padre",
        },
        {
          id: "tutorial:charged_attack",
          label: "✦ Combate Pesado: Como romper defesas e escudos com ataque carregado",
        },
        {
          id: "tutorial:crystal_torches",
          label: "✦ Cristais do Solo: As chamas coloridas da tocha nos ermos",
        },
        {
          id: "mission:horse_theft",
          label: "✦ Missão: Roubo de Montaria Puro-Sangue (+60 moedas, +1 CAR)",
        },
        {
          id: "rumor:cult",
          label: "Ouvir boatos sobre as sombras além dos muros",
        },
        ...(MissionState.activeId
          ? [{ id: "mission:cancel", label: `✕ Cancelar missão ativa (${MissionState.title})` }]
          : []),
        { id: "close", label: "Encerrar conversa" },
      ];
    } else if (npc.isProud || npc.title === "Nobre" || npc.name === "Lorde Corvino") {
      body =
        message ||
        "«O nobre ajeita sua capa de veludo e olha-te de cima a baixo com altivez: 'O que desejas com a nobreza de Caldera? Nosso tempo é precioso e não deve ser gasto com a plebe.'»";
      actions = [
        {
          id: "charity:noble",
          label: "🪙 Caridade: Oferecer moedas de cortesia ao nobre (-5 moedas)",
          disabled: this.player.coins < 5,
        },
        {
          id: "rumor:secrets",
          label: "✦ Assuntos da Corte: Perguntar sobre as tensões no reino",
        },
        { id: "close", label: "Fazer reverência e afastar-se" },
      ];
    } else {
      // Habitantes Comuns e Aldeões: personalidades variadas, pedidos de ajuda, atos de caridade e missões
      const pCode = Math.abs((npc.name ? npc.name.charCodeAt(0) * 17 + npc.name.length * 3 : 7) % 4);

      if (pCode === 0) {
        // Aldeão necessitado / Família camponesa
        body = message || "«O aldeão aperta o casaco puído e olha para o céu cinzento: 'As noites estão geladas e os animais do curral mal têm o que comer. Qualquer ajuda com feno fresco ou auxílio é uma bênção dos céus.'»";
        actions = [
          {
            id: "charity:hay",
            label: `🌾 Caridade: Doar 3 Fardos de Feno para o rebanho (-3 Feno · +2 CAR) · tens ${PlayerInventory.hay}`,
            disabled: (PlayerInventory.hay || 0) < 3,
          },
          {
            id: "charity:alms",
            label: "🪙 Caridade: Entregar moedas de auxílio solidário (-5 moedas · +1 CAR)",
            disabled: this.player.coins < 5,
          },
          {
            id: "mission:deliver",
            label: "✦ Missão: Entrega Solidária de Mantimentos (+50 moedas, +1 CAR)",
          },
          {
            id: "rumor:morvath",
            label: "🌑 Boato: Ouvir avisos sobre o Grão-Mestre Morvath",
          },
          ...(MissionState.activeId
            ? [{ id: "mission:cancel", label: `✕ Cancelar missão ativa (${MissionState.title})` }]
            : []),
          { id: "close", label: "Encerrar conversa" },
        ];
      } else if (pCode === 1) {
        // Moradora com frio / Necessidade de lenha e reparos
        body = message || "«A aldeã treme junto à porta: 'A lenha da lareira acabou. A névoa da floresta parece sugar o calor das nossas casas... Se alguém tiver madeira seca para doar, salvará nossa noite.'»";
        actions = [
          {
            id: "charity:alms",
            label: "🪙 Caridade: Doar moedas para a lenha e o aquecimento da casa (-5 moedas · +1 CAR)",
            disabled: this.player.coins < 5,
          },
          {
            id: "charity:wood",
            label: `🪵 Caridade: Doar 4 Madeiras secas para a lareira (-4 Madeira · +2 CAR) · tens ${PlayerInventory.wood}`,
            disabled: (PlayerInventory.wood || 0) < 4,
          },
          {
            id: "charity:stone",
            label: `🪨 Caridade: Doar 4 Pedras para calafetar o abrigo (-4 Pedra · +2 CAR) · tens ${PlayerInventory.stone}`,
            disabled: (PlayerInventory.stone || 0) < 4,
          },
          {
            id: "mission:debt",
            label: "✦ Missão: Cobrança de Devedor da Vila (+55 moedas, +1 CAR)",
          },
          {
            id: "rumor:beasts",
            label: "👁️ Boato: Relatos sobre os Gulurs de olhos amarelos nos ermos",
          },
          ...(MissionState.activeId
            ? [{ id: "mission:cancel", label: `✕ Cancelar missão ativa (${MissionState.title})` }]
            : []),
          { id: "close", label: "Encerrar conversa" },
        ];
      } else if (pCode === 2) {
        // Viajante ou morador ferido
        body = message || "«O morador se apoia na mureta, gemendo de dor: 'Fui cercado por aquelas feras na estrada além dos muros... Meu braço sangra. Uma poção de cura me colocaria de pé novamente.'»";
        actions = [
          {
            id: "charity:potion",
            label: `🧪 Caridade Suprema: Entregar Poção de Cura (-1 Poção · +3 CAR) · tens ${this.player.potions || 0}`,
            disabled: (this.player.potions || 0) < 1,
          },
          {
            id: "charity:alms",
            label: "🪙 Caridade: Doar moedas para comprar remédios (-5 moedas · +1 CAR)",
            disabled: this.player.coins < 5,
          },
          {
            id: "mission:bounty",
            label: "⚔️ Missão: Caça ao Bandido nas terras ermas (+65 moedas, +2 CAR)",
          },
          {
            id: "rumor:cult",
            label: "Ouvir boatos sobre as sombras e a seita além dos muros",
          },
          ...(MissionState.activeId
            ? [{ id: "mission:cancel", label: `✕ Cancelar missão ativa (${MissionState.title})` }]
            : []),
          { id: "close", label: "Encerrar conversa" },
        ];
      } else {
        // Contrabandista / Tropeiro experiente
        body = message || "«O homem ajeita o capuz e fala em tom discreto: 'Tenho compradores para cavalos de raça e tarefas especiais para quem tiver coragem nos ermos.'»";
        actions = [
          {
            id: "mission:horse_theft",
            label: "✦ Missão Clandestina: Roubo de Montaria Puro-Sangue (+60 moedas, +1 CAR)",
          },
          {
            id: "charity:alms",
            label: "🪙 Caridade: Dar uma moeda de ajuda solidária (-5 moedas · +1 CAR)",
            disabled: this.player.coins < 5,
          },
          {
            id: "rumor:secrets",
            label: "✦ Segredos dos Viajantes: Ouvir dicas e boatos dos ermos",
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
    }
    const finalBody = (eclipseHeader && !body.includes(eclipseHeader)) ? (eclipseHeader + body) : body;
    this.ui.showDialogue(npc.name, finalBody, actions, {
      role: npc.title || "Habitante de Caldera",
      roleKey: npc.roleKey,
      chat: this._chatMeta(npc, message),
      customPortrait: npc.portrait || (npc.roleKey === "cult_leader" ? CULT_LEADER_PORTRAIT : null),
      eyebrow: (WorldDecay && WorldDecay.isEclipse)
        ? "🌑 DIA DE ECLIPSE · O MALIGNO MOSTRA SUA FACE"
        : (npc.roleKey === "cult_leader" ? "GRANDE BASTIÃO DE REX MUNDI · DIÁLOGO HERÉTICO" : "CALDERA · CONVERSA & COMÉRCIO"),
      funds: {
        coins: this.player.coins,
        wood: PlayerInventory.wood,
        stone: PlayerInventory.stone,
        clay: PlayerInventory.clay || 0,
        hay: PlayerInventory.hay,
      },
    });
  }

  _triggerCharityFeedback(npc, successToast, dialogueText) {
    if (this.audio?.charity) {
      this.audio.charity();
    } else {
      this.audio?.coin?.();
    }

    if (this.effects && npc?.root) {
      const pos = npc.root.position;
      // Coração radiante subindo acima da cabeça do NPC
      this.effects.play("heart", pos.x, pos.y + 1.8, pos.z, "#ff3366", 1.3);
      // Estrelas e centelhas douradas de bênção
      this.effects.play("glint", pos.x + 0.25, pos.y + 1.4, pos.z + 0.15, "#ffd700", 2.0);
      this.effects.play("star", pos.x - 0.25, pos.y + 1.6, pos.z - 0.15, "#ffe266", 2.2);
    } else if (this.effects && this.player?.root) {
      const pos = this.player.root.position;
      this.effects.play("heart", pos.x, pos.y + 1.8, pos.z, "#ff3366", 1.3);
      this.effects.play("glint", pos.x, pos.y + 1.4, pos.z, "#ffd700", 2.0);
    }

    NpcLife.onPlayerHelped();
    this.ui.showToast(successToast);
    if (dialogueText) {
      this._showNPCDialogue(dialogueText);
    }
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
    if (action === "charity:hay") {
      if ((PlayerInventory.hay || 0) >= 3) {
        PlayerInventory.hay -= 3;
        PlayerStats.hay = PlayerInventory.hay;
        PlayerStats.cha += 2;
        syncPlayerStatsToPlayer();
        addGood(4, "Doou feno fresco para uma família camponesa");
        this._triggerCharityFeedback(
          this.activeNPC,
          "✦ Caridade Feita! -3 Fenos · +2 Carisma. A família agradece comovida!",
          "«O aldeão segura o fardo de feno com olhos marejados: 'Que os santos te abençoem, viajante! Nosso gado agora terá alimento e passará a noite aquecido.'»"
        );
      } else {
        this.audio?.block?.();
        this.ui.showToast("⚠️ Feno insuficiente! Você precisa de 3 feixes de feno.");
      }
      return;
    }
    if (action === "charity:wood") {
      if ((PlayerInventory.wood || 0) >= 4) {
        PlayerInventory.wood -= 4;
        PlayerStats.cha += 2;
        syncPlayerStatsToPlayer();
        addGood(4, "Doou lenha seca para a lareira de uma aldeã");
        this._triggerCharityFeedback(
          this.activeNPC,
          "✦ Caridade Feita! -4 Madeiras · +2 Carisma. A lareira estala com calor!",
          "«A aldeã abre um sorriso aliviado: 'Muito obrigada, alma generosa! Minha família e minhas crianças estarão protegidas do frio cortante da noite.'»"
        );
      } else {
        this.audio?.block?.();
        this.ui.showToast("⚠️ Madeira insuficiente! Você precisa de 4 unidades de madeira.");
      }
      return;
    }
    if (action === "charity:stone") {
      if ((PlayerInventory.stone || 0) >= 4) {
        PlayerInventory.stone -= 4;
        PlayerStats.cha += 2;
        syncPlayerStatsToPlayer();
        addGood(4, "Doou pedras para consertar abrigo desabado");
        this._triggerCharityFeedback(
          this.activeNPC,
          "✦ Caridade Feita! -4 Pedras · +2 Carisma. A estrutura foi reforçada!",
          "«'Com essas pedras firmes podemos tapar os buracos da parede antes que os lobos da névoa entrem. Deus te guarde pelos teus caminhos!'»"
        );
      } else {
        this.audio?.block?.();
        this.ui.showToast("⚠️ Pedras insuficientes! Você precisa de 4 pedras.");
      }
      return;
    }
    if (action === "charity:potion") {
      if ((this.player.potions || 0) >= 1) {
        this.player.potions -= 1;
        PlayerStats.cha += 3;
        syncPlayerStatsToPlayer();
        addGood(6, "Salvou um aldeão gravemente ferido com poção de cura");
        this._triggerCharityFeedback(
          this.activeNPC,
          "✦ Gesto Sagrado de Caridade! -1 Poção · +3 Carisma. O ferido foi restaurado!",
          "«O aldeão bebe a poção e seu semblante recupera a vitalidade imediatamente: 'É um verdadeiro milagre! A dor do veneno cessou por completo. Caldera nunca esquecerá tua nobreza!'»"
        );
      } else {
        this.audio?.block?.();
        this.ui.showToast("⚠️ Poções insuficientes! Você não possui frascos de poção.");
      }
      return;
    }
    if (action.startsWith("charity:")) {
      const isProudNoble = Boolean(
        this.activeNPC?.isProud ||
        this.activeNPC?.title === "Nobre" ||
        this.activeNPC?.name === "Lorde Corvino" ||
        action === "charity:noble"
      );
      const isCultLeader = Boolean(this.activeNPC?.roleKey === "cult_leader" || action === "charity:cult_leader");
      const isVasco = Boolean(this.activeNPC?.name === "Vasco Corvino" || action === "charity:vasco");

      if (isProudNoble) {
        this.audio?.block?.();
        this.ui.showToast("⚠️ Doação rejeitada com desdém! O nobre sentiu-se ultrajado pela oferta.");
        this._showNPCDialogue("«O nobre afasta tua mão com desdém enojado: 'Por quem me tomas, plebeu impertinente?! Não aceito tuas moedas imundas! Guarda tua caridade barata para a gentalha!'»");
        return;
      }

      if (isCultLeader) {
        this.audio?.block?.();
        this.ui.showToast("⚠️ Doação rejeitada! O Grão-Mestre abomina as moedas da matéria.");
        this._showNPCDialogue("«Morvath recua com desprezo absoluto e empurra tuas moedas: 'Ouro? Metal moldado no lodo da matéria pelo Arquiteto Cego? Guarda tua poeira perecível, cego! O Pleroma não negocia com o esterco do mundo!'»");
        return;
      }

      if (isVasco) {
        this.audio?.block?.();
        this.ui.showToast("⚠️ Vasco recusa a esmola com um sorriso cínico.");
        this._showNPCDialogue("«Vasco ajeita a adaga no cinto e dá uma risada debochada: 'Esmola para mim? Guarda isso no bolso antes que eu me ofenda de verdade, viajante. Eu tomo o que preciso na estrada; não vivo da piedade de ninguém.'»");
        return;
      }

      const cost = action === "charity:alms_generous" ? 8 : 5;
      if (this.player.coins >= cost) {
        this.player.coins -= cost;
        PlayerStats.gold = this.player.coins;
        PlayerInventory.gold = this.player.coins;
        PlayerStats.cha += (cost >= 8 ? 2 : 1);
        syncPlayerStatsToPlayer();
        addGood(3, "Ato nobre de caridade e auxílio solidário");

        let reply = "«'Tua esmola nobre traz alívio a quem nada tem. Que tua jornada seja próspera e tua lâmina fiel!'»";
        if (action === "charity:smith") {
          reply = "«O ferreiro limpa a fuligem da testa e sorri comovido: 'Que os céus te abençoem, viajante! Essa ajuda garantirá pão e carvão para os jovens aprendizes da forja. O bom aço nunca te faltará!'»";
        } else if (action === "charity:merchant") {
          reply = "«O mercador agradece com sincera reverência: 'Tua generosidade socorrerá peregrinos e viajantes sem teto que chegam com frio a Caldera. A estima dos justos te acompanhará!'»";
        } else if (action === "charity:farmer") {
          reply = "«O fazendeiro aperta tuas mãos calejadas: 'Deus te pague, viajante! Esse auxílio comprará grãos e protegerá as famílias do campo do inverno. A terra florescerá!'»";
        } else if (action === "charity:guard") {
          reply = "«O guarda bate o punho no peito em saudação militar solene: 'Em nome dos veteranos e das famílias dos caídos na patrulha além dos muros, a guarda de Caldera honra tua nobreza!'»";
        }

        this._triggerCharityFeedback(
          this.activeNPC,
          `✦ Caridade Feita com Sucesso! -${cost} Moedas · +${cost >= 8 ? 2 : 1} Carisma perante o povo.`,
          reply
        );
      } else {
        this.audio?.block?.();
        this.ui.showToast(`⚠️ Moedas insuficientes! Você precisa de ${cost} moedas para doar.`);
      }
      return;
    }
    if (action === "rumor:morvath") {
      this._showNPCDialogue("«O aldeão sussurra arrepiado: 'O Grão-Mestre Morvath é o líder supremo da Ordem de Rex Mundi. Ele anda visitando as vilas do reino à noite, realizando sermões proibidos para invocar o Demiurgo. Se um bravo guerreiro encontrá-lo nas estradas e conseguir abatê-lo, quebrará o ritual e salvará o mundo da chegada do Demiurgo!'»");
      return;
    }
    if (action === "rumor:beasts") {
      this._showNPCDialogue("«'Cuidado ao caminhar nos descampados longe das tochas! Há gigantes de pescoço comprido e pernas monumentais chamados Gulurs que te encaram com olhos amarelos brilhantes. E à noite, os observadores de seis olhos espreitam na escuridão. Fique sempre perto de fogueiras ou armado!'»");
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
    if (action === "rumor:secrets") {
      const hint = OBSCURE_TUTORIAL_HINTS[Math.floor(Math.random() * OBSCURE_TUTORIAL_HINTS.length)];
      this._showNPCDialogue(hint);
      return;
    }
    if (action === "tutorial:ghost_towns") {
      this._showNPCDialogue(
        "«Vasco aponta para a névoa escura além dos muros: 'A oeste e ao sul há vilarejos destruídos pela seita da máscara de porcelana. À noite, uma névoa espectral azulada paira sobre eles e pode ser vista à distância no breu. Não temas entrar nos casebres em ruínas: os cultistas deixaram baús com ouro, poções e relíquias raras nos cantos escuros das salas que ninguém teve coragem de saquear.'»"
      );
      return;
    }
    if (action === "tutorial:tame_horses") {
      this._showNPCDialogue(
        "«Vasco sorri e revela o truque dos tropeiros: 'Cavalos selvagens nos ermos têm medo de humanos correndo. Se fores atrás deles em desespero, eles fogem até o fim do mundo. O segredo é ter um fardo de feno no alforje. Segure o feno com [G] e ande calmamente até o focinho dele. O bicho sentirá o aroma doce e aceitará tua montaria [E] sem disparar em fuga.'»"
      );
      return;
    }
    if (action === "tutorial:torch_placing") {
      this._showNPCDialogue(
        "«Vasco mostra uma tocha gasta: 'O breu da noite mata mais do que lâminas, e o vento forte apaga tua vela se correres. Mas eis o segredo: entre no Modo Construção [C] segurando uma tocha ou vela e pressione [E]. Tu cravarás a tocha na parede de uma casa ou na terra do ermo! Ela queima eternamente e cria faróis seguros pelo caminho.'»"
      );
      return;
    }
    if (action === "tutorial:church_absolution") {
      this._showNPCDialogue(
        "«Vasco pisca um olho com cumplicidade: 'Se a guarda da capital estiver te caçando por abater animais, arranjar brigas ou furtar, não adianta tentar matar os soldados. Corre para dentro da Igreja de Caldera e fala com o Padre Anselmo. A bênção do confessionário purifica tua culpa: zera o nível de Procurado na hora e ainda te rende +2 de Carisma perante o povo.'»"
      );
      return;
    }
    if (action === "tutorial:charged_attack") {
      this._showNPCDialogue(
        "«'Quando enfrentares um guarda de escudo ou fera blindada, ficar dando toques rápidos só fará tua lâmina resvalar. Com machado, martelo ou maça, segure o ataque com força. Vais sentir o peso acumular: quando desferir o golpe carregado, a postura do guarda quebra e ele tomba no chão indefeso!'»"
      );
      return;
    }
    if (action === "tutorial:crystal_torches") {
      this._showNPCDialogue(
        "«'Pelos descampados brotam prismas brilhantes de cristais antigos. Se colheres um [E], tua tocha absorve aquela cor na hora: azul celeste, verde floresta, carmesim, rosa ou roxo místico. Cada prisma altera o brilho da tua tocha e como a escuridão dos lobos reage a você.'»"
      );
      return;
    }
    if (action.startsWith("cult_leader:")) {
      const sub = action.split(":")[1];
      if (sub === "about_book") {
        if (!PlayerInventory.hasDemiurgeDiary) {
          PlayerInventory.hasDemiurgeDiary = true;
          this.ui.showToast("✦ Recebeste o Tractatus de Carcere das mãos de Morvath! Pressione [L] para ler.");
          if (this.audio?.bookPage) this.audio.bookPage();
        }
        this._showNPCDialogue(
          "«Morvath declama em tom litúrgico e hipnótico: 'No princípio, não havia a Terra, mas o Pleroma — o abismo de pura luz silenciosa e imóvel. O desastre começou quando Rex Mundi, o Arquiteto Cego, tentou espelhar a glória do Todo e pariu a matéria como um tumor no vazio perfeito. O Éden não foi paraíso, mas matadouro; a serpente sussurrou a verdade. Comer, respirar e procriar são as engrenagens da máquina de moer almas do Demiurgo. Nascer é o verdadeiro pecado original.'»"
        );
        return;
      }
      if (sub === "endura") {
        this._showNPCDialogue(
          "«Morvath aponta para sua máscara de porcelana e diz: 'A Endura é a recusa solene da carne. Jejuamos doze dias ingerindo cinzas e água pura para que o estômago lembre que a terra é estéril. A máscara com filtro de carvão não serve para pestes comuns, mas para barrar o fedor da criação. Olhamos através do vidro fumê para não sermos seduzidos pelo falso sol e pela beleza mundana. O fiel deve ver apenas a decadência para alcançar a libertação.'»"
        );
        return;
      }
      if (sub === "sacraments") {
        this._showNPCDialogue(
          "«Morvath reluz os olhos avermelhados na névoa: 'Nossos sacramentos buscam agredir o Arquiteto Cego. No Rito da Madeira Órfã, incendiamos árvores vivas com enxofre para devolver ao Pleroma a centelha aprisionada na celulose. Na Liturgia dos Seis Olhos, invocamos o Observador que enlouqueceu ao ver a farsa cósmica — quem acolhe o abismo ganha a força das tempestades. E com lâminas quebradas e enferrujadas, espalhamos a desintegração do mundo material.'»"
        );
        return;
      }
      if (sub === "blessing") {
        PlayerStats.cha = Math.min(20, (PlayerStats.cha || 10) + 2);
        this.player.health = this.player.maxHealth;
        syncPlayerStatsToPlayer(this.player, this.ui);

        import("./rpg.js").then(({ unlockDemiurgeAttire }) => {
          unlockDemiurgeAttire(this.player, this.ui, this.audio);
        }).catch(() => {});

        const missing = [7, 11, 16, 19, 21].filter((p) => !PlayerInventory.discoveredBookPages.includes(p));
        if (missing.length > 0) {
          const gained = missing[0];
          PlayerInventory.discoveredBookPages.push(gained);
          const pageTitle = gained === 21 ? "O Sacrifício Final" : `Página ${gained}`;
          this.ui.showToast(`✦ Bênção acolhida! +2 CAR, vida restaurada e ${pageTitle} anexada ao Tractatus!`);
        } else {
          this.ui.showToast("✦ Bênção acolhida! Vida restaurada, Túnica Cerimonial consagrada e +2 Carisma!");
        }

        this._showNPCDialogue(
          "«Morvath toca tua fronte com a ametista do cajado: 'Que a cinza proteja tua centelha. Recebe o Manto Cerimonial do Demiurgo e a comunhão do Vazio primordial. Tua alma começa a se descolar da casca mortal de Rex Mundi.'»"
        );
        return;
      }
      if (sub === "challenge") {
        if (this.activeNPC) {
          this.activeNPC.hostile = true;
        }
        this.ui.closeDialogue();
        this.ui.showToast("⚔️ Desafiaste o Grão-Mestre Morvath! Defende-te da cólera do Vazio!");
        return;
      }
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
    } else if (action === "cure_plague" && this.player.potions > 0 && this.activeNPC?.sick) {
      this.player.potions -= 1;
      this.activeNPC.sick = false;
      NpcLife.onCured(this.activeNPC);
      this.activeNPC.task = "Curado da peste negra!";
      PlayerStats.cha = Math.min(20, PlayerStats.cha + 3);
      addGood(12, "Curou aldeão da peste negra");
      WorldDecay.reduceDecay(0.08, "CURED_PLAGUE_NPC");
      this.audio.coin?.();
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("✦ Curaste o aldeão da peste negra! O mal recua perante tua virtude (-8% Corrupção) · +3 CAR");
      this._showNPCDialogue("« Louvado sejais! O ar voltou aos meus pulmões e a febre cessou! Que Deus vos guarde! »");
      EventBus.emit(GAME_EVENTS.NPC_CURED, { npc: this.activeNPC });
      return;
    } else if (action === "priest:heal") {
      this.player.health = this.player.maxHealth;
      syncPlayerStatsToPlayer(this.player, this.ui);
      this.ui.showToast("Bênção de Cura concedida gratuitamente! Vitalidade totalmente restaurada.");
      this._showNPCDialogue("«Levanta-te e anda em paz». Que a luz sagrada renove tuas forças.");
      return;
    } else if (action === "priest:confess") {
      const res = interactWithPriest(this.player.root.position, this.activeNPC, 0);
      if (res && res.success) {
        this.ui.showToast(`✨ Confissão realizada! Maldade reduzida em 10% (-${res.reduction}%) · Procurado zerado · Carisma +2`);
        this._showNPCDialogue("«Ego te absolvo a peccatis tuis». Seus pecados foram perdoados pela graça. Tua alma recuperou a virtude e o mal em teu íntimo retrocedeu (-10% de Maldade).");
      } else {
        this.ui.showToast("⚠️ Já vos confessastes hoje! O sacramento da penitência deve ser feito uma vez por dia.");
        this._showNPCDialogue("«Já ouvistes a absolvição neste dia, filho meu. Guarda a bênção no coração e pratica a caridade até o romper do próximo dia.»");
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
      this._showNPCDialogue(
        this.houses?.mass?.active
          ? "A celebração eucarística já está em andamento no Altar-Mor!"
          : "Não há fiéis reunidos agora, filho. A Santa Missa só se celebra de dia, com o povo presente na paróquia.",
      );
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
