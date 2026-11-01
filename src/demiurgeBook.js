import * as THREE from "three";
import { PlayerStats, PlayerInventory, syncPlayerStatsToPlayer } from "./rpg.js";

// ============================================================================
// Diário dos Demiurgos (Livro Oculto em Posição Aleatória por Save)
// ============================================================================

export const DEMIURGE_BOOK_SPOTS = [
  {
    id: 0,
    name: "Cemitério da Igreja",
    x: -16.8,
    z: -12.5,
    hint: "Vi sombras encapuzadas sussurrando entre as lápides frias do cemitério atrás da igreja de Caldera.",
  },
  {
    id: 1,
    name: "Beco da Taverna",
    x: 10.5,
    z: -17.5,
    hint: "Dizem que algo herético foi jogado atrás dos barris de vinho no beco da taverna da praça.",
  },
  {
    id: 2,
    name: "Alcova do Velho Poço",
    x: 2.2,
    z: -8.8,
    hint: "Na calada da noite vi um brilho carmesim pulsando na base de pedra do poço central da vila.",
  },
  {
    id: 3,
    name: "Entulho do Ferreiro",
    x: -21.0,
    z: 14.5,
    hint: "O ferreiro jurou que deixaram um livro negro sob os restos de escória atrás de sua forja.",
  },
  {
    id: 4,
    name: "Bancas do Mercado Antigo",
    x: -8.0,
    z: -23.5,
    hint: "Um viajante de capa escura esqueceu um tomo oculto sob os caixotes de especiarias do mercado velho.",
  },
  {
    id: 5,
    name: "Portão da Muralha Sul",
    x: 5.5,
    z: -38.0,
    hint: "Guardas encontraram marcas de cinzas e um códice sinistro nos esteios de madeira perto do grande portão da muralha.",
  },
];

let _currentSpotIndex = 0;
let _demiurgeBookGroup = null;
let _bookLight = null;
let _cachedScene = null;
let _cachedWorld = null;
let _isCollected = false;

