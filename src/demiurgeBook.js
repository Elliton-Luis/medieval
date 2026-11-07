import * as THREE from "three";
import { PlayerStats, PlayerInventory, syncPlayerStatsToPlayer } from "./rpg.js";
import { isCanonicalWorld, getBookSpotsFull, worldRand } from "./worldgen.js";

// ============================================================================
// Tractatus de Carcere · O Livro do Barro
// (Livro da Seita do Demiurgo oculto em posição aleatória persistida por save)
// ============================================================================

export const DEMIURGE_BOOK_SPOTS = [
  {
    id: 0,
    name: "Marco de Pedra Além do Portão Norte",
    x: 12.0,
    z: -64.0,
    hint: "Dizem que o Livro do Barro foi deixado além do Portão Norte, fora das muralhas da cidade sob um marco de pedra antigo.",
  },
  {
    id: 1,
    name: "Ruínas a Oeste das Muralhas",
    x: -58.0,
    z: -14.0,
    hint: "Vi um brilho carmesim pulsando entre os escombros do lado de fora da muralha oeste, onde a floresta começa.",
  },
  {
    id: 2,
    name: "Penhasco Além da Muralha Leste",
    x: 54.0,
    z: 24.0,
    hint: "Um viajante sussurrou que o Livro do Barro repousa entre as rochas frias, do lado de fora das muralhas a leste.",
  },
  {
    id: 3,
    name: "Carroça Tombada ao Sul dos Muros",
    x: -24.0,
    z: 62.0,
    hint: "Fora dos muros ao sul, perto de uma carroça quebrada nas colinas ermas, cheira a terra velha e cobre oxidado.",
  },
  {
    id: 4,
    name: "Acampamento Arruinado a Nordeste",
    x: 38.0,
    z: -58.0,
    hint: "Saindo pelos portões e contornando as paliçadas a nordeste, há cinzas de um acampamento profano com um livro negro.",
  },
];

let _currentSpotIndex = 0;
let _demiurgeBookGroup = null;
let _bookLight = null;
let _cachedScene = null;
let _cachedWorld = null;
let _isCollected = false;

// Flags de efeitos desencadeados pela leitura de páginas específicas
let _hasReadPage2 = false;
let _hasReadPage19 = false;

// ============================================================================
// Tractatus de Carcere · versão resumida
// Só a PÁGINA 1 vive neste módulo (pré-carregada e pré-renderizada em idle).
// As páginas 2..21 estão em ./bookPages.js e entram por import() dinâmico na primeira abertura.
// ============================================================================

const TOTAL_PAGES = 21;

const FIRST_PAGE = {
  id: 1,
  chapter: "GÊNESE DO ABORTO CÓSMICO · I",
  title: "O Pleroma e a Centelha",
  stateLabel: "Folha rasgada e puída nas bordas",
  isTorn: true,
  story: "Escute. Antes de existir mundo, existia o Pleroma: luz, silêncio, paz. Você lembra, não lembra? Uma centelha vaidosa quis imitar o Todo e pariu um erro. Esse erro é tudo o que seus olhos chamam de realidade.",
  torn: "[…a página foi arrancada aqui]",
};

// Exportado para quem precisar: começa só com a página 1 e é completado quando bookPages.js carrega.
export const DEMIURGE_DIARY_PAGES = [FIRST_PAGE];
const _pageById = new Map([[1, FIRST_PAGE]]);
let _restLoaded = false;
let _restPromise = null;

function _esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Monta o corpo da página (história curta + pontos + ritual + efeito). Sem ilustrações.
function _buildPageHtml(p) {
  let h = "";
  if (p.story) h += `<p class="diary-story">${_esc(p.story)}</p>`;
  if (p.ritual && p.ritual.steps) {
    h += `<h3 class="diary-sub">O que você deve fazer</h3><ol class="diary-ritual">${p.ritual.steps.map((x) => `<li>${_esc(x)}</li>`).join("")}</ol>`;
  }
  if (p.torn) h += `<p class="diary-torn-note">${_esc(p.torn)}</p>`;
  if (p.effect) h += `<p class="diary-effect"><strong>Efeito:</strong> ${_esc(p.effect)}</p>`;
  return h;
}
FIRST_PAGE.html = _buildPageHtml(FIRST_PAGE);

