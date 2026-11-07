import * as THREE from "three";
import { createSeededRandom } from "./procedural.js";
import { igniteTarget, spawnLoot, PlayerInventory, PlayerStats, syncPlayerStatsToPlayer } from "./rpg.js";
import { VILLAGES } from "./kingdom.js";
import { finalizeMonster, makeMergedGeometry, getSmoothDetailMaterial } from "./monsterParts.js";

// ============================================================================
// 1. Materiais e Geometrias Otimizadas do Culto dos Cátaros (Zero-GC)
// ============================================================================
const _robeMat = new THREE.MeshStandardMaterial({
  color: 0x111116,
  roughness: 0.94,
  metalness: 0.08,
  flatShading: true,
});
const _maskMat = new THREE.MeshStandardMaterial({
  color: 0xf2ede4,
  roughness: 0.32,
  metalness: 0.12,
  flatShading: true,
});
const _goldMat = new THREE.MeshStandardMaterial({
  color: 0xc8982a,
  emissive: 0x553805,
  emissiveIntensity: 0.7,
  roughness: 0.35,
  metalness: 0.85,
  flatShading: true,
});
const _crimsonRibbonMat = new THREE.MeshStandardMaterial({
  color: 0x6e0d19,
  roughness: 0.7,
  metalness: 0.2,
  flatShading: true,
});
const _lensMat = new THREE.MeshStandardMaterial({
  color: 0x050508,
  roughness: 0.2,
  metalness: 0.8,
});
const _bladeMat = new THREE.MeshStandardMaterial({
  color: 0x222228,
  roughness: 0.35,
  metalness: 0.8,
});
const _glintMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
});
const _boneMat = new THREE.MeshStandardMaterial({
  color: 0xd8cca8,
  roughness: 0.88,
  flatShading: true,
});
const _altarStoneMat = new THREE.MeshStandardMaterial({
  color: 0x36363c,
  roughness: 0.95,
  flatShading: true,
});
const _purpleFireMat = new THREE.MeshStandardMaterial({
  color: 0x9933cc,
  emissive: 0x7711aa,
  emissiveIntensity: 2.5,
});
const _redTorchMat = new THREE.MeshStandardMaterial({
  color: 0xff2211,
  emissive: 0xff1100,
  emissiveIntensity: 2.8,
});
const _amethystMat = new THREE.MeshStandardMaterial({
  color: 0xaa22ff,
  emissive: 0x9911ee,
  emissiveIntensity: 3.2,
  roughness: 0.15,
  metalness: 0.85,
});

const _WHITE_FLASH = new THREE.Color("#ffffff");
const _RED_FLASH = new THREE.Color("#ff1122");
const _ZERO_FLASH = new THREE.Color("#000000");
const _ebonyHornMat = new THREE.MeshStandardMaterial({
  color: 0x141018,
  roughness: 0.85,
  metalness: 0.25,
  flatShading: true,
});

// Retrato Sombrio em SVG de Alta Definição do Líder da Seita Cátara (Morvath, o Perfeito)
export const CULT_LEADER_PORTRAIT = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="voidGlow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="%23481258" stop-opacity="0.9"/>
      <stop offset="55%" stop-color="%231b0826" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="%2306020a" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23ffd700"/>
      <stop offset="40%" stop-color="%23c8982a"/>
      <stop offset="100%" stop-color="%2368480b"/>
    </linearGradient>
    <linearGradient id="crimsonStole" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%23a81224"/>
      <stop offset="50%" stop-color="%23680a15"/>
      <stop offset="100%" stop-color="%232b0307"/>
    </linearGradient>
    <radialGradient id="eyeFire" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="%23ffffff"/>
      <stop offset="25%" stop-color="%23ff3322"/>
      <stop offset="65%" stop-color="%23bb11ee"/>
      <stop offset="100%" stop-color="%233a0055" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="%23000000" flood-opacity="0.9"/>
    </filter>
  </defs>
  <rect width="128" height="128" fill="url(%23voidGlow)"/>
  <circle cx="64" cy="46" r="38" fill="%23050109" stroke="%23bb22ff" stroke-width="1.2" opacity="0.45"/>
  <circle cx="64" cy="46" r="39.5" fill="none" stroke="%23ff3344" stroke-width="0.75" opacity="0.3"/>
  <path d="M12 128 C18 102 32 94 48 90 L80 90 C96 94 110 102 116 128 Z" fill="%230d0c14" filter="url(%23shadow)"/>
  <path d="M52 90 L48 128 L80 128 L76 90 Z" fill="url(%23crimsonStole)"/>
  <path d="M54 96 L74 96 M52 108 L76 108 M50 120 L78 120" stroke="url(%23goldTrim)" stroke-width="1.4" stroke-linecap="round"/>
  <circle cx="64" cy="94" r="6.5" fill="%230a050f" stroke="url(%23goldTrim)" stroke-width="2"/>
  <circle cx="64" cy="94" r="2.5" fill="%23bb11ee"/>
  <path d="M40 48 Q22 36 18 18 Q26 22 32 36 Q38 45 42 50 Z" fill="%231a151f" stroke="url(%23goldTrim)" stroke-width="1"/>
  <path d="M88 48 Q106 36 110 18 Q102 22 96 36 Q90 45 86 50 Z" fill="%231a151f" stroke="url(%23goldTrim)" stroke-width="1"/>
  <path d="M28 72 Q30 30 64 10 Q98 30 100 72 Q92 84 64 88 Q36 84 28 72 Z" fill="%2314131c" filter="url(%23shadow)"/>
  <path d="M34 68 Q36 36 64 22 Q92 36 94 68 Q84 80 64 84 Q44 80 34 68 Z" fill="%2306050a"/>
  <path d="M42 45 Q64 38 86 45 Q88 64 78 78 L64 92 L50 78 Q40 64 42 45 Z" fill="%23e8e2d5" stroke="%231c1722" stroke-width="1.2" filter="url(%23shadow)"/>
  <path d="M52 74 L64 91 L76 74 Q64 78 52 74 Z" fill="%23cdc4b3"/>
  <path d="M46 47 Q64 42 82 47" fill="none" stroke="url(%23goldTrim)" stroke-width="1.8"/>
  <circle cx="64" cy="44" r="2.4" fill="url(%23goldTrim)"/>
  <path d="M48 50 Q56 46 64 50 Q72 46 80 50" fill="none" stroke="%2378541a" stroke-width="1"/>
  <ellipse cx="52" cy="56" rx="6.5" ry="3.8" fill="%23050108"/>
  <ellipse cx="76" cy="56" rx="6.5" ry="3.8" fill="%23050108"/>
  <circle cx="52" cy="56" r="3.6" fill="url(%23eyeFire)"/>
  <circle cx="76" cy="56" r="3.6" fill="url(%23eyeFire)"/>
  <circle cx="52" cy="56" r="1.2" fill="%23ffffff"/>
  <circle cx="76" cy="56" r="1.2" fill="%23ffffff"/>
  <path d="M72 63 L74 69 L77 72" fill="none" stroke="%23483f35" stroke-width="0.8"/>