// ============================================================================
// Estrutura Modular das Páginas do Diário dos Demiurgos
// O usuário pode expandir ou alterar o conteúdo de cada página futuramente.
// ============================================================================
export const DEMIURGE_DIARY_PAGES = [
  {
    id: 1,
    chapter: "CÓDICE I",
    title: "O Círculo dos Nove Olhos",
    type: "ritual",
    svg: `
      <svg viewBox="0 0 280 200" class="diary-svg" style="width:100%;max-height:160px;">
        <defs>
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ff3322" stop-opacity="0.9"/>
            <stop offset="65%" stop-color="#880011" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <!-- Círculos concêntricos e runas -->
        <circle cx="140" cy="100" r="82" fill="none" stroke="#682218" stroke-width="1.8" stroke-dasharray="4 3"/>
        <circle cx="140" cy="100" r="70" fill="none" stroke="#8a2b22" stroke-width="1.2"/>
        <circle cx="140" cy="100" r="50" fill="none" stroke="#521b18" stroke-width="1"/>
        <!-- Heptagrama ritual -->
        <polygon points="140,32 178,148 78,74 202,74 102,148" fill="none" stroke="#992620" stroke-width="1.4"/>
        <!-- Olho Central Reptiliano -->
        <circle cx="140" cy="100" r="32" fill="url(#eyeGlow)"/>
        <path d="M 104 100 Q 140 70 176 100 Q 140 130 104 100 Z" fill="#180e0c" stroke="#aa2218" stroke-width="2"/>
        <ellipse cx="140" cy="100" rx="4" ry="17" fill="#ff2211"/>
        <circle cx="140" cy="100" r="2.2" fill="#fff"/>
        <!-- Runas nos eixos -->
        <text x="135" y="24" fill="#a8352b" font-size="11" font-family="serif">𐡀</text>
        <text x="228" y="104" fill="#a8352b" font-size="11" font-family="serif">𐡁</text>
        <text x="135" y="192" fill="#a8352b" font-size="11" font-family="serif">𐡂</text>
        <text x="44" y="104" fill="#a8352b" font-size="11" font-family="serif">𐡃</text>
      </svg>
    `,
    html: `
      <p class="diary-lead">«A matéria que tocais não é a obra do Pai Celestial, mas o cárcere forjado pelo Demiurgo cego. Cada rocha talhada, cada carne que sangra e adoece foi moldada para aprisionar a centelha do fogo eterno em barro perecível.»</p>
      <p class="diary-text">«Às doze badaladas da meia-noite, sobre o heptagrama de cinzas de carvalho, misturai três gotas de sangue de inocente com pó de ossos secos. Os olhos do firmamento não piscam; eles aguardam o romper do primeiro selo.»</p>
    `,
  },
  {
    id: 2,
    chapter: "CÓDICE II",
    title: "Esboço do Cerco à Caldera",
    type: "plans",
    svg: `
      <svg viewBox="0 0 280 180" class="diary-svg" style="width:100%;max-height:150px;">
        <!-- Mapa rústico de Caldera -->
        <rect x="25" y="20" width="230" height="140" rx="8" fill="none" stroke="#5d3b28" stroke-width="1.5" stroke-dasharray="6 3"/>
        <!-- Muralhas e torres -->
        <circle cx="45" cy="40" r="12" fill="none" stroke="#7a4228" stroke-width="2"/>
        <circle cx="235" cy="40" r="12" fill="none" stroke="#7a4228" stroke-width="2"/>
        <circle cx="45" cy="140" r="12" fill="none" stroke="#7a4228" stroke-width="2"/>
        <circle cx="235" cy="140" r="12" fill="none" stroke="#7a4228" stroke-width="2"/>
        <!-- Igreja e Altar com cruz invertida e fogo -->
        <rect x="110" y="55" width="45" height="35" fill="none" stroke="#882211" stroke-width="1.8"/>
        <path d="M 132 45 L 132 60 M 126 52 L 138 52" stroke="#cc2211" stroke-width="1.8"/>
        <!-- Setas de Ataque marcadas em carmesim -->
        <path d="M 15 90 L 95 90 M 80 82 L 95 90 L 80 98" stroke="#ff2211" stroke-width="2.2" fill="none"/>
        <path d="M 265 110 L 175 110 M 190 102 L 175 110 L 190 118" stroke="#ff2211" stroke-width="2.2" fill="none"/>
        <!-- Marcador de Fogo no Poço -->
        <circle cx="140" cy="120" r="6" fill="#ff4411"/>
        <text x="152" y="124" fill="#ff5522" font-size="9" font-family="monospace">POÇO (VENENO)</text>
        <text x="60" y="32" fill="#996644" font-size="9" font-family="serif">MURALHA NORTE</text>
        <text x="96" y="103" fill="#cc2211" font-size="9" font-family="serif">IGREJA (ALVO)</text>
      </svg>
    `,
    html: `
      <p class="diary-lead">«Na décima noite após a lua de cinzas, queimai a torre de madeira a oeste para desviar as sentinelas reais.»</p>
      <p class="diary-text">«Enquanto os guardas correrem para o fogo, duas almas mascaradas devem despejar o frasco de seiva negra na fonte central da praça. Ninguém beberá sem vomitar o próprio sangue. As portas do templo serão trancadas por fora com arames recozidos.»</p>
    `,
  },
  {
    id: 3,
    chapter: "CÓDICE III",
    title: "[Fragmento Arrancado]",
    type: "torn",
    svg: ``,
    html: `
      <div class="diary-torn-container">
        <div class="diary-torn-jagged-top"></div>
        <div class="diary-torn-page-content">
          <div class="diary-torn-charred-burn"></div>
          <div class="diary-torn-title">O SACRIFÍCIO FINAL</div>
          <p class="diary-torn-sub">...não sobrará um só sopro de vida sobre a carne corrompida...</p>
          <div class="diary-torn-scratch-line"></div>
        </div>
        <div class="diary-torn-jagged-bottom"></div>
      </div>
    `,
  },
  {
    id: 4,
    chapter: "CÓDICE IV",
    title: "[Ilegível · Tinta & Sangue]",
    type: "bloody_splatter",
    svg: `
      <svg viewBox="0 0 320 220" class="diary-bloody-svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;">
        <!-- Manchas densas de tinta vermelha e sangue espirrado cobrindo o texto como caneta explodida -->
        <path d="M 40 40 Q 90 20 120 50 Q 170 30 210 65 Q 260 40 280 85 Q 295 140 250 170 Q 200 200 140 185 Q 80 205 45 160 Q 15 110 40 40 Z" fill="#7a0a0a" opacity="0.92"/>
        <path d="M 60 60 Q 110 45 140 70 Q 190 55 230 85 Q 270 125 240 155 Q 180 185 130 165 Q 70 175 55 130 Z" fill="#990f14" opacity="0.88"/>
        <!-- Gotas escorrendo para baixo -->
        <path d="M 85 160 Q 88 195 90 215 Q 85 220 82 215 Q 80 195 85 160 Z" fill="#880c10"/>
        <path d="M 160 175 Q 163 205 165 218 Q 160 222 157 217 Q 155 200 160 175 Z" fill="#990f14"/>
        <path d="M 230 155 Q 235 185 238 205 Q 233 210 230 205 Q 227 185 230 155 Z" fill="#77080a"/>
        <!-- Respingos e salpicos finos -->
        <circle cx="28" cy="85" r="4.5" fill="#8e0d10"/>
        <circle cx="18" cy="115" r="2.8" fill="#a01215"/>
        <circle cx="35" cy="145" r="3.2" fill="#7a0a0a"/>
        <circle cx="265" cy="35" r="5" fill="#8e0d10"/>
        <circle cx="295" cy="65" r="3.5" fill="#a01215"/>
        <circle cx="285" cy="120" r="4" fill="#77080a"/>
        <circle cx="145" cy="15" r="3" fill="#8e0d10"/>
        <circle cx="185" cy="22" r="2.5" fill="#a01215"/>
        <!-- Rabisco de caneta arrebentada -->
        <path d="M 30 180 L 110 70 L 150 140 L 220 80 L 290 150" stroke="#4a0404" stroke-width="4.5" fill="none" opacity="0.6"/>
      </svg>
    `,
    html: `
      <div class="diary-bloody-container">
        <div class="diary-bloody-ghost-text">
          <p>«...eles romperam o manto das nuvens... as sete cabeças...»</p>
          <p>«...não adianta rezar... a luz sagrada apagou... ELE ESTÁ VINDO...»</p>
          <p>«...socorro... a carne derrete... o abismo...»</p>
        </div>
      </div>
    `,
  },
  {
    id: 5,
    chapter: "CÓDICE V",
    title: "A Revelação do Sol Negro",
    type: "doctrine",
    svg: `
      <svg viewBox="0 0 280 180" class="diary-svg" style="width:100%;max-height:150px;">
        <defs>
          <radialGradient id="blackSunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0a0508"/>
            <stop offset="60%" stop-color="#2a0f18"/>
            <stop offset="85%" stop-color="#6e101b"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <!-- Raios retorcidos do Sol Negro -->
        <g stroke="#801822" stroke-width="1.8" fill="none">
          <path d="M 140 20 Q 155 50 140 70"/>
          <path d="M 140 160 Q 125 130 140 110"/>
          <path d="M 70 90 Q 95 105 115 90"/>
          <path d="M 210 90 Q 185 75 165 90"/>
          <path d="M 85 45 Q 110 70 120 75"/>
          <path d="M 195 135 Q 170 110 160 105"/>
          <path d="M 195 45 Q 170 70 160 75"/>
          <path d="M 85 135 Q 110 110 120 105"/>
        </g>
        <!-- Disco Central Escuro com 3 Olhos de Crocodilo -->
        <circle cx="140" cy="90" r="42" fill="url(#blackSunGlow)" stroke="#ff2233" stroke-width="1.5"/>
        <!-- Olho Superior -->
        <ellipse cx="140" cy="74" rx="12" ry="6" fill="#110508" stroke="#ff2211" stroke-width="1.2"/>
        <line x1="140" y1="69" x2="140" y2="79" stroke="#ffaa22" stroke-width="1.8"/>
        <!-- Olho Inferior Esquerdo -->
        <ellipse cx="126" cy="98" rx="11" ry="5.5" fill="#110508" stroke="#ff2211" stroke-width="1.2"/>
        <line x1="126" y1="93" x2="126" y2="103" stroke="#ffaa22" stroke-width="1.8"/>
        <!-- Olho Inferior Direito -->
        <ellipse cx="154" cy="98" rx="11" ry="5.5" fill="#110508" stroke="#ff2211" stroke-width="1.2"/>
        <line x1="154" y1="93" x2="154" y2="103" stroke="#ffaa22" stroke-width="1.8"/>
      </svg>
    `,
    html: `
      <p class="diary-lead">«O Demiurgo não possui compaixão; sua forja é a vaidade e a escuridão primordial. Três olhos vigiam a alma humana para pesar cada pecado como chumbo.»</p>
      <p class="diary-text">«Aquele que aceita a cinza transcende o cárcere dos elementos. Quando as trombetas calarem, o Sol Negro consumirá até a última memória deste reino.»</p>
    `,
  },
  {
    id: 6,
    chapter: "CÓDICE VI",
    title: "Anotações do Viajante",
    type: "modular_blank",
    svg: ``,
    html: `
      <div class="diary-blank-notes">
        <p class="diary-notes-lead">✦ Páginas de pergaminho preservadas para novos decretos, rituais e planos sombrios...</p>
        <div class="diary-ruled-lines">
          <div class="diary-line"></div>
          <div class="diary-line"></div>
          <div class="diary-line"></div>
          <div class="diary-line"></div>
          <div class="diary-line"></div>
        </div>
      </div>
    `,
  },
];

