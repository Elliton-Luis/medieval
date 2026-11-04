import { WorldDecay } from "./decay.js";
import {
  PlayerStats,
  PlayerInventory,
  PlayerEquipment,
  equipArmor,
  syncPlayerStatsToPlayer,
  getEvilPercent,
  setEvilPercent,
  addEvil,
  addGood,
} from "./rpg.js";
import { WEAPON_LIST } from "./weapondata.js";
import { CRYSTAL_PALETTE, applyTorchColor } from "./crystals.js";

let _cheatModalEl = null;
let _activeEnv = null;

const CHEAT_MODAL_CSS = `
#cheat-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 5, 12, 0.86);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
#cheat-modal-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.cheat-panel {
  background: linear-gradient(180deg, #1b1424 0%, #100b17 100%);
  border: 2px solid #8e54e9;
  border-radius: 12px;
  box-shadow: 0 0 55px rgba(142, 84, 233, 0.55), inset 0 0 30px rgba(0, 0, 0, 0.85);
  padding: 24px 32px;
  max-width: 1180px;
  width: 96%;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  color: #f0e6ff;
  position: relative;
  animation: cheat-pop 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
@keyframes cheat-pop {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1.0); opacity: 1; }
}
.cheat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(142, 84, 233, 0.35);
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.cheat-title {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: #c9a9ff;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cheat-close-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ff8888;
  font-size: 16px;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.cheat-close-btn:hover {
  background: #ff4444;
  color: #fff;
}

/* Abas de Navegação: Todas as categorias visíveis simultaneamente sem corte ou scroll quebrado */
.cheat-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 10px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.cheat-tab-btn {
  background: rgba(142, 84, 233, 0.14);
  border: 1px solid rgba(142, 84, 233, 0.38);
  border-radius: 6px;
  color: #c5b4e3;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  flex: 0 0 auto;
}
.cheat-tab-btn:hover {
  background: rgba(142, 84, 233, 0.32);
  border-color: #bb86fc;
  color: #ffffff;
}
.cheat-tab-btn.active {
  background: #8e54e9;
  border-color: #bb86fc;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(142, 84, 233, 0.7);
}

/* Painel de Recursos em Tempo Real */
.cheat-status-box {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(142, 84, 233, 0.25);
  border-radius: 6px;
  padding: 8px 14px;
  margin-bottom: 14px;
  font-size: 12.5px;
  color: #d8cce8;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  line-height: 1.4;
}
.cheat-status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.cheat-status-val {
  font-weight: 700;
  color: #ffd700;
}

/* Área de Conteúdo das Abas */
.cheat-body {
  overflow-y: auto;
  max-height: 58vh;
  padding-right: 8px;
  margin-bottom: 14px;
  scrollbar-width: thin;
  scrollbar-color: #8e54e9 #1b1424;
}
.cheat-body::-webkit-scrollbar {
  width: 6px;
}
.cheat-body::-webkit-scrollbar-track {
  background: #120e18;
}
.cheat-body::-webkit-scrollbar-thumb {
  background: #8e54e9;
  border-radius: 3px;
}

.cheat-tab-content {
  display: none;
}
.cheat-tab-content.active {
  display: block;
}

.cheat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.cheat-btn {
  background: rgba(142, 84, 233, 0.14);
  border: 1px solid rgba(142, 84, 233, 0.45);
  border-radius: 6px;
  color: #ede2ff;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.16s ease;
  text-align: left;
}
.cheat-btn:hover {
  background: rgba(142, 84, 233, 0.38);
  border-color: #bb86fc;
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(142, 84, 233, 0.3);
}
.cheat-btn:active {
  transform: translateY(0);
}
.cheat-btn.full-width {
  grid-column: 1 / -1;
}
.cheat-btn.highlight {
  background: rgba(255, 215, 0, 0.18);
  border-color: #ffd700;
  color: #ffe688;
}
.cheat-btn.highlight:hover {
  background: rgba(255, 215, 0, 0.3);
  color: #ffffff;
}

.cheat-tip {
  font-size: 11.5px;
  color: #9f8fb5;
  text-align: center;
  margin: 0;
  padding-top: 4px;
}
`;

function _injectCheatStyles() {
  let style = document.getElementById("cheat-modal-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "cheat-modal-styles";
    document.head.appendChild(style);
  }
  style.textContent = CHEAT_MODAL_CSS;
}