</svg>`;

const _tempVec = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _rotEuler = new THREE.Euler();

// Lista global de altares para pistas e inspeção
export const CULT_ALTARS = [];
export const CULT_CAMP_GROUPS = [];

// ============================================================================
// Acervo de Notas e Pistas Investigativas dos Acampamentos do Demiurgo
// ============================================================================
export const CULT_INVESTIGATION_NOTES = [
  // 1. Planos de Ataque e Sabotagem
  {
    type: "Plano de Cerco",
    icon: "⚔️",
    title: "Ordem Cátara Selada",
    text: "«Em 10 dias, ataque na Igreja. Trancai as portas de carvalho por fora com correntes de ferro, apagai as lamparinas sagradas e tomai os cálices de prata para consagração da cinza.»",
  },
  {
    type: "Ordem de Sabotagem",
    icon: "🔥",
    title: "Plano do Piche & Fogo",
    text: "«Na quarta noite após a lua minguante, espalhai óleo no celeiro sul e quebrai as trancas do curral. Quando o gado fugir em disparada, a sentinela do portão abandonará seu posto.»",
  },
  {
    type: "Plano de Envenenamento",
    icon: "☠️",
    title: "Instrução de Beladona",
    text: "«O poço central de Caldera deve receber o extrato de cicuta e cinzas antes da missa dominical. Ninguém deve beber da água sem provar o sabor do Vazio primordial.»",
  },
  {
    type: "Ordem de Execução",
    icon: "🗡️",
    title: "Aviso ao Ferreiro",
    text: "«O ferreiro da praça forja pontas de flecha de prata para os guardas reais. Calai o som de sua bigorna antes do próximo alvorecer; queimai seus foles enquanto ele dorme.»",
  },
  // 2. Ensinamentos e Doutrinas do Demiurgo
  {
    type: "Doutrina do Demiurgo",
    icon: "📜",
    title: "Escritura da Cinza Purificadora",
    text: "«A matéria que vos cerca não é milagre, mas a masmorra imperfeita criada pelo Deus Cego. Cada gota de suor e cada febre que consome o corpo é a prova de que a carne pertence à podridão.»",
  },
  {
    type: "Ensinamento aos Perfeitos",
    icon: "👁️",
    title: "Cânone dos Cátaros Ocultos",
    text: "«Não choreis por aqueles que perecem sob a lâmina: a morte não é perda, mas a quebra do vaso de barro. Somente pela destruição das formas terrenas a centelha do fogo eterno retorna ao Nada absoluto.»",
  },
  {
    type: "Doutrina da Luz Enganosa",
    icon: "🌑",
    title: "Tratado do Sol Falso",
    text: "«O sol dourado é a tocha que cega os homens no vale da ilusão. Adorai as sombras do Demiurgo, pois na escuridão mais densa não há mentiras nem falsos pastores.»",
  },
  // 3. Frases Incoerentes / Nada com Nada
  {
    type: "Garrancho Delirante",
    icon: "🌀",
    title: "Rabisco Febril",
    text: "«Maçã sapato olho, 3 dias... as pedras mastigam o silêncio quando a lua tropeça nos arbustos.»",
  },
  {
    type: "Frase Sem Sentido",
    icon: "🌀",
    title: "Delírio Noturno",
    text: "«Galinha relógio espelho... quando o céu girar ao contrário, as pernas do tempo quebram na curva do moinho.»",
  },
  {
    type: "Rabisco Incompreensível",
    icon: "🌀",
    title: "Palavras na Cinza",
    text: "«Sete colheres na lama fria, peixe sem osso riu do sino... não olhe para o teto da torre quando o vento assoviar.»",
  },
  {
    type: "Garrancho Febril",
    icon: "🌀",
    title: "Rascunho Queimado",
    text: "«Corda vermelha, besouro no bolso, chuva de pregos... quem não tem orelha ouve a parede de pedra rir baixinho.»",
  },
];

let _campModalEl = null;

function _ensureCampModal() {
  if (_campModalEl) return _campModalEl;
  const overlay = document.createElement("div");
  overlay.id = "cult-camp-modal-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(5, 2, 8, 0.88); backdrop-filter: blur(6px);
    z-index: 10002; display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    font-family: 'Cinzel', 'Cinzel Decorative', Georgia, serif;
  `;
  overlay.innerHTML = `
    <div style="
      position: relative; width: 90%; max-width: 580px; background: #160d0f;
      border: 3px solid #6b1b24; border-radius: 8px; padding: 24px 28px;
      box-shadow: 0 0 35px rgba(0,0,0,0.9), 0 0 20px rgba(180,30,40,0.5);
      color: #ebd7c1;
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #7d202b; padding-bottom:10px; margin-bottom:16px;">
        <div style="font-size:13px; letter-spacing:2px; color:#ff4433; font-weight:700;" id="camp-modal-header">
          👁️ VESTÍGIOS DO CULTO DO DEMIURGO
        </div>
        <button id="camp-modal-close" style="
          background:#330a10; border:1px solid #8e202c; color:#f0dcc5;
          font-family:inherit; font-size:12px; padding:5px 12px; border-radius:4px; cursor:pointer;
        ">✕ Fechar (ESC/E)</button>
      </div>
      <div style="font-size:11px; letter-spacing:2px; color:#a37553; text-transform:uppercase; margin-bottom:4px;" id="camp-modal-category">
        Plano de Cerco
      </div>
      <h3 style="margin:0 0 14px 0; font-size:20px; color:#f05544; border-bottom:1px dashed #591b22; padding-bottom:6px;" id="camp-modal-title">
        Ordem Cátara Selada
      </h3>
      <div style="background:#cfbc94; color:#231411; border-radius:4px; padding:18px 22px; font-size:15px; line-height:1.7; font-style:italic; box-shadow:inset 0 0 20px rgba(50,20,10,0.4); margin-bottom:16px;" id="camp-modal-text">
        <!-- Texto da nota -->
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#8e7762;">
        <span id="camp-modal-site">Acampamento dos Ermos</span>
        <span style="color:#e68a38;">✦ Pista registrada · +1 Carisma</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  _campModalEl = overlay;

  const closeBtn = overlay.querySelector("#camp-modal-close");
  closeBtn.addEventListener("click", () => {
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";
  });

  window.addEventListener("keydown", (e) => {
    if (overlay.style.pointerEvents === "auto" && (e.key === "Escape" || e.code === "KeyE")) {
      e.preventDefault();
      overlay.style.opacity = "0";
      overlay.style.pointerEvents = "none";
    }
  });

  return overlay;
}

export function showCampInvestigationModal(altar, note) {
  const overlay = _ensureCampModal();
  overlay.querySelector("#camp-modal-header").textContent = `👁️ ${altar.name?.toUpperCase() || "ACAMPAMENTO DO DEMIURGO"}`;
  overlay.querySelector("#camp-modal-category").textContent = `${note.icon || "📜"} ${note.type || "Anotação Oculta"}`;
  overlay.querySelector("#camp-modal-title").textContent = note.title || "Vestígio Herético";
  overlay.querySelector("#camp-modal-text").textContent = note.text || "";
  overlay.querySelector("#camp-modal-site").textContent = altar.name || "Ermos Noturnos";

  overlay.style.opacity = "1";
  overlay.style.pointerEvents = "auto";
}

export function investigateCultCamp(altar, ui, audio, input) {
  if (!altar) return false;
  altar.investigationIndex = (altar.investigationIndex ?? Math.floor(Math.random() * CULT_INVESTIGATION_NOTES.length));
  const note = CULT_INVESTIGATION_NOTES[altar.investigationIndex % CULT_INVESTIGATION_NOTES.length];
  altar.investigationIndex++;
  altar.inspected = true;

  const tier = altar.tier || "small";
  const chaGain = tier === "huge" ? 4 : tier === "medium" ? 2 : 1;
  PlayerStats.cha = Math.min(20, (PlayerStats.cha || 10) + chaGain);

  // Saque proporcional e roubado de moedas conforme o porte do acampamento
  let goldGain = 15 + Math.floor(Math.random() * 12);
  if (tier === "medium") goldGain = 55 + Math.floor(Math.random() * 25);
  else if (tier === "huge") goldGain = 190 + Math.floor(Math.random() * 60);

  PlayerInventory.gold = (PlayerInventory.gold || 0) + goldGain;
  PlayerStats.gold = PlayerInventory.gold;

  // Saque de Cristais nos acampamentos médios e enormes
  PlayerInventory.crystals = PlayerInventory.crystals || { green: 0, blue: 0, pink: 0, red: 0, white: 0, purple: 0 };
  if (tier === "medium") {
    PlayerInventory.crystals.purple = (PlayerInventory.crystals.purple || 0) + 1;
    PlayerInventory.crystals.red = (PlayerInventory.crystals.red || 0) + 1;
  } else if (tier === "huge") {
    PlayerInventory.crystals.purple = (PlayerInventory.crystals.purple || 0) + 2;
    PlayerInventory.crystals.white = (PlayerInventory.crystals.white || 0) + 1;
    PlayerInventory.crystals.red = (PlayerInventory.crystals.red || 0) + 1;
    PlayerInventory.crystals.green = (PlayerInventory.crystals.green || 0) + 1;
    // No acampamento enorme, garante o desbloqueio do Manto do Demiurgo
    import("./rpg.js").then(({ unlockDemiurgeAttire }) => {
      unlockDemiurgeAttire();
    }).catch(() => {});
  }

  syncPlayerStatsToPlayer();

  if (audio?.bookPage) audio.bookPage();
  if (audio?.coin) audio.coin();

  showCampInvestigationModal(altar, note);

  // Chance / Garantia de recuperar o Tractatus de Carcere ou páginas faltantes
  const possiblePages = [3, 7, 11, 16, 19, 21];
  const missingPages = possiblePages.filter((p) => !PlayerInventory.discoveredBookPages.includes(p));
  if (tier === "huge" && !PlayerInventory.hasDemiurgeDiary) {
    PlayerInventory.hasDemiurgeDiary = true;
    const basePages = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 20];
    for (const bp of basePages) {
      if (!PlayerInventory.discoveredBookPages.includes(bp)) {
        PlayerInventory.discoveredBookPages.push(bp);
      }
    }
    ui?.showToast?.(`✦ Encontraste o Tomo do Tractatus de Carcere no Altar Maior! (+${goldGain} moedas · [L] para ler).`);
  } else if (missingPages.length > 0) {
    if (tier === "huge") {
      // No acampamento enorme recupera TODAS as páginas restantes!
      for (const p of missingPages) {
        if (!PlayerInventory.discoveredBookPages.includes(p)) {
          PlayerInventory.discoveredBookPages.push(p);
        }
      }
      ui?.showToast?.(`✦ SAQUE LENDÁRIO DO BASTIÃO: +${goldGain} moedas, cristais raros e todos os fragmentos do Códice recuperados ([L])!`);
    } else {
      const gainedPage = missingPages[Math.floor(Math.random() * missingPages.length)];
      PlayerInventory.discoveredBookPages.push(gainedPage);
      const pageTitle = gainedPage === 21 ? "O Sacrifício Final" : `Página ${gainedPage}`;
      if (PlayerInventory.hasDemiurgeDiary) {
        ui?.showToast?.(`✦ Fragmento herético recuperado: ${pageTitle} anexada ao Tractatus de Carcere (+${goldGain} moedas)!`);
      } else {
        ui?.showToast?.(`✦ Fragmento herético avulso recolhido: ${pageTitle} (+${goldGain} moedas · [L] para inspecionar)!`);
      }
    }
  } else {
    ui?.showToast?.(`✦ Saque herético realizado no ${altar.name}! (+${goldGain} moedas · +${chaGain} Carisma)`);
  }
  return true;
}

// ============================================================================
// Estado de Poder e Sacrifícios da Seita Cátara (A Ordem do Demiurgo)
// ============================================================================
export const CultState = {
  sacrifices: 0,
  level: 1, // Tier 1 a 4
  speedMultiplier: 1.0,
  damageBonus: 0,
  altarTarget: null,
  apocalypseChance: 0, // Inicia em 0%, sobe 5% por dia e 2% por má ação

  addApocalypseProgress(amount = 2) {
    const prev = this.apocalypseChance;
    this.apocalypseChance = Math.min(100, Math.max(0, this.apocalypseChance + amount));
    const stepPrev = Math.floor(prev / 25);
    const stepCurr = Math.floor(this.apocalypseChance / 25);
    if (stepCurr > stepPrev && this.apocalypseChance >= 25) {
      window.__game?.ui?.showToast?.(
        `🌑 O Véu da Criação estremece! Perigo do Fim dos Tempos: ${Math.round(this.apocalypseChance)}%!`
      );
    }
    return this.apocalypseChance;
  },

  recordSacrifice() {
    this.sacrifices++;
    this.addApocalypseProgress(2);
    if (this.sacrifices >= 10) {
      this.level = 4;
      this.speedMultiplier = 1.75;
      this.damageBonus = 4;
    } else if (this.sacrifices >= 6) {
      this.level = 3;
      this.speedMultiplier = 1.5;
      this.damageBonus = 2;
    } else if (this.sacrifices >= 3) {
      this.level = 2;
      this.speedMultiplier = 1.25;
      this.damageBonus = 1;
    } else {
      this.level = 1;
      this.speedMultiplier = 1.1;
      this.damageBonus = 0;
    }
    return this.level;
  },

  syncLevel(sacrifices = 0) {
    this.sacrifices = Number(sacrifices) || 0;
    if (this.sacrifices >= 10) {
      this.level = 4;
      this.speedMultiplier = 1.75;
      this.damageBonus = 4;
    } else if (this.sacrifices >= 6) {
      this.level = 3;
      this.speedMultiplier = 1.5;
      this.damageBonus = 2;
    } else if (this.sacrifices >= 3) {
      this.level = 2;
      this.speedMultiplier = 1.25;
      this.damageBonus = 1;
    } else if (this.sacrifices >= 1) {
      this.level = 1;
      this.speedMultiplier = 1.1;
      this.damageBonus = 0;
    } else {
      this.level = 1;
      this.speedMultiplier = 1.0;
      this.damageBonus = 0;
    }
  },
};

// ============================================================================
// 2. Geração de Pistas Estáticas e Altares Rituais (InstancedMesh)
// ============================================================================
export function createCultistCluesMeshes(scene) {
  // Geometria de Crânio Humano
  const skullGeo = new THREE.DodecahedronGeometry(0.18, 1);
  const skullsMesh = new THREE.InstancedMesh(skullGeo, _boneMat, 64);
  skullsMesh.name = "CultSkulls";
  skullsMesh.castShadow = true;
  skullsMesh.userData = { currentIndex: 0 };

  // Geometria de Espadas/Lâminas Quebradas
  const swordGeo = new THREE.BoxGeometry(0.08, 0.65, 0.02);
  const weaponsMesh = new THREE.InstancedMesh(swordGeo, _bladeMat, 64);
  weaponsMesh.name = "CultWeapons";
  weaponsMesh.castShadow = true;
  weaponsMesh.userData = { currentIndex: 0 };

  if (scene) {
    scene.add(skullsMesh);
    scene.add(weaponsMesh);
  }

  return { skullsMesh, weaponsMesh };
}

/**
 * Configuração dos Acampamentos dos Servos do Demiurgo em 3 Níveis (Pequeno, Médio, Enorme).
 * Localizados estritamente nos ermos profundos, desfiladeiros e montanhas distantes, NUNCA dentro de vilas ou da capital.
 */
export const CULT_CAMPS_PRESETS = [
  // 1. Grande Bastião de Rex Mundi (ENORME - Morada do Líder Cátaro)
  {
    tier: "huge",
    name: "Grande Bastião Cátaro de Rex Mundi",
    dx: 270,
    dz: 230,
    radius: 14.0,
    cultistsCount: 6,
    hasLeader: true,
    lorePrompt: "A fortaleza herética de Rex Mundi ergue-se nas montanhas do sudeste profundo com braseiros de chama púrpura e estacas afiadas. O Grão-Mestre Morvath aguarda perante o altar.",
  },
  // 2. Acampamentos Médios (3 unidades com paliçadas leves e altares rituais em vales remotos)
  {
    tier: "medium",
    name: "Santuário Oculto dos Montes Leste",
    dx: 290,
    dz: -70,
    radius: 9.0,
    cultistsCount: 4,
    hasLeader: false,
    lorePrompt: "Paliçada de estacas pontiagudas e tochas cerimoniais que cercam o altar da cinza nos montes do leste distante.",
  },
  {
    tier: "medium",
    name: "Círculo dos Sacramentos do Sul",
    dx: -40,
    dz: 290,
    radius: 9.0,
    cultistsCount: 4,
    hasLeader: false,
    lorePrompt: "Quatro sentinelas com tochas rubras vigiam a encruzilhada rochosa do sul em torno da fogueira do vazio.",
  },
  {
    tier: "medium",
    name: "Acampamento das Sombras do Vale Oeste",
    dx: -290,
    dz: -50,
    radius: 9.0,
    cultistsCount: 4,
    hasLeader: false,
    lorePrompt: "Altar ritual cercado por ossadas e símbolos do Deus Cego talhados em troncos queimados no desfiladeiro oeste.",
  },
  // 3. Acampamentos Pequenos (4 unidades em anéis nos ermos distantes)
  {
    tier: "small",
    name: "Vigília Cátara do Ermo Norte",
    dx: 20,
    dz: -280,
    radius: 6.5,
    cultistsCount: 2,
    hasLeader: false,
    lorePrompt: "Duas sentinelas heréticas encapuzadas aquecem suas adagas na chama roxa no vale gelado ao norte.",
  },
  {
    tier: "small",
    name: "Posto Avançado da Clareira Noroeste",
    dx: -240,
    dz: -240,
    radius: 6.5,
    cultistsCount: 2,
    hasLeader: false,
    lorePrompt: "Pequeno acampamento de servos que observam as estradas desertas na calada da noite no platô noroeste.",
  },
  {
    tier: "small",
    name: "Refúgio da Cinza Sudoeste",
    dx: -250,
    dz: 200,
    radius: 6.5,
    cultistsCount: 2,
    hasLeader: false,
    lorePrompt: "Fogueira mística oculta entre arbustos ressequidos nos limites dos bosques do sudoeste.",
  },
  {
    tier: "small",
    name: "Acampamento da Trilha Sudeste",
    dx: 210,
    dz: 270,
    radius: 6.5,
    cultistsCount: 2,
    hasLeader: false,
    lorePrompt: "Tochas avermelhadas ardem nos galhos secos onde os cultistas vigiam a ravina do sudeste.",
  },
];

/**
 * Espalha os acampamentos pequenos, médios e enorme e seus altares rituais.
 */
// ----------------------------------------------------------------------------
// Fogo e adereços animados dos acampamentos do culto (geometrias/materiais compartilhados)
// ----------------------------------------------------------------------------
const _campConeUnit = new THREE.ConeGeometry(0.5, 1, 7, 1, true).translate(0, 0.5, 0);
const _campFireOuterMat = new THREE.MeshBasicMaterial({ color: 0x8b2be2, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });
const _campFireMidMat = new THREE.MeshBasicMaterial({ color: 0xd13cff, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false });
const _campFireCoreMat = new THREE.MeshBasicMaterial({ color: 0xffd9ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
const _campTorchOuterMat = new THREE.MeshBasicMaterial({ color: 0xff4a12, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false });
const _campTorchInnerMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
const _campEmberMat = new THREE.PointsMaterial({ color: 0xe0a8ff, size: 0.13, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
const _campFlagGeo = new THREE.BoxGeometry(0.62, 0.4, 0.015).translate(0.31, 0, 0);
const _campFlagMat = new THREE.MeshStandardMaterial({ color: 0x6e0d19, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
const _cm = new THREE.Matrix4();
const _cq = new THREE.Quaternion();
const _cv = new THREE.Vector3();
const _cs = new THREE.Vector3();
const _ce = new THREE.Euler();

/** Anima UM acampamento (chamas por senos, brasas subindo, bandeiras e o flicker da luz). Só roda quando o jogador está perto. */
function animateCampFx(camp, time, dt) {
  const fx = camp.userData.fx;
  if (!fx) return;
  const t = time + fx.phase;
  const fl = 0.86 + Math.sin(t * 11) * 0.07 + Math.sin(t * 17 + 1.3) * 0.05 + Math.sin(t * 5) * 0.04;

  // fogueira(s): 3 camadas aninhadas, cada uma com escala/rotação própria
  const layers = [[fx.fireOuter, 1, 1, 1.0], [fx.fireMid, 0.72, 0.84, -1.5], [fx.fireCore, 0.42, 0.62, 2.1]];
  for (const [mesh, rk, hk, spin] of layers) {
    for (let i = 0; i < fx.fireSlots.length; i++) {
      const sl = fx.fireSlots[i];
      const ph = t + i * 1.7;
      const w = 1 + Math.sin(ph * 6.1 + hk) * 0.09;
      const hh = sl.h * hk * (fl + Math.sin(ph * 8.3 + hk * 3) * 0.12);
      _ce.set(0, ph * spin, Math.sin(ph * 3.1) * 0.06);
      _cq.setFromEuler(_ce);
      _cv.set(sl.x + Math.sin(ph * 4 + hk) * 0.02, sl.y, sl.z + Math.cos(ph * 3.4) * 0.02);
      _cs.set(sl.r * 2 * rk * w, hh, sl.r * 2 * rk * w);
      _cm.compose(_cv, _cq, _cs);
      mesh.setMatrixAt(i, _cm);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  // tochas rubras
  for (let i = 0; i < fx.torchSlots.length; i++) {
    const sl = fx.torchSlots[i];
    const ph = t + i * 2.3;
    const a = Math.sin(ph * 9.0);
    const b = Math.sin(ph * 6.3 + 1.0);
    _ce.set(0, ph * 2.4, 0);
    _cq.setFromEuler(_ce);
    _cv.set(sl.x, sl.y, sl.z);
    _cs.set(1.2 + a * 0.15, 1.15 + b * 0.28, 1.2 + a * 0.15);
    _cm.compose(_cv, _cq, _cs);
    fx.torchOuter.setMatrixAt(i, _cm);
    _cs.set(1.15 - a * 0.1, 1.0 + b * 0.2, 1.15 - a * 0.1);
    _cm.compose(_cv, _cq, _cs);
    fx.torchInner.setMatrixAt(i, _cm);
  }
  fx.torchOuter.instanceMatrix.needsUpdate = true;
  fx.torchInner.instanceMatrix.needsUpdate = true;

  // halo e luz pulsam junto com a chama
  fx.fireHalo.material.opacity = 0.55 + fl * 0.3;
  const light = camp.userData.mainLight;
  if (light && light.visible) {
    const base = camp.userData.isHuge ? 6.5 : 4.5;
    light.intensity = base * (0.82 + (fl - 0.86) * 1.4);
  }

  // brasas subindo em espiral lenta; reciclam ao passar do topo
  const pos = fx.emberPos;
  for (let i = 0; i < fx.emberN; i++) {
    const ang = fx.emberSeed[i * 3];
    const speed = fx.emberSeed[i * 3 + 1];
    const off = fx.emberSeed[i * 3 + 2];
    const life = (t * 0.22 * speed + off) % 1;
    const rad = 0.18 + life * 0.5 + off * 0.2;
    pos[i * 3] = Math.cos(ang + life * 4) * rad;
    pos[i * 3 + 1] = 0.3 + life * (2.6 + off);
    pos[i * 3 + 2] = Math.sin(ang + life * 4) * rad;
  }
  fx.embers.geometry.attributes.position.needsUpdate = true;

  // bandeiras esfarrapadas balançando devagar
  for (let i = 0; i < fx.flags.length; i++) {
    const f = fx.flags[i];
    f.rotation.y = f.userData.base + Math.sin(t * 0.9 + f.userData.phase) * 0.35;
    f.rotation.z = Math.sin(t * 1.7 + f.userData.phase) * 0.08;
  }
}

export function spawnCultistClues(skullsMesh, weaponsMesh, regionSeed, cityCenter, scene, world) {
  if (!skullsMesh || !weaponsMesh || !cityCenter) return;
  const random = createSeededRandom(regionSeed || 12345);

  CULT_ALTARS.length = 0;
  CULT_CAMP_GROUPS.length = 0;

  const cx = cityCenter.x ?? 0;
  const cz = cityCenter.z ?? 0;

  for (let c = 0; c < CULT_CAMPS_PRESETS.length; c++) {
    const preset = CULT_CAMPS_PRESETS[c];
    let ax = cx + preset.dx;
    let az = cz + preset.dz;

    // Salvaguarda matemática: garante que NUNCA colida com a Capital nem com qualquer Vila
    const distToCenter = Math.hypot(ax - cx, az - cz);
    if (distToCenter < 220) {
      const scale = 260 / Math.max(1, distToCenter);
      ax = cx + (ax - cx) * scale;
      az = cz + (az - cz) * scale;
    }
    if (Array.isArray(VILLAGES)) {
      for (let vIdx = 0; vIdx < VILLAGES.length; vIdx++) {
        const v = VILLAGES[vIdx];
        const vd = Math.hypot(ax - v.x, az - v.z);
        if (vd < 140) {
          const vPush = 150 - vd;
          const ang = Math.atan2(az - v.z, ax - v.x);
          ax += Math.cos(ang) * vPush;
          az += Math.sin(ang) * vPush;
        }
      }
    }

    const ay = world ? world.heightAt(ax, az) : 0;

    const outpostData = {
      x: ax,
      y: ay,
      z: az,
      tier: preset.tier,
      radius: preset.radius,
      cultistsCount: preset.cultistsCount,
      hasLeader: preset.hasLeader,
      inspected: false,
      name: preset.name,
      lorePrompt: preset.lorePrompt,
    };
    CULT_ALTARS.push(outpostData);
    if (!CultState.altarTarget) {
      CultState.altarTarget = outpostData;
    }

    if (scene) {
      const campGroup = new THREE.Group();
      campGroup.position.set(ax, ay, az);

      const isHuge = preset.tier === "huge";
      const isMedium = preset.tier === "medium";

      // Geometria ESTÁTICA do acampamento fundida em UM mesh (cor por vértice, formas redondas);
      // fogo, brasas e bandeiras são os únicos elementos animados (poucos draw calls).
      const defs = [];
      const PI2 = Math.PI * 2;

      // 1. Paliçada de troncos queimados com crânios (Médio e Enorme)
      if (isHuge || isMedium) {
        const stakeCount = isHuge ? 20 : 10;
        const stakeRadius = isHuge ? 8.5 : 4.8;
        for (let st = 2; st < stakeCount; st++) {
          const sang = (st / stakeCount) * PI2;
          const sx = Math.cos(sang) * stakeRadius;
          const sz = Math.sin(sang) * stakeRadius;
          defs.push({ t: "cone", a: [0.13, 2.4, 6], p: [sx, 1.1, sz], r: [(random() - 0.5) * 0.15, 0, (random() - 0.5) * 0.15], c: 0x17100d, ao: 0.5 });
          if (st % 3 === 0) defs.push({ t: "sph", a: [0.16, 6, 4], p: [sx, 2.2, sz], s: [0.9, 1.1, 1], c: 0xd8cfb8, ao: 0.8 });
        }
      }

      // 2. Fogueira cerimonial: pedras redondas e toras (a chama é animada, mais abaixo)
      const stoneCount = isHuge ? 14 : isMedium ? 10 : 8;
      const stoneDist = isHuge ? 2.2 : isMedium ? 1.7 : 1.35;
      for (let q = 0; q < stoneCount; q++) {
        const pang = (q / stoneCount) * PI2;
        const sr = isHuge ? 0.34 : 0.24;
        defs.push({ t: "sph", a: [sr, 6, 4], p: [Math.cos(pang) * stoneDist, 0.12, Math.sin(pang) * stoneDist], s: [1, 0.7, 1], c: 0x4b4650, ao: 0.6 });
      }
      for (let l = 0; l < (isHuge ? 6 : 4); l++) {
        defs.push({ t: "cap", a: [0.07, isHuge ? 1.2 : 0.8, 1, 5], p: [0, 0.14, 0], r: [0, (l / 4) * Math.PI, Math.PI / 2], c: 0x241710, ao: 0.6 });
      }

      // 3. Círculo ritual de pedras e ossos ao redor da fogueira
      const ringR = stoneDist + (isHuge ? 3.4 : isMedium ? 2.6 : 2.2);
      const boneN = isHuge ? 14 : isMedium ? 10 : 7;
      for (let q = 0; q < boneN; q++) {
        const rang = (q / boneN) * PI2 + 0.15;
        const bx = Math.cos(rang) * ringR;
        const bz = Math.sin(rang) * ringR;
        if (q % 2 === 0) defs.push({ t: "cap", a: [0.03, 0.5, 1, 4], p: [bx, 0.05, bz], r: [Math.PI / 2, 0, rang + Math.PI / 2], c: 0xd8cfb8, ao: 0.8 });
        else defs.push({ t: "sph", a: [0.14, 5, 4], p: [bx, 0.08, bz], s: [1.2, 0.7, 1], c: 0x3c3844, ao: 0.6 });
      }

      // 4. Tendas arredondadas e remendadas, viradas para a fogueira
      const tentN = isHuge ? 3 : isMedium ? 2 : 1;
      const tentDist = ringR + (isHuge ? 3.2 : 2.6);
      const tentR = (h) => (h < 0.45 ? 1.55 - h * 0.11 : h < 1.05 ? 1.5 - (h - 0.45) * 0.58 : 1.15 - (h - 1.05) * 1.1);
      for (let tn = 0; tn < tentN; tn++) {
        const tang = (tn / tentN) * PI2 + 2.1 + c * 0.7;
        const tx = Math.cos(tang) * tentDist;
        const tz = Math.sin(tang) * tentDist;
        defs.push({ t: "lat", a: [[[1.55, 0.0], [1.5, 0.45], [1.15, 1.05], [0.6, 1.55], [0.04, 1.85]], 8], p: [tx, 0, tz], r: [0, -tang, 0], s: [0.9, 1, 0.9], c: 0x2b221d, ao: 0.5 });
        for (let pt = 0; pt < 4; pt++) {
          const pa = random() * PI2;
          const ph = 0.35 + random() * 0.75;
          const pr = tentR(ph) * 0.9 * 0.96;
          defs.push({ t: "sph", a: [0.24, 5, 3], p: [tx + Math.cos(pa) * pr, ph, tz + Math.sin(pa) * pr], r: [0, Math.PI / 2 - pa, 0], s: [1.2, 0.95, 0.2], c: pt % 2 ? 0x4a3c2c : 0x3a2a3a, ao: 0.9 });
        }
        // estaca de entrada com um osso pendurado
        defs.push({ t: "cap", a: [0.03, 0.9, 1, 4], p: [tx + Math.cos(tang + Math.PI) * 1.65, 0.5, tz + Math.sin(tang + Math.PI) * 1.65], c: 0x17100d, ao: 0.6 });
      }

      // 5. Totens com o Olho (Médio e Enorme)
      if (isHuge || isMedium) {
        const totemN = isHuge ? 3 : 2;
        for (let tt = 0; tt < totemN; tt++) {
          const tang = (tt / totemN) * PI2 + 0.9 + c;
          const tx = Math.cos(tang) * (ringR + 1.2);
          const tz = Math.sin(tang) * (ringR + 1.2);
          const face = Math.PI / 2 - tang + Math.PI; // olho voltado para a fogueira
          defs.push({ t: "cap", a: [0.1, 2.6, 2, 6], p: [tx, 1.4, tz], c: 0x1d140f, ao: 0.5 });
          defs.push({ t: "sph", a: [0.2, 6, 4], p: [tx + Math.sin(face) * 0.1, 2.55, tz + Math.cos(face) * 0.1], r: [0, face, 0], s: [1.3, 0.8, 0.45], c: 0xc8982a, ao: 0.9 });
          defs.push({ t: "sph", a: [0.07, 4, 3], p: [tx + Math.sin(face) * 0.2, 2.55, tz + Math.cos(face) * 0.2], c: 0x8a0f1c, ao: 1 });
          defs.push({ t: "cone", a: [0.07, 0.4, 4], p: [tx - Math.cos(face) * 0.22, 2.9, tz + Math.sin(face) * 0.22], r: [0, 0, 0.5], c: 0xd8cfb8, ao: 0.8 });
          defs.push({ t: "cone", a: [0.07, 0.4, 4], p: [tx + Math.cos(face) * 0.22, 2.9, tz - Math.sin(face) * 0.22], r: [0, 0, -0.5], c: 0xd8cfb8, ao: 0.8 });
        }
      }

      // 6. Hastes das tochas rubras (as chamas animadas ficam em InstancedMesh)
      const torchCount = isHuge ? 6 : isMedium ? 4 : 2;
      const torchDist = isHuge ? 4.5 : isMedium ? 2.8 : 1.6;
      const torchSlots = [];
      for (let q = 0; q < torchCount; q++) {
        const tang = (q / torchCount) * PI2 + 0.3;
        const tx = Math.cos(tang) * torchDist;
        const tz = Math.sin(tang) * torchDist;
        defs.push({ t: "cap", a: [0.04, 1.85, 1, 5], p: [tx, 1.0, tz], c: 0x241a14, ao: 0.6 });
        defs.push({ t: "cyl", a: [0.07, 0.04, 0.14, 6], p: [tx, 1.97, tz], c: 0x15100d, ao: 0.6 });
        torchSlots.push({ x: tx, y: 2.04, z: tz });
      }

      // 7. Braseiros e altar monumental (Enorme)
      const fireSlots = [{ x: 0, y: 0.18, z: 0, r: isHuge ? 0.55 : isMedium ? 0.4 : 0.34, h: isHuge ? 1.6 : isMedium ? 1.15 : 0.88 }];
      if (isHuge) {
        for (const bx of [-3.8, 3.8]) {
          defs.push({ t: "cyl", a: [0.35, 0.45, 1.2, 8], p: [bx, 0.6, -1.8], c: 0x4b4650, ao: 0.6 });
          defs.push({ t: "cyl", a: [0.55, 0.32, 0.3, 8], p: [bx, 1.3, -1.8], c: 0x3c3844, ao: 0.6 });
          fireSlots.push({ x: bx, y: 1.42, z: -1.8, r: 0.32, h: 0.95 });
        }
        defs.push({ t: "box", a: [2.8, 0.75, 1.4], p: [0, 0.38, 3.2], c: 0x4b4650, ao: 0.6 });
        defs.push({ t: "box", a: [3.2, 0.22, 1.6], p: [0, 0.84, 3.2], c: 0x5a545f, ao: 0.6 });
        defs.push({ t: "cap", a: [0.17, 1.0, 2, 7], p: [0, 1.55, 3.2], c: 0x4b4650, ao: 0.6 });
        defs.push({ t: "sph", a: [0.22, 6, 4], p: [0, 2.2, 3.28], s: [0.9, 0.8, 1.2], c: 0x4b4650, ao: 0.7 });
        defs.push({ t: "cone", a: [0.05, 0.18, 4], p: [-0.1, 2.38, 3.3], r: [0, 0, 0.4], c: 0xd8cfb8, ao: 0.8 });
        defs.push({ t: "cone", a: [0.05, 0.18, 4], p: [0.1, 2.38, 3.3], r: [0, 0, -0.4], c: 0xd8cfb8, ao: 0.8 });
      }
      defs.push({ t: "sph", a: [0.18, 6, 4], p: [0.7, 0.14, 0.7], s: [0.9, 1.1, 1], c: 0xd8cfb8, ao: 0.8 });

      // Mastros das bandeiras esfarrapadas (as bandeiras balançam, animadas)
      const flagN = isHuge ? 4 : isMedium ? 2 : 1;
      const flags = [];
      for (let fl = 0; fl < flagN; fl++) {
        const fang = (fl / flagN) * PI2 + 0.55 + c * 0.4;
        const fx = Math.cos(fang) * (ringR + 2.2);
        const fz = Math.sin(fang) * (ringR + 2.2);
        defs.push({ t: "cap", a: [0.035, 2.9, 1, 5], p: [fx, 1.55, fz], c: 0x1d140f, ao: 0.5 });
        const flagMesh = new THREE.Mesh(_campFlagGeo, _campFlagMat);
        flagMesh.position.set(fx, 2.55, fz);
        flagMesh.rotation.y = fang;
        flagMesh.userData.phase = random() * 6.28;
        flagMesh.userData.base = fang;
        campGroup.add(flagMesh);
        flags.push(flagMesh);
      }

      const staticMesh = new THREE.Mesh(makeMergedGeometry(defs), getSmoothDetailMaterial());
      staticMesh.name = "CultCampStatic";
      staticMesh.castShadow = false;
      campGroup.add(staticMesh);

      // Fogo animado: 3 camadas de cone aninhado (violeta -> magenta -> branco-rosado) em InstancedMesh (1 draw call por camada)
      const fireOuter = new THREE.InstancedMesh(_campConeUnit, _campFireOuterMat, fireSlots.length);
      const fireMid = new THREE.InstancedMesh(_campConeUnit, _campFireMidMat, fireSlots.length);
      const fireCore = new THREE.InstancedMesh(_campConeUnit, _campFireCoreMat, fireSlots.length);
      const torchOuter = new THREE.InstancedMesh(_flameGeoOuter, _campTorchOuterMat, torchSlots.length);
      const torchInner = new THREE.InstancedMesh(_flameGeoInner, _campTorchInnerMat, torchSlots.length);
      for (const im of [fireOuter, fireMid, fireCore, torchOuter, torchInner]) {
        im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        campGroup.add(im);
      }

      // Halo aditivo pulsante e brasas subindo (1 sprite + 1 Points por acampamento)
      const fireHalo = new THREE.Sprite(_servantHalo().clone());
      fireHalo.scale.setScalar(isHuge ? 5.2 : isMedium ? 3.8 : 3);
      fireHalo.position.set(0, fireSlots[0].h * 0.55, 0);
      campGroup.add(fireHalo);
      const emberN = isHuge ? 28 : isMedium ? 20 : 14;
      const emberPos = new Float32Array(emberN * 3);
      const emberSeed = new Float32Array(emberN * 3);
      for (let q = 0; q < emberN; q++) {
        emberSeed[q * 3] = random() * PI2;
        emberSeed[q * 3 + 1] = 0.5 + random() * 1.1;
        emberSeed[q * 3 + 2] = random();
      }
      const emberGeo = new THREE.BufferGeometry();
      emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
      const embers = new THREE.Points(emberGeo, _campEmberMat);
      embers.frustumCulled = false;
      campGroup.add(embers);

      campGroup.userData.fx = { fireSlots, torchSlots, fireOuter, fireMid, fireCore, torchOuter, torchInner, fireHalo, embers, emberPos, emberSeed, emberN, flags, phase: random() * 6.28, ringR };

      // Única luz pontual por acampamento (otimização radical de shaders e draw calls)
      const campfireLight = new THREE.PointLight(0xaa33ff, 0, isHuge ? 32 : isMedium ? 24 : 16, 1.8);
      campfireLight.position.set(0, 1.1, 0);
      campfireLight.visible = false;
      campGroup.add(campfireLight);
      campGroup.userData.mainLight = campfireLight;
      campGroup.userData.isHuge = isHuge;

      // Os acampamentos só aparecem à noite
      campGroup.visible = false;
      CULT_CAMP_GROUPS.push(campGroup);
      scene.add(campGroup);
    }
  }

  // Preenche instâncias de crânios e armas quebradas espalhadas nos arredores
  for (let c = 0; c < CULT_ALTARS.length; c++) {
    const altar = CULT_ALTARS[c];
    const ax = altar.x;
    const az = altar.z;
    const ay = altar.y;

    const skullsCount = altar.tier === "huge" ? 6 : altar.tier === "medium" ? 4 : 2;
    for (let s = 0; s < skullsCount; s++) {
      if (skullsMesh.userData.currentIndex >= skullsMesh.count) break;
      const sAng = random() * Math.PI * 2;
      const sDist = 1.0 + random() * (altar.radius * 0.7);
      const sx = ax + Math.cos(sAng) * sDist;
      const sz = az + Math.sin(sAng) * sDist;
      const sy = world ? world.heightAt(sx, sz) : ay;

      _rotEuler.set(random() * 0.4, random() * Math.PI * 2, random() * 0.4);
      _matrix.makeRotationFromEuler(_rotEuler);
      _matrix.setPosition(sx, sy + 0.12, sz);
      skullsMesh.setMatrixAt(skullsMesh.userData.currentIndex++, _matrix);
    }

    const weaponsCount = altar.tier === "huge" ? 5 : altar.tier === "medium" ? 3 : 1;
    for (let w = 0; w < weaponsCount; w++) {
      if (weaponsMesh.userData.currentIndex >= weaponsMesh.count) break;
      const wAng = random() * Math.PI * 2;
      const wDist = 1.2 + random() * (altar.radius * 0.65);
      const wx = ax + Math.cos(wAng) * wDist;
      const wz = az + Math.sin(wAng) * wDist;
      const wy = world ? world.heightAt(wx, wz) : ay;

      _rotEuler.set(Math.PI * 0.48, random() * Math.PI * 2, random() * 0.3);
      _matrix.makeRotationFromEuler(_rotEuler);
      _matrix.setPosition(wx, wy + 0.06, wz);
      weaponsMesh.setMatrixAt(weaponsMesh.userData.currentIndex++, _matrix);
    }
  }

  skullsMesh.instanceMatrix.needsUpdate = true;
  skullsMesh.computeBoundingBox();
  skullsMesh.computeBoundingSphere();
  weaponsMesh.instanceMatrix.needsUpdate = true;
  weaponsMesh.computeBoundingBox();
  weaponsMesh.computeBoundingSphere();
}

// ============================================================================
// 3. Modelo Anatômico 3D do Cultista Cátaro (Estilo Baile Oculto - Eyes Wide Shut)
// ============================================================================
// ----------------------------------------------------------------------------
// Servos do Demiurgo: formas redondas (torno/cápsulas/esferas amassadas) fundidas por cor de vértice.
// Custo: poucos meshes (manto, cabeça, olhos, 2 braços, tocha) e ~900 triângulos, sem PointLight.
// Peças que a IA anima continuam separadas e com os mesmos nomes: robe, armL, armR, torchGroup.
// ----------------------------------------------------------------------------
const SV = {
  robe: 0x0c080f, robeLite: 0x1d1424, robeDark: 0x060408, crimson: 0x7a1018, gold: 0xc8982a, goldDark: 0x6b5320,
  bone: 0xd8cfb8, mask: 0xeee6d8, crack: 0x4a4038, dark: 0x050405, blade: 0x2b2b33,
};
const _servantEyeMat = new THREE.MeshBasicMaterial({ color: 0xb53cff });
const _servantFlameOuter = new THREE.MeshBasicMaterial({ color: 0xaa33ff, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false });
const _servantFlameInner = new THREE.MeshBasicMaterial({ color: 0xffd6ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
let _servantHaloMat = null;
function _servantHalo() {
  if (!_servantHaloMat) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(220,140,255,1)");
    g.addColorStop(0.35, "rgba(170,60,255,0.55)");
    g.addColorStop(1, "rgba(120,20,200,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _servantHaloMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  }
  return _servantHaloMat;
}

// Geometria de uma chama (2 cones aninhados) reaproveitada pelas tochas dos servos e pelas fogueiras dos acampamentos
const _flameGeoOuter = new THREE.ConeGeometry(0.085, 0.34, 6, 1, true).translate(0, 0.17, 0);
const _flameGeoInner = new THREE.ConeGeometry(0.048, 0.24, 5, 1, true).translate(0, 0.12, 0);

function _pivotGeometry(defs, dy) {
  const g = makeMergedGeometry(defs);
  g.translate(0, dy, 0);
  g.computeBoundingSphere();
  return g;
}

export function buildCultistMesh() {
  const root = new THREE.Group();
  root.name = "CultistRoot";

  const model = new THREE.Group();
  model.name = "CultistModel";
  model.rotation.x = 0.07; // postura levemente inclinada para a frente: mais ameaçador
  root.add(model);
  const mat = getSmoothDetailMaterial();

  // ---- Manto (animado: escala quando senta/respira). Torno redondo, ombros largos, barra esfarrapada, estola,
  //      cordão com talismãs e corcunda. Pivô em y=0.8 (mesmo de antes) para a animação de sentar continuar igual.
  const hem = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    hem.push({ t: "cone", a: [0.075, 0.28, 4], p: [Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5], r: [Math.PI, a, 0], c: SV.robeDark, ao: 0.7 });
  }
  const robeGeo = _pivotGeometry([
    { t: "lat", a: [[[0.52, 0.02], [0.49, 0.28], [0.4, 0.72], [0.31, 1.12], [0.37, 1.4], [0.27, 1.56], [0.12, 1.63]], 9], c: SV.robe, ao: 0.5 },
    ...hem,
    { t: "cap", a: [0.05, 0.9, 2, 5], p: [0, 0.82, 0.37], r: [-0.1, 0, 0], s: [1, 1, 0.45], c: SV.crimson, ao: 0.7 },
    { t: "sph", a: [0.045, 5, 3], p: [0, 1.4, 0.32], c: SV.gold, ao: 0.9 },
    { t: "sph", a: [0.05, 5, 3], p: [0, 1.06, 0.395], s: [1.2, 0.6, 0.3], c: SV.gold, ao: 0.9 },
    { t: "tor", a: [0.36, 0.018, 3, 9], p: [0, 0.88, 0], r: [Math.PI / 2, 0, 0], c: SV.goldDark, ao: 0.9 },
    { t: "cone", a: [0.03, 0.17, 4], p: [-0.12, 0.76, 0.375], r: [Math.PI, 0, 0], c: SV.bone, ao: 0.9 },
    { t: "sph", a: [0.032, 4, 3], p: [0.14, 0.79, 0.37], c: SV.gold, ao: 0.9 },
    { t: "sph", a: [0.2, 6, 4], p: [0, 1.42, -0.14], s: [1.1, 0.8, 0.9], c: SV.robeLite, ao: 0.6 },
  ], -0.8);
  const robe = new THREE.Mesh(robeGeo, mat);
  robe.name = "CultistRobe";
  robe.position.set(0, 0.8, 0);
  robe.castShadow = true;
  model.add(robe);

  // ---- Cabeça estática: capuz profundo e alto, aro do capuz, máscara de porcelana com rachaduras, órbitas escuras
  const headGeo = makeMergedGeometry([
    { t: "sph", a: [0.2, 8, 5], p: [0, 1.78, -0.01], s: [0.95, 1.3, 1.1], c: SV.robe, ao: 0.55 },
    { t: "cone", a: [0.12, 0.36, 5], p: [0, 2.03, -0.1], r: [-0.5, 0, 0], c: SV.robe, ao: 0.6 },
    { t: "tor", a: [0.145, 0.04, 3, 8], p: [0, 1.7, 0.11], r: [-0.1, 0, 0], s: [1, 1.15, 1], c: SV.robeLite, ao: 0.8 },
    { t: "sph", a: [0.125, 7, 4], p: [0, 1.68, 0.115], s: [0.85, 1.2, 0.5], c: SV.mask, ao: 0.75 },
    { t: "box", a: [0.012, 0.14, 0.02], p: [0.02, 1.73, 0.172], r: [0, 0, 0.35], c: SV.crack, ao: 1 },
    { t: "box", a: [0.01, 0.09, 0.02], p: [-0.045, 1.63, 0.17], r: [0, 0, -0.5], c: SV.crack, ao: 1 },
    { t: "sph", a: [0.028, 5, 3], p: [-0.05, 1.7, 0.165], s: [1.5, 0.8, 0.5], c: SV.dark, ao: 1 },
    { t: "sph", a: [0.028, 5, 3], p: [0.05, 1.7, 0.165], s: [1.5, 0.8, 0.5], c: SV.dark, ao: 1 },
    { t: "box", a: [0.07, 0.012, 0.02], p: [0, 1.6, 0.17], c: SV.dark, ao: 1 },
  ]);
  const head = new THREE.Mesh(headGeo, mat);
  head.name = "CultistHead";
  model.add(head);

  // Olhos roxos emissivos (MeshBasic, não são afetados pela luz) + halo aditivo pequeno
  const eyesGeo = makeMergedGeometry([
    { t: "sph", a: [0.016, 5, 3], p: [-0.05, 1.7, 0.18], c: 0xffffff, ao: 1 },
    { t: "sph", a: [0.016, 5, 3], p: [0.05, 1.7, 0.18], c: 0xffffff, ao: 1 },
  ]);
  const eyes = new THREE.Mesh(eyesGeo, _servantEyeMat);
  eyes.name = "CultistEyes";
  model.add(eyes);
  const halo = new THREE.Sprite(_servantHalo());
  halo.scale.set(0.34, 0.16, 1);
  halo.position.set(0, 1.7, 0.2);
  model.add(halo);

  // ---- Braços longos (animados) com pivô no ombro: capsula, mão grande; a adaga ritual acompanha o braço direito
  const armDefs = (extra = []) => [
    { t: "cap", a: [0.058, 0.55, 1, 5], p: [0, -0.3, 0.12], r: [0.4, 0, 0], c: SV.robe, ao: 0.6 },
    { t: "sph", a: [0.075, 5, 4], p: [0, -0.66, 0.28], s: [1, 1.35, 1], c: SV.robeLite, ao: 0.8 },
    ...extra,
  ];
  const armL = new THREE.Mesh(makeMergedGeometry(armDefs()), mat);
  armL.name = "CultistArmL";
  armL.position.set(-0.3, 1.45, 0);
  armL.rotation.z = -0.1;
  model.add(armL);

  const armR = new THREE.Mesh(makeMergedGeometry(armDefs([
    { t: "cyl", a: [0.018, 0.018, 0.14, 5], p: [0, -0.7, 0.28], c: SV.blade, ao: 0.9 },
    { t: "box", a: [0.1, 0.025, 0.035], p: [0, -0.77, 0.28], c: SV.gold, ao: 0.9 },
    { t: "cone", a: [0.04, 0.34, 4], p: [0, -0.96, 0.28], r: [Math.PI, 0, 0], c: SV.blade, ao: 0.9 },
    { t: "sph", a: [0.03, 4, 3], p: [0, -0.62, 0.28], c: SV.gold, ao: 0.9 },
  ])), mat);
  armR.name = "CultistArmR";
  armR.position.set(0.3, 1.45, 0);
  armR.rotation.z = 0.1;
  model.add(armR);

  // ---- Tocha cerimonial na mão esquerda: haste+gaiola fundidas e chama de 2 cones aninhados (animada)
  const torchGroup = new THREE.Group();
  torchGroup.name = "CultistRedTorch";
  torchGroup.position.set(-0.37, 0.98, 0.28);
  const torchBody = new THREE.Mesh(makeMergedGeometry([
    { t: "cyl", a: [0.02, 0.024, 0.48, 6], c: SV.blade, ao: 0.8 },
    { t: "box", a: [0.08, 0.08, 0.08], p: [0, 0.22, 0], c: SV.blade, ao: 0.8 },
  ]), mat);
  torchGroup.add(torchBody);
  const flameOuter = new THREE.Mesh(_flameGeoOuter, _servantFlameOuter);
  const flameInner = new THREE.Mesh(_flameGeoInner, _servantFlameInner);
  flameOuter.position.y = 0.25;
  flameInner.position.y = 0.25;
  flameOuter.frustumCulled = false;
  flameInner.frustumCulled = false;
  torchGroup.add(flameOuter, flameInner);
  model.add(torchGroup);

  root.visible = false;
  const _parts = { root, model, robe, head, armL, armR, torchGroup, torchLight: null, flameOuter, flameInner };
  finalizeMonster(root, _parts);
  return _parts;
}

// ============================================================================
// 4. Classe Cultist (IA Furtiva, Sabotagem e Desvanecimento Sobrenatural)
// ============================================================================
const CULTIST_SPEED = 2.0; // Movimento fantasmagórico lento
const CULTIST_FLEE_SPEED = 5.2;

export class Cultist {
  constructor(scene, world, effects, combat) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = combat;

    const { root, model, robe, head, armL, armR, torchGroup, torchLight, flameOuter, flameInner } = buildCultistMesh();
    this.root = root;
    this.model = model;
    this.robe = robe;
    this.head = head;
    this.flameOuter = flameOuter;
    this.flameInner = flameInner;
    this.armL = armL;
    this.armR = armR;
    this.torchGroup = torchGroup;
    this.torchLight = torchLight;
    this.isSeated = false;

    this.roleKey = "cultist";
    this.name = "Cultista do Demiurgo";
    this.title = "A Ordem do Demiurgo";
    this.alive = false;
    this.hostile = true;
    this.temporary = true;
    this.health = 24;
    this.maxHealth = 24;
    this.meleeDamage = 2;
    this.meleeRange = 2.2;
    this.task = "Invocando as sombras do Demiurgo";

    this.x = 9999;
    this.z = 9999;
    this.floatPhase = Math.random() * Math.PI * 2;
    this._spellTimer = 0;
    this._attackTimer = 0;

    this.userData = {
      type: "CULTIST",
      state: "DESPAWNED",
      anchor: new THREE.Vector3(),
      nextActionTime: 0,
      vanishTimer: 0,
      fleeTimer: 0,
      isDead: true,
    };

    this.flashMaterials = [];
    this.model.traverse((child) => {
      // olhos/chama são MeshBasic (sem emissive, compartilhados): ficam de fora do flash de dano
      if (child.isMesh && child.material && child.material.emissive) {
        if (!child._origMaterial) {
          child.material = child.material.clone();
          child._origMaterial = true;
        }
        this.flashMaterials.push(child.material);
      }
    });
    this._flashTimer = 0;
    this._hitHop = 0;
    this._tremorTimer = 0;
    this._knockX = 0;
    this._knockZ = 0;
    this._knockPower = 0;
    this._inGrid = false;
    this.hitRadius = 0.65;

    this.root.visible = false;
    if (scene) scene.add(root);
  }

  endAlert() {
    if (this.userData.state === "ATTACKING") {
      this.userData.state = "CAMPING";
      this.setSeatedPose(true);
    }
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.0, 0);
  }

  setSeatedPose(isSeated) {
    this.isSeated = Boolean(isSeated);
    if (this.isSeated) {
      this.model.position.y = -0.42;
      if (this.robe) this.robe.scale.set(1.22, 0.78, 1.22);
      if (this.head) this.head.position.y = -0.2; // a cabeça acompanha o manto que encolhe ao sentar
      if (this.armL) { this.armL.position.y = 1.25; this.armL.rotation.set(-0.62, 0, 0.12); }
      if (this.armR) { this.armR.position.y = 1.25; this.armR.rotation.set(-0.3, 0, 0.1); }
      if (this.torchGroup) this.torchGroup.position.set(-0.33, 1.08, 0.56);
    } else {
      this.model.position.y = 0;
      if (this.robe) this.robe.scale.set(1, 1, 1);
      if (this.head) this.head.position.y = 0;
      if (this.armL) { this.armL.position.y = 1.45; this.armL.rotation.set(0, 0, -0.1); }
      if (this.armR) { this.armR.position.y = 1.45; this.armR.rotation.set(0, 0, 0.1); }
      if (this.torchGroup) this.torchGroup.position.set(-0.37, 0.98, 0.28);
    }
  }

  // Vida barata: respiração, barra do manto balançando devagar e a chama da tocha dançando (só senos, sem alocação)
  _animateServant() {
    const t = this.floatPhase;
    if (this.robe) {
      const breathe = Math.sin(t * 0.6);
      if (!this.isSeated) this.robe.scale.set(1 + breathe * 0.008, 1 + breathe * 0.014, 1 + breathe * 0.008);
      this.robe.rotation.z = Math.sin(t * 0.45) * 0.014;
      this.robe.rotation.x = Math.sin(t * 0.37 + 1.3) * 0.01;
    }
    const fo = this.flameOuter;
    if (fo) {
      const a = Math.sin(t * 5.3);
      const b = Math.sin(t * 3.7 + 1.0);
      const c = Math.sin(t * 9.1);
      fo.scale.set(1 + a * 0.12, 1 + b * 0.25 + c * 0.08, 1 + a * 0.12);
      fo.rotation.y = t * 1.2;
      const fi = this.flameInner;
      fi.scale.set(1 - a * 0.1, 0.9 + c * 0.2 + b * 0.1, 1 - a * 0.1);
      fi.rotation.y = -t * 1.6;
    }
  }

  spawnAtCamp(anchorPos, seatIndex = 0, totalSeats = 3) {
    this.alive = true;
    this.health = this.maxHealth;
    const angle = (seatIndex / Math.max(1, totalSeats)) * Math.PI * 2 + 0.4;
    this.x = anchorPos.x + Math.cos(angle) * 2.3;
    this.z = anchorPos.z + Math.sin(angle) * 2.3;
    this.userData.anchor.copy(anchorPos);
    this.userData.state = "CAMPING";
    this.userData.nextActionTime = performance.now() + 8000;
    this.userData.isDead = false;

    // Encarando a fogueira no centro do altar
    const targetYaw = Math.atan2(anchorPos.x - this.x, anchorPos.z - this.z);
    this.model.rotation.y = targetYaw;

    const y = this.world ? this.world.heightAt(this.x, this.z) : anchorPos.y;
    this.root.position.set(this.x, y, this.z);
    this.setSeatedPose(true);
    this.root.visible = true;

    this.npcs = this.combat?.npcs || window.__game?.npcs || null;
    if (this.npcs?.spatialGrid) {
      if (this._inGrid) this.npcs.spatialGrid.remove(this);
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
    }
    if (this.npcs?.npcs && !this.npcs.npcs.includes(this)) {
      this.npcs.npcs.push(this);
    }

    if (this.effects) {
      this.effects.play("dust", this.x, y + 0.35, this.z, "#1c1b22", 1.2);
    }
  }

  spawnAt(anchorPos) {
    this.alive = true;
    this.health = this.maxHealth;
    this.x = anchorPos.x + 3;
    this.z = anchorPos.z + 3;
    this.userData.anchor.copy(anchorPos);
    this.userData.state = "PATROL";
    this.userData.nextActionTime = performance.now() + 8000 + Math.random() * 8000;
    this.userData.isDead = false;

    const y = this.world ? this.world.heightAt(this.x, this.z) : anchorPos.y;
    this.root.position.set(this.x, y, this.z);
    this.setSeatedPose(false);
    this.root.visible = true;

    this.npcs = this.combat?.npcs || window.__game?.npcs || null;
    if (this.npcs?.spatialGrid) {
      if (this._inGrid) this.npcs.spatialGrid.remove(this);
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
    }
    if (this.npcs?.npcs && !this.npcs.npcs.includes(this)) {
      this.npcs.npcs.push(this);
    }

    if (this.effects) {
      this.effects.play("dust", this.x, y + 0.8, this.z, "#1c1b22", 1.8);
    }
  }

  takeHit(amount, dirX, dirZ, force = 1.8, launch = 0) {
    if (!this.alive || !this.root.visible) return false;
    this.health -= amount;
    this._flashTimer = 0.24;
    this._hitHop = 0.45;
    this._tremorTimer = 0.28;
    this._knockX = dirX || 0;
    this._knockZ = dirZ || 0;
    this._knockPower = Math.max(force * 2.8, 6.0);

    if (this.effects) {
      this.effects.play("dust", this.x, this.root.position.y + 1.1, this.z, "#111116", 2.2);
      this.effects.play("star", this.x, this.root.position.y + 1.3, this.z, "#8844cc", 1.5);
    }

    if (this.health <= 0) {
      this.vanish(true);
      return true;
    }

    // Se alvejado, passa ao ataque frontal imediato
    this.userData.state = "ATTACKING";
    this.setSeatedPose(false);
    return false;
  }

  vanish(dropRelic = false) {
    if (!this.root.visible) return;
    this.alive = false;
    this.root.visible = false;
    this.userData.state = "DESPAWNED";
    this.userData.isDead = true;

    if (this.npcs?.spatialGrid && this._inGrid) {
      this.npcs.spatialGrid.remove(this);
      this._inGrid = false;
    }

    if (this.effects) {
      this.effects.play("dust", this.x, this.root.position.y + 0.9, this.z, "#14141a", 2.8);
      this.effects.play("dust", this.x, this.root.position.y + 1.6, this.z, "#221a2c", 2.2);
      this.effects.play("star", this.x, this.root.position.y + 1.2, this.z, "#8844cc", 2.0);
    }

    if (dropRelic) {
      spawnLoot(this.root.position, 45);
      // Chance alta de dropar a Roupa/Manto do Demiurgo ao derrotar cultistas
      import("./rpg.js").then(({ unlockDemiurgeAttire }) => {
        unlockDemiurgeAttire();
      }).catch(() => {});
    }
  }

  update(dt, player, npcs, firePool, time = performance.now()) {
    if (!this.alive || !this.root.visible) return;

    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const isWhite = this._flashTimer > 0.12;
      const c = this._flashTimer > 0 ? (isWhite ? _WHITE_FLASH : _RED_FLASH) : _ZERO_FLASH;
      const intensity = this._flashTimer > 0 ? (isWhite ? 1.0 : 0.85) : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.copy(c);
        this.flashMaterials[i].emissiveIntensity = intensity;
      }
    }

    if (this._knockPower > 0) {
      const step = this._knockPower * dt;
      const nx = this.x + this._knockX * step;
      const nz = this.z + this._knockZ * step;
      if (!this.world || !this.world.isBlockedAt(nx, nz, 0.35)) {
        this.x = nx;
        this.z = nz;
      }
      this._knockPower = Math.max(0, this._knockPower - dt * 18);
    }

    let hopY = 0;
    if (this._hitHop > 0) {
      this._hitHop = Math.max(0, this._hitHop - dt * 3.2);
      hopY = this._hitHop * 1.8;
    }
    let tremX = 0;
    let tremZ = 0;
    if (this._tremorTimer > 0) {
      this._tremorTimer = Math.max(0, this._tremorTimer - dt);
      const trem = (this._tremorTimer / 0.28) * 0.18;
      tremX = (Math.random() - 0.5) * trem;
      tremZ = (Math.random() - 0.5) * trem;
    }
    this.model.position.x = tremX;
    this.model.position.z = tremZ;
    this.model.position.y = (this.isSeated ? -0.42 : 0) + hopY;

    // Atualiza Spatial Grid
    if (this.npcs?.spatialGrid) {
      if (!this._inGrid) {
        this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
        this._spatialCX = Math.floor(this.x * 0.0625);
        this._spatialCZ = Math.floor(this.z * 0.0625);
        this._inGrid = true;
      } else {
        const curCX = Math.floor(this.x * 0.0625);
        const curCZ = Math.floor(this.z * 0.0625);
        if (curCX !== this._spatialCX || curCZ !== this._spatialCZ) {
          this.npcs.spatialGrid.remove(this);
          this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
          this._spatialCX = curCX;
          this._spatialCZ = curCZ;
        }
      }
    }

    this.floatPhase += dt * 3.2;
    this._animateServant();
    const px = player?.x ?? player?.position?.x ?? 0;
    const pz = player?.z ?? player?.position?.z ?? 0;

    const toPlayerX = px - this.x;
    const toPlayerZ = pz - this.z;
    const distToPlayerSq = toPlayerX * toPlayerX + toPlayerZ * toPlayerZ;
    const distToPlayer = Math.sqrt(distToPlayerSq);

    // 1. Deteção & Reação ao Jogador:
    // Ao chegar perto (<= 16m), os servos do Demiurgo sentados ao redor da fogueira se levantam e FOGEM nas sombras!
    if (distToPlayer <= 16 && this.userData.state === "CAMPING") {
      this.userData.state = "FLEEING";
      this.userData.fleeTimer = 5.5;
      this.setSeatedPose(false);
      this.task = "Fugindo nas sombras do Demiurgo";
      if (this.effects) {
        this.effects.play("dust", this.x, this.root.position.y + 0.5, this.z, "#1e1d24", 1.8);
        this.effects.play("star", this.x, this.root.position.y + 1.1, this.z, "#a822ee", 1.8);
      }
    } else if (distToPlayer > 36 && this.userData.state === "ATTACKING") {
      // Retorna para o acampamento se o jogador fugir para muito longe
      this.userData.state = "CAMPING";
      this.setSeatedPose(true);
      return;
    }

    if (this.userData.state === "CAMPING") {
      // Permanece sentado ao redor da fogueira com a tocha vermelha ardendo
      if (this.torchLight) {
        this.torchLight.intensity = 1.3 + Math.sin(time * 0.008 + this.floatPhase) * 0.35;
      }
      return;
    }

    if (this.userData.state === "FLEEING") {
      this.setSeatedPose(false);
      const d = Math.max(0.001, distToPlayer);
      const cultSpeed = (CULTIST_SPEED + 2.2) * (CultState.speedMultiplier || 1.0);

      // Corre na direção oposta ao jogador
      this.x -= (toPlayerX / d) * (cultSpeed * dt);
      this.z -= (toPlayerZ / d) * (cultSpeed * dt);

      // Encarar a direção da fuga
      const fleeYaw = Math.atan2(-toPlayerX, -toPlayerZ);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, fleeYaw, 0.2);

      const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
      this.root.position.set(this.x, groundY + 0.05 + Math.sin(this.floatPhase) * 0.04, this.z);

      this.userData.fleeTimer = (this.userData.fleeTimer || 5.5) - dt;
      if (this.userData.fleeTimer <= 0 || distToPlayer > 32) {
        // Desaparece na escuridão
        this.vanish(false);
      }
      return;
    }

    const hasCultRobe = Boolean(PlayerInventory.hasDemiurgeRobe || PlayerStats.wearingDemiurgeRobe);
    if (this.userData.state === "ATTACKING" && hasCultRobe) {
      this.userData.state = "REVERING";
    }

    if (this.userData.state === "REVERING") {
      const targetYaw = Math.atan2(toPlayerX, toPlayerZ);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, targetYaw, 0.1);
      if (this.armR) this.armR.rotation.x = -0.4;
      if (this.armL) this.armL.rotation.x = -0.4;
      return;
    }

    if (this.userData.state === "ATTACKING") {
      this.setSeatedPose(false);
      const d = Math.max(0.001, distToPlayer);

      // Encarar o jogador
      const targetYaw = Math.atan2(toPlayerX, toPlayerZ);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, targetYaw, 0.15);

      // Ataque à distância: Conjura centelhas místicas do vazio (entre 3.5m e 16m)
      this._spellTimer = (this._spellTimer || 0) + dt;
      if (d >= 3.5 && d <= 16 && this._spellTimer > 2.6) {
        this._spellTimer = 0;
        if (this.effects) {
          this.effects.play("star", this.x + Math.sin(targetYaw) * 0.8, this.root.position.y + 1.4, this.z + Math.cos(targetYaw) * 0.8, "#a822ee", 1.5);
          this.effects.play("star", px, (player?.root?.position?.y ?? 0) + 1.2, pz, "#ff2233", 1.2);
        }
        if (this.combat?.hurtPlayer && Math.random() < 0.65) {
          this.combat.hurtPlayer(1 + (CultState.damageBonus || 0), this.x, this.z, { weapon: "cult_magic", knock: 2.0 });
        }
      }

      // Ataque corpo a corpo: Golpe com a Adaga Sacrificial quando <= 2.2m
      this._attackTimer = (this._attackTimer || 0) + dt;
      if (d <= 2.2 && this._attackTimer > 1.1) {
        this._attackTimer = 0;
        if (this.armR) this.armR.rotation.x = -2.2;
        if (this.combat?.hurtPlayer) {
          this.combat.hurtPlayer(2 + (CultState.damageBonus || 0), this.x, this.z, { weapon: "dagger", knock: 3.2 });
        }
        if (this.effects) {
          this.effects.play("glint", px, (player?.root?.position?.y ?? 0) + 1.2, pz, "#ff2211", 1.2);
        }
      } else if (this.armR && this.armR.rotation.x < -0.3) {
        this.armR.rotation.x += dt * 5.0;
      }

      // Perseguição do jogador
      if (d > 2.0) {
        const cultSpeed = (CULTIST_SPEED + 1.5) * (CultState.speedMultiplier || 1.0);
        this.x += (toPlayerX / d) * (cultSpeed * dt);
        this.z += (toPlayerZ / d) * (cultSpeed * dt);
      }

      const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
      this.root.position.set(this.x, groundY + 0.05 + Math.sin(this.floatPhase) * 0.04, this.z);
      return;
    }

    // 2. Caos Discreto e Sabotagem (cooldown de ações)
    if (time > this.userData.nextActionTime) {
      this.userData.nextActionTime = time + 11000 + Math.random() * 9000;
      const actionRoll = Math.random();

      if (actionRoll < 0.35) {
        // Ateia fogo ao próprio redor (solo mágico / árvores)
        igniteTarget(this.root, { x: this.x, y: this.root.position.y + 0.4, z: this.z }, firePool, time);
      } else if (actionRoll < 0.75 && Array.isArray(npcs)) {
        // Abate silencioso de NPC desgarrado fora da cidade
        for (let i = 0; i < npcs.length; i++) {
          const victim = npcs[i];
          if (!victim || !victim.alive || victim.userData?.type === "CULTIST" || victim.roleKey === "werewolf" || victim.roleKey === "guard") {
            continue;
          }
          const vdx = this.x - victim.x;
          const vdz = this.z - victim.z;
          if (vdx * vdx + vdz * vdz < 100) {
            // Morte limpa e instantânea sem alertar guardas
            victim.alive = false;
            victim.userData = victim.userData || {};
            victim.userData.isDead = true;
            victim.task = "Abatido em sacrifício silencioso";
            if (this.effects) {
              this.effects.play("dust", victim.x, victim.root.position.y + 0.8, victim.z, "#1c1b22", 1.8);
            }
            break;
          }
        }
      }
    }

    // 3. Patrulha espectral em círculos ao redor do seu altar (âncora)
    const anchor = this.userData.anchor;
    const patrolAngle = time * 0.00045;
    const targetX = anchor.x + Math.cos(patrolAngle) * 11;
    const targetZ = anchor.z + Math.sin(patrolAngle) * 11;

    _targetDir.set(targetX - this.x, 0, targetZ - this.z);
    const tDist = _targetDir.length();
    if (tDist > 0.1) {
      _targetDir.normalize();
      const currentSpeed = CULTIST_SPEED * (CultState.speedMultiplier || 1.0);
      this.x += _targetDir.x * (currentSpeed * dt);
      this.z += _targetDir.z * (currentSpeed * dt);

      const targetYaw = Math.atan2(_targetDir.x, _targetDir.z);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, targetYaw, 0.06);
    }

    const groundY = this.world ? this.world.heightAt(this.x, this.z) : anchor.y;
    this.root.position.set(this.x, groundY + 0.05 + Math.sin(this.floatPhase) * 0.035, this.z);
  }
}

// ============================================================================
// 4.5 Modelo Anatômico 3D e Classe do Líder da Seita Cátara (Morvath)
// ============================================================================
let _leaderHaloMat = null;
function _leaderHalo() {
  if (!_leaderHaloMat) {
    _leaderHaloMat = _servantHalo().clone();
    _leaderHaloMat.color.setHex(0xff5070); // multiplica o halo roxo: halo vermelho para o Grão-Mestre
  }
  return _leaderHaloMat;
}
const _leaderEyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });

export function buildCultLeaderMesh() {
  const root = new THREE.Group();
  root.name = "CultLeaderRoot";

  const model = new THREE.Group();
  model.name = "CultLeaderModel";
  model.scale.set(1.22, 1.22, 1.22);
  model.rotation.x = 0.06;
  root.add(model);
  const mat = getSmoothDetailMaterial();

  // Manto sacerdotal imponente: torno redondo, ombros em manto largo, barra dourada e esfarrapada, estola larga,
  // emblema do Olho no peito e corcunda. Tudo fundido por cor de vértice em UM mesh.
  const hem = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.2;
    hem.push({ t: "cone", a: [0.085, 0.3, 4], p: [Math.cos(ang) * 0.58, 0.1, Math.sin(ang) * 0.58], r: [Math.PI, ang, 0], c: SV.robeDark, ao: 0.7 });
  }
  const robeGeo = _pivotGeometry([
    { t: "lat", a: [[[0.6, 0.02], [0.56, 0.3], [0.45, 0.78], [0.34, 1.18], [0.44, 1.46], [0.31, 1.64], [0.14, 1.72]], 10], c: SV.robe, ao: 0.5 },
    ...hem,
    { t: "tor", a: [0.585, 0.03, 3, 12], p: [0, 0.07, 0], r: [Math.PI / 2, 0, 0], c: SV.gold, ao: 0.9 },
    { t: "cap", a: [0.075, 1.0, 2, 6], p: [0, 0.86, 0.43], r: [-0.1, 0, 0], s: [1, 1, 0.42], c: SV.crimson, ao: 0.7 },
    { t: "sph", a: [0.062, 6, 4], p: [0, 1.5, 0.36], c: SV.gold, ao: 0.9 },
    { t: "sph", a: [0.085, 6, 4], p: [0, 1.1, 0.455], s: [1.3, 0.65, 0.3], c: SV.gold, ao: 0.9 },
    { t: "sph", a: [0.03, 4, 3], p: [0, 1.1, 0.475], s: [1, 1, 0.5], c: 0x8a0f1c, ao: 1 },
    { t: "tor", a: [0.4, 0.022, 3, 10], p: [0, 0.9, 0], r: [Math.PI / 2, 0, 0], c: SV.goldDark, ao: 0.9 },
    { t: "cone", a: [0.034, 0.2, 4], p: [-0.14, 0.76, 0.43], r: [Math.PI, 0, 0], c: SV.bone, ao: 0.9 },
    { t: "cone", a: [0.034, 0.2, 4], p: [0.16, 0.76, 0.43], r: [Math.PI, 0, 0], c: SV.bone, ao: 0.9 },
    { t: "sph", a: [0.26, 7, 4], p: [0, 1.5, -0.16], s: [1.15, 0.8, 0.9], c: SV.robeLite, ao: 0.6 },
  ], -0.85);
  const robe = new THREE.Mesh(robeGeo, mat);
  robe.name = "CultLeaderRobe";
  robe.position.set(0, 0.85, 0);
  robe.castShadow = true;
  model.add(robe);

  // Cabeça: capuz alto com aro, chifres curvos de ébano com pontas de ouro, máscara rachada, testeira dourada
  const horns = [];
  for (const side of [-1, 1]) {
    horns.push({ t: "cone", a: [0.05, 0.34, 5], p: [side * 0.2, 2.0, 0.0], r: [-0.2, 0, side * 0.9], c: 0x1a1210, ao: 0.6 });
    horns.push({ t: "cone", a: [0.032, 0.28, 4], p: [side * 0.36, 2.2, -0.05], r: [-0.25, 0, side * 1.45], c: 0x1a1210, ao: 0.6 });
    horns.push({ t: "sph", a: [0.03, 4, 3], p: [side * 0.5, 2.28, -0.08], c: SV.gold, ao: 0.9 });
  }
  const headGeo = makeMergedGeometry([
    { t: "sph", a: [0.225, 8, 5], p: [0, 1.9, -0.01], s: [0.95, 1.4, 1.1], c: SV.robe, ao: 0.55 },
    { t: "cone", a: [0.14, 0.42, 5], p: [0, 2.2, -0.12], r: [-0.5, 0, 0], c: SV.robe, ao: 0.6 },
    { t: "tor", a: [0.165, 0.045, 3, 8], p: [0, 1.82, 0.12], r: [-0.1, 0, 0], s: [1, 1.15, 1], c: SV.robeLite, ao: 0.8 },
    { t: "sph", a: [0.14, 7, 4], p: [0, 1.8, 0.13], s: [0.85, 1.2, 0.5], c: SV.mask, ao: 0.75 },
    { t: "box", a: [0.245, 0.034, 0.05], p: [0, 1.92, 0.17], r: [0.15, 0, 0], c: SV.gold, ao: 0.9 },
    { t: "box", a: [0.012, 0.16, 0.02], p: [0.03, 1.83, 0.192], r: [0, 0, 0.35], c: SV.crack, ao: 1 },
    { t: "box", a: [0.01, 0.1, 0.02], p: [-0.05, 1.72, 0.19], r: [0, 0, -0.5], c: SV.crack, ao: 1 },
    { t: "sph", a: [0.032, 5, 3], p: [-0.058, 1.82, 0.182], s: [1.5, 0.8, 0.5], c: SV.dark, ao: 1 },
    { t: "sph", a: [0.032, 5, 3], p: [0.058, 1.82, 0.182], s: [1.5, 0.8, 0.5], c: SV.dark, ao: 1 },
    { t: "box", a: [0.08, 0.012, 0.02], p: [0, 1.7, 0.19], c: SV.dark, ao: 1 },
    ...horns,
  ]);
  const head = new THREE.Mesh(headGeo, mat);
  head.name = "CultLeaderHead";
  model.add(head);

  const eyes = new THREE.Mesh(makeMergedGeometry([
    { t: "sph", a: [0.018, 5, 3], p: [-0.058, 1.82, 0.2], c: 0xffffff, ao: 1 },
    { t: "sph", a: [0.018, 5, 3], p: [0.058, 1.82, 0.2], c: 0xffffff, ao: 1 },
  ]), _leaderEyeMat);
  eyes.name = "CultLeaderEyes";
  model.add(eyes);
  const halo = new THREE.Sprite(_leaderHalo());
  halo.scale.set(0.42, 0.2, 1);
  halo.position.set(0, 1.82, 0.22);
  model.add(halo);

  // Braços longos com pivô no ombro, mãos grandes e braçadeiras de ouro
  const armDefs = (extra = []) => [
    { t: "cap", a: [0.066, 0.6, 1, 5], p: [0, -0.33, 0.13], r: [0.4, 0, 0], c: SV.robe, ao: 0.6 },
    { t: "tor", a: [0.062, 0.016, 3, 7], p: [0, -0.62, 0.24], r: [0.4 + Math.PI / 2, 0, 0], c: SV.gold, ao: 0.9 },
    { t: "sph", a: [0.085, 5, 4], p: [0, -0.73, 0.31], s: [1, 1.35, 1], c: SV.robeLite, ao: 0.8 },
    ...extra,
  ];
  const armL = new THREE.Mesh(makeMergedGeometry(armDefs()), mat);
  armL.name = "CultLeaderArmL";
  armL.position.set(-0.36, 1.52, 0);
  armL.rotation.z = -0.1;
  model.add(armL);

  const armR = new THREE.Mesh(makeMergedGeometry(armDefs([
    { t: "cyl", a: [0.02, 0.02, 0.15, 5], p: [0, -0.77, 0.31], c: SV.blade, ao: 0.9 },
    { t: "box", a: [0.12, 0.03, 0.04], p: [0, -0.85, 0.31], c: SV.gold, ao: 0.9 },
    { t: "cone", a: [0.045, 0.38, 4], p: [0, -1.06, 0.31], r: [Math.PI, 0, 0], c: SV.blade, ao: 0.9 },
  ])), mat);
  armR.name = "CultLeaderArmR";
  armR.position.set(0.36, 1.52, 0);
  armR.rotation.z = 0.1;
  model.add(armR);

  // Cajado do Demiurgo na mão esquerda: haste, serpente de ouro e a gema de ametista (o "olho") que gira devagar
  const staffGroup = new THREE.Group();
  staffGroup.name = "DemiurgeStaff";
  staffGroup.position.set(-0.43, 0.9, 0.31);
  const staffBody = new THREE.Mesh(makeMergedGeometry([
    { t: "cyl", a: [0.022, 0.03, 2.35, 7], p: [0, 0.15, 0], c: SV.robe, ao: 0.8 },
    { t: "tor", a: [0.09, 0.025, 3, 12, Math.PI * 1.8], p: [0, 1.25, 0], r: [Math.PI / 2, 0, 0], c: SV.gold, ao: 0.9 },
    { t: "tor", a: [0.17, 0.02, 3, 12], p: [0, 1.35, 0], r: [0, 0, 0], c: SV.gold, ao: 0.9 },
  ]), mat);
  staffGroup.add(staffBody);

  const staffGem = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), _amethystMat);
  staffGem.position.set(0, 1.35, 0);
  staffGroup.add(staffGem);

  const staffLight = new THREE.PointLight(0xaa22ff, 4.5, 18, 1.8);
  staffLight.position.set(0, 1.45, 0);
  staffGroup.add(staffLight);
  model.add(staffGroup);

  root.visible = false;
  const _leaderParts = { root, model, robe, head, armL, armR, staffGroup, staffGem, staffLight, eyeLight: null };
  finalizeMonster(root, _leaderParts);
  return _leaderParts;
}

export class CultLeader {
  constructor(scene, world, effects, combat, player, npcs = null) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = combat;
    this.player = player;
    this.npcs = npcs || window.__game?.npcs || null;
    this._inGrid = false;

    const { root, model, robe, armL, armR, staffGroup, staffGem, staffLight, eyeLight } = buildCultLeaderMesh();
    this.root = root;
    this.model = model;
    this.robe = robe;
    this.armL = armL;
    this.armR = armR;
    this.staffGroup = staffGroup;
    this.staffGem = staffGem;
    this.staffLight = staffLight;
    this.eyeLight = eyeLight;

    this.roleKey = "cult_leader";
    this.name = "Morvath, o Perfeito";
    this.title = "Grão-Mestre da Ordem do Demiurgo";
    this.task = "Contemplando a ilusão da carne e o Apocalipse de Rex Mundi";
    this.portrait = CULT_LEADER_PORTRAIT;

    this.alive = true;
    this.temporary = false; // FÍSICO! Não some quando o jogador se aproxima!
    this.hostile = false; // Permite diálogo pacífico/filosófico
    this.health = 80;
    this.maxHealth = 80;
    this.hitRadius = 1.35;
    this.x = 9999;
    this.z = 9999;
    this._spellTimer = 0;
    this.userData = {
      type: "CULT_LEADER",
      isDead: false,
    };

    this.flashMaterials = [];
    this.model.traverse((child) => {
      if (child.isMesh && child.material && child.material.emissive) {
        if (!child._origMaterial) {
          child.material = child.material.clone();
          child._origMaterial = true;
        }
        this.flashMaterials.push(child.material);
      }
    });
    this._flashTimer = 0;
    this._hitHop = 0;
    this._tremorTimer = 0;
    this._knockX = 0;
    this._knockZ = 0;
    this._knockPower = 0;

    if (scene) scene.add(root);
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.2);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 1.2, launch = 0) {
    if (!this.alive) return false;
    this.health -= amount;
    this.hostile = true; // Se for atacado, passa a lutar
    this._flashTimer = 0.24;
    this._hitHop = 0.45;
    this._tremorTimer = 0.28;
    this._knockX = dirX || 0;
    this._knockZ = dirZ || 0;
    this._knockPower = Math.max(force * 2.0, 4.5);

    if (this.effects) {
      this.effects.play("dust", this.x, this.root.position.y + 1.2, this.z, "#1c1722", 2.0);
      this.effects.play("star", this.x, this.root.position.y + 1.5, this.z, "#aa22ff", 2.2);
      this.effects.play("slash", this.x, this.root.position.y + 1.3, this.z, "#ff2233", 1.8);
    }

    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.alive = false;
    this.hostile = false;
    this.userData.isDead = true;
    this.task = "Colapsado no abraço silencioso do Pleroma";

    if (this.npcs?.spatialGrid && this._inGrid) {
      this.npcs.spatialGrid.remove(this);
      this._inGrid = false;
    }

    // 1. Remove qualquer waypoint de missão ativo
    import("./rpg.js").then(({ removeWaypointMarker }) => {
      removeWaypointMarker();
    }).catch(() => {});

    // 2. MATA-LO IMPEDE A CHEGADA DO DEMIURGO!
    import("./decay.js").then(({ WorldDecay, DemiurgeCataclysm }) => {
      if (WorldDecay) {
        WorldDecay.demiurgePrevented = true;
        WorldDecay.decayLevel = Math.max(0, (WorldDecay.decayLevel || 0) - 0.75);
        if (WorldDecay.isEclipse) {
          WorldDecay.isEclipse = false;
        }
      }
      if (DemiurgeCataclysm) {
        DemiurgeCataclysm.active = false;
      }
    }).catch(() => {});

    if (this.effects) {
      this.effects.play("dust", this.x, this.root.position.y + 1.0, this.z, "#0a0610", 5.5);
      this.effects.play("star", this.x, this.root.position.y + 1.8, this.z, "#bb22ff", 4.5);
      this.effects.play("star", this.x, this.root.position.y + 1.2, this.z, "#ffea00", 4.0);
    }

    // Saque Roubado Lendário: 150 moedas, 4 cristais raros e Túnica do Demiurgo
    spawnLoot(this.root.position, 150);
    PlayerInventory.crystals = PlayerInventory.crystals || {};
    PlayerInventory.crystals.purple = (PlayerInventory.crystals.purple || 0) + 2;
    PlayerInventory.crystals.white = (PlayerInventory.crystals.white || 0) + 1;
    PlayerInventory.crystals.red = (PlayerInventory.crystals.red || 0) + 1;

    import("./rpg.js").then(({ unlockDemiurgeAttire, addGood }) => {
      unlockDemiurgeAttire();
      addGood(15, "Morvath, o Grão-Mestre Cátaro, foi derrotado em combate");
    }).catch(() => {});

    window.__game?.ui?.showToast?.("⚔️ VITÓRIA: O Grão-Mestre Morvath foi derrotado! O ritual herético foi quebrado e a vinda do Demiurgo foi IMPEDIDA!", 9500);
    window.__game?.audio?.bell?.();

    // Animação solene de colapso
    this.model.rotation.x = -Math.PI / 2.2;
    this.model.position.y = -0.45;
  }

  spawnAt(x, z) {
    this.alive = true;
    this.health = this.maxHealth;
    this.hostile = false;
    this.x = x;
    this.z = z;
    this.model.rotation.x = 0;
    this.model.position.y = 0;
    this.userData.isDead = false;

    this.npcs = this.npcs || window.__game?.npcs;
    if (this.npcs?.spatialGrid) {
      if (this._inGrid) this.npcs.spatialGrid.remove(this);
      this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
      this._spatialCX = Math.floor(this.x * 0.0625);
      this._spatialCZ = Math.floor(this.z * 0.0625);
      this._inGrid = true;
    }

    const groundY = this.world ? this.world.heightAt(x, z) : 0;
    this.root.position.set(x, groundY, z);
    this.root.visible = true;

    if (this.effects) {
      this.effects.play("dust", x, groundY + 1.0, z, "#1a0822", 3.5);
      this.effects.play("star", x, groundY + 1.6, z, "#aa22ff", 2.8);
    }
  }

  update(dt, player, isNight = true) {
    if (!this.root.visible) return;

    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const isWhite = this._flashTimer > 0.12;
      const c = this._flashTimer > 0 ? (isWhite ? _WHITE_FLASH : _RED_FLASH) : _ZERO_FLASH;
      const intensity = this._flashTimer > 0 ? (isWhite ? 1.0 : 0.85) : 0;
      for (let i = 0; i < this.flashMaterials.length; i++) {
        this.flashMaterials[i].emissive.copy(c);
        this.flashMaterials[i].emissiveIntensity = intensity;
      }
    }

    if (this._knockPower > 0) {
      const step = this._knockPower * dt;
      const nx = this.x + this._knockX * step;
      const nz = this.z + this._knockZ * step;
      if (!this.world || !this.world.isBlockedAt(nx, nz, 0.4)) {
        this.x = nx;
        this.z = nz;
      }
      this._knockPower = Math.max(0, this._knockPower - dt * 14);
    }

    let hopY = 0;
    if (this._hitHop > 0) {
      this._hitHop = Math.max(0, this._hitHop - dt * 3.2);
      hopY = this._hitHop * 1.8;
    }
    let tremX = 0;
    let tremZ = 0;
    if (this._tremorTimer > 0) {
      this._tremorTimer = Math.max(0, this._tremorTimer - dt);
      const trem = (this._tremorTimer / 0.28) * 0.18;
      tremX = (Math.random() - 0.5) * trem;
      tremZ = (Math.random() - 0.5) * trem;
    }
    this.model.position.x = tremX;
    this.model.position.z = tremZ;
    if (this.alive) {
      this.model.position.y = hopY;
    }

    // Atualização celular na Spatial Grid para garantir que armas e flechas acertem Morvath
    this.npcs = this.npcs || window.__game?.npcs;
    if (this.npcs?.spatialGrid) {
      if (!this._inGrid) {
        this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
        this._spatialCX = Math.floor(this.x * 0.0625);
        this._spatialCZ = Math.floor(this.z * 0.0625);
        this._inGrid = true;
      } else {
        const curCX = Math.floor(this.x * 0.0625);
        const curCZ = Math.floor(this.z * 0.0625);
        if (curCX !== this._spatialCX || curCZ !== this._spatialCZ) {
          this.npcs.spatialGrid.remove(this);
          this.npcs.spatialGrid.insertCircle(this, this.x, this.z, this.hitRadius);
          this._spatialCX = curCX;
          this._spatialCZ = curCZ;
        }
      }
    }

    const px = player?.x ?? player?.position?.x ?? 0;
    const pz = player?.z ?? player?.position?.z ?? 0;
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);

    if (this.staffLight) {
      this.staffLight.intensity = 3.6 + Math.sin(performance.now() * 0.005) * 1.2;
    }
    // vida barata: a gema gira devagar e a barra do manto balança
    if (this.staffGem) this.staffGem.rotation.y += dt * 0.9;
    if (this.robe) {
      const lt = performance.now() * 0.001;
      this.robe.rotation.z = Math.sin(lt * 0.7) * 0.012;
      this.robe.scale.y = 1 + Math.sin(lt * 1.1) * 0.01;
    }

    if (!this.alive) return;

    if (dist <= 20) {
      const targetYaw = Math.atan2(dx, dz);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, targetYaw, dt * 3.5);
    }

    if (this.hostile) {
      this._spellTimer = (this._spellTimer || 0) + dt;
      if (dist <= 18 && this._spellTimer > 2.0) {
        this._spellTimer = 0;
        if (this.effects) {
          this.effects.play("star", this.x, this.root.position.y + 1.8, this.z, "#aa22ff", 2.2);
          this.effects.play("star", px, (player?.root?.position?.y || 0) + 1.2, pz, "#ff2233", 1.8);
        }
        if (this.combat?.hurtPlayer) {
          this.combat.hurtPlayer(3.5, this.x, this.z, { weapon: "demiurge_wrath", knock: 3.5 });
        }
      }
      if (dist > 3.0) {
        this.x += (dx / dist) * (2.2 * dt);
        this.z += (dz / dist) * (2.2 * dt);
      }
    }

    const groundY = this.world ? this.world.heightAt(this.x, this.z) : 0;
    this.root.position.set(this.x, groundY, this.z);
  }
}

export let ACTIVE_CULT_LEADER = null;
let _cachedHugeCamp = null;

export function summonCultLeader(player, scene, world, effects, combat) {
  const p = player || window.__game?.player;
  const sc = scene || window.__game?.scene;
  const w = world || window.__game?.world;
  const eff = effects || window.__game?.effects;
  const cmb = combat || window.__game?.combat;

  if (!p || !sc) return null;
  const px = p.x ?? p.position?.x ?? 0;
  const pz = p.z ?? p.position?.z ?? 0;

  if (!ACTIVE_CULT_LEADER) {
    ACTIVE_CULT_LEADER = new CultLeader(sc, w, eff, cmb, p, window.__game?.npcs);
    if (window.__game?.npcs?.npcs && !window.__game.npcs.npcs.includes(ACTIVE_CULT_LEADER)) {
      window.__game.npcs.npcs.push(ACTIVE_CULT_LEADER);
    }
  }

  const angle = p.heading || (p.model ? p.model.rotation.y : 0);
  const sx = px + Math.sin(angle) * 3.5;
  const sz = pz + Math.cos(angle) * 3.5;

  ACTIVE_CULT_LEADER.spawnAt(sx, sz);
  return ACTIVE_CULT_LEADER;
}

// ============================================================================
// 5. Pool e Gerenciador de Cultistas (Noite e Névoa fora dos muros)
// ============================================================================
export function createCultistsPool(scene, world, effects, combat, count = 16) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    const c = new Cultist(scene, world, effects, combat);
    pool.push(c);
  }
  return pool;
}

let _cultistCheckTimer = 0;

let _lastCycleIsNight = false;
let _morvathInvasionAlertDone = false;

/**
 * Atualiza o ciclo de vida dos Cultistas do Demiurgo fora dos muros.
 * Os acampamentos e cultistas SÓ aparecem à noite, nunca de dia.
 */
export function updateCultistsLifeCycle(cultistsPool, player, npcs, firePool, dt, isNight, cityData) {
  if (!Array.isArray(cultistsPool) || !player) return;

  const isNightBool = Boolean(isNight);

  const px = player.x ?? player.position?.x ?? 0;
  const pz = player.z ?? player.position?.z ?? 0;

  // 1. Visibilidade dos Acampamentos dos Servos dos Demiurgos: SÓ APARECEM À NOITE, NUNCA DE DIA!
  // Otimização Zero-GC: Apenas o acampamento onde o jogador está por perto (< 45m) acende a luz suave.
  for (let c = 0; c < CULT_CAMP_GROUPS.length; c++) {
    const camp = CULT_CAMP_GROUPS[c];
    if (!camp) continue;
    // só desenha o acampamento à noite e quando está ao alcance da névoa (nem entra no render quando longe)
    const cdx0 = camp.position.x - px;
    const cdz0 = camp.position.z - pz;
    const cd0 = cdx0 * cdx0 + cdz0 * cdz0;
    const wantVisible = isNightBool && cd0 < 260 * 260;
    if (camp.visible !== wantVisible) {
      camp.visible = wantVisible;
    }
    // anima o fogo só quando o jogador está perto (< 60 m)
    if (wantVisible && cd0 < 60 * 60) {
      animateCampFx(camp, performance.now() * 0.001, dt);
    }
    const light = camp.userData.mainLight;
    if (light) {
      if (!isNightBool) {
        if (light.visible) light.visible = false;
      } else {
        const cdx = camp.position.x - px;
        const cdz = camp.position.z - pz;
        const isNear = cdx * cdx + cdz * cdz < 45 * 45;
        if (light.visible !== isNear) {
          light.visible = isNear;
          light.intensity = isNear ? (camp.userData.isHuge ? 6.5 : 4.5) : 0;
        }
      }
    }
  }

  // 2. Se for de dia, nenhum servo comum do demiurgo atua e os que estiverem ativos desvanecem imediatamente
  if (!isNightBool) {
    if (_lastCycleIsNight) {
      _lastCycleIsNight = false;
      _morvathInvasionAlertDone = false;
      if (ACTIVE_CULT_LEADER && ACTIVE_CULT_LEADER.root.visible) {
        ACTIVE_CULT_LEADER.root.visible = false;
        if (ACTIVE_CULT_LEADER.npcs?.spatialGrid && ACTIVE_CULT_LEADER._inGrid) {
          ACTIVE_CULT_LEADER.npcs.spatialGrid.remove(ACTIVE_CULT_LEADER);
          ACTIVE_CULT_LEADER._inGrid = false;
        }
        import("./rpg.js").then(({ removeWaypointMarker }) => {
          removeWaypointMarker();
        }).catch(() => {});
      }
    }
    for (let i = 0; i < cultistsPool.length; i++) {
      const c = cultistsPool[i];
      if (c.root.visible) {
        c.vanish(false);
      }
    }
    if (ACTIVE_CULT_LEADER && ACTIVE_CULT_LEADER.root.visible) {
      ACTIVE_CULT_LEADER.root.visible = false;
    }
    return;
  }

  if (!_lastCycleIsNight) {
    _lastCycleIsNight = true;
    _morvathInvasionAlertDone = false;
  }

  // 3. Spawna e comanda Morvath à noite: invasão aleatória nas vilas do Reino!
  const decayMod = window.__game?.WorldDecay;
  const isPrevented = Boolean(decayMod?.demiurgePrevented);

  if (!isPrevented) {
    if (!ACTIVE_CULT_LEADER && window.__game?.scene) {
      ACTIVE_CULT_LEADER = new CultLeader(
        window.__game.scene,
        window.__game.world,
        window.__game.effects,
        window.__game.combat,
        player,
        npcs
      );
      if (window.__game?.npcs?.npcs && !window.__game.npcs.npcs.includes(ACTIVE_CULT_LEADER)) {
        window.__game.npcs.npcs.push(ACTIVE_CULT_LEADER);
      }
    }

    if (ACTIVE_CULT_LEADER && ACTIVE_CULT_LEADER.alive && !_morvathInvasionAlertDone) {
      _morvathInvasionAlertDone = true;
      const targetVillages = Array.isArray(VILLAGES) && VILLAGES.length > 0 ? VILLAGES : [{ name: "Caldera", x: -2, z: -20 }];
      const chosen = targetVillages[Math.floor(Math.random() * targetVillages.length)];
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 8;
      const sx = chosen.x + Math.cos(angle) * dist;
      const sz = chosen.z + Math.sin(angle) * dist;

      ACTIVE_CULT_LEADER.spawnAt(sx, sz);

      import("./rpg.js").then(({ spawnWaypointMarker }) => {
        spawnWaypointMarker({ x: sx, z: sz });
      }).catch(() => {});

      if (window.__game?.ui?.showToast) {
        window.__game.ui.showToast(`🌑 ALERTA: Um mensageiro do acampamento avisa: 'O Grão-Mestre Morvath foi avistado nos arredores de ${chosen.name} esta noite! Abata-o antes que o ritual traga o Demiurgo!'`, 9500);
      }
      window.__game?.audio?.playWolfHowl?.(0.65, 45);
    }
  }

  if (ACTIVE_CULT_LEADER && ACTIVE_CULT_LEADER.root.visible) {
    ACTIVE_CULT_LEADER.update(dt, player, isNightBool);
  }

  const time = performance.now();

  // Avalia acampamentos fora das muralhas a cada 1.0 segundo (Zero-GC: contagem sem .filter)
  _cultistCheckTimer += dt;
  if (_cultistCheckTimer > 1.0) {
    _cultistCheckTimer = 0;

    for (let a = 0; a < CULT_ALTARS.length; a++) {
      const altar = CULT_ALTARS[a];
      const adx = altar.x - px;
      const adz = altar.z - pz;
      const aDistSq = adx * adx + adz * adz;

      // Ativa o acampamento herético apenas se o jogador estiver nos ermos a <= 55m do local
      if (aDistSq <= 3025) {
        let activeCount = 0;
        let available = null;
        for (let i = 0; i < cultistsPool.length; i++) {
          const c = cultistsPool[i];
          if (c.root.visible) {
            if (c.userData.anchor && c.userData.anchor.distanceToSquared(altar) < 36) {
              activeCount++;
            }
          } else if (!available) {
            available = c;
          }
        }
        const maxCultists = altar.cultistsCount || (altar.tier === "huge" ? 6 : altar.tier === "medium" ? 4 : 2);
        if (activeCount < maxCultists && available) {
          available.spawnAtCamp(altar, activeCount, maxCultists);
        }
      }
    }
  }

  // Atualiza a rotina individual de cada cultista ativo
  for (let i = 0; i < cultistsPool.length; i++) {
    const c = cultistsPool[i];
    if (c.root.visible) {
      c.update(dt, player, npcs, firePool, time);
    }
  }
}

/**
 * Checa se o jogador está perto de um Acampamento do Culto para investigar pistas com E.
 * SÓ PODE INVESTIGAR À NOITE QUANDO O ACAMPAMENTO ESTIVER PRESENTE.
 */
export function checkAltarInteraction(playerPos, isNight = true) {
  if (!playerPos || !isNight) return null;
  const px = playerPos.x ?? playerPos.position?.x ?? 0;
  const pz = playerPos.z ?? playerPos.position?.z ?? 0;

  for (let i = 0; i < CULT_ALTARS.length; i++) {
    const altar = CULT_ALTARS[i];
    const dx = altar.x - px;
    const dz = altar.z - pz;
    const radius = altar.radius || 6.5;
    if (dx * dx + dz * dz < radius * radius) {
      return altar;
    }
  }
  return null;
}
