import * as THREE from "three";
import { createSeededRandom } from "./procedural.js";
import { igniteTarget, spawnLoot, PlayerInventory, PlayerStats, syncPlayerStatsToPlayer } from "./rpg.js";

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
  const missingPages = [7, 11, 16, 19, 21].filter((p) => !PlayerInventory.discoveredBookPages.includes(p));
  if (!PlayerInventory.hasDemiurgeDiary) {
    PlayerInventory.hasDemiurgeDiary = true;
    ui?.showToast?.(`✦ Encontraste o Tractatus de Carcere esquecido junto ao altar herético! (+${goldGain} moedas · [L] para ler).`);
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
      ui?.showToast?.(`✦ Fragmento herético recuperado: ${pageTitle} anexada ao Tractatus de Carcere (+${goldGain} moedas)!`);
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
 */
export const CULT_CAMPS_PRESETS = [
  // 1. Grande Bastião de Rex Mundi (ENORME - Morada do Líder Cátaro)
  {
    tier: "huge",
    name: "Grande Bastião Cátaro de Rex Mundi",
    dx: 175,
    dz: 165,
    radius: 14.0,
    cultistsCount: 6,
    hasLeader: true,
    lorePrompt: "A fortaleza herética de Rex Mundi ergue-se com braseiros de chama púrpura e estacas afiadas. O Grão-Mestre Morvath aguarda perante o altar.",
  },
  // 2. Acampamentos Médios (3 unidades com paliçadas leves e altares rituais)
  {
    tier: "medium",
    name: "Santuário Oculto dos Montes Leste",
    dx: 180,
    dz: -85,
    radius: 9.0,
    cultistsCount: 4,
    hasLeader: false,
    lorePrompt: "Paliçada de estacas pontiagudas e tochas cerimoniais que cercam o altar da cinza nos montes.",
  },
  {
    tier: "medium",
    name: "Círculo dos Sacramentos do Sul",
    dx: -95,
    dz: 185,
    radius: 9.0,
    cultistsCount: 4,
    hasLeader: false,
    lorePrompt: "Quatro sentinelas com tochas rubras vigiam a encruzilhada do sul em torno da fogueira do vazio.",
  },
  {
    tier: "medium",
    name: "Acampamento das Sombras do Vale Oeste",
    dx: -190,
    dz: -75,
    radius: 9.0,
    cultistsCount: 4,
    hasLeader: false,
    lorePrompt: "Altar ritual cercado por ossadas e símbolos do Deus Cego talhados em troncos queimados.",
  },
  // 3. Acampamentos Pequenos (4 unidades em anéis mais próximos da muralha: 85m a 135m)
  {
    tier: "small",
    name: "Vigília Cátara do Ermo Norte",
    dx: 30,
    dz: -105,
    radius: 6.5,
    cultistsCount: 2,
    hasLeader: false,
    lorePrompt: "Duas sentinelas heréticas encapuzadas aquecem suas adagas na chama roxa.",
  },
  {
    tier: "small",
    name: "Posto Avançado da Clareira Noroeste",
    dx: -110,
    dz: -65,
    radius: 6.5,
    cultistsCount: 2,
    hasLeader: false,
    lorePrompt: "Pequeno acampamento de servos que observam os viajantes na calada da noite.",
  },
  {
    tier: "small",
    name: "Refúgio da Cinza Sudoeste",
    dx: -115,
    dz: 95,
    radius: 6.5,
    cultistsCount: 2,
    hasLeader: false,
    lorePrompt: "Fogueira mística oculta entre arbustos ressequidos nos limites do vale.",
  },
  {
    tier: "small",
    name: "Acampamento da Trilha Sudeste",
    dx: 95,
    dz: 85,
    radius: 6.5,
    cultistsCount: 2,
    hasLeader: false,
    lorePrompt: "Tochas avermelhadas ardem nos galhos secos onde os cultistas vigiam.",
  },
];

/**
 * Espalha os acampamentos pequenos, médios e enorme e seus altares rituais.
 */
export function spawnCultistClues(skullsMesh, weaponsMesh, regionSeed, cityCenter, scene, world) {
  if (!skullsMesh || !weaponsMesh || !cityCenter) return;
  const random = createSeededRandom(regionSeed || 12345);

  CULT_ALTARS.length = 0;
  CULT_CAMP_GROUPS.length = 0;

  const cx = cityCenter.x ?? 0;
  const cz = cityCenter.z ?? 0;

  for (let c = 0; c < CULT_CAMPS_PRESETS.length; c++) {
    const preset = CULT_CAMPS_PRESETS[c];
    const ax = cx + preset.dx;
    const az = cz + preset.dz;
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

      // 1. Paliçada Defensiva de Troncos Queimados (Médio e Enorme)
      if (isHuge || isMedium) {
        const stakeCount = isHuge ? 20 : 10;
        const stakeRadius = isHuge ? 8.5 : 4.8;
        for (let s = 0; s < stakeCount; s++) {
          // Deixa passagem frontal aberta
          if (s === 0 || s === 1) continue;
          const sang = (s / stakeCount) * Math.PI * 2;
          const stake = new THREE.Mesh(new THREE.ConeGeometry(0.12, 2.4, 5), _robeMat);
          stake.position.set(Math.cos(sang) * stakeRadius, 1.1, Math.sin(sang) * stakeRadius);
          stake.rotation.x = (random() - 0.5) * 0.15;
          stake.rotation.z = (random() - 0.5) * 0.15;
          campGroup.add(stake);

          // Alguns troncos com crânios fincados
          if (s % 3 === 0) {
            const stakeSkull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 1), _boneMat);
            stakeSkull.position.set(Math.cos(sang) * stakeRadius, 2.2, Math.sin(sang) * stakeRadius);
            campGroup.add(stakeSkull);
          }
        }
      }

      // 2. Fogueira Cerimonial Central de Chama Roxa
      const stoneCount = isHuge ? 14 : isMedium ? 10 : 8;
      const stoneDist = isHuge ? 2.2 : isMedium ? 1.7 : 1.35;
      for (let p = 0; p < stoneCount; p++) {
        const pang = (p / stoneCount) * Math.PI * 2;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(isHuge ? 0.35 : 0.24, 0), _altarStoneMat);
        stone.position.set(Math.cos(pang) * stoneDist, 0.15, Math.sin(pang) * stoneDist);
        campGroup.add(stone);
      }

      for (let l = 0; l < (isHuge ? 6 : 4); l++) {
        const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, isHuge ? 1.4 : 0.95, 5), _robeMat);
        logMesh.position.set(0, 0.1, 0);
        logMesh.rotation.y = (l / 4) * Math.PI;
        logMesh.rotation.z = Math.PI / 2;
        campGroup.add(logMesh);
      }

      const flameH = isHuge ? 1.6 : isMedium ? 1.15 : 0.88;
      const purpleFlame = new THREE.Mesh(new THREE.ConeGeometry(isHuge ? 0.55 : 0.38, flameH, 6), _purpleFireMat);
      purpleFlame.position.set(0, flameH * 0.5, 0);
      campGroup.add(purpleFlame);

      const campfireLight = new THREE.PointLight(0xaa33ff, isHuge ? 7.5 : 5.5, isHuge ? 50 : 36, 1.5);
      campfireLight.position.set(0, 1.1, 0);
      campGroup.add(campfireLight);

      // 3. Tochas Rubras Cerimoniais
      const torchCount = isHuge ? 6 : isMedium ? 4 : 2;
      const torchDist = isHuge ? 4.5 : isMedium ? 2.8 : 1.6;
      for (let t = 0; t < torchCount; t++) {
        const tang = (t / torchCount) * Math.PI * 2 + 0.3;
        const tx = Math.cos(tang) * torchDist;
        const tz = Math.sin(tang) * torchDist;

        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.0, 5), _robeMat);
        stake.position.set(tx, 1.0, tz);
        campGroup.add(stake);

        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 5), _redTorchMat);
        flame.position.set(tx, 2.15, tz);
        campGroup.add(flame);

        const tLight = new THREE.PointLight(0xff1100, 4.5, 26, 1.8);
        tLight.position.set(tx, 2.25, tz);
        campGroup.add(tLight);
      }

      // 4. Braseiros Monumentais de Fogo Roxo no Acampamento Enorme
      if (isHuge) {
        for (const bx of [-3.8, 3.8]) {
          const brazierPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 6), _altarStoneMat);
          brazierPillar.position.set(bx, 0.6, -1.8);
          campGroup.add(brazierPillar);

          const brazierBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.32, 0.3, 6), _altarStoneMat);
          brazierBowl.position.set(bx, 1.3, -1.8);
          campGroup.add(brazierBowl);

          const brazierFlame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 6), _purpleFireMat);
          brazierFlame.position.set(bx, 1.85, -1.8);
          campGroup.add(brazierFlame);

          const bLight = new THREE.PointLight(0xaa22ff, 5.0, 30, 1.6);
          bLight.position.set(bx, 2.0, -1.8);
          campGroup.add(bLight);
        }

        // Altar Monumental de Pedra Esculpida ao fundo
        const altarBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.75, 1.4), _altarStoneMat);
        altarBase.position.set(0, 0.38, 3.2);
        campGroup.add(altarBase);

        const altarTable = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 1.6), _altarStoneMat);
        altarTable.position.set(0, 0.84, 3.2);
        campGroup.add(altarTable);

        // Estátua de Pedra da Serpente de Rex Mundi sobre o altar
        const snakeTotem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.3, 6), _altarStoneMat);
        snakeTotem.position.set(0, 1.55, 3.2);
        campGroup.add(snakeTotem);

        const snakeHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.45), _altarStoneMat);
        snakeHead.position.set(0, 2.15, 3.25);
        campGroup.add(snakeHead);

        const totemLight = new THREE.PointLight(0xaa22ff, 3.5, 14, 1.8);
        totemLight.position.set(0, 2.3, 3.3);
        campGroup.add(totemLight);
      }

      // Crânios de aviso decorativos
      const skullDeco = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), _boneMat);
      skullDeco.position.set(0.7, 0.14, 0.7);
      campGroup.add(skullDeco);

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
  weaponsMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================================