function _updateStatusDisplays() {
  if (!_cheatModalEl) return;
  const woodEl = _cheatModalEl.querySelector("#cs-wood");
  const stoneEl = _cheatModalEl.querySelector("#cs-stone");
  const clayEl = _cheatModalEl.querySelector("#cs-clay");
  const hayEl = _cheatModalEl.querySelector("#cs-hay");
  const goldEl = _cheatModalEl.querySelector("#cs-gold");
  const torchesEl = _cheatModalEl.querySelector("#cs-torches");
  const potionsEl = _cheatModalEl.querySelector("#cs-potions");
  const candleEl = _cheatModalEl.querySelector("#cs-candles");
  const crystalsEl = _cheatModalEl.querySelector("#cs-crystals");
  const torchColorEl = _cheatModalEl.querySelector("#cs-torch-color");

  if (woodEl) woodEl.textContent = String(PlayerInventory.wood || 0);
  if (stoneEl) stoneEl.textContent = String(PlayerInventory.stone || 0);
  if (clayEl) clayEl.textContent = String(PlayerInventory.clay || 0);
  if (hayEl) hayEl.textContent = String(PlayerInventory.hay || 0);
  if (goldEl) goldEl.textContent = String(PlayerInventory.gold || 0);
  if (torchesEl) torchesEl.textContent = String(PlayerInventory.torches || 0);

  const potCount = _activeEnv?.player?.potions ?? 0;
  if (potionsEl) potionsEl.textContent = String(potCount);

  const candleCount = _activeEnv?.candle?.count ?? window.__game?.candle?.count ?? 0;
  if (candleEl) candleEl.textContent = String(candleCount);

  const cry = PlayerInventory.crystals || {};
  if (crystalsEl) {
    crystalsEl.textContent = `🟢${cry.green || 0} 🔵${cry.blue || 0} 🌸${cry.pink || 0} 🔴${cry.red || 0} ⚪${cry.white || 0} 🟣${cry.purple || 0}`;
  }

  const curColor = CRYSTAL_PALETTE[PlayerInventory.torchColor]?.name || PlayerInventory.torchColor || "Fogo Comum";
  if (torchColorEl) torchColorEl.textContent = curColor;

  const clockEl = _cheatModalEl.querySelector("#cs-clock");
  const dn = _activeEnv?.dayNight || window.__game?.dayNight;
  if (clockEl && dn) {
    const totalMinutes = Math.floor((dn.progress ?? 0.36) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
    const minutes = (totalMinutes % 60).toString().padStart(2, "0");
    const prof = dn.currentProfile ? dn.currentProfile.toUpperCase() : (dn.isNight ? "NOITE" : "DIA");
    const w = dn.weights ? ` · [D:${Math.round(dn.weights.day * 100)}% T:${Math.round(dn.weights.afternoon * 100)}% N:${Math.round(dn.weights.night * 100)}%]` : "";
    clockEl.textContent = `${hours}:${minutes} (${prof}${w})`;
  }

  const dayEl = _cheatModalEl.querySelector("#cs-day");
  const curDay = WorldDecay?.daysPassed ?? 1;
  if (dayEl) dayEl.textContent = `Dia ${curDay}${WorldDecay?.isEclipse ? " (🌑 Eclipse)" : ""}`;

  const evilEl = _cheatModalEl.querySelector("#cs-evil");
  const curEvil = getEvilPercent();
  if (evilEl) evilEl.textContent = `${curEvil}%`;

  const dayLabel = _cheatModalEl.querySelector("#cheat-day-label");
  if (dayLabel) dayLabel.textContent = `Dia ${curDay}${WorldDecay?.isEclipse ? " · 🌑 ECLIPSE" : ""}`;

  const dayInput = _cheatModalEl.querySelector("#cheat-day-input");
  if (dayInput && document.activeElement !== dayInput) dayInput.value = curDay;

  const evilLabel = _cheatModalEl.querySelector("#cheat-evil-label");
  if (evilLabel) evilLabel.textContent = `${curEvil}% Maldade`;

  const evilSlider = _cheatModalEl.querySelector("#cheat-evil-slider");
  if (evilSlider && document.activeElement !== evilSlider) evilSlider.value = curEvil;
}

export function openCheatModal(env) {
  _activeEnv = env || window.__game || {};
  _injectCheatStyles();

  if (!_cheatModalEl) {
    _cheatModalEl = document.createElement("div");
    _cheatModalEl.id = "cheat-modal-overlay";
    document.body.appendChild(_cheatModalEl);
  }

  _cheatModalEl.innerHTML = `
    <div class="cheat-panel" role="dialog" aria-modal="true">
      <div class="cheat-header">
        <h2 class="cheat-title">🥔 CHEAT MENU · PURIS RECURSOS & DEBUG</h2>
        <button class="cheat-close-btn" id="cheat-btn-close" aria-label="Fechar">✕</button>
      </div>

      <!-- Barra de Abas -->
      <div class="cheat-tabs">
        <button class="cheat-tab-btn active" data-tab="quick">🌟 Ações Rápidas</button>
        <button class="cheat-tab-btn" data-tab="time">⏰ Horário & Tempo</button>
        <button class="cheat-tab-btn" data-tab="resources">🪵 Recursos & Matérias</button>
        <button class="cheat-tab-btn" data-tab="crystals">💎 Cristais & Tochas</button>
        <button class="cheat-tab-btn" data-tab="ammo">🏹 Consumíveis & Munição</button>
        <button class="cheat-tab-btn" data-tab="weapons">⚔️ Arsenal & Armaduras</button>
        <button class="cheat-tab-btn" data-tab="spawns">🐾 Spawns & Criaturas</button>
        <button class="cheat-tab-btn" data-tab="events">⚡ Poderes & Eventos</button>
      </div>

      <!-- Status em Tempo Real -->
      <div class="cheat-status-box">
        <div class="cheat-status-item">⏰ Horário: <span class="cheat-status-val" id="cs-clock">--:--</span></div>
        <div class="cheat-status-item">📅 Dia: <span class="cheat-status-val" id="cs-day">Dia 1</span></div>
        <div class="cheat-status-item">⚖️ Maldade: <span class="cheat-status-val" id="cs-evil">0%</span></div>
        <div class="cheat-status-item">🪵 Mad: <span class="cheat-status-val" id="cs-wood">0</span></div>
        <div class="cheat-status-item">🪨 Ped: <span class="cheat-status-val" id="cs-stone">0</span></div>
        <div class="cheat-status-item">🏺 Barro: <span class="cheat-status-val" id="cs-clay">0</span></div>
        <div class="cheat-status-item">🌾 Feno: <span class="cheat-status-val" id="cs-hay">0</span></div>
        <div class="cheat-status-item">🪙 Ouro: <span class="cheat-status-val" id="cs-gold">0</span></div>
        <div class="cheat-status-item">🔦 Tochas: <span class="cheat-status-val" id="cs-torches">0</span></div>
        <div class="cheat-status-item">🧪 Poções: <span class="cheat-status-val" id="cs-potions">0</span></div>
        <div class="cheat-status-item">🕯️ Velas: <span class="cheat-status-val" id="cs-candles">0</span></div>
        <div class="cheat-status-item">🔥 Tocha: <span class="cheat-status-val" id="cs-torch-color">Laranja</span></div>
        <div class="cheat-status-item">💎 Cristais: <span class="cheat-status-val" id="cs-crystals">--</span></div>
      </div>

      <!-- Conteúdo das Abas -->
      <div class="cheat-body">

        <!-- ABA 1: RÁPIDAS -->
        <div class="cheat-tab-content active" id="tab-quick">
          <div class="cheat-grid">
            <button class="cheat-btn highlight full-width" data-cheat="maxAllItems">🎒 Encher Todos os Itens, Recursos, Arsenal & Atributos (Max)</button>
            <button class="cheat-btn highlight full-width" data-cheat="giveAllResources">📦 Dar +500 de Todos os Recursos de Construção & Forja</button>
            <button class="cheat-btn highlight full-width" data-cheat="giveAllCrystals">💎 Dar +20 de Todos os Cristais Místicos para Tochas</button>
            <button class="cheat-btn" data-cheat="time_set_day">☀️ Mudar para Dia (10:00)</button>
            <button class="cheat-btn" data-cheat="time_set_night">🌙 Mudar para Noite (22:00)</button>
            <button class="cheat-btn" data-cheat="godMode">⚡ Modo Deus (Vida Infinita)</button>
            <button class="cheat-btn" data-cheat="makeMeRich">💰 +10.000 Ouro</button>
            <button class="cheat-btn" data-cheat="giveAllWeapons">⚔️ Liberar Todo o Arsenal</button>
            <button class="cheat-btn" data-cheat="giveAllAmmo">🏹 Max Todas as Munições (99)</button>
            <button class="cheat-btn" data-cheat="forgiveSins">🕊️ Perdoar Pecados & Voto</button>
            <button class="cheat-btn" data-cheat="killAllEnemies">💀 Exterminar Inimigos Próximos</button>
            <button class="cheat-btn" data-cheat="giveDemiurgeDiary">📖 Obter Livro do Demiurgo (L)</button>
            <button class="cheat-btn" data-cheat="demiurgeRobe">👑 Vestir Traje do Culto</button>
          </div>
        </div>

        <!-- ABA DE HORÁRIO & TEMPO -->
        <div class="cheat-tab-content" id="tab-time">
          <div class="cheat-time-slider-box" style="background: rgba(142, 84, 233, 0.12); border: 1px solid rgba(142, 84, 233, 0.35); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-weight: 700; color: #ffd700; font-size: 13.5px;">⏰ Seletor de Hora Precisa (0h a 23h):</span>
              <span id="cheat-slider-label" style="font-size: 15px; font-weight: 800; color: #ffffff; background: #8e54e9; padding: 3px 12px; border-radius: 12px;">12:00</span>
            </div>
            <input type="range" id="cheat-time-slider" min="0" max="23" step="1" value="12" style="width: 100%; cursor: pointer; accent-color: #8e54e9; margin-bottom: 12px;">
            <button class="cheat-btn highlight full-width" id="cheat-apply-slider-time">🎯 Aplicar Horário Selecionado no Slider</button>
          </div>

          <div style="font-size: 12px; color: #ffd700; font-weight: 700; margin: 10px 0 6px 2px; text-transform: uppercase; letter-spacing: 1px;">🎨 Perfis de Iluminação Pré-Assados (Baked Lighting)</div>
          <div class="cheat-grid" style="margin-bottom: 12px;">
            <button class="cheat-btn highlight" data-cheat="lighting_day">☀️ Perfil Assado: DIA (12:00)</button>
            <button class="cheat-btn highlight" data-cheat="lighting_afternoon">🌇 Perfil Assado: TARDE (18:00)</button>
            <button class="cheat-btn highlight" data-cheat="lighting_night">🌙 Perfil Assado: NOITE (22:00)</button>
          </div>

          <div style="font-size: 12px; color: #bba8d8; font-weight: 700; margin: 10px 0 6px 2px; text-transform: uppercase; letter-spacing: 1px;">Presets de Horário Imediatos</div>
          <div class="cheat-grid">
            <button class="cheat-btn" data-cheat="time_dawn">🌅 Amanhecer (06:00)</button>
            <button class="cheat-btn" data-cheat="time_morning">☀️ Manhã Ensolarada (09:00)</button>
            <button class="cheat-btn" data-cheat="time_noon">☀️ Meio-Dia Pleno (12:00)</button>
            <button class="cheat-btn" data-cheat="time_afternoon">🌤️ Meio da Tarde (15:00)</button>
            <button class="cheat-btn" data-cheat="time_sunset">🌇 Pôr do Sol / Crepúsculo (18:00)</button>
            <button class="cheat-btn" data-cheat="time_dusk">🌆 Anoitecer (19:30)</button>
            <button class="cheat-btn" data-cheat="time_night">🌙 Noite Profunda (21:30)</button>
            <button class="cheat-btn" data-cheat="time_midnight">🌌 Meia-Noite dos Rituais (00:00)</button>
            <button class="cheat-btn" data-cheat="time_witching">🌑 Madrugada dos Ermos (03:00)</button>
            <button class="cheat-btn" data-cheat="time_set_day">☀️ Fazer Dia Imediato (10:00)</button>
            <button class="cheat-btn" data-cheat="time_set_night">🌙 Fazer Noite Imediata (22:00)</button>
          </div>

          <div style="font-size: 12px; color: #bba8d8; font-weight: 700; margin: 14px 0 6px 2px; text-transform: uppercase; letter-spacing: 1px;">Avançar & Retroceder o Relógio</div>
          <div class="cheat-grid">
            <button class="cheat-btn" data-cheat="time_add_1h">⏩ Avançar +1 Hora</button>
            <button class="cheat-btn" data-cheat="time_sub_1h">⏪ Voltar -1 Hora</button>
            <button class="cheat-btn" data-cheat="time_add_3h">⏩ Avançar +3 Horas</button>
            <button class="cheat-btn" data-cheat="time_add_6h">⏩ Avançar +6 Horas</button>
            <button class="cheat-btn" data-cheat="time_add_12h">⏩ Avançar +12 Horas (Meio Ciclo)</button>
          </div>

          <div style="font-size: 12px; color: #ffd700; font-weight: 700; margin: 16px 0 6px 2px; text-transform: uppercase; letter-spacing: 1px;">📅 Controle de Dias do Mundo (Decaimento & Juízo)</div>
          <div class="cheat-time-slider-box" style="background: rgba(142, 84, 233, 0.12); border: 1px solid rgba(142, 84, 233, 0.35); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-weight: 700; color: #ffd700; font-size: 13.5px;">📅 Seleção Direta de Dia:</span>
              <span id="cheat-day-label" style="font-size: 15px; font-weight: 800; color: #ffffff; background: #8e54e9; padding: 3px 12px; border-radius: 12px;">Dia 1</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
              <button class="cheat-btn" id="cheat-prev-day" style="flex: 1;">◀ Dia Anterior</button>
              <input type="number" id="cheat-day-input" min="1" max="999" value="1" style="width: 75px; text-align: center; background: #160f22; border: 1px solid #8e54e9; color: #fff; font-weight: bold; border-radius: 6px; padding: 6px;">
              <button class="cheat-btn" id="cheat-next-day" style="flex: 1;">Dia Seguinte ▶</button>
              <button class="cheat-btn highlight" id="cheat-apply-day" style="flex: 1.2;">🎯 Definir Dia</button>
            </div>
            <div class="cheat-grid" style="grid-template-columns: repeat(4, 1fr);">
              <button class="cheat-btn" data-cheat="set_day_1">Dia 1 (Início)</button>
              <button class="cheat-btn" data-cheat="set_day_3">Dia 3 (Tensão)</button>
              <button class="cheat-btn" data-cheat="set_day_5">Dia 5 (Pré-Eclipse)</button>
              <button class="cheat-btn" data-cheat="set_day_7">Dia 7 (Juízo Final)</button>
            </div>
          </div>

          <div style="font-size: 12px; color: #ff6b6b; font-weight: 700; margin: 16px 0 6px 2px; text-transform: uppercase; letter-spacing: 1px;">⚖️ Manipulador do Índice de Maldade & Corrupção</div>
          <div class="cheat-time-slider-box" style="background: rgba(233, 84, 84, 0.12); border: 1px solid rgba(233, 84, 84, 0.35); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-weight: 700; color: #ff8888; font-size: 13.5px;">⚖️ Barra de Nível de Maldade:</span>
              <span id="cheat-evil-label" style="font-size: 15px; font-weight: 800; color: #ffffff; background: #e95454; padding: 3px 12px; border-radius: 12px;">0% Maldade</span>
            </div>
            <input type="range" id="cheat-evil-slider" min="0" max="100" step="1" value="0" style="width: 100%; cursor: pointer; accent-color: #e95454; margin-bottom: 12px;">
            <button class="cheat-btn highlight full-width" id="cheat-apply-evil" style="background: linear-gradient(135deg, #c0392b, #8e44ad); margin-bottom: 10px;">🎯 Aplicar Índice de Maldade do Slider</button>
            <div class="cheat-grid" style="grid-template-columns: repeat(5, 1fr);">
              <button class="cheat-btn" data-cheat="evil_0">😇 0% (Santo)</button>
              <button class="cheat-btn" data-cheat="evil_25">🙂 25% (Puro)</button>
              <button class="cheat-btn" data-cheat="evil_50">⚖️ 50% (Neutro)</button>
              <button class="cheat-btn" data-cheat="evil_75">😈 75% (Corrupto)</button>
              <button class="cheat-btn" data-cheat="evil_100">💀 100% (Herege)</button>
            </div>
          </div>
        </div>

        <!-- ABA 2: RECURSOS & MATÉRIAS-PRIMAS -->
        <div class="cheat-tab-content" id="tab-resources">
          <div class="cheat-grid">
            <button class="cheat-btn highlight full-width" data-cheat="giveAllResources">📦 +500 em Todos os Recursos (Madeira, Pedra, Barro, Feno, Tochas)</button>
            <button class="cheat-btn" data-cheat="wood_100">🪵 +100 Madeira</button>
            <button class="cheat-btn" data-cheat="wood_999">🪵 Max Madeira (999)</button>
            <button class="cheat-btn" data-cheat="stone_100">🪨 +100 Pedra</button>
            <button class="cheat-btn" data-cheat="stone_999">🪨 Max Pedra (999)</button>
            <button class="cheat-btn" data-cheat="clay_100">🏺 +100 Barro / Argila</button>
            <button class="cheat-btn" data-cheat="clay_999">🏺 Max Barro (999)</button>
            <button class="cheat-btn" data-cheat="hay_50">🌾 +50 Feno</button>
            <button class="cheat-btn" data-cheat="hay_999">🌾 Max Feno (999)</button>
            <button class="cheat-btn" data-cheat="torches_25">🔦 +25 Tochas</button>
            <button class="cheat-btn" data-cheat="torches_99">🔦 Max Tochas (99)</button>
            <button class="cheat-btn" data-cheat="gold_5k">🪙 +5.000 Ouro</button>
            <button class="cheat-btn" data-cheat="gold_50k">🪙 +50.000 Ouro</button>
          </div>
        </div>

        <!-- ABA 3: CRISTAIS MÍSTICOS & TOCHAS -->
        <div class="cheat-tab-content" id="tab-crystals">
          <div class="cheat-grid">
            <button class="cheat-btn highlight full-width" data-cheat="giveAllCrystals">💎 +20 de Todos os Cristais Místicos (6 Cores)</button>
            <button class="cheat-btn" data-cheat="cry_green">🟢 +10 Esmeralda (Verde)</button>
            <button class="cheat-btn" data-cheat="set_torch_green">🔥 Infundir Tocha: Verde</button>
            <button class="cheat-btn" data-cheat="cry_blue">🔵 +10 Safira (Azul)</button>
            <button class="cheat-btn" data-cheat="set_torch_blue">🔥 Infundir Tocha: Azul</button>
            <button class="cheat-btn" data-cheat="cry_pink">🌸 +10 Quartzo (Rosa)</button>
            <button class="cheat-btn" data-cheat="set_torch_pink">🔥 Infundir Tocha: Rosa</button>
            <button class="cheat-btn" data-cheat="cry_red">🔴 +10 Rubi (Vermelho)</button>
            <button class="cheat-btn" data-cheat="set_torch_red">🔥 Infundir Tocha: Vermelho</button>
            <button class="cheat-btn" data-cheat="cry_white">⚪ +10 Diamante (Branco)</button>
            <button class="cheat-btn" data-cheat="set_torch_white">🔥 Infundir Tocha: Branco</button>
            <button class="cheat-btn" data-cheat="cry_purple">🟣 +10 Ametista (Roxo)</button>
            <button class="cheat-btn" data-cheat="set_torch_purple">🔥 Infundir Tocha: Roxo</button>
            <button class="cheat-btn full-width" data-cheat="set_torch_orange">🔥 Restaurar Tocha Comum (Laranja)</button>
          </div>
        </div>

        <!-- ABA 4: CONSUMÍVEIS & MUNIÇÃO -->
        <div class="cheat-tab-content" id="tab-ammo">
          <div class="cheat-grid">
            <button class="cheat-btn highlight full-width" data-cheat="giveAllAmmo">🏹 Max Todas as Munições & Consumíveis (99 de tudo)</button>
            <button class="cheat-btn" data-cheat="potions_10">🧪 +10 Poções de Cura</button>
            <button class="cheat-btn" data-cheat="potions_99">🧪 Max Poções (99)</button>
            <button class="cheat-btn" data-cheat="candles_20">🕯️ +20 Velas de Cera</button>
            <button class="cheat-btn" data-cheat="candles_99">🕯️ Max Velas (99)</button>
            <button class="cheat-btn" data-cheat="arrows_50">🏹 +50 Flechas (Arco)</button>
            <button class="cheat-btn" data-cheat="bolts_50">🎯 +50 Virotes (Besta)</button>
            <button class="cheat-btn" data-cheat="bombs_25">💣 +25 Bombas Incendiárias</button>
            <button class="cheat-btn" data-cheat="knives_25">🗡️ +25 Facas de Arremesso</button>
            <button class="cheat-btn full-width" data-cheat="oil_25">🛢️ +25 Potes de Óleo Inflamável</button>
          </div>
        </div>

        <!-- ABA 5: ARSENAL & ARMADURAS -->
        <div class="cheat-tab-content" id="tab-weapons">
          <div class="cheat-grid">
            <button class="cheat-btn highlight full-width" data-cheat="giveAllWeapons">⚔️ Liberar Todo o Arsenal & Forja Nível 5</button>
            <button class="cheat-btn" data-cheat="armor0">🛡️ Armadura 0 (Camponês)</button>
            <button class="cheat-btn" data-cheat="armor1">🛡️ Armadura 1 (Couro)</button>
            <button class="cheat-btn" data-cheat="armor2">🛡️ Armadura 2 (Cota de Malha)</button>
            <button class="cheat-btn" data-cheat="armor3">🛡️ Armadura 3 (Placas Templárias)</button>
            <button class="cheat-btn" data-cheat="giveTools">🪓 Machado & Picareta de Trabalho</button>
            <button class="cheat-btn" data-cheat="giveDemiurgeDiary">📖 Diário do Demiurgo (Livro do Barro)</button>
            <button class="cheat-btn full-width" data-cheat="demiurgeRobe">👑 Vestir Traje Completo do Demiurgo (Capa & Máscara)</button>
          </div>
        </div>

        <!-- ABA 6: SPAWNS DE ENTIDADES (MONSTROS, NPCS & CAVALOS) -->
        <div class="cheat-tab-content" id="tab-spawns">
          <div style="font-size:12px; font-weight:700; color:#c792ea; margin-bottom:6px; letter-spacing:1px; text-transform:uppercase;">
            🐺 Monstros, Abominações & Seita Cátara
          </div>
          <div class="cheat-grid" style="margin-bottom:14px;">
            <button class="cheat-btn" data-cheat="spawn_werewolf">🐺 Lobisomem (Werewolf)</button>
            <button class="cheat-btn" data-cheat="spawn_gulur">🦒 Gulur (Colosso de 16m)</button>
            <button class="cheat-btn" data-cheat="spawn_necron">💀 Necron (Cego Devorador)</button>
            <button class="cheat-btn" data-cheat="spawn_hexoculus">👁️ Hexoculus (6 Olhos)</button>
            <button class="cheat-btn" data-cheat="spawn_polyphonia">🐍 Polyphonia (Múltiplas Bocas)</button>
            <button class="cheat-btn" data-cheat="spawn_cultist">🌑 Cultista Cátaro (Servo)</button>
            <button class="cheat-btn" data-cheat="summonCultLeader">👑 Grão-Mestre Morvath</button>
            <button class="cheat-btn" data-cheat="summonMessenger">👁️ Mensageiro do Demiurgo</button>
          </div>

          <div style="font-size:12px; font-weight:700; color:#ffcb6b; margin-bottom:6px; letter-spacing:1px; text-transform:uppercase;">
            🐎 Cavalos & Montarias
          </div>
          <div class="cheat-grid" style="margin-bottom:14px;">
            <button class="cheat-btn" data-cheat="spawn_horse_wild">🐎 Cavalo Selvagem (Ágil)</button>
            <button class="cheat-btn" data-cheat="spawn_horse_tame">🐎 Cavalo com Sela (Domesticado)</button>
            <button class="cheat-btn" data-cheat="spawn_horse_thoroughbred">🦄 Puro-Sangue Real</button>
          </div>

          <div style="font-size:12px; font-weight:700; color:#c3e88d; margin-bottom:6px; letter-spacing:1px; text-transform:uppercase;">
            🧑 Cidadãos, Ofícios & Guardas (NPCs)
          </div>
          <div class="cheat-grid">
            <button class="cheat-btn" data-cheat="spawn_npc_guard">🛡️ Guarda Real da Patrulha</button>
            <button class="cheat-btn" data-cheat="spawn_npc_smith">🔨 Ferreiro / Armeiro</button>
            <button class="cheat-btn" data-cheat="spawn_npc_merchant">⚖️ Mercador de Caldera</button>
            <button class="cheat-btn" data-cheat="spawn_npc_priest">✝️ Padre / Sacerdote</button>
            <button class="cheat-btn" data-cheat="spawn_npc_farmer">🌾 Camponês / Agricultor</button>
            <button class="cheat-btn" data-cheat="spawn_npc_villager">🧑 Aldeão / Habitante</button>
            <button class="cheat-btn" data-cheat="spawn_npc_beggar">🪙 Mendigo Solicitante</button>
            <button class="cheat-btn" data-cheat="spawn_npc_bandit">🗡️ Bandido dos Ermos</button>
          </div>
        </div>

        <!-- ABA 7: EVENTOS & PODERES -->
        <div class="cheat-tab-content" id="tab-events">
          <div class="cheat-grid">
            <button class="cheat-btn full-width highlight" data-cheat="toggleDebugScreen">📊 Alternar Tela de Debug F3 (Estatísticas do Jogo)</button>
            <button class="cheat-btn" data-cheat="godMode">⚡ Modo Deus (Vida Infinita)</button>
            <button class="cheat-btn" data-cheat="setSpeed">🏃 Super Velocidade (2.5x)</button>
            <button class="cheat-btn" data-cheat="forgiveSins">🕊️ Perdoar Pecados & Voto</button>
            <button class="cheat-btn" data-cheat="killAllEnemies">💀 Exterminar Inimigos Próximos</button>
            <button class="cheat-btn" data-cheat="spawnWerewolf">🐺 Invocar Lobisomem nos Ermos</button>
            <button class="cheat-btn" data-cheat="summonMessenger">👁️ Invocar Mensageiro do Demiurgo</button>
            <button class="cheat-btn" data-cheat="summonCultLeader">👁️ Invocar Líder da Seita Cátara</button>
            <button class="cheat-btn full-width" data-cheat="holyEnding">✝️ O Final Bom: A Trombeta e Assunção Sagrada</button>
            <button class="cheat-btn full-width" data-cheat="apocalypse">☄️ O Mal Final: Descida do Demiurgo (Apocalipse)</button>
          </div>
        </div>

      </div>

      <p class="cheat-tip">Digite <code>POTATO</code> ou <code>CHIEFS</code> no teclado a qualquer hora para abrir este menu, ou use o console: <code>window.CheatMenu.giveAllResources()</code>.</p>
    </div>
  `;

  _updateStatusDisplays();
  _cheatModalEl.classList.add("active");

  const close = () => {
    if (!_cheatModalEl.classList.contains("active")) return;
    _cheatModalEl.classList.remove("active");
    window.removeEventListener("keydown", onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape" || e.code === "Escape") {
      e.preventDefault();
      close();
    }
  };

  window.addEventListener("keydown", onKeyDown);

  const btnClose = _cheatModalEl.querySelector("#cheat-btn-close");
  btnClose?.addEventListener("click", () => close());
  _cheatModalEl.addEventListener("click", (e) => {
    if (e.target === _cheatModalEl) close();
  });

  // Alternância de Abas
  const tabBtns = _cheatModalEl.querySelectorAll(".cheat-tab-btn");
  tabBtns.forEach((tb) => {
    tb.addEventListener("click", () => {
      const targetTab = tb.getAttribute("data-tab");
      tabBtns.forEach((b) => b.classList.remove("active"));
      tb.classList.add("active");

      const contents = _cheatModalEl.querySelectorAll(".cheat-tab-content");
      contents.forEach((c) => c.classList.remove("active"));
      const activeContent = _cheatModalEl.querySelector(`#tab-${targetTab}`);
      if (activeContent) activeContent.classList.add("active");
    });
  });

  // Manipulação de cliques de Cheats
  const buttons = _cheatModalEl.querySelectorAll(".cheat-btn");
  buttons.forEach((b) => {
    b.addEventListener("click", (e) => {
      const type = e.currentTarget.getAttribute("data-cheat");
      if (type) {
        _handleCheatAction(type);
        _updateStatusDisplays();
      }
    });
  });

  // Configuração do Slider de Horário
  const slider = _cheatModalEl.querySelector("#cheat-time-slider");
  const sliderLabel = _cheatModalEl.querySelector("#cheat-slider-label");
  const btnApplySlider = _cheatModalEl.querySelector("#cheat-apply-slider-time");
  if (slider && sliderLabel) {
    const dn = _activeEnv?.dayNight || window.__game?.dayNight;
    if (dn) {
      const curHour = Math.floor((dn.progress ?? 0.36) * 24);
      slider.value = curHour;
      sliderLabel.textContent = `${curHour.toString().padStart(2, "0")}:00`;
    }
    slider.addEventListener("input", () => {
      sliderLabel.textContent = `${String(slider.value).padStart(2, "0")}:00`;
    });
    btnApplySlider?.addEventListener("click", () => {
      window.CheatMenu?.setTime(Number(slider.value), 0);
      _updateStatusDisplays();
    });
  }

  // Configuração do Seletor de Dia
  const dayInput = _cheatModalEl.querySelector("#cheat-day-input");
  const dayLabel = _cheatModalEl.querySelector("#cheat-day-label");
  const btnPrevDay = _cheatModalEl.querySelector("#cheat-prev-day");
  const btnNextDay = _cheatModalEl.querySelector("#cheat-next-day");
  const btnApplyDay = _cheatModalEl.querySelector("#cheat-apply-day");

  btnPrevDay?.addEventListener("click", () => {
    window.CheatMenu?.addDays(-1);
    _updateStatusDisplays();
  });
  btnNextDay?.addEventListener("click", () => {
    window.CheatMenu?.addDays(1);
    _updateStatusDisplays();
  });
  btnApplyDay?.addEventListener("click", () => {
    const d = Number(dayInput?.value) || 1;
    window.CheatMenu?.setCalendarDay(d);
    _updateStatusDisplays();
  });

  // Configuração do Slider de Maldade
  const evilSlider = _cheatModalEl.querySelector("#cheat-evil-slider");
  const evilLabel = _cheatModalEl.querySelector("#cheat-evil-label");
  const btnApplyEvil = _cheatModalEl.querySelector("#cheat-apply-evil");

  if (evilSlider && evilLabel) {
    evilSlider.value = getEvilPercent();
    evilLabel.textContent = `${evilSlider.value}% Maldade`;
    evilSlider.addEventListener("input", () => {
      evilLabel.textContent = `${evilSlider.value}% Maldade`;
    });
    btnApplyEvil?.addEventListener("click", () => {
      window.CheatMenu?.setEvil(Number(evilSlider.value));
      _updateStatusDisplays();
    });
  }
}

function _handleCheatAction(type) {
  if (!window.CheatMenu) return;
  switch (type) {
    // Horário & Ciclo Dia/Noite
    case "lighting_day":
      window.CheatMenu.setBakedDay();
      break;
    case "lighting_afternoon":
      window.CheatMenu.setBakedAfternoon();
      break;
    case "lighting_night":
      window.CheatMenu.setBakedNight();
      break;
    case "set_day_1":
      window.CheatMenu.setCalendarDay(1);
      break;
    case "set_day_3":
      window.CheatMenu.setCalendarDay(3);
      break;
    case "set_day_5":
      window.CheatMenu.setCalendarDay(5);
      break;
    case "set_day_7":
      window.CheatMenu.setCalendarDay(7);
      break;
    case "evil_0":
      window.CheatMenu.setEvil(0);
      break;
    case "evil_25":
      window.CheatMenu.setEvil(25);
      break;
    case "evil_50":
      window.CheatMenu.setEvil(50);
      break;
    case "evil_75":
      window.CheatMenu.setEvil(75);
      break;
    case "evil_100":
      window.CheatMenu.setEvil(100);
      break;
    case "time_dawn":
      window.CheatMenu.setTime(6, 0);
      break;
    case "time_morning":
      window.CheatMenu.setTime(9, 0);
      break;
    case "time_noon":
      window.CheatMenu.setTime(12, 0);
      break;
    case "time_afternoon":
      window.CheatMenu.setTime(15, 0);
      break;
    case "time_sunset":
      window.CheatMenu.setTime(18, 0);
      break;
    case "time_dusk":
      window.CheatMenu.setTime(19, 30);
      break;
    case "time_night":
      window.CheatMenu.setTime(21, 30);
      break;
    case "time_midnight":
      window.CheatMenu.setTime(0, 0);
      break;
    case "time_witching":
      window.CheatMenu.setTime(3, 0);
      break;
    case "time_set_day":
      window.CheatMenu.setDay();
      break;
    case "time_set_night":
      window.CheatMenu.setNight();
      break;
    case "time_add_1h":
      window.CheatMenu.addHours(1);
      break;
    case "time_sub_1h":
      window.CheatMenu.addHours(-1);
      break;
    case "time_add_3h":
      window.CheatMenu.addHours(3);
      break;
    case "time_add_6h":
      window.CheatMenu.addHours(6);
      break;
    case "time_add_12h":
      window.CheatMenu.addHours(12);
      break;
    case "maxAllItems":
      window.CheatMenu.maxAllItems();
      break;
    case "giveAllResources":
      window.CheatMenu.giveAllResources(500);
      break;
    case "giveAllCrystals":
      window.CheatMenu.giveCrystals(20);
      break;
    case "giveAllWeapons":
      window.CheatMenu.giveAllWeapons();
      break;
    case "giveAllAmmo":
      window.CheatMenu.giveAllAmmo(99);
      break;
    case "toggleDebugScreen":
      window.CheatMenu.toggleDebugScreen();
      close();
      break;
    case "godMode":
      window.CheatMenu.godMode();
      break;
    case "makeMeRich":
      window.CheatMenu.makeMeRich(10000);
      break;
    case "setSpeed":
      window.CheatMenu.setSpeed(2.5);
      break;
    case "forgiveSins":
      window.CheatMenu.forgiveSins();
      break;
    case "killAllEnemies":
      window.CheatMenu.killAllEnemies();
      break;
    case "armor0":
      window.CheatMenu.equipArmor(0);
      break;
    case "armor1":
      window.CheatMenu.equipArmor(1);
      break;
    case "armor2":
      window.CheatMenu.equipArmor(2);
      break;
    case "armor3":
      window.CheatMenu.equipArmor(3);
      break;
    case "giveTools":
      window.CheatMenu.giveTools();
      break;
    case "giveDemiurgeDiary":
      window.CheatMenu.giveDemiurgeDiary();
      break;
    case "demiurgeRobe":
      window.CheatMenu.giveDemiurgeRobe();
      break;
    case "holyEnding":
      window.CheatMenu.triggerHolyEnding();
      break;
    case "apocalypse":
      window.CheatMenu.triggerApocalypse();
      break;
    case "spawnWerewolf":
    case "spawn_werewolf":
      window.CheatMenu.spawnWerewolf();
      break;
    case "spawn_gulur":
      window.CheatMenu.spawnGulur();
      break;
    case "spawn_necron":
      window.CheatMenu.spawnNecron();
      break;
    case "spawn_hexoculus":
      window.CheatMenu.spawnHexoculus();
      break;
    case "spawn_polyphonia":
      window.CheatMenu.spawnPolyphonia();
      break;
    case "spawn_cultist":
      window.CheatMenu.spawnCultist();
      break;
    case "spawn_horse_wild":
      window.CheatMenu.spawnHorse(true, false, "Cavalo Selvagem");
      break;
    case "spawn_horse_tame":
      window.CheatMenu.spawnHorse(false, false, "Cavalo de Sela");
      break;
    case "spawn_horse_thoroughbred":
      window.CheatMenu.spawnHorse(false, true, "Puro-Sangue Real");
      break;
    case "spawn_npc_guard":
      window.CheatMenu.spawnNPC("guard");
      break;
    case "spawn_npc_smith":
      window.CheatMenu.spawnNPC("smith");
      break;
    case "spawn_npc_merchant":
      window.CheatMenu.spawnNPC("merchant");
      break;
    case "spawn_npc_priest":
      window.CheatMenu.spawnNPC("priest");
      break;
    case "spawn_npc_farmer":
      window.CheatMenu.spawnNPC("farmer");
      break;
    case "spawn_npc_villager":
      window.CheatMenu.spawnNPC("villager");
      break;
    case "spawn_npc_beggar":
      window.CheatMenu.spawnNPC("beggar");
      break;
    case "spawn_npc_bandit":
      window.CheatMenu.spawnNPC("villager", true);
      break;
    case "summonMessenger":
      window.CheatMenu.summonMessenger();
      break;
    case "summonCultLeader":
      window.CheatMenu.summonCultLeader();
      break;

    // Recursos específicos
    case "wood_100":
      window.CheatMenu.giveWood(100);
      break;
    case "wood_999":
      window.CheatMenu.setResource("wood", 999);
      break;
    case "stone_100":
      window.CheatMenu.giveStone(100);
      break;
    case "stone_999":
      window.CheatMenu.setResource("stone", 999);
      break;
    case "clay_100":
      window.CheatMenu.giveClay(100);
      break;
    case "clay_999":
      window.CheatMenu.setResource("clay", 999);
      break;
    case "hay_50":
      window.CheatMenu.giveHay(50);
      break;
    case "hay_999":
      window.CheatMenu.setResource("hay", 999);
      break;
    case "torches_25":
      window.CheatMenu.giveTorches(25);
      break;
    case "torches_99":
      window.CheatMenu.setResource("torches", 99);
      break;
    case "gold_5k":
      window.CheatMenu.giveGold(5000);
      break;
    case "gold_50k":
      window.CheatMenu.giveGold(50000);
      break;

    // Cristais específicos
    case "cry_green":
      window.CheatMenu.giveCrystal("green", 10);
      break;
    case "cry_blue":
      window.CheatMenu.giveCrystal("blue", 10);
      break;
    case "cry_pink":
      window.CheatMenu.giveCrystal("pink", 10);
      break;
    case "cry_red":
      window.CheatMenu.giveCrystal("red", 10);
      break;
    case "cry_white":
      window.CheatMenu.giveCrystal("white", 10);
      break;
    case "cry_purple":
      window.CheatMenu.giveCrystal("purple", 10);
      break;

    // Infusão de Tochas
    case "set_torch_green":
      window.CheatMenu.setTorchColor("green");
      break;
    case "set_torch_blue":
      window.CheatMenu.setTorchColor("blue");
      break;
    case "set_torch_pink":
      window.CheatMenu.setTorchColor("pink");
      break;
    case "set_torch_red":
      window.CheatMenu.setTorchColor("red");
      break;
    case "set_torch_white":
      window.CheatMenu.setTorchColor("white");
      break;
    case "set_torch_purple":
      window.CheatMenu.setTorchColor("purple");
      break;
    case "set_torch_orange":
      window.CheatMenu.setTorchColor("orange");
      break;

    // Consumíveis e Munições
    case "potions_10":
      window.CheatMenu.givePotions(10);
      break;
    case "potions_99":
      window.CheatMenu.setPotions(99);
      break;
    case "candles_20":
      window.CheatMenu.giveCandles(20);
      break;
    case "candles_99":
      window.CheatMenu.setCandles(99);
      break;
    case "arrows_50":
      window.CheatMenu.giveAmmo("arrows", 50);
      break;
    case "bolts_50":
      window.CheatMenu.giveAmmo("bolts", 50);
      break;
    case "bombs_25":
      window.CheatMenu.giveAmmo("bombs", 25);
      break;
    case "knives_25":
      window.CheatMenu.giveAmmo("knives", 25);
      break;
    case "oil_25":
      window.CheatMenu.giveAmmo("oil", 25);
      break;

    default:
      console.warn("Ação de cheat desconhecida:", type);
      break;
  }
}

/**
 * Inicializa o menu de Cheats acessível via Console (window.CheatMenu)
 * e via sequência de teclado ('POTATO' ou 'CHIEFS') durante o jogo.
 */
export function initCheatMenu(env = {}) {
  _activeEnv = env;

  const cheatObj = {
    open() {
      openCheatModal(env);
    },

    close() {
      if (_cheatModalEl) _cheatModalEl.classList.remove("active");
    },

    setTime(hours = 12, minutes = 0) {
      const dn = env.dayNight || window.__game?.dayNight;
      if (!dn) {
        env.ui?.showToast?.("⚠️ Sistema de tempo (DayNight) não inicializado.");
        return "Erro";
      }
      const h = ((Number(hours) % 24) + 24) % 24;
      const m = Math.max(0, Math.min(59, Number(minutes) || 0));
      const totalMinutes = h * 60 + m;
      dn.progress = totalMinutes / (24 * 60);
      const px = env.player?.x ?? window.__game?.player?.x ?? 0;
      const pz = env.player?.z ?? window.__game?.player?.z ?? 0;
      const clock = dn.update(0, px, pz, env.renderer || window.__game?.renderer);
      const isNight = dn.isNight ? "🌙 Noite" : "☀️ Dia";

      // Atualiza feras e tochas instantaneamente
      if (window.__game?.beasts) {
        window.__game.beasts.update(0, Boolean(dn.isNight && dn.daylight < 0.45));
      }
      if (window.__game?.torches && window.__game?.player) {
        window.__game.torches.update(0, window.__game.player);
      }

      env.audio?.bell?.();
      env.ui?.showToast?.(`⏰ CHEAT: Horário alterado para ${clock} (${isNight})!`);
      console.log(`⏰ CHEAT: Horário alterado para ${clock} (${isNight})`);
      return `Horário: ${clock}`;
    },

    setDay(dayNumber = undefined) {
      if (dayNumber !== undefined && dayNumber !== null && typeof dayNumber !== "boolean") {
        return this.setCalendarDay(dayNumber);
      }
      return this.setTime(10, 0);
    },

    setDaytime() {
      return this.setTime(10, 0);
    },

    setCalendarDay(dayNumber) {
      const d = WorldDecay.setDay(dayNumber, env.ui);
      env.audio?.bell?.();
      return `Dia ${d}`;
    },

    addDays(delta = 1) {
      const cur = WorldDecay?.daysPassed ?? 1;
      return this.setCalendarDay(cur + Number(delta));
    },

    setEvil(targetPercent) {
      const evil = setEvilPercent(targetPercent, "Cheat Menu");
      env.audio?.bell?.();
      return `${evil}% Maldade`;
    },

    addEvil(amount = 5) {
      const evil = addEvil(amount, "Cheat Menu");
      return `${evil}% Maldade`;
    },

    addGood(amount = 5) {
      const evil = addGood(amount, "Cheat Menu");
      return `${evil}% Maldade`;
    },

    setNight() {
      return this.setTime(22, 0);
    },

    setBakedDay() {
      const res = this.setTime(12, 0);
      env.ui?.showToast?.("☀️ Iluminação Pré-Assada: DIA ativado");
      return res;
    },

    setBakedAfternoon() {
      const res = this.setTime(18, 0);
      env.ui?.showToast?.("🌇 Iluminação Pré-Assada: TARDE (Golden Hour) ativado");
      return res;
    },

    setBakedNight() {
      const res = this.setTime(22, 0);
      env.ui?.showToast?.("🌙 Iluminação Pré-Assada: NOITE ativado");
      return res;
    },

    addHours(delta = 1) {
      const dn = env.dayNight || window.__game?.dayNight;
      if (!dn) return "DayNight não disponível";
      const curProg = dn.progress ?? 0;
      const deltaProg = Number(delta) / 24;
      let newProg = (curProg + deltaProg) % 1;
      if (newProg < 0) newProg += 1;
      dn.progress = newProg;
      const px = env.player?.x ?? window.__game?.player?.x ?? 0;
      const pz = env.player?.z ?? window.__game?.player?.z ?? 0;
      const clock = dn.update(0, px, pz, env.renderer || window.__game?.renderer);
      const isNight = dn.isNight ? "🌙 Noite" : "☀️ Dia";

      if (window.__game?.beasts) {
        window.__game.beasts.update(0, Boolean(dn.isNight && dn.daylight < 0.45));
      }
      if (window.__game?.torches && window.__game?.player) {
        window.__game.torches.update(0, window.__game.player);
      }

      env.audio?.bell?.();
      env.ui?.showToast?.(`⏰ CHEAT: Horário ajustado para ${clock} (${isNight})!`);
      console.log(`⏰ CHEAT: Horário ajustado para ${clock} (${isNight})`);
      return `Horário: ${clock}`;
    },

    getTime() {
      const dn = env.dayNight || window.__game?.dayNight;
      if (!dn) return "00:00";
      const totalMinutes = Math.floor((dn.progress ?? 0) * 24 * 60);
      const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
      const minutes = (totalMinutes % 60).toString().padStart(2, "0");
      return `${hours}:${minutes} (${dn.isNight ? "Noite" : "Dia"})`;
    },

    giveWood(amount = 100) {
      PlayerInventory.wood = (PlayerInventory.wood || 0) + amount;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`🪵 CHEAT: +${amount} Madeiras recebidas! (Total: ${PlayerInventory.wood})`);
      return PlayerInventory.wood;
    },

    giveStone(amount = 100) {
      PlayerInventory.stone = (PlayerInventory.stone || 0) + amount;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`🪨 CHEAT: +${amount} Pedras recebidas! (Total: ${PlayerInventory.stone})`);
      return PlayerInventory.stone;
    },

    giveClay(amount = 100) {
      PlayerInventory.clay = (PlayerInventory.clay || 0) + amount;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`🏺 CHEAT: +${amount} Barro / Argila recebidos! (Total: ${PlayerInventory.clay})`);
      return PlayerInventory.clay;
    },

    giveHay(amount = 50) {
      PlayerInventory.hay = (PlayerInventory.hay || 0) + amount;
      PlayerStats.hay = PlayerInventory.hay;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`🌾 CHEAT: +${amount} Feno recebido! (Total: ${PlayerInventory.hay})`);
      return PlayerInventory.hay;
    },

    giveTorches(amount = 25) {
      PlayerInventory.torches = (PlayerInventory.torches || 0) + amount;
      if (env.weapons) {
        env.weapons.unlock?.("torch", false);
      }
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`🔦 CHEAT: +${amount} Tochas recebidas! (Total: ${PlayerInventory.torches})`);
      return PlayerInventory.torches;
    },

    giveGold(amount = 5000) {
      PlayerStats.gold = (PlayerStats.gold || 0) + amount;
      PlayerInventory.gold = (PlayerInventory.gold || 0) + amount;
      if (env.player) env.player.coins = (env.player.coins || 0) + amount;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`🪙 CHEAT: +${amount} Moedas de Ouro recebidas! (Total: ${PlayerInventory.gold})`);
      return PlayerInventory.gold;
    },

    setResource(type, amount) {
      if (type === "wood") PlayerInventory.wood = amount;
      else if (type === "stone") PlayerInventory.stone = amount;
      else if (type === "clay") PlayerInventory.clay = amount;
      else if (type === "hay") {
        PlayerInventory.hay = amount;
        PlayerStats.hay = amount;
      } else if (type === "torches") {
        PlayerInventory.torches = amount;
        if (env.weapons) env.weapons.unlock?.("torch", false);
      }
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`📦 CHEAT: ${type.toUpperCase()} ajustado para ${amount}!`);
      return amount;
    },

    giveResource(type, amount = 100) {
      if (type === "wood") return this.giveWood(amount);
      if (type === "stone") return this.giveStone(amount);
      if (type === "clay") return this.giveClay(amount);
      if (type === "hay") return this.giveHay(amount);
      if (type === "torches" || type === "torch") return this.giveTorches(amount);
      if (type === "gold" || type === "coins") return this.giveGold(amount);
      console.warn("Tipo de recurso não reconhecido:", type);
      return false;
    },

    giveAllResources(amount = 500) {
      PlayerInventory.wood = (PlayerInventory.wood || 0) + amount;
      PlayerInventory.stone = (PlayerInventory.stone || 0) + amount;
      PlayerInventory.clay = (PlayerInventory.clay || 0) + amount;
      PlayerInventory.hay = (PlayerInventory.hay || 0) + amount;
      PlayerStats.hay = PlayerInventory.hay;
      PlayerInventory.torches = Math.max(99, (PlayerInventory.torches || 0) + 50);
      PlayerInventory.gold = (PlayerInventory.gold || 0) + amount * 10;
      PlayerStats.gold = PlayerInventory.gold;
      if (env.player) env.player.coins = PlayerInventory.gold;
      if (env.weapons) env.weapons.unlock?.("torch", false);

      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`📦 CHEAT: +${amount} em Todos os Recursos de Construção & Ouro adicionados!`);
      return "Todos os recursos concedidos";
    },

    giveCrystal(color, amount = 10) {
      PlayerInventory.crystals = PlayerInventory.crystals || {
        green: 0,
        blue: 0,
        pink: 0,
        red: 0,
        white: 0,
        purple: 0,
      };
      if (color in PlayerInventory.crystals) {
        PlayerInventory.crystals[color] = (PlayerInventory.crystals[color] || 0) + amount;
        const info = CRYSTAL_PALETTE[color] || { name: color, label: color };
        applyTorchColor(color, env.weapons);
        env.audio?.coin?.();
        env.ui?.showToast?.(`💎 CHEAT: +${amount} ${info.name}! Tocha infundida com chama ${info.label.toUpperCase()}!`);
        return PlayerInventory.crystals[color];
      }
      return 0;
    },

    giveCrystals(amount = 20) {
      PlayerInventory.crystals = PlayerInventory.crystals || {};
      const colors = ["green", "blue", "pink", "red", "white", "purple"];
      for (const c of colors) {
        PlayerInventory.crystals[c] = (PlayerInventory.crystals[c] || 0) + amount;
      }
      env.audio?.coin?.();
      env.ui?.showToast?.(`💎 CHEAT: +${amount} de Cada Cristal Místico (Verde, Azul, Rosa, Vermelho, Branco, Roxo)!`);
      return PlayerInventory.crystals;
    },

    setTorchColor(color) {
      applyTorchColor(color, env.weapons);
      const info = CRYSTAL_PALETTE[color] || { name: color, label: color };
      env.audio?.weaponSwing?.("slash", false);
      env.ui?.showToast?.(`🔥 CHEAT: Tocha infundida com a chama ${info.label.toUpperCase()} (${info.name})!`);
      return color;
    },

    givePotions(amount = 10) {
      if (env.player) {
        env.player.potions = Math.min(99, (env.player.potions || 0) + amount);
        syncPlayerStatsToPlayer(env.player, env.ui);
        env.audio?.coin?.();
        env.ui?.showToast?.(`🧪 CHEAT: +${amount} Poções de Cura recebidas! (Total: ${env.player.potions})`);
        return env.player.potions;
      }
      return 0;
    },

    setPotions(amount = 99) {
      if (env.player) {
        env.player.potions = amount;
        syncPlayerStatsToPlayer(env.player, env.ui);
        env.audio?.coin?.();
        env.ui?.showToast?.(`🧪 CHEAT: Poções ajustadas para ${amount}!`);
        return amount;
      }
      return 0;
    },

    giveCandles(amount = 20) {
      const c = env.candle || window.__game?.candle;
      if (c) {
        c.count = Math.min(99, (c.count || 0) + amount);
        c._sync?.();
        env.audio?.coin?.();
        env.ui?.showToast?.(`🕯️ CHEAT: +${amount} Velas de Cera recebidas! (Total: ${c.count})`);
        return c.count;
      }
      return 0;
    },

    setCandles(amount = 99) {
      const c = env.candle || window.__game?.candle;
      if (c) {
        c.count = amount;
        c._sync?.();
        env.audio?.coin?.();
        env.ui?.showToast?.(`🕯️ CHEAT: Velas ajustadas para ${amount}!`);
        return amount;
      }
      return 0;
    },

    giveAmmo(type, amount = 50) {
      if (!env.weapons) return 0;
      env.weapons.ammo = env.weapons.ammo || {};
      if (type in env.weapons.ammo || type in env.weapons) {
        env.weapons.ammo[type] = Math.min(99, (env.weapons.ammo[type] || 0) + amount);
        env.weapons[type] = env.weapons.ammo[type];
        env.weapons._refreshWeaponHud?.();
        env.audio?.coin?.();
        env.ui?.showToast?.(`🏹 CHEAT: +${amount} munição de ${type.toUpperCase()}! (Total: ${env.weapons[type]})`);
        return env.weapons[type];
      }
      return 0;
    },

    giveAllAmmo(amount = 99) {
      if (env.weapons) {
        env.weapons.ammo = env.weapons.ammo || {};
        const types = ["arrows", "bolts", "bombs", "knives", "oil"];
        for (const t of types) {
          env.weapons.ammo[t] = amount;
          env.weapons[t] = amount;
        }
        env.weapons._refreshWeaponHud?.();
      }
      if (env.player) {
        env.player.potions = amount;
      }
      const c = env.candle || window.__game?.candle;
      if (c) {
        c.count = amount;
        c._sync?.();
      }
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.("🏹 CHEAT: Todas as munições, poções e velas no máximo (99)!");
      return "Todas as munições maximizadas";
    },

    giveTools() {
      PlayerInventory.hasAxe = true;
      PlayerInventory.hasPickaxe = true;
      PlayerInventory.hasSword = true;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.weaponSwing?.("chop", false);
      env.ui?.showToast?.("🪓 CHEAT: Machado, Picareta e Espada concedidos!");
      return "Ferramentas concedidas";
    },

    giveDemiurgeDiary() {
      PlayerInventory.hasDemiurgeDiary = true;
      PlayerInventory.discoveredBookPages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
      import("./demiurgeBook.js").then((book) => {
        book.setDemiurgeDiaryCollected?.(true);
      }).catch((e) => console.warn(e));
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.choir?.();
      env.ui?.showToast?.("📖 CHEAT: Códice do Demiurgo (O Tractatus de Carcere) completo recebido! Tecla L para ler.");
      return "Diário do Demiurgo entregue";
    },

    maxAllItems() {
      // 1. Desbloqueia e restaura durabilidade de todas as 24+ armas existentes
      if (env.weapons) {
        for (const w of WEAPON_LIST) {
          env.weapons.unlock?.(w.id, false);
          if (w.maxDurability) {
            env.weapons.setWeaponDurability?.(w.id, w.maxDurability);
          }
        }
        if (env.weapons.ammo) {
          env.weapons.ammo.arrows = 99;
          env.weapons.ammo.bolts = 99;
          env.weapons.ammo.bombs = 99;
          env.weapons.ammo.knives = 99;
          env.weapons.ammo.oil = 99;
        }
        env.weapons.arrows = 99;
        env.weapons.bolts = 99;
        env.weapons.bombs = 99;
        env.weapons.knives = 99;
        env.weapons.oil = 99;
        env.weapons.hotbarSlots = [
          "fists",
          "longsword",
          "spear",
          "flanged_mace",
          "warhammer",
          "greatsword",
          "heavycrossbow",
          "musket",
          "bomb",
        ];
        env.weapons.equip?.("greatsword", false);
        env.weapons._refreshWeaponHud?.();
      }

      // 2. Inventário e recursos de construção/crafting ao máximo
      PlayerInventory.hasAxe = true;
      PlayerInventory.hasPickaxe = true;
      PlayerInventory.hasSword = true;
      PlayerInventory.hasDemiurgeRobe = true;
      PlayerInventory.hasDemiurgeDiary = true;
      PlayerInventory.discoveredBookPages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
      PlayerInventory.crystals = { green: 99, blue: 99, pink: 99, red: 99, white: 99, purple: 99 };
      PlayerInventory.wood = 999;
      PlayerInventory.stone = 999;
      PlayerInventory.clay = 999;
      PlayerInventory.hay = 999;
      PlayerInventory.torches = 99;
      PlayerInventory.gold = 99999;
      PlayerStats.gold = 99999;
      PlayerStats.hay = 999;

      // 3. Poções e Velas ao máximo
      if (env.candle) {
        env.candle.count = 99;
        env.candle._sync?.();
      }
      if (window.__game?.candle) {
        window.__game.candle.count = 99;
        window.__game.candle._sync?.();
      }

      if (env.player) {
        env.player.coins = 99999;
        env.player.potions = 99;
        env.player.maxHealth = Math.max(14, env.player.maxHealth);
        env.player.health = env.player.maxHealth;
      }

      // 4. Armadura máxima de placas templárias e atributos no nível 20
      equipArmor(3, env.player);
      PlayerStats.str = 20;
      PlayerStats.con = 20;
      PlayerStats.cha = 20;
      PlayerStats.spd = 20;
      PlayerStats.weaponLevel = 5;
      PlayerStats.hp = PlayerStats.getMaxHp();
      PlayerStats.maxHp = PlayerStats.getMaxHp();

      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.audio?.choir?.();
      env.ui?.showToast?.("🎒 CHEAT: Todos os itens, recursos, munições e armas maximizados!");
      console.log("🎒 CHEAT: Inventário, armas e atributos no nível máximo!");
      return "Todos os itens maximizados";
    },

    toggleDebugScreen() {
      if (typeof window.toggleDebugScreen === "function") {
        return window.toggleDebugScreen();
      }
      return false;
    },

    godMode() {
      if (env.player) {
        env.player.godMode = !env.player.godMode;
        env.player.maxHealth = Math.max(10, env.player.maxHealth);
        env.player.health = env.player.maxHealth;
        env.player.potions = 4;
      }
      PlayerStats.con = 20;
      PlayerStats.hp = PlayerStats.getMaxHp();
      PlayerStats.maxHp = PlayerStats.getMaxHp();
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.choir?.();
      const status = env.player?.godMode ? "ATIVADO (Invencível)" : "DESATIVADO";
      env.ui?.showToast?.(`⚡ CHEAT: Modo Deus ${status}!`);
      console.log(`⚡ CHEAT: Modo Deus ${status}`);
      return `God Mode ${status}`;
    },

    giveAllWeapons() {
      if (env.weapons) {
        for (const w of WEAPON_LIST) {
          env.weapons.unlock?.(w.id, true);
        }
        env.weapons.arrows = 99;
        env.weapons.bolts = 99;
        env.weapons.bombs = 99;
        env.weapons.equip?.("shortsword", false);
      }
      PlayerInventory.hasAxe = true;
      PlayerInventory.hasPickaxe = true;
      PlayerInventory.hasSword = true;
      PlayerInventory.wood = 999;
      PlayerInventory.stone = 999;
      PlayerInventory.clay = 999;
      PlayerInventory.hay = 999;
      PlayerInventory.torches = 99;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.weaponSwing?.("slash", false);
      env.ui?.showToast?.("⚔️ CHEAT: Todas as armas, munições e recursos liberados!");
      console.log("⚔️ CHEAT: Todo o arsenal desbloqueado!");
      return "Arsenal liberado";
    },

    makeMeRich(bonus = 10000) {
      PlayerStats.gold += bonus;
      PlayerInventory.gold += bonus;
      if (env.player) env.player.coins += bonus;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.coin?.();
      env.ui?.showToast?.(`💰 CHEAT: +${bonus} moedas de ouro adicionadas!`);
      console.log(`💰 CHEAT: Rico com +${bonus} moedas`);
      return `+${bonus} ouro`;
    },

    setSpeed(mult = 2.5) {
      PlayerStats.spd = Math.round(10 + (mult - 1.0) / 0.03);
      env.ui?.showToast?.(`🏃 CHEAT: Velocidade ajustada para ${mult}x!`);
      console.log(`🏃 CHEAT: Velocidade ajustada para ${mult}x`);
      return `Velocidade ${mult}x`;
    },

    forgiveSins() {
      PlayerStats.morality = 100;
      PlayerStats.hasBrokenVow = false;
      if (env.npcs?.clearWantedLevel) env.npcs.clearWantedLevel();
      else if (env.npcs) env.npcs.wantedLevel = 0;
      env.audio?.choir?.();
      env.ui?.showToast?.("🕊️ CHEAT: Pecados perdoados, procurado zerado e Voto Templário restaurado!");
      console.log("🕊️ CHEAT: Pecados perdoados e votos restaurados");
      return "Pecados perdoados";
    },

    killAllEnemies() {
      let count = 0;
      if (env.npcs?.npcs) {
        for (let i = 0; i < env.npcs.npcs.length; i++) {
          const n = env.npcs.npcs[i];
          if (
            n &&
            n.alive &&
            (n.roleKey === "werewolf" ||
              n.roleKey === "cultist" ||
              n.userData?.type === "CULTIST" ||
              n.hostile)
          ) {
            try {
              if (typeof n.takeHit === "function") {
                n.takeHit(999, 0, 0, 2);
              } else if (typeof n.takeDamage === "function") {
                n.takeDamage(999);
              } else if (typeof n.vanish === "function") {
                n.vanish(true);
              }
              count++;
            } catch (err) {
              console.warn("killAllEnemies warn:", err);
            }
          }
        }
      }
      const pool = env.monstersPool || window.__game?.monstersPool;
      if (Array.isArray(pool)) {
        for (const m of pool) {
          if (m && m.visible) {
            m.visible = false;
            count++;
          }
        }
      }
      env.ui?.showToast?.(`💀 CHEAT: ${count} inimigos e feras exterminados!`);
      console.log(`💀 CHEAT: ${count} inimigos eliminados`);
      return `${count} inimigos mortos`;
    },

    equipArmor(level = 0) {
      const lv = equipArmor(level, env.player);
      const names = ["Camponês (Túnica)", "Couro", "Cota de Malha", "Placas (Templário)"];
      env.ui?.showToast?.(`🛡️ CHEAT: Armadura Nível ${lv} (${names[lv]}) equipada!`);
      console.log(`🛡️ CHEAT: Armadura Nível ${lv} equipada`);
      return `Armadura nível ${lv}`;
    },

    giveDemiurgeRobe() {
      import("./rpg.js").then(({ unlockDemiurgeAttire }) => {
        unlockDemiurgeAttire(env.player, env.ui, env.audio);
      });
      return "Roupa do Demiurgo equipada";
    },

    triggerHolyEnding() {
      import("./holyEnding.js").then(({ triggerDeusVultEnding }) => {
        triggerDeusVultEnding(window.__game || env);
        env.ui?.showToast?.("✝️ CHEAT: A Ira de Deus foi invocada! Triunfo Católico!");
        console.log("✝️ CHEAT: Ira Dei / Triunfo Sagrado iniciado");
      }).catch((err) => {
        console.error("Erro no final sagrado:", err);
      });
      return "Ira Dei iniciada";
    },

    triggerApocalypse() {
      import("./decay.js").then(({ triggerDemiurgeCataclysm }) => {
        triggerDemiurgeCataclysm(window.__game || env, true);
        env.ui?.showToast?.("☄️ CHEAT: O Mal Final foi invocado! O Demiurgo desce dos céus!");
        console.log("☄️ CHEAT: Descida do Demiurgo iniciada");
      }).catch((err) => {
        console.error("Erro no apocalipse:", err);
      });
      return "Apocalipse iniciado";
    },

    setApocalypseChance(pct = 100) {
      import("./cult.js").then(({ CultState }) => {
        CultState.apocalypseChance = Number(pct);
        env.ui?.showToast?.(`🌑 Chance do Demiurgo ajustada para ${pct}%`);
        console.log(`🌑 Chance do Demiurgo: ${pct}%`);
      });
      return `Chance ${pct}%`;
    },

    spawnWerewolf() {
      const pool = env.monstersPool || window.__game?.monstersPool;
      if (pool && pool.length > 0) {
        const ww = pool.find((m) => !m.visible) || pool[0];
        if (ww && env.player) {
          const px = env.player.x;
          const pz = env.player.z;
          const py = env.world ? env.world.heightAt(px + 8, pz + 8) : 0;
          ww.position.set(px + 8, py, pz + 8);
          ww.x = px + 8;
          ww.z = pz + 8;
          ww.visible = true;
          ww.userData.state = "HUNTING_PLAYER";
          env.ui?.showToast?.("🐺 CHEAT: Lobisomem invocado para iniciar o massacre!");
        }
      } else {
        env.ui?.showToast?.("🐺 Nenhum lobisomem disponível no momento!");
      }
      return "Lobisomem invocado";
    },

    summonMessenger() {
      import("./decay.js").then(({ triggerCultistMessenger }) => {
        triggerCultistMessenger(env.player, env.scene, env.world, true);
        env.ui?.showToast?.("👁️ CHEAT: Mensageiro do Demiurgo invocado!");
        console.log("👁️ CHEAT: Mensageiro do Demiurgo invocado!");
      });
      return "Mensageiro invocado";
    },

    summonCultLeader() {
      import("./cult.js").then(({ summonCultLeader }) => {
        const leader = summonCultLeader(env.player, env.scene, env.world, env.effects, env.combat);
        env.ui?.showToast?.("👁️ CHEAT: Morvath, o Líder da Seita Cátara, foi invocado!");
        console.log("👁️ CHEAT: Líder da Seita Cátara invocado:", leader);
      });
      return "Líder da Seita Cátara invocado";
    },

    spawnGulur() {
      import("./beasts.js").then(({ Gulur }) => {
        const p = env.player || window.__game?.player;
        const px = p.x ?? p.position?.x ?? 0;
        const pz = p.z ?? p.position?.z ?? 0;
        const ang = p.heading || (p.model ? p.model.rotation.y : 0);
        const sx = px + Math.sin(ang) * 12;
        const sz = pz + Math.cos(ang) * 12;
        const g = new Gulur(env.scene, env.world, env.effects, env.combat, p, env.npcs, sx, sz);
        g._forceSpawned = true;
        g.root.visible = true;
        if (window.__game?.beasts) window.__game.beasts.walkers.push(g);
        if (env.npcs?.npcs && !env.npcs.npcs.includes(g)) env.npcs.npcs.push(g);
        env.effects?.play?.("star", sx, (env.world ? env.world.heightAt(sx, sz) : 0) + 12, sz, "#ffea00", 3.0);
        env.ui?.showToast?.("🦒 CHEAT: Gulur (Colosso de 16m) invocado nos ermos!");
        console.log("🦒 CHEAT: Gulur invocado:", g);
      });
      return "Gulur invocado";
    },

    spawnNecron() {
      import("./beasts.js").then(({ Necron }) => {
        const p = env.player || window.__game?.player;
        const px = p.x ?? p.position?.x ?? 0;
        const pz = p.z ?? p.position?.z ?? 0;
        const ang = p.heading || (p.model ? p.model.rotation.y : 0);
        const sx = px + Math.sin(ang) * 4.5;
        const sz = pz + Math.cos(ang) * 4.5;
        const n = new Necron(env.scene, env.world, env.effects, env.combat, p, env.npcs, sx, sz);
        n.root.visible = true;
        if (window.__game?.beasts) window.__game.beasts.biters.push(n);
        if (env.npcs?.npcs && !env.npcs.npcs.includes(n)) env.npcs.npcs.push(n);
        env.effects?.play?.("dust", sx, env.world ? env.world.heightAt(sx, sz) : 0, sz, "#332222", 2.2);
        env.ui?.showToast?.("💀 CHEAT: Necron (O Cego Devorador) invocado!");
        console.log("💀 CHEAT: Necron invocado:", n);
      });
      return "Necron invocado";
    },

    spawnHexoculus() {
      import("./beasts.js").then(({ Hexoculus }) => {
        const p = env.player || window.__game?.player;
        const px = p.x ?? p.position?.x ?? 0;
        const pz = p.z ?? p.position?.z ?? 0;
        const ang = p.heading || (p.model ? p.model.rotation.y : 0);
        const sx = px + Math.sin(ang) * 5.0;
        const sz = pz + Math.cos(ang) * 5.0;
        const h = new Hexoculus(env.scene, env.world, env.effects, env.combat, p, env.npcs, sx, sz);
        h.root.visible = true;
        if (window.__game?.beasts) window.__game.beasts.hexoculusList.push(h);
        if (env.npcs?.npcs && !env.npcs.npcs.includes(h)) env.npcs.npcs.push(h);
        env.effects?.play?.("star", sx, (env.world ? env.world.heightAt(sx, sz) : 0) + 2.5, sz, "#aa22ff", 2.5);
        env.ui?.showToast?.("👁️ CHEAT: Hexoculus (Observador dos 6 Olhos) invocado!");
        console.log("👁️ CHEAT: Hexoculus invocado:", h);
      });
      return "Hexoculus invocado";
    },

    spawnPolyphonia() {
      import("./beasts.js").then(({ Polyphonia }) => {
        const p = env.player || window.__game?.player;
        const px = p.x ?? p.position?.x ?? 0;
        const pz = p.z ?? p.position?.z ?? 0;
        const ang = p.heading || (p.model ? p.model.rotation.y : 0);
        const sx = px + Math.sin(ang) * 4.5;
        const sz = pz + Math.cos(ang) * 4.5;
        const poly = new Polyphonia(env.scene, env.world, env.effects, env.combat, p, env.npcs, sx, sz);
        poly.root.visible = true;
        if (window.__game?.beasts) window.__game.beasts.polyphoniaList.push(poly);
        if (env.npcs?.npcs && !env.npcs.npcs.includes(poly)) env.npcs.npcs.push(poly);
        env.effects?.play?.("star", sx, (env.world ? env.world.heightAt(sx, sz) : 0) + 1.2, sz, "#cc1122", 2.2);
        env.ui?.showToast?.("🐍 CHEAT: Polyphonia (Fauce Múltipla) invocada!");
        console.log("🐍 CHEAT: Polyphonia invocada:", poly);
      });
      return "Polyphonia invocada";
    },

    spawnCultist() {
      import("./cult.js").then(({ Cultist }) => {
        const p = env.player || window.__game?.player;
        const px = p.x ?? p.position?.x ?? 0;
        const pz = p.z ?? p.position?.z ?? 0;
        const ang = p.heading || (p.model ? p.model.rotation.y : 0);
        const sx = px + Math.sin(ang) * 4.0;
        const sz = pz + Math.cos(ang) * 4.0;
        const c = new Cultist(env.scene, env.world, env.effects, env.combat);
        const sy = env.world ? env.world.heightAt(sx, sz) : 0;
        c.spawnAt({ x: sx, y: sy, z: sz });
        if (env.cultistsPool) env.cultistsPool.push(c);
        if (env.npcs?.npcs && !env.npcs.npcs.includes(c)) env.npcs.npcs.push(c);
        env.effects?.play?.("dust", sx, sy + 0.8, sz, "#1a0822", 2.8);
        env.ui?.showToast?.("🌑 CHEAT: Cultista Cátaro do Demiurgo invocado!");
        console.log("🌑 CHEAT: Cultista invocado:", c);
      });
      return "Cultista invocado";
    },

    spawnHorse(wild = false, isMissionHorse = false, name = null) {
      const hm = env.horses || window.__game?.horses;
      if (!hm) return "HorseManager não disponível";
      const p = env.player || window.__game?.player;
      const px = p.x ?? p.position?.x ?? 0;
      const pz = p.z ?? p.position?.z ?? 0;
      const ang = p.heading || (p.model ? p.model.rotation.y : 0);
      const sx = px + Math.sin(ang) * 4.2;
      const sz = pz + Math.cos(ang) * 4.2;
      const horse = hm.spawnHorse(sx, sz, {
        wild,
        stay: !wild,
        isMissionHorse,
        name: name || (wild ? "Cavalo Selvagem" : "Cavalo Doméstico"),
      });
      if (horse) {
        env.audio?.coin?.();
        env.effects?.play?.("dust", sx, env.world ? env.world.heightAt(sx, sz) : 0, sz, "#735c46", 2.0);
        env.ui?.showToast?.(`🐎 CHEAT: ${horse.name} invocado! [F] para montar.`);
        console.log("🐎 CHEAT: Cavalo invocado:", horse);
      }
      return horse;
    },

    spawnNPC(roleKey = "villager", isBandit = false) {
      import("./npc.js").then(({ NPC }) => {
        const p = env.player || window.__game?.player;
        const px = p.x ?? p.position?.x ?? 0;
        const pz = p.z ?? p.position?.z ?? 0;
        const ang = p.heading || (p.model ? p.model.rotation.y : 0);
        const sx = px + Math.sin(ang) * 3.5;
        const sz = pz + Math.cos(ang) * 3.5;
        const path = [{ x: sx, z: sz }, { x: sx + 2, z: sz + 2 }];
        const workPoint = { x: sx, z: sz };
        const appearance = isBandit ? { isBandit: true, name: "Bandido dos Ermos", title: "Ladrão Fora-da-Lei" } : {};
        const n = new NPC(env.scene, env.world, roleKey, path, workPoint, appearance, env.effects);
        if (env.npcs?.npcs && !env.npcs.npcs.includes(n)) env.npcs.npcs.push(n);
        if (env.npcs?.spatialGrid) env.npcs.spatialGrid.insert(n, sx, sz);
        env.effects?.play?.("dust", sx, env.world ? env.world.heightAt(sx, sz) : 0, sz, "#554433", 1.8);
        env.ui?.showToast?.(`🧑 CHEAT: ${n.name} (${n.title}) invocado perante ti! [E] para interagir.`);
        console.log(`🧑 CHEAT: NPC (${roleKey}) invocado:`, n);
      });
      return `${roleKey} invocado`;
    },
  };

  window.CheatMenu = cheatObj;
  window.openCheatModal = () => openCheatModal(env);

  // Detector de Sequência de Teclado ("POTATO" ou "CHIEFS")
  let keySequence = "";
  let lastKeyTimestamp = 0;

  window.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    const now = performance.now();
    if (now - lastKeyTimestamp > 2800) {
      keySequence = "";
    }
    lastKeyTimestamp = now;

    if (e.key && e.key.length === 1) {
      keySequence += e.key.toUpperCase();
      if (keySequence.length > 12) {
        keySequence = keySequence.slice(-12);
      }

      if (keySequence.endsWith("POTATO") || keySequence.endsWith("CHIEFS")) {
        keySequence = "";
        env.audio?.choir?.();
        env.ui?.showToast?.("🥔 CÓDIGO POTATO DETECTADO! Abrindo Menu de Cheats...");
        openCheatModal(env);
      }
    }
  });

  window.__cheats = window.CheatMenu;

  console.log(
    "%c[PURIS CHEATS] Ativado (oculto na interface). Digite 'POTATO' durante o jogo ou utilize 'window.CheatMenu' no console.",
    "color: #bb86fc; font-weight: bold; font-size: 13px;"
  );
}