// ============================================================================
// CSS da Interface do Leitor do Diário dos Demiurgos
// ============================================================================
const DIARY_READER_CSS = `
#demiurge-diary-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 2, 6, 0.92);
  backdrop-filter: blur(8px);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  font-family: "Cinzel", "Cinzel Decorative", Georgia, serif;
}
#demiurge-diary-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.diary-book-wrapper {
  position: relative;
  width: 92%;
  max-width: 820px;
  min-height: 540px;
  background: #140d0c;
  border: 4px solid #4a1818;
  border-radius: 12px;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.95), 0 0 25px rgba(180, 25, 25, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.diary-book-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: linear-gradient(90deg, #1f0b0d 0%, #300c11 50%, #1f0b0d 100%);
  border-bottom: 2px solid #6b1b22;
  color: #eed6b0;
}
.diary-book-title-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  letter-spacing: 2px;
  color: #ff5544;
  text-shadow: 0 0 8px rgba(255, 50, 50, 0.6);
}
.diary-close-btn {
  background: #360a0f;
  border: 1px solid #7d1c24;
  color: #e8d0b5;
  font-family: inherit;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.diary-close-btn:hover {
  background: #7a151f;
  color: #fff;
  box-shadow: 0 0 10px rgba(255, 40, 50, 0.8);
}
.diary-page-viewport {
  flex: 1;
  display: flex;
  background: radial-gradient(circle at center, #231614 0%, #130b0a 100%);
  padding: 22px;
  position: relative;
  overflow-y: auto;
  max-height: 440px;
}
.diary-parchment-sheet {
  flex: 1;
  background: #cfbe95;
  color: #241411;
  border-radius: 4px;
  padding: 26px 32px;
  box-shadow: inset 0 0 40px rgba(70, 35, 20, 0.4), 0 4px 16px rgba(0, 0, 0, 0.6);
  position: relative;
  min-height: 380px;
  display: flex;
  flex-direction: column;
}
.diary-chapter-label {
  font-size: 12px;
  letter-spacing: 3px;
  color: #882218;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.diary-page-heading {
  font-size: 20px;
  margin: 0 0 14px 0;
  color: #3b110e;
  border-bottom: 2px solid #8e3228;
  padding-bottom: 6px;
  letter-spacing: 1px;
}
.diary-lead {
  font-size: 15px;
  font-style: italic;
  line-height: 1.6;
  color: #381a16;
  margin-bottom: 12px;
}
.diary-text {
  font-size: 14px;
  line-height: 1.65;
  color: #2b1714;
}

/* Página Rasgada: O Sacrifício Final */
.diary-torn-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  background: repeating-linear-gradient(45deg, #bfa87a, #bfa87a 10px, #b8a072 10px, #b8a072 20px);
  border: 3px dashed #6b1f18;
  padding: 30px;
  box-shadow: inset 0 0 35px rgba(0, 0, 0, 0.5);
  clip-path: polygon(
    0% 5%, 8% 2%, 16% 7%, 25% 1%, 35% 6%, 45% 0%, 55% 5%, 65% 2%, 75% 7%, 85% 1%, 95% 6%, 100% 2%,
    98% 30%, 100% 50%, 97% 70%, 100% 90%, 95% 98%, 85% 94%, 75% 99%, 65% 95%, 55% 100%, 45% 94%, 35% 98%, 25% 93%, 15% 99%, 5% 95%, 0% 100%,
    3% 75%, 0% 55%, 4% 35%, 1% 15%
  );
}
.diary-torn-title {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 4px;
  color: #1a0808;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.3);
  text-align: center;
  margin-bottom: 12px;
  border-top: 2px solid #5a1515;
  border-bottom: 2px solid #5a1515;
  padding: 10px 0;
}
.diary-torn-sub {
  font-size: 13px;
  font-style: italic;
  color: #551915;
  text-align: center;
}
.diary-torn-charred-burn {
  position: absolute;
  top: 10px;
  right: 15px;
  width: 45px;
  height: 45px;
  background: radial-gradient(circle, #050202 0%, #290d0b 60%, transparent 100%);
  border-radius: 50%;
  opacity: 0.85;
}

/* Página Manchada de Sangue/Tinta */
.diary-bloody-container {
  position: relative;
  flex: 1;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #992222;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 0 50px #3a0505;
}
.diary-bloody-ghost-text {
  position: relative;
  z-index: 1;
  color: rgba(240, 180, 180, 0.45);
  font-size: 14px;
  line-height: 2.2;
  font-style: italic;
  padding: 24px;
  text-align: center;
  filter: blur(0.6px);
}

/* Linhas em branco modulares */
.diary-blank-notes {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.diary-notes-lead {
  font-size: 13px;
  color: #6a2a22;
  font-style: italic;
  margin-bottom: 16px;
}
.diary-ruled-lines {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.diary-line {
  height: 1px;
  background: rgba(100, 40, 30, 0.35);
  width: 100%;
}

/* Rodapé de navegação */
.diary-book-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #190c0d;
  border-top: 2px solid #5a151b;
}
.diary-nav-btn {
  background: #2b0c10;
  border: 1px solid #751a23;
  color: #f0dac2;
  font-family: inherit;
  font-size: 13px;
  padding: 8px 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}
.diary-nav-btn:hover:not(:disabled) {
  background: #6a141c;
  color: #fff;
  box-shadow: 0 0 10px rgba(255, 50, 70, 0.5);
}
.diary-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: #3b181a;
}
.diary-page-indicator {
  font-size: 14px;
  letter-spacing: 2px;
  color: #d1b590;
}
`;