// 3. Modelo Anatômico 3D do Cultista Cátaro (Estilo Baile Oculto - Eyes Wide Shut)
// ============================================================================
export function buildCultistMesh() {
  const root = new THREE.Group();
  root.name = "CultistRoot";

  const model = new THREE.Group();
  model.name = "CultistModel";
  root.add(model);

  // Manto preto longo sacerdotal (silhueta austera, reta e sem cantos redondos)
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.44, 1.55, 8), _robeMat);
  robe.position.set(0, 0.8, 0);
  robe.castShadow = true;
  model.add(robe);

  // Faixa/Estola cerimonial carmesim descendo pelo centro do peito
  const stola = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.35, 0.03), _crimsonRibbonMat);
  stola.position.set(0, 0.75, 0.23);
  stola.rotation.x = -0.04;
  model.add(stola);

  const stolaClasp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), _goldMat);
  stolaClasp.position.set(0, 1.38, 0.22);
  model.add(stolaClasp);

  // Ombreiras angulares de corte reto (ombros largos e imponentes de cerimônia oculta)
  for (const side of [-1, 1]) {
    const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.32), _robeMat);
    epaulet.position.set(side * 0.28, 1.48, 0);
    epaulet.rotation.z = -side * 0.12;
    model.add(epaulet);

    const epauletGold = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.10, 0.325), _goldMat);
    epauletGold.position.set(side * 0.36, 1.48, 0);
    epauletGold.rotation.z = -side * 0.12;
    model.add(epauletGold);
  }

  // Gola alta rígida cerimonial
  const collarBack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.03), _robeMat);
  collarBack.position.set(0, 1.62, -0.12);
  collarBack.rotation.x = 0.12;
  model.add(collarBack);

  // Capuz facetado gótico rígido (sem esferas redondas)
  const hoodRoof = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.32), _robeMat);
  hoodRoof.position.set(0, 1.84, 0.02);
  model.add(hoodRoof);

  const hoodPeak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 4), _robeMat);
  hoodPeak.position.set(0, 1.94, -0.05);
  hoodPeak.rotation.x = -0.32;
  model.add(hoodPeak);

  for (const side of [-1, 1]) {
    const hoodSide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.28), _robeMat);
    hoodSide.position.set(side * 0.15, 1.68, 0.02);
    model.add(hoodSide);
  }

  // Máscara Veneziana de Porcelana Oculta (Estilo Baile Eyes Wide Shut - Bauta / Volto)
  const maskGroup = new THREE.Group();
  maskGroup.position.set(0, 1.65, 0.10);

  const maskFace = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.23, 0.05), _maskMat);
  maskGroup.add(maskFace);

  // Queixo afiado geométrico característico da Bauta
  const maskChin = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.20, 4), _maskMat);
  maskChin.position.set(0, -0.13, 0.035);
  maskChin.rotation.x = Math.PI * 0.95;
  maskGroup.add(maskChin);

  // Filigrana e detalhes dourados nas têmporas
  const maskBrowGold = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.03, 0.055), _goldMat);
  maskBrowGold.position.set(0, 0.09, 0.002);
  maskGroup.add(maskBrowGold);

  // Órbitas oculares vazadas e profundas com ponto de luz penetrante
  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.035), _lensMat);
    eyeSocket.position.set(side * 0.055, 0.035, 0.032);
    maskGroup.add(eyeSocket);

    const eyeDot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.018), _glintMat);
    eyeDot.position.set(side * 0.055, 0.035, 0.046);
    maskGroup.add(eyeDot);
  }
  model.add(maskGroup);

  // Mangas pretas estruturadas com conexão física
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.70, 0.13), _robeMat);
  armL.position.set(-0.3, 1.25, 0);
  armL.rotation.z = 0.22;
  model.add(armL);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.07), _robeMat);
  handL.position.set(-0.34, 0.94, 0.10);
  model.add(handL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.70, 0.13), _robeMat);
  armR.position.set(0.3, 1.25, 0.05);
  armR.rotation.z = -0.22;
  model.add(armR);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.07), _robeMat);
  handR.position.set(0.34, 0.94, 0.12);
  model.add(handR);

  // Tocha Cerimonial de Ferro Forjado na mão esquerda (os servos que vigiam além dos muros)
  const torchGroup = new THREE.Group();
  torchGroup.name = "CultistRedTorch";
  torchGroup.position.set(-0.32, 1.05, 0.16);

  const torchStick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.48, 6), _bladeMat);
  torchStick.position.set(0, 0, 0);
  torchGroup.add(torchStick);

  const torchCage = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), _bladeMat);
  torchCage.position.set(0, 0.22, 0);
  torchGroup.add(torchCage);

  const torchFlame = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 5), _redTorchMat);
  torchFlame.position.set(0, 0.28, 0);
  torchGroup.add(torchFlame);

  const torchLight = new THREE.PointLight(0xff2211, 2.8, 18, 1.8);
  torchLight.position.set(0, 0.32, 0);
  torchGroup.add(torchLight);

  model.add(torchGroup);

  // Adaga ritual cerimonial na mão direita (obsidiana com guarda e pomo de ouro)
  const daggerGroup = new THREE.Group();
  daggerGroup.position.set(0.34, 0.92, 0.12);

  const daggerGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 5), _bladeMat);
  daggerGrip.position.set(0, 0, 0);
  daggerGroup.add(daggerGrip);

  const daggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.025, 0.035), _goldMat);
  daggerGuard.position.set(0, -0.07, 0);
  daggerGroup.add(daggerGuard);

  const daggerBlade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.34, 4), _bladeMat);
  daggerBlade.position.set(0, -0.24, 0);
  daggerBlade.rotation.x = Math.PI;
  daggerGroup.add(daggerBlade);

  const daggerPommel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), _goldMat);
  daggerPommel.position.set(0, 0.08, 0);
  daggerGroup.add(daggerPommel);

  model.add(daggerGroup);

  root.visible = false;
  return { root, model, robe, armL, armR, torchGroup, torchLight };
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

    const { root, model, robe, armL, armR, torchGroup, torchLight } = buildCultistMesh();
    this.root = root;
    this.model = model;
    this.robe = robe;
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
      if (this.robe) this.robe.scale.set(1.24, 0.62, 1.24);
      if (this.armL) this.armL.rotation.set(-0.62, 0, 0.28);
      if (this.torchGroup) this.torchGroup.position.set(-0.28, 0.62, 0.22);
    } else {
      this.model.position.y = 0;
      if (this.robe) this.robe.scale.set(1, 1, 1);
      if (this.armL) this.armL.rotation.set(0, 0, 0.22);
      if (this.torchGroup) this.torchGroup.position.set(-0.32, 1.05, 0.16);
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

    if (this.effects) {
      this.effects.play("dust", this.x, y + 0.8, this.z, "#1c1b22", 1.8);
    }
  }

  takeHit(amount, dirX, dirZ, force = 1.8, launch = 0) {
    if (!this.alive || !this.root.visible) return false;
    this.health -= amount;

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

    this.floatPhase += dt * 3.2;
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
export function buildCultLeaderMesh() {
  const root = new THREE.Group();
  root.name = "CultLeaderRoot";

  const model = new THREE.Group();
  model.name = "CultLeaderModel";
  model.scale.set(1.22, 1.22, 1.22);
  root.add(model);

  // Manto sacerdotal longo imponente com bordado de ouro
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.48, 1.65, 8), _robeMat);
  robe.position.set(0, 0.85, 0);
  robe.castShadow = true;
  model.add(robe);

  const robeGoldHem = new THREE.Mesh(new THREE.CylinderGeometry(0.482, 0.49, 0.08, 8), _goldMat);
  robeGoldHem.position.set(0, 0.08, 0);
  model.add(robeGoldHem);

  // Faixa/Estola cerimonial carmesim mais larga
  const stola = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.45, 0.035), _crimsonRibbonMat);
  stola.position.set(0, 0.82, 0.25);
  stola.rotation.x = -0.04;
  model.add(stola);

  const stolaClasp = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065, 1), _goldMat);
  stolaClasp.position.set(0, 1.46, 0.24);
  model.add(stolaClasp);

  // Ombreiras angulares clericais pontiagudas
  for (const side of [-1, 1]) {
    const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.36), _robeMat);
    epaulet.position.set(side * 0.32, 1.55, 0);
    epaulet.rotation.z = -side * 0.16;
    model.add(epaulet);

    const epauletGold = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.365), _goldMat);
    epauletGold.position.set(side * 0.41, 1.55, 0);
    epauletGold.rotation.z = -side * 0.16;
    model.add(epauletGold);
  }

  // Gola alta gótica
  const collarBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.04), _robeMat);
  collarBack.position.set(0, 1.70, -0.14);
  collarBack.rotation.x = 0.14;
  model.add(collarBack);

  // Capuz pontiagudo
  const hoodRoof = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.36), _robeMat);
  hoodRoof.position.set(0, 1.94, 0.02);
  model.add(hoodRoof);

  const hoodPeak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 4), _robeMat);
  hoodPeak.position.set(0, 2.06, -0.06);
  hoodPeak.rotation.x = -0.32;
  model.add(hoodPeak);

  for (const side of [-1, 1]) {
    const hoodSide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.36, 0.32), _robeMat);
    hoodSide.position.set(side * 0.17, 1.76, 0.02);
    model.add(hoodSide);

    // Chifres retorcidos de ébano e bronze saindo do capuz
    const hornBase = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.35, 5), _ebonyHornMat);
    hornBase.position.set(side * 0.22, 1.96, 0.02);
    hornBase.rotation.z = side * 0.85;
    hornBase.rotation.x = -0.25;
    model.add(hornBase);

    const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.25, 4), _goldMat);
    hornTip.position.set(side * 0.36, 2.15, -0.04);
    hornTip.rotation.z = side * 1.25;
    model.add(hornTip);
  }

  // Máscara Veneziana de Porcelana Oculta de Grande Nobreza
  const maskGroup = new THREE.Group();
  maskGroup.position.set(0, 1.74, 0.11);

  const maskFace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.05), _maskMat);
  maskGroup.add(maskFace);

  const maskChin = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 4), _maskMat);
  maskChin.position.set(0, -0.15, 0.04);
  maskChin.rotation.x = Math.PI * 0.95;
  maskGroup.add(maskChin);

  const maskGoldBrow = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.035, 0.055), _goldMat);
  maskGoldBrow.position.set(0, 0.10, 0.005);
  maskGroup.add(maskGoldBrow);

  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.026, 0.04), _lensMat);
    eyeSocket.position.set(side * 0.06, 0.04, 0.035);
    maskGroup.add(eyeSocket);

    const eyeFlame = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), _redTorchMat);
    eyeFlame.position.set(side * 0.06, 0.04, 0.048);
    maskGroup.add(eyeFlame);
  }

  const eyeLight = new THREE.PointLight(0xff2244, 2.0, 6.0, 2.0);
  eyeLight.position.set(0, 0.05, 0.1);
  maskGroup.add(eyeLight);

  model.add(maskGroup);

  // Braços
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.75, 0.14), _robeMat);
  armL.position.set(-0.34, 1.30, 0.05);
  armL.rotation.z = 0.2;
  model.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.75, 0.14), _robeMat);
  armR.position.set(0.34, 1.30, 0.05);
  armR.rotation.z = -0.2;
  model.add(armR);

  // Cajado Cerimonial do Demiurgo na mão esquerda
  const staffGroup = new THREE.Group();
  staffGroup.name = "DemiurgeStaff";
  staffGroup.position.set(-0.42, 0.95, 0.22);

  const staffPole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 2.35, 6), _robeMat);
  staffPole.position.set(0, 0.15, 0);
  staffGroup.add(staffPole);

  const staffSnake = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12, Math.PI * 1.8), _goldMat);
  staffSnake.position.set(0, 1.25, 0);
  staffSnake.rotation.x = Math.PI / 2;
  staffGroup.add(staffSnake);

  // Gema mística de Ametista no topo do cajado
  const staffGem = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), _amethystMat);
  staffGem.position.set(0, 1.35, 0);
  staffGroup.add(staffGem);

  const staffLight = new THREE.PointLight(0xaa22ff, 4.5, 18, 1.8);
  staffLight.position.set(0, 1.45, 0);
  staffGroup.add(staffLight);

  model.add(staffGroup);

  // Adaga de obsidiana na mão direita
  const daggerGroup = new THREE.Group();
  daggerGroup.position.set(0.38, 0.95, 0.14);

  const daggerGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 5), _bladeMat);
  daggerGroup.add(daggerGrip);

  const daggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.04), _goldMat);
  daggerGuard.position.set(0, -0.07, 0);
  daggerGroup.add(daggerGuard);

  const daggerBlade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.38, 4), _bladeMat);
  daggerBlade.position.set(0, -0.26, 0);
  daggerBlade.rotation.x = Math.PI;
  daggerGroup.add(daggerBlade);

  model.add(daggerGroup);

  root.visible = false;
  return { root, model, armL, armR, staffGroup, staffGem, staffLight, eyeLight };
}