/** Carrega as páginas 2..21 uma única vez (import dinâmico) e completa DEMIURGE_DIARY_PAGES. */
export function ensureBookPagesLoaded() {
  if (_restLoaded) return Promise.resolve();
  if (_restPromise) return _restPromise;
  _restPromise = import("./bookPages.js")
    .then((mod) => {
      for (const p of mod.BOOK_PAGES_REST) {
        p.html = _buildPageHtml(p);
        _pageById.set(p.id, p);
      }
      DEMIURGE_DIARY_PAGES.length = 0;
      for (let id = 1; id <= TOTAL_PAGES; id++) {
        const p = _pageById.get(id);
        if (p) DEMIURGE_DIARY_PAGES.push(p);
      }
      _restLoaded = true;
    })
    .catch((err) => {
      _restPromise = null;
      console.warn("Falha ao carregar as páginas do livro:", err);
    });
  return _restPromise;
}

const TRACTATUS_CSS = `
#demiurge-diary-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  z-index: 10001;
  display: none;
  align-items: center;
  justify-content: center;
  font-family: system-ui, "Segoe UI", Roboto, Arial, sans-serif;
}
#demiurge-diary-overlay.active {
  display: flex;
}
.diary-book-wrapper {
  width: 94%;
  max-width: 720px;
  max-height: 92vh;
  background: #15110f;
  border: 1px solid #4a3a30;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e9e1d6;
}
.diary-book-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #1d1814;
  border-bottom: 1px solid #3a2f27;
}
.diary-book-title-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #cdbfae;
}
.diary-close-btn,
.diary-nav-btn {
  background: #2a231d;
  border: 1px solid #5a4a3d;
  color: #efe7dc;
  font: inherit;
  font-size: 14px;
  padding: 7px 14px;
  border-radius: 3px;
  cursor: pointer;
}
.diary-close-btn:hover,
.diary-nav-btn:hover:not(:disabled) {
  background: #3a3027;
}
.diary-nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.diary-page-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 22px 28px;
}
.diary-parchment-sheet {
  font-size: 18px;
  line-height: 1.6;
  color: #efe8dd;
}
.diary-chapter-label {
  font-size: 13px;
  letter-spacing: 0.06em;
  color: #a89a8a;
  text-transform: uppercase;
}
.diary-page-heading {
  margin: 6px 0 4px;
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.25;
}
.diary-state-badge {
  font-size: 14px;
  color: #a89a8a;
  margin-bottom: 14px;
}
.diary-story {
  margin: 0 0 14px;
}
.diary-sub {
  margin: 16px 0 6px;
  font-size: 15px;
  font-weight: 700;
  color: #d9a066;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.diary-ritual {
  margin: 0 0 10px;
  padding-left: 24px;
}
.diary-ritual li {
  margin: 4px 0;
}
.diary-torn-note {
  margin: 14px 0 0;
  color: #9a8c7c;
  font-style: italic;
}
.diary-effect {
  margin: 16px 0 0;
  padding: 10px 12px;
  background: #221b16;
  border-left: 3px solid #d9a066;
  font-size: 16px;
}
.diary-book-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #1d1814;
  border-top: 1px solid #3a2f27;
}
.diary-page-indicator {
  font-size: 14px;
  color: #bfb2a2;
}

/* Filtro cinza na tela (efeito da página 2) */
#grey-vision-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: grayscale(0.88) contrast(1.15) brightness(0.9);
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.5s ease;
}
#grey-vision-overlay.active {
  opacity: 1;
}
`;

let _diaryReaderModalEl = null;
let _currentReadingPage = 0;
let _cachedAudio = null;
let _greyVisionOverlayEl = null;

function _ensureGreyVisionOverlay() {
  if (_greyVisionOverlayEl) return _greyVisionOverlayEl;
  const el = document.createElement("div");
  el.id = "grey-vision-overlay";
  document.body.appendChild(el);
  _greyVisionOverlayEl = el;
  return el;
}

function _triggerGreyFilterEffect(durationSeconds = 3) {
  const overlay = _ensureGreyVisionOverlay();
  overlay.classList.add("active");
  setTimeout(() => {
    overlay.classList.remove("active");
  }, durationSeconds * 1000);
}