let _diaryReaderModalEl = null;
let _currentReadingPage = 0;
let _cachedAudio = null;

function _ensureDiaryModal(audio) {
  _cachedAudio = audio || _cachedAudio;
  if (_diaryReaderModalEl) return _diaryReaderModalEl;

  const style = document.createElement("style");
  style.id = "demiurge-diary-css";
  style.textContent = DIARY_READER_CSS;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "demiurge-diary-overlay";
  overlay.innerHTML = `
    <div class="diary-book-wrapper">
      <div class="diary-book-header">
        <div class="diary-book-title-badge">
          <span>👁️</span>
          <span>DIÁRIO DOS DEMIURGOS · CÓDICE PROIBIDO</span>
        </div>
        <button class="diary-close-btn" id="diary-close-btn">✕ Fechar (ESC / L)</button>
      </div>
      <div class="diary-page-viewport" id="diary-viewport">
        <!-- Inserido dinamicamente -->
      </div>
      <div class="diary-book-footer">
        <button class="diary-nav-btn" id="diary-prev-btn">◄ Anterior (A)</button>
        <div class="diary-page-indicator" id="diary-page-indicator">Página 1 de ${DEMIURGE_DIARY_PAGES.length}</div>
        <button class="diary-nav-btn" id="diary-next-btn">Próxima (D) ►</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  _diaryReaderModalEl = overlay;

  overlay.querySelector("#diary-close-btn").addEventListener("click", () => {
    closeDemiurgeDiaryReader();
  });
  overlay.querySelector("#diary-prev-btn").addEventListener("click", () => {
    changeDiaryPage(-1);
  });
  overlay.querySelector("#diary-next-btn").addEventListener("click", () => {
    changeDiaryPage(1);
  });

  window.addEventListener("keydown", (e) => {
    if (!isDemiurgeDiaryReaderOpen()) return;
    if (e.key === "Escape" || e.code === "KeyL" || e.code === "KeyE") {
      e.preventDefault();
      closeDemiurgeDiaryReader();
    } else if (e.key === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      changeDiaryPage(-1);
    } else if (e.key === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      changeDiaryPage(1);
    }
  });

  return overlay;
}

function _renderCurrentPage() {
  if (!_diaryReaderModalEl) return;
  const page = DEMIURGE_DIARY_PAGES[_currentReadingPage] || DEMIURGE_DIARY_PAGES[0];
  const viewport = _diaryReaderModalEl.querySelector("#diary-viewport");
  const indicator = _diaryReaderModalEl.querySelector("#diary-page-indicator");
  const prevBtn = _diaryReaderModalEl.querySelector("#diary-prev-btn");
  const nextBtn = _diaryReaderModalEl.querySelector("#diary-next-btn");

  indicator.textContent = `Página ${_currentReadingPage + 1} de ${DEMIURGE_DIARY_PAGES.length}`;
  prevBtn.disabled = _currentReadingPage === 0;
  nextBtn.disabled = _currentReadingPage === DEMIURGE_DIARY_PAGES.length - 1;

  viewport.innerHTML = `
    <div class="diary-parchment-sheet">
      <div class="diary-chapter-label">${page.chapter}</div>
      <h2 class="diary-page-heading">${page.title}</h2>
      ${page.svg || ""}
      ${page.html || ""}
    </div>
  `;
}

export function openDemiurgeDiaryReader(pageIndex = 0, audio = null) {
  _currentReadingPage = Math.max(0, Math.min(DEMIURGE_DIARY_PAGES.length - 1, pageIndex));
  const modal = _ensureDiaryModal(audio);
  _renderCurrentPage();
  modal.classList.add("active");
  if (_cachedAudio?.bookPage) {
    _cachedAudio.bookPage();
  }
}

export function closeDemiurgeDiaryReader() {
  if (_diaryReaderModalEl) {
    _diaryReaderModalEl.classList.remove("active");
  }
}

export function isDemiurgeDiaryReaderOpen() {
  return _diaryReaderModalEl ? _diaryReaderModalEl.classList.contains("active") : false;
}

export function changeDiaryPage(delta) {
  const next = _currentReadingPage + delta;
  if (next >= 0 && next < DEMIURGE_DIARY_PAGES.length) {
    _currentReadingPage = next;
    _renderCurrentPage();
    if (_cachedAudio?.bookPage) {
      _cachedAudio.bookPage();
    }
  }
}

// ============================================================================
// Controle de Spawn e Interação no Mundo 3D
// ============================================================================

export function getDemiurgeDiarySpotIndex() {
  return _currentSpotIndex;
}

export function getDemiurgeDiaryHint() {
  const spot = DEMIURGE_BOOK_SPOTS[_currentSpotIndex] || DEMIURGE_BOOK_SPOTS[0];
  return spot.hint;
}

export function isDemiurgeDiaryCollected() {
  return _isCollected || Boolean(PlayerInventory.hasDemiurgeDiary);
}

export function initDemiurgeDiary({ scene, world, savedSpotIndex = null, isCollected = false }) {
  _cachedScene = scene;
  _cachedWorld = world;
  _isCollected = Boolean(isCollected || PlayerInventory.hasDemiurgeDiary);

  if (
    savedSpotIndex !== null &&
    savedSpotIndex !== undefined &&
    typeof savedSpotIndex === "number" &&
    savedSpotIndex >= 0 &&
    savedSpotIndex < DEMIURGE_BOOK_SPOTS.length
  ) {
    _currentSpotIndex = savedSpotIndex;
  } else {
    _currentSpotIndex = Math.floor(Math.random() * DEMIURGE_BOOK_SPOTS.length);
  }

  const spot = DEMIURGE_BOOK_SPOTS[_currentSpotIndex];

  if (_demiurgeBookGroup && _demiurgeBookGroup.parent) {
    _demiurgeBookGroup.parent.remove(_demiurgeBookGroup);
  }

  // Se já foi coletado, não coloca o livro no chão
  if (_isCollected) {
    return null;
  }

  _demiurgeBookGroup = new THREE.Group();
  _demiurgeBookGroup.name = "DiarioDosDemiurgos";

  // Materiais do tomo profano
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x140e0c, roughness: 0.88, flatShading: true });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xb58b38, metalness: 0.75, roughness: 0.35, flatShading: true });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xd6c498, roughness: 0.95, flatShading: true });
  const eyeSealMat = new THREE.MeshBasicMaterial({ color: 0xff1500 });

  // Capa inferior e capa superior
  const coverBottom = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.48), leatherMat);
  coverBottom.position.set(0, 0.015, 0);
  coverBottom.castShadow = true;
  _demiurgeBookGroup.add(coverBottom);

  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.07, 0.45), paperMat);
  pages.position.set(0.01, 0.06, 0);
  _demiurgeBookGroup.add(pages);

  const coverTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.48), leatherMat);
  coverTop.position.set(0, 0.105, 0);
  coverTop.castShadow = true;
  _demiurgeBookGroup.add(coverTop);

  // Lombada reforçada de couro trabalhado
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.115, 0.48), leatherMat);
  spine.position.set(-0.175, 0.06, 0);
  _demiurgeBookGroup.add(spine);

  // Cantoneiras de bronze entalhado
  for (const cx of [-0.155, 0.155]) {
    for (const cz of [-0.215, 0.215]) {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.05), goldTrimMat);
      corner.position.set(cx, 0.106, cz);
      _demiurgeBookGroup.add(corner);
    }
  }

  // Olho Oculto do Demiurgo na capa frontal
  const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeSealMat);
  eyeGlow.position.set(0.02, 0.122, 0);
  eyeGlow.scale.set(1.2, 0.35, 0.85);
  _demiurgeBookGroup.add(eyeGlow);

  const eyePupil = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.028, 0.055), goldTrimMat);
  eyePupil.position.set(0.02, 0.126, 0);
  _demiurgeBookGroup.add(eyePupil);

  // Luz carmesim oculta que pulsa sobre o livro
  _bookLight = new THREE.PointLight(0xee2200, 1.4, 3.8, 2.0);
  _bookLight.position.set(0, 0.35, 0);
  _demiurgeBookGroup.add(_bookLight);

  // Posição no mundo
  const gy = world ? world.heightAt(spot.x, spot.z) : 0;
  _demiurgeBookGroup.position.set(spot.x, gy + 0.12, spot.z);
  _demiurgeBookGroup.rotation.y = 0.42;

  scene.add(_demiurgeBookGroup);
  return _demiurgeBookGroup;
}

export function updateDemiurgeDiary(dt, now = performance.now()) {
  if (!_bookLight || !_demiurgeBookGroup || !_demiurgeBookGroup.visible) return;
  _bookLight.intensity = 1.2 + Math.sin(now * 0.0035) * 0.45;
}

export function checkDemiurgeDiaryNearby(playerPos) {
  if (!_demiurgeBookGroup || !_demiurgeBookGroup.visible || _isCollected || PlayerInventory.hasDemiurgeDiary) {
    return false;
  }
  const dx = (playerPos.x ?? 0) - _demiurgeBookGroup.position.x;
  const dz = (playerPos.z ?? 0) - _demiurgeBookGroup.position.z;
  return dx * dx + dz * dz < 2.5 * 2.5;
}

export function interactWithDemiurgeDiary(playerPos, ui, audio, input) {
  if (!checkDemiurgeDiaryNearby(playerPos)) return false;

  // Coleta o Diário para o Inventário do Jogador
  _isCollected = true;
  PlayerInventory.hasDemiurgeDiary = true;

  if (_demiurgeBookGroup) {
    _demiurgeBookGroup.visible = false;
    if (_demiurgeBookGroup.parent) {
      _demiurgeBookGroup.parent.remove(_demiurgeBookGroup);
    }
  }

  // Notificação e concessão de atributos ocultos
  PlayerStats.cha += 1;
  syncPlayerStatsToPlayer();

  import("./decay.js").then(({ addEvil }) => {
    addEvil(2, "Recolheu o Diário dos Demiurgos das sombras da vila");
  });

  ui?.showToast?.("✦ Diário dos Demiurgos coletado! Pressione [L] para lê-lo a qualquer momento. (+1 Carisma)");
  audio?.bookPage?.();

  // Abre imediatamente o leitor na página 1
  openDemiurgeDiaryReader(0, audio);
  return true;
}