export class CultLeader {
  constructor(scene, world, effects, combat, player) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = combat;
    this.player = player;

    const { root, model, armL, armR, staffGroup, staffGem, staffLight, eyeLight } = buildCultLeaderMesh();
    this.root = root;
    this.model = model;
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

    if (scene) scene.add(root);
  }

  takeDamage(amount) {
    return this.takeHit(amount, 0, 0, 1.2);
  }

  takeHit(amount, dirX = 0, dirZ = 0, force = 1.2, launch = 0) {
    if (!this.alive) return false;
    this.health -= amount;
    this.hostile = true; // Se for atacado, passa a lutar

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

    if (this.effects) {
      this.effects.play("dust", this.x, this.root.position.y + 1.0, this.z, "#0a0610", 4.5);
      this.effects.play("star", this.x, this.root.position.y + 1.8, this.z, "#bb22ff", 3.5);
      this.effects.play("star", this.x, this.root.position.y + 1.2, this.z, "#ff3322", 3.0);
    }

    // Saque Roubado Lendário: 150 moedas, 4 cristais raros e Túnica do Demiurgo
    spawnLoot(this.root.position, 150);
    PlayerInventory.crystals = PlayerInventory.crystals || {};
    PlayerInventory.crystals.purple = (PlayerInventory.crystals.purple || 0) + 2;
    PlayerInventory.crystals.white = (PlayerInventory.crystals.white || 0) + 1;
    PlayerInventory.crystals.red = (PlayerInventory.crystals.red || 0) + 1;

    import("./rpg.js").then(({ unlockDemiurgeAttire, addGood }) => {
      unlockDemiurgeAttire();
      addGood(10, "Morvath, o Grão-Mestre Cátaro, foi derrotado em combate");
    }).catch(() => {});

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

    const px = player?.x ?? player?.position?.x ?? 0;
    const pz = player?.z ?? player?.position?.z ?? 0;
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);

    if (this.staffLight) {
      this.staffLight.intensity = 3.6 + Math.sin(performance.now() * 0.005) * 1.2;
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
    ACTIVE_CULT_LEADER = new CultLeader(sc, w, eff, cmb, p);
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

/**
 * Atualiza o ciclo de vida dos Cultistas do Demiurgo fora dos muros.
 * Os acampamentos e cultistas SÓ aparecem à noite, nunca de dia.
 */
export function updateCultistsLifeCycle(cultistsPool, player, npcs, firePool, dt, isNight, cityData) {
  if (!Array.isArray(cultistsPool) || !player) return;

  const isNightBool = Boolean(isNight);

  // 1. Visibilidade dos Acampamentos dos Servos dos Demiurgos: SÓ APARECEM À NOITE, NUNCA DE DIA!
  for (let c = 0; c < CULT_CAMP_GROUPS.length; c++) {
    const camp = CULT_CAMP_GROUPS[c];
    if (camp && camp.visible !== isNightBool) {
      camp.visible = isNightBool;
    }
  }

  // 2. Se for de dia, nenhum servo comum do demiurgo atua e os que estiverem ativos desvanecem imediatamente
  if (!isNightBool) {
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

  // 3. Atualiza e spawna o Líder da Seita Cátara no Acampamento Enorme à noite (otimizado com cache)
  if (!_cachedHugeCamp) {
    _cachedHugeCamp = CULT_ALTARS.find((a) => a.hasLeader && a.tier === "huge") || null;
  }
  const hugeCamp = _cachedHugeCamp;
  if (hugeCamp) {
    if (!ACTIVE_CULT_LEADER && window.__game?.scene) {
      ACTIVE_CULT_LEADER = new CultLeader(
        window.__game.scene,
        window.__game.world,
        window.__game.effects,
        window.__game.combat,
        player
      );
      if (window.__game?.npcs?.npcs && !window.__game.npcs.npcs.includes(ACTIVE_CULT_LEADER)) {
        window.__game.npcs.npcs.push(ACTIVE_CULT_LEADER);
      }
      ACTIVE_CULT_LEADER.spawnAt(hugeCamp.x, hugeCamp.z + 1.8);
    } else if (ACTIVE_CULT_LEADER && !ACTIVE_CULT_LEADER.root.visible && ACTIVE_CULT_LEADER.alive) {
      ACTIVE_CULT_LEADER.spawnAt(hugeCamp.x, hugeCamp.z + 1.8);
    }
  }

  if (ACTIVE_CULT_LEADER && ACTIVE_CULT_LEADER.root.visible) {
    ACTIVE_CULT_LEADER.update(dt, player, isNightBool);
  }

  const time = performance.now();

  // Avalia acampamentos fora das muralhas a cada 1.0 segundo
  _cultistCheckTimer += dt;
  if (_cultistCheckTimer > 1.0) {
    _cultistCheckTimer = 0;

    const px = player.x ?? player.position?.x ?? 0;
    const pz = player.z ?? player.position?.z ?? 0;

    for (let a = 0; a < CULT_ALTARS.length; a++) {
      const altar = CULT_ALTARS[a];
      const adx = altar.x - px;
      const adz = altar.z - pz;
      const aDistSq = adx * adx + adz * adz;

      // Ativa o acampamento herético apenas se o jogador estiver nos ermos a <= 55m do local
      if (aDistSq <= 3025) {
        const activeHere = cultistsPool.filter(
          (c) => c.root.visible && c.userData.anchor && c.userData.anchor.distanceToSquared(altar) < 36
        );
        const maxCultists = altar.cultistsCount || (altar.tier === "huge" ? 6 : altar.tier === "medium" ? 4 : 2);
        if (activeHere.length < maxCultists) {
          const available = cultistsPool.find((c) => !c.root.visible);
          if (available) {
            available.spawnAtCamp(altar, activeHere.length, maxCultists);
          }
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