function _ensureDiaryModal(audio) {
  _cachedAudio = audio || _cachedAudio;
  if (_diaryReaderModalEl) return _diaryReaderModalEl;

  const style = document.createElement("style");
  style.id = "demiurge-diary-css";
  style.textContent = TRACTATUS_CSS;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "demiurge-diary-overlay";
  overlay.innerHTML = `
    <div class="diary-book-wrapper">
      <div class="diary-book-header">
        <div class="diary-book-title-badge">
          <span>Tractatus de Carcere · O Livro do Barro</span>
        </div>
        <button class="diary-close-btn" id="diary-close-btn">Fechar (ESC / L)</button>
      </div>
      <div class="diary-page-viewport" id="diary-viewport"></div>
      <div class="diary-book-footer">
        <button class="diary-nav-btn" id="diary-prev-btn">◄ Anterior (A)</button>
        <div class="diary-page-indicator" id="diary-page-indicator">Página 1 de ${TOTAL_PAGES}</div>
        <button class="diary-nav-btn" id="diary-next-btn">Próxima (D) ►</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  _diaryReaderModalEl = overlay;

  overlay.querySelector("#diary-close-btn").addEventListener("click", () => closeDemiurgeDiaryReader());
  overlay.querySelector("#diary-prev-btn").addEventListener("click", () => changeDiaryPage(-1));
  overlay.querySelector("#diary-next-btn").addEventListener("click", () => changeDiaryPage(1));

  window.addEventListener("keydown", (e) => {
    if (!isDemiurgeDiaryReaderOpen()) return;
    if (e.key === "Escape" || e.code === "KeyL" || e.code === "KeyE") {
      e.preventDefault();
      // o input já guardou o toque de L/E para alternar o diário: sem limpar, o interactions reabriria o livro
      window.__game?.input?.consumeDiaryPressed?.();
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

// Lista de IDs legíveis: tomo completo = 1..21; folhas avulsas = só as descobertas.
// (usa só ids, então não precisa do conteúdo carregado para contar/navegar)
function _readableIds() {
  if (PlayerInventory.hasDemiurgeDiary) {
    const all = [];
    for (let id = 1; id <= TOTAL_PAGES; id++) all.push(id);
    return all;
  }
  const discovered = Array.isArray(PlayerInventory.discoveredBookPages) ? PlayerInventory.discoveredBookPages : [];
  return discovered.filter((id) => id >= 1 && id <= TOTAL_PAGES).sort((x, y) => x - y);
}

// Compatibilidade: lista de páginas já carregadas e legíveis
function _getReadablePages() {
  return _readableIds().map((id) => _pageById.get(id)).filter(Boolean);
}

function _renderCurrentPage() {
  if (!_diaryReaderModalEl) return;
  const hasBook = Boolean(PlayerInventory.hasDemiurgeDiary);
  const ids = _readableIds();

  const titleBadge = _diaryReaderModalEl.querySelector(".diary-book-title-badge");
  const closeBtn = _diaryReaderModalEl.querySelector("#diary-close-btn");
  const viewport = _diaryReaderModalEl.querySelector("#diary-viewport");
  const indicator = _diaryReaderModalEl.querySelector("#diary-page-indicator");
  const prevBtn = _diaryReaderModalEl.querySelector("#diary-prev-btn");
  const nextBtn = _diaryReaderModalEl.querySelector("#diary-next-btn");

  if (titleBadge) {
    titleBadge.innerHTML = hasBook
      ? `<span>Tractatus de Carcere · O Livro do Barro</span>`
      : `<span>Fragmento avulso do Tractatus de Carcere</span>`;
  }
  if (closeBtn) closeBtn.textContent = hasBook ? "Fechar (ESC / L)" : "Guardar (ESC / L)";

  if (ids.length === 0) {
    indicator.textContent = "Nenhum fragmento encontrado";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    viewport.innerHTML = `
      <div class="diary-parchment-sheet">
        <h2 class="diary-page-heading">Nenhum fragmento recolhido</h2>
        <p class="diary-story">Você não tem o livro encadernado nem qualquer folha solta.</p>
      </div>`;
    return;
  }

  _currentReadingPage = Math.max(0, Math.min(ids.length - 1, _currentReadingPage));
  const id = ids[_currentReadingPage];

  indicator.textContent = hasBook ? `Página ${_currentReadingPage + 1} de ${ids.length}` : `Fragmento ${_currentReadingPage + 1} de ${ids.length} (página ${id})`;
  prevBtn.disabled = _currentReadingPage === 0;
  nextBtn.disabled = _currentReadingPage === ids.length - 1;

  const page = _pageById.get(id);
  if (!page) {
    // página 1 já está carregada; as demais entram por import() dinâmico
    viewport.innerHTML = `<div class="diary-parchment-sheet"><p class="diary-story">Carregando…</p></div>`;
    ensureBookPagesLoaded().then(() => {
      if (isDemiurgeDiaryReaderOpen() && _pageById.has(id)) _renderCurrentPage();
    });
    return;
  }

  const isDiscovered = hasBook
    ? (!PlayerInventory.discoveredBookPages || PlayerInventory.discoveredBookPages.includes(page.id))
    : true;

  if (!isDiscovered) {
    viewport.innerHTML = `
      <div class="diary-parchment-sheet">
        <div class="diary-chapter-label">${_esc(page.chapter)}</div>
        <h2 class="diary-page-heading">Página arrancada</h2>
        <p class="diary-story">Arrancaram esta folha de você. Mas ela existe, e você vai sentir onde. Procure nos acampamentos dos servos, à noite. Procure entre as cinzas das cidades mortas.</p>
      </div>`;
    return;
  }

  if (page.id === 2) _hasReadPage2 = true;
  if (page.id === 19) _hasReadPage19 = true;

  viewport.innerHTML = `
    <div class="diary-parchment-sheet">
      <div class="diary-chapter-label">${_esc(page.chapter)}</div>
      <h2 class="diary-page-heading">${_esc(page.title)}</h2>
      <div class="diary-state-badge">
        ${page.origin ? `${_esc(page.origin)} · ` : ""}${_esc(page.stateLabel || "")}${!hasBook ? " · folha avulsa" : ""}
      </div>
      ${page.html || ""}
    </div>`;
  viewport.scrollTop = 0;
}

export function openDemiurgeDiaryReader(pageIndex = 0, audio = null) {
  const ids = _readableIds();
  if (ids.length === 0) {
    window.__game?.ui?.showToast?.(`✦ Você não tem o Diário dos Demiurgos nem qualquer fragmento. Dica: ${getDemiurgeDiaryHint()}`);
    return;
  }
  _currentReadingPage = Math.max(0, Math.min(ids.length - 1, pageIndex));
  const modal = _ensureDiaryModal(audio);
  _renderCurrentPage(); // a página 1 aparece na hora; o resto é carregado em seguida
  modal.classList.add("active");
  // Leitura = mundo parado: bloqueia o movimento/ações do personagem (o main.js congela o tempo enquanto aberto)
  if (!_inputLockedByBook) {
    const input = window.__game?.input;
    if (input?.setModalOpen) {
      _prevModalOpen = Boolean(input.modalOpen);
      input.setModalOpen(true);
      _inputLockedByBook = true;
    }
  }
  ensureBookPagesLoaded(); // ao abrir, carrega as outras páginas
  if (_cachedAudio?.bookPage) _cachedAudio.bookPage();
}

let _inputLockedByBook = false;
let _prevModalOpen = false;

export function closeDemiurgeDiaryReader() {
  if (_diaryReaderModalEl) {
    _diaryReaderModalEl.classList.remove("active");
  }
  // devolve o controle ao personagem (só se foi o livro que bloqueou)
  if (_inputLockedByBook) {
    _inputLockedByBook = false;
    window.__game?.input?.setModalOpen?.(_prevModalOpen);
  }

  // Efeito da Página 2: visão ganha filtro cinza por 3 segundos
  if (_hasReadPage2) {
    _hasReadPage2 = false;
    _triggerGreyFilterEffect(3);
    window.__game?.ui?.showToast?.("✦ A revelação do tumor cósmico turva sua visão em cinzas...");
  }

  // Efeito da Página 19: prenúncio do fim, a trilha sonora muda imediatamente
  if (_hasReadPage19) {
    _hasReadPage19 = false;
    window.__game?.music?.playTrack?.("tense");
    window.__game?.ui?.showToast?.("🌑 O Apocalipse do Olho Cego foi revelado... A música do mundo silencia em pavor.");
  }
}

export function isDemiurgeDiaryReaderOpen() {
  return _diaryReaderModalEl ? _diaryReaderModalEl.classList.contains("active") : false;
}

export function changeDiaryPage(delta) {
  const ids = _readableIds();
  const next = _currentReadingPage + delta;
  if (next >= 0 && next < ids.length) {
    _currentReadingPage = next;
    _renderCurrentPage();
    if (_cachedAudio?.bookPage) _cachedAudio.bookPage();
  }
}

// Pré-carga da primeira folha: monta o modal (CSS + DOM) e renderiza a página 1 em tempo ocioso,
// para a abertura do livro ser instantânea. Sem custo por frame.
function _preloadFirstPage() {
  const run = () => {
    try {
      _ensureDiaryModal(null);
      // página 1 já montada no DOM (independe do inventário); a abertura só re-renderiza se for preciso
      const viewport = _diaryReaderModalEl.querySelector("#diary-viewport");
      if (viewport && !viewport.firstChild) {
        viewport.innerHTML = `
          <div class="diary-parchment-sheet">
            <div class="diary-chapter-label">${_esc(FIRST_PAGE.chapter)}</div>
            <h2 class="diary-page-heading">${_esc(FIRST_PAGE.title)}</h2>
            <div class="diary-state-badge">${_esc(FIRST_PAGE.stateLabel)}</div>
            ${FIRST_PAGE.html}
          </div>`;
      }
    } catch (_) {}
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
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
  return _isCollected || Boolean(PlayerInventory.hasCollectedGroundBook);
}

export function initDemiurgeDiary({ scene, world, savedSpotIndex = null, isCollected = false }) {
  _cachedScene = scene;
  _cachedWorld = world;
  _preloadFirstPage();
  _isCollected = Boolean(isCollected || PlayerInventory.hasCollectedGroundBook);

  // Mundo procedural: os 5 candidatos (e as dicas de texto) vêm das âncoras da seed; o mundo canônico mantém os originais.
  if (!isCanonicalWorld()) {
    const gen = getBookSpotsFull();
    if (gen.length) {
      DEMIURGE_BOOK_SPOTS.length = 0;
      for (const g of gen) DEMIURGE_BOOK_SPOTS.push(g);
    }
  }

  if (
    savedSpotIndex !== null &&
    savedSpotIndex !== undefined &&
    typeof savedSpotIndex === "number" &&
    savedSpotIndex >= 0 &&
    savedSpotIndex < DEMIURGE_BOOK_SPOTS.length
  ) {
    _currentSpotIndex = savedSpotIndex;
  } else {
    _currentSpotIndex = Math.floor(worldRand(9001) * DEMIURGE_BOOK_SPOTS.length); // sorteio por seed (cada mundo esconde o livro num lugar)
  }

  const spot = DEMIURGE_BOOK_SPOTS[_currentSpotIndex];

  if (_demiurgeBookGroup && _demiurgeBookGroup.parent) {
    _demiurgeBookGroup.parent.remove(_demiurgeBookGroup);
  }

  // Se o livro físico do chão já foi pego, não recoloca o modelo
  if (_isCollected) {
    return null;
  }

  _demiurgeBookGroup = new THREE.Group();
  _demiurgeBookGroup.name = "TractatusDeCarcere";

  // Materiais do tomo: couro áspero que cheira a terra velha e cobre
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x180f0c, roughness: 0.95, flatShading: true });
  const copperTrimMat = new THREE.MeshStandardMaterial({ color: 0x9c4e2b, metalness: 0.8, roughness: 0.4, flatShading: true });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xc8b58a, roughness: 0.98, flatShading: true });
  const eyeSealMat = new THREE.MeshBasicMaterial({ color: 0xff1500 });

  // Capa inferior e capa superior
  const coverBottom = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.025, 0.50), leatherMat);
  coverBottom.position.set(0, 0.015, 0);
  coverBottom.castShadow = true;
  _demiurgeBookGroup.add(coverBottom);

  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.47), paperMat);
  pages.position.set(0.01, 0.065, 0);
  _demiurgeBookGroup.add(pages);

  const coverTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.025, 0.50), leatherMat);
  coverTop.position.set(0, 0.115, 0);
  coverTop.castShadow = true;
  _demiurgeBookGroup.add(coverTop);

  // Lombada reforçada de couro envelhecido
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.125, 0.50), leatherMat);
  spine.position.set(-0.185, 0.065, 0);
  _demiurgeBookGroup.add(spine);

  // Cantoneiras de cobre oxidado
  for (const cx of [-0.165, 0.165]) {
    for (const cz of [-0.225, 0.225]) {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.030, 0.055), copperTrimMat);
      corner.position.set(cx, 0.116, cz);
      _demiurgeBookGroup.add(corner);
    }
  }

  // Olho Oculto do Demiurgo na capa frontal
  const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 6), eyeSealMat);
  eyeGlow.position.set(0.02, 0.132, 0);
  eyeGlow.scale.set(1.2, 0.35, 0.85);
  _demiurgeBookGroup.add(eyeGlow);

  const eyePupil = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.028, 0.055), copperTrimMat);
  eyePupil.position.set(0.02, 0.136, 0);
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

let _fogReliefSet = false;

// Perto do livro no mundo a neblina de dia alivia um pouco (dayNight.fogRelief 0..1, suavizado no daynight).
function _setFogRelief(value) {
  const dn = window.__game?.dayNight;
  if (!dn) return;
  if (value > 0) {
    dn.fogRelief = value;
    _fogReliefSet = true;
  } else if (_fogReliefSet) {
    dn.fogRelief = 0;
    _fogReliefSet = false;
  }
}

export function updateDemiurgeDiary(dt, now = performance.now()) {
  if (!_bookLight || !_demiurgeBookGroup || !_demiurgeBookGroup.visible || _isCollected || PlayerInventory.hasCollectedGroundBook) {
    _setFogRelief(0); // livro coletado/ausente: neblina volta ao normal
    return;
  }
  _bookLight.intensity = 1.2 + Math.sin(now * 0.0035) * 0.45;
  const player = window.__game?.player;
  if (player) {
    const dx = player.x - _demiurgeBookGroup.position.x;
    const dz = player.z - _demiurgeBookGroup.position.z;
    const rel = Math.max(0, Math.min(1, 1 - Math.sqrt(dx * dx + dz * dz) / 35));
    _setFogRelief(rel);
  }
}

export function checkDemiurgeDiaryNearby(playerPos) {
  if (!_demiurgeBookGroup || !_demiurgeBookGroup.visible || _isCollected || PlayerInventory.hasCollectedGroundBook) {
    return false;
  }
  const dx = (playerPos.x ?? 0) - _demiurgeBookGroup.position.x;
  const dz = (playerPos.z ?? 0) - _demiurgeBookGroup.position.z;
  return dx * dx + dz * dz < 2.8 * 2.8;
}

export function interactWithDemiurgeDiary(playerPos, ui, audio, input) {
  if (!checkDemiurgeDiaryNearby(playerPos)) return false;

  // Coleta o Tomo Básico para o Inventário do Jogador
  _isCollected = true;
  PlayerInventory.hasCollectedGroundBook = true;
  PlayerInventory.hasDemiurgeDiary = true;

  // O livro no chão é o conjunto básico de páginas do Tractatus de Carcere
  const basePages = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 20];
  if (!Array.isArray(PlayerInventory.discoveredBookPages)) {
    PlayerInventory.discoveredBookPages = [];
  }
  for (const bp of basePages) {
    if (!PlayerInventory.discoveredBookPages.includes(bp)) {
      PlayerInventory.discoveredBookPages.push(bp);
    }
  }

  if (_demiurgeBookGroup) {
    _demiurgeBookGroup.visible = false;
    if (_demiurgeBookGroup.parent) {
      _demiurgeBookGroup.parent.remove(_demiurgeBookGroup);
    }
  }

  PlayerStats.cha += 1;
  syncPlayerStatsToPlayer();

  import("./decay.js").then(({ addEvil }) => {
    addEvil(2, "Recolheu o Tractatus de Carcere (O Livro do Barro)");
  });

  ui?.showToast?.("✦ Tractatus de Carcere recolhido! As páginas básicas do Tomo do Barro foram reunidas [L]! (+1 Carisma)");
  audio?.bookPage?.();

  // Abre imediatamente o leitor na página 1
  openDemiurgeDiaryReader(0, audio);
  return true;
}
