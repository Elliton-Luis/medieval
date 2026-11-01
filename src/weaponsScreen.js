import { WEAPON_LIST, AMMO_LABELS } from "./weapondata.js";
import { PlayerEquipment, PlayerStats } from "./rpg.js";

let _codexModalEl = null;
let _activeCategory = "all";
let _inspectedWeaponId = null;

const CODEX_CSS = `
#weapons-codex-overlay {
  position: fixed;
  inset: 0;
  z-index: 999990;
  background: radial-gradient(circle at center, rgba(16, 12, 22, 0.94) 0%, rgba(4, 2, 7, 0.98) 100%);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #eeddbb;
  padding: 16px;
  box-sizing: border-box;
}
#weapons-codex-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.codex-panel {
  background: linear-gradient(180deg, #181320 0%, #0d0a12 100%);
  border: 2px solid #d4af37;
  border-radius: 8px;
  box-shadow: 0 0 45px rgba(212, 175, 55, 0.35), inset 0 0 30px rgba(0, 0, 0, 0.85);
  max-width: 920px;
  width: 96%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  animation: codex-pop 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.2);
}
@keyframes codex-pop {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1.0); opacity: 1; }
}
.codex-header {
  padding: 16px 22px 12px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
}
.codex-title-wrap h2 {
  margin: 0;
  font-family: "Cinzel Decorative", "Almendra", Georgia, serif;
  font-size: clamp(17px, 2.3vw, 22px);
  font-weight: 900;
  color: #ffd700;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
}
.codex-title-wrap p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: #b5a489;
  letter-spacing: 0.04em;
}
.codex-close-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ff9999;
  font-size: 18px;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.codex-close-btn:hover {
  background: #b81428;
  color: #ffffff;
  border-color: #ff5555;
}
.codex-hotbar-container {
  background: rgba(8, 6, 12, 0.75);
  border-bottom: 1px solid rgba(212, 175, 55, 0.25);
  padding: 9px 22px;
}
.codex-hotbar-title {
  font-size: 10.5px;
  font-weight: 700;
  color: #ffd700;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.codex-hotbar-grid {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 6px;
}
.codex-hotbar-slot {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  padding: 5px 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  cursor: pointer;
  transition: all 0.18s;
}
.codex-hotbar-slot:hover {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.5);
}
.codex-hotbar-slot.active {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.18);
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.25);
}
.codex-hotbar-slot-num {
  font-size: 11px;
  font-weight: 900;
  color: #d4af37;
  line-height: 1;
}
.codex-hotbar-slot-name {
  font-size: 10px;
  color: #ffffff;
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.codex-hotbar-slot-clear {
  position: absolute;
  top: 1px;
  right: 2px;
  background: none;
  border: none;
  color: #ff7777;
  font-size: 10px;
  cursor: pointer;
  padding: 0 2px;
  display: none;
}
.codex-hotbar-slot:hover .codex-hotbar-slot-clear {
  display: block;
}
.codex-tabs {
  display: flex;
  gap: 6px;
  padding: 8px 22px;
  background: rgba(10, 8, 14, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: auto;
}
.codex-tab-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #d6ccb8;
  padding: 5px 11px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s ease;
}
.codex-tab-btn:hover {
  background: rgba(212, 175, 55, 0.2);
  border-color: #ffd700;
  color: #ffffff;
}
.codex-tab-btn.active {
  background: #d4af37;
  border-color: #ffd700;
  color: #0b0710;
  font-weight: 700;
}
.codex-body {
  padding: 16px 22px 20px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}

/* Card Simples e Organizado: Apenas Nome e Dano */
.weapon-card-simple {
  background: rgba(22, 17, 30, 0.75);
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 6px;
  padding: 12px 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  transition: all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.2);
  user-select: none;
}
.weapon-card-simple:hover {
  border-color: #ffd700;
  background: rgba(35, 27, 48, 0.95);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55), 0 0 10px rgba(212, 175, 55, 0.2);
}
.weapon-card-simple.equipped {
  border: 1.5px solid #ffd700;
  background: linear-gradient(180deg, rgba(38, 30, 52, 0.95) 0%, rgba(20, 15, 28, 0.95) 100%);
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.3);
}
.weapon-card-simple.owned:not(.equipped) {
  border-color: rgba(90, 180, 110, 0.55);
}
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
}
.card-weapon-name {
  margin: 0;
  font-size: 14.5px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.25;
}
.card-status-badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.card-status-badge.eq {
  background: #ffd700;
  color: #0b0710;
}
.card-status-badge.hot {
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid #ffd700;
  color: #ffe888;
}
.card-status-badge.inv {
  background: rgba(90, 180, 110, 0.2);
  border: 1px solid #5ab46e;
  color: #88ffaa;
}
.card-status-badge.lock {
  background: rgba(255, 255, 255, 0.06);
  color: #887e6d;
}
.card-damage-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
}
.card-damage-label {
  font-size: 11.5px;
  color: #a49780;
}
.card-damage-val {
  font-size: 16px;
  font-weight: 900;
  color: #ffd700;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
.card-click-hint {
  font-size: 10px;
  color: #b5a489;
  text-align: right;
  opacity: 0.8;
  transition: opacity 0.15s;
}
.weapon-card-simple:hover .card-click-hint {
  opacity: 1;
  color: #ffd700;
}

/* Painel de Descrição Detalhada da Arma Inspecionada */
.codex-detail-view {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  animation: codex-pop 0.18s ease;
}
.detail-back-btn {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffd700;
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.detail-back-btn:hover {
  background: #d4af37;
  color: #0b0710;
  border-color: #ffffff;
}
.detail-hero-card {
  background: rgba(20, 15, 28, 0.85);
  border: 1.5px solid #d4af37;
  border-radius: 8px;
  padding: 18px 22px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
}
.detail-hero-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(212, 175, 55, 0.35);
  padding-bottom: 12px;
  margin-bottom: 14px;
}
.detail-hero-title {
  margin: 0;
  font-size: 20px;
  font-weight: 900;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
}
.detail-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px 18px;
  font-size: 13px;
  margin-bottom: 16px;
}
.detail-stat-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
  padding-bottom: 4px;
}
.detail-stat-label {
  color: #a49780;
}
.detail-stat-val {
  font-weight: 700;
  color: #ffffff;
}
.detail-stat-val.gold {
  color: #ffd700;
}
.detail-traits-box {
  background: rgba(142, 84, 233, 0.12);
  border: 1px solid rgba(142, 84, 233, 0.35);
  border-radius: 5px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.5;
  color: #dfceff;
  margin-bottom: 18px;
}
.detail-actions-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(0, 0, 0, 0.35);
  padding: 14px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.detail-equip-btn {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 800;
  border-radius: 5px;
  cursor: pointer;
  border: 1px solid #ffd700;
  background: #d4af37;
  color: #0b0710;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.18s;
}
.detail-equip-btn:hover {
  background: #ffe366;
  border-color: #ffffff;
}
.detail-slot-assign-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.detail-slot-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffe688;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.detail-slot-btn:hover {
  background: #ffd700;
  color: #110d18;
}
.detail-slot-btn.active-slot {
  background: #ffd700;
  color: #110d18;
  border-color: #ffd700;
}
`;

function _injectCodexStyles() {
  if (document.getElementById("weapons-codex-styles")) return;
  const style = document.createElement("style");
  style.id = "weapons-codex-styles";
  style.textContent = CODEX_CSS;
  document.head.appendChild(style);
}

/**
 * Abre o compêndio de armas com cards simples de Nome e Dano e visualizador individual.
 */
export function openWeaponsScreen(env = window.__game || {}) {
  _injectCodexStyles();

  if (!_codexModalEl) {
    _codexModalEl = document.createElement("div");
    _codexModalEl.id = "weapons-codex-overlay";
    document.body.appendChild(_codexModalEl);
  }

  // Libera pointer lock se ativo
  if (document.pointerLockElement) {
    try {
      document.exitPointerLock?.();
    } catch {}
  }

  _inspectedWeaponId = null;
  _renderCodex(env);
  _codexModalEl.classList.add("active");

  const close = () => {
    if (!_codexModalEl.classList.contains("active")) return;
    _codexModalEl.classList.remove("active");
    _inspectedWeaponId = null;
    window.removeEventListener("keydown", onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape" || e.code === "Escape" || e.code === "KeyK") {
      e.preventDefault();
      if (_inspectedWeaponId) {
        _inspectedWeaponId = null;
        _renderCodex(env);
      } else {
        close();
      }
    }
  };

  window.addEventListener("keydown", onKeyDown);

  _codexModalEl.onclick = (e) => {
    if (e.target === _codexModalEl) close();
  };
}

export function closeWeaponsScreen() {
  if (_codexModalEl) {
    _codexModalEl.classList.remove("active");
    _inspectedWeaponId = null;
  }
}

function _renderCodex(env) {
  const weaponsSys = env.weapons || window.__game?.weapons;
  const ownedSet = weaponsSys?.owned || new Set(["fists", "axe", "pickaxe"]);
  const currentWepId = weaponsSys?.currentId || "fists";
  const hotbar = weaponsSys?.hotbarSlots || ["fists", "axe", "pickaxe", null, null, null, null, null, null];
  const ammoMap = weaponsSys?.ammo || { bolts: 0, arrows: 0, bombs: 0, knives: 0, oil: 0 };
  const durMap = weaponsSys?.durability || {};

  const wepLevel = PlayerEquipment.weaponLevel || 1;
  const wepMult = PlayerEquipment.getWeaponMult?.() ?? (1.0 + (wepLevel - 1) * 0.25);
  const meleeMult = PlayerStats.getMeleeMult?.() ?? 1.0;
  const totalMeleeMult = Math.round(wepMult * meleeMult * 100) / 100;

  // Se o jogador estiver inspecionando uma arma específica:
  if (_inspectedWeaponId) {
    const w = WEAPON_LIST.find((item) => item.id === _inspectedWeaponId) || WEAPON_LIST[0];
    const isEquipped = currentWepId === w.id;
    const isOwned = ownedSet.has(w.id);
    const hotbarIdx = hotbar.indexOf(w.id);
    const inHotbar = hotbarIdx >= 0;

    let effectiveDmg = Math.round(w.damage * totalMeleeMult * 10) / 10;
    if (w.type === "musket") effectiveDmg = Math.round(w.damage * wepMult * 10) / 10;
    else if (w.type === "bow" || w.type === "crossbow") effectiveDmg = Math.round(w.damage * wepMult * 10) / 10;
    else if (w.type === "throw") effectiveDmg = w.damage;

    const attackSpeed = (1 / Math.max(0.1, w.cooldown)).toFixed(1);

    let ammoDisplay = "Infinita (Corpo a Corpo)";
    if (w.ammo) {
      const count = ammoMap[w.ammo] ?? 0;
      const label = AMMO_LABELS[w.ammo] || w.ammo.toUpperCase();
      ammoDisplay = `${count} ${label}`;
    }

    let durDisplay = "Infinita (Aço Forjado)";
    if (w.isImprovised) {
      const cur = durMap[w.id] !== undefined ? durMap[w.id] : (w.durability || 10);
      durDisplay = `${cur}/${w.maxDurability || 10} Usos (Rústica)`;
    }

    const traits = [];
    if (w.id === "spear" || w.id === "makeshift_spear") traits.push("Investida com Lança: Dano aumenta com a velocidade (até 3.5x)");
    if (w.combo) traits.push("Combo fluído de 3 golpes em sequência");
    if (w.charge) traits.push("Ataque carregado pesado com alto recuo");
    if (w.hands === 1) traits.push("1 Mão · Permite empunhar Escudo (segurar Q)");
    else traits.push("2 Mãos · Golpe de arco amplo e devastador");
    if (w.toolType === "AXE") traits.push("Corta árvores e colhe madeira");
    if (w.toolType === "PICKAXE") traits.push("Minera rochas, pedregulhos e barro");
    if (w.type === "musket") traits.push("Pólvora rápida (120 m/s) · Perfura armadura");
    if (w.type === "bow" || w.type === "crossbow") traits.push("Disparo preciso de longa distância · Tiro na cabeça causa dano crítico");
    if (w.radius) traits.push(`Explosão em raio (${w.radius}m)`);

    _codexModalEl.innerHTML = `
      <div class="codex-panel" role="dialog" aria-modal="true">
        <div class="codex-header">
          <div class="codex-title-wrap">
            <h2>⚔️ DETALHES DA ARMA</h2>
            <p>Estatísticas completas e atribuição aos slots em mãos</p>
          </div>
          <button class="codex-close-btn" id="codex-btn-close" aria-label="Fechar">✕</button>
        </div>

        <div class="codex-detail-view">
          <button class="detail-back-btn" id="btn-back-codex">
            ← Voltar ao Compêndio
          </button>

          <div class="detail-hero-card">
            <div class="detail-hero-header">
              <h3 class="detail-hero-title">
                ${w.name}
                <span class="card-status-badge ${isEquipped ? "eq" : inHotbar ? "hot" : isOwned ? "inv" : "lock"}">
                  ${isEquipped ? "EM MÃOS" : inHotbar ? `SLOT ${hotbarIdx + 1}` : isOwned ? "NO ALFORJE" : "BLOQUEADA"}
                </span>
              </h3>
              <span style="font-size: 12px; color: #ffd700; font-weight: 700;">
                ${w.hands === 1 ? "1 Mão (Escudo)" : "2 Mãos"} · ${w.type.toUpperCase()}
              </span>
            </div>

            <div class="detail-stats-grid">
              <div class="detail-stat-row">
                <span class="detail-stat-label">Dano Base da Arma:</span>
                <span class="detail-stat-val gold">${w.damage} pts</span>
              </div>
              <div class="detail-stat-row">
                <span class="detail-stat-label">Dano Efetivo (Força + Forja):</span>
                <span class="detail-stat-val gold">${effectiveDmg} pts</span>
              </div>
              <div class="detail-stat-row">
                <span class="detail-stat-label">Velocidade de Ataque:</span>
                <span class="detail-stat-val">${attackSpeed} golpes/s (${w.cooldown}s)</span>
              </div>
              <div class="detail-stat-row">
                <span class="detail-stat-label">Alcance de Golpe:</span>
                <span class="detail-stat-val">${w.reach ? `${w.reach}m` : "Projétil"}</span>
              </div>
              <div class="detail-stat-row">
                <span class="detail-stat-label">Força de Impacto:</span>
                <span class="detail-stat-val">${w.knock} pts (Empurrão)</span>
              </div>
              <div class="detail-stat-row">
                <span class="detail-stat-label">Mobilidade (Peso):</span>
                <span class="detail-stat-val">${Math.round(w.weight * 100)}% Velocidade</span>
              </div>
              <div class="detail-stat-row">
                <span class="detail-stat-label">Munição:</span>
                <span class="detail-stat-val">${ammoDisplay}</span>
              </div>
              <div class="detail-stat-row">
                <span class="detail-stat-label">Durabilidade:</span>
                <span class="detail-stat-val">${durDisplay}</span>
              </div>
            </div>

            <div class="detail-traits-box">
              <strong>Propriedades:</strong> ${traits.join(" · ")}
            </div>

            <div class="detail-actions-box">
              ${
                isOwned
                  ? `
                  ${
                    isEquipped
                      ? `<button class="detail-equip-btn" style="background:#5ab46e;border-color:#5ab46e;color:#ffffff;" disabled>✓ Empunhada na Mão Agora</button>`
                      : `<button class="detail-equip-btn" id="btn-detail-equip" data-equip-id="${w.id}">⚔️ Empunhar na Mão Agora</button>`
                  }
                  <div style="font-size: 11px; color: #b5a489; font-weight: 700; margin-top: 4px;">
                    ATRIBUIR AOS SLOTS EM MÃOS (1 a 9):
                  </div>
                  <div class="detail-slot-assign-row">
                    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((sIdx) => {
                      const isCurrent = hotbar[sIdx] === w.id;
                      return `<button class="detail-slot-btn ${isCurrent ? "active-slot" : ""}" data-assign-slot="${sIdx}" data-assign-wep="${w.id}">Slot ${sIdx + 1}${isCurrent ? " (Atual)" : ""}</button>`;
                    }).join("")}
                    ${inHotbar && w.id !== "fists" ? `<button class="detail-slot-btn" style="color:#ff8888;" data-unassign-wep="${w.id}">✕ Remover da Mão</button>` : ""}
                  </div>
                `
                  : `
                  <div style="color: #ffaa77; font-size: 12.5px; font-weight: 600;">
                    🔒 Arma bloqueada · ${w.price > 0 ? `Disponível com o Armeiro da capital por ${w.price} moedas.` : "Crie na bancada de artesanato ou encontre em missões."}
                  </div>
                `
              }
            </div>
          </div>
        </div>
      </div>
    `;

    _setupDetailListeners(env);
    return;
  }

  // Filtragem das armas
  const filtered = WEAPON_LIST.filter((w) => {
    if (_activeCategory === "all") return true;
    if (_activeCategory === "melee1") return w.hands === 1 && (w.type === "melee" || w.type === "fists") && !w.toolType;
    if (_activeCategory === "melee2") return w.hands === 2 && w.type === "melee";
    if (_activeCategory === "ranged") return w.type === "bow" || w.type === "crossbow" || w.type === "musket";
    if (_activeCategory === "throw_tool") return w.type === "throw" || Boolean(w.toolType);
    return true;
  });

  _codexModalEl.innerHTML = `
    <div class="codex-panel" role="dialog" aria-modal="true">
      <div class="codex-header">
        <div class="codex-title-wrap">
          <h2>⚔️ COMPÊNDIO DE ARMAS</h2>
          <p>Selecione um card para ver a descrição detalhada e atribuir aos slots</p>
        </div>
        <button class="codex-close-btn" id="codex-btn-close" aria-label="Fechar">✕</button>
      </div>

      <div class="codex-hotbar-container">
        <div class="codex-hotbar-title">
          <span>⚔️ ARMAS EM MÃOS (HOTBAR 1-9 · CLIQUE NO SLOT PARA EMPUNHAR)</span>
          <span style="color: #bfa888; font-size: 10px; font-weight: normal;">Tocha sempre compartilhada com a mão</span>
        </div>
        <div class="codex-hotbar-grid">
          ${hotbar.map((slotWepId, idx) => {
            const slotNum = idx + 1;
            const slotDef = slotWepId ? WEAPON_LIST.find((w) => w.id === slotWepId) : null;
            const isSlotActive = currentWepId === slotWepId;
            return `
              <div class="codex-hotbar-slot ${isSlotActive ? "active" : ""}" data-hotbar-select="${slotNum}">
                <span class="codex-hotbar-slot-num">${slotNum}</span>
                <span class="codex-hotbar-slot-name">${slotDef ? slotDef.name : "(Vazio)"}</span>
                ${slotWepId && slotWepId !== "fists" ? `<button class="codex-hotbar-slot-clear" data-unassign-slot="${idx}" title="Desequipar da Mão">✕</button>` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <div class="codex-tabs">
        <button class="codex-tab-btn ${_activeCategory === "all" ? "active" : ""}" data-cat="all">Todas (${WEAPON_LIST.length})</button>
        <button class="codex-tab-btn ${_activeCategory === "melee1" ? "active" : ""}" data-cat="melee1">1 Mão (Escudo)</button>
        <button class="codex-tab-btn ${_activeCategory === "melee2" ? "active" : ""}" data-cat="melee2">2 Mãos (Haste/Pesadas)</button>
        <button class="codex-tab-btn ${_activeCategory === "ranged" ? "active" : ""}" data-cat="ranged">Balística (Arcos/Mosquete)</button>
        <button class="codex-tab-btn ${_activeCategory === "throw_tool" ? "active" : ""}" data-cat="throw_tool">Arremesso & Ferramentas</button>
      </div>

      <div class="codex-body">
        ${filtered.map((w) => {
          const isEquipped = currentWepId === w.id;
          const isOwned = ownedSet.has(w.id);
          const hotbarIdx = hotbar.indexOf(w.id);
          const inHotbar = hotbarIdx >= 0;

          return `
            <div class="weapon-card-simple ${isEquipped ? "equipped" : isOwned ? "owned" : ""}" data-inspect-wep="${w.id}">
              <div class="card-header-row">
                <h3 class="card-weapon-name">${w.name}</h3>
                <span class="card-status-badge ${isEquipped ? "eq" : inHotbar ? "hot" : isOwned ? "inv" : "lock"}">
                  ${isEquipped ? "EM MÃOS" : inHotbar ? `SLOT ${hotbarIdx + 1}` : isOwned ? "NO ALFORJE" : "BLOQUEADA"}
                </span>
              </div>
              <div class="card-damage-row">
                <span class="card-damage-label">Dano:</span>
                <span class="card-damage-val">${w.damage} pts</span>
              </div>
              <div class="card-click-hint">
                Ver Detalhes ➜
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  _setupGridListeners(env);
}

function _setupGridListeners(env) {
  const weaponsSys = env.weapons || window.__game?.weapons;

  // Botão fechar
  const btnClose = _codexModalEl.querySelector("#codex-btn-close");
  btnClose?.addEventListener("click", () => closeWeaponsScreen());

  // Listener para abas
  const tabBtns = _codexModalEl.querySelectorAll(".codex-tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      _activeCategory = e.currentTarget.getAttribute("data-cat");
      _renderCodex(env);
    });
  });

  // Listener para clicar no card simples e abrir a descrição detalhada dessa arma
  const cardEls = _codexModalEl.querySelectorAll("[data-inspect-wep]");
  cardEls.forEach((card) => {
    card.addEventListener("click", () => {
      const wepId = card.getAttribute("data-inspect-wep");
      if (wepId) {
        _inspectedWeaponId = wepId;
        _renderCodex(env);
      }
    });
  });

  // Hotbar rápida no topo
  const hotbarSlotEls = _codexModalEl.querySelectorAll("[data-hotbar-select]");
  hotbarSlotEls.forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".codex-hotbar-slot-clear")) return;
      const num = Number(el.getAttribute("data-hotbar-select"));
      if (num && weaponsSys?.selectSlot) {
        weaponsSys.selectSlot(num);
        _renderCodex(env);
      }
    });
  });

  // Limpar slot da hotbar
  const clearSlotBtns = _codexModalEl.querySelectorAll("[data-unassign-slot]");
  clearSlotBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const sIdx = Number(btn.getAttribute("data-unassign-slot"));
      if (weaponsSys?.unassignHotbarSlot) {
        weaponsSys.unassignHotbarSlot(sIdx);
        _renderCodex(env);
      }
    });
  });
}

function _setupDetailListeners(env) {
  const weaponsSys = env.weapons || window.__game?.weapons;

  // Botão fechar
  const btnClose = _codexModalEl.querySelector("#codex-btn-close");
  btnClose?.addEventListener("click", () => closeWeaponsScreen());

  // Botão voltar à lista
  const btnBack = _codexModalEl.querySelector("#btn-back-codex");
  btnBack?.addEventListener("click", () => {
    _inspectedWeaponId = null;
    _renderCodex(env);
  });

  // Botão equipar agora
  const btnEquip = _codexModalEl.querySelector("#btn-detail-equip");
  btnEquip?.addEventListener("click", (e) => {
    const id = e.currentTarget.getAttribute("data-equip-id");
    if (id && weaponsSys?.equip) {
      if (weaponsSys.hotbarSlots && !weaponsSys.hotbarSlots.includes(id)) {
        let freeIdx = weaponsSys.hotbarSlots.indexOf(null);
        if (freeIdx === -1) freeIdx = 3;
        weaponsSys.assignHotbarSlot(freeIdx, id);
      }
      weaponsSys.equip(id, false);
      weaponsSys._refreshWeaponHud?.();
      env.audio?.weaponSwing?.("slash", false);
      env.ui?.showToast?.(`⚔️ Empunhaste: ${WEAPON_LIST.find((w) => w.id === id)?.name || id}`);
      _renderCodex(env);
    }
  });

  // Atribuir aos slots 1 a 9
  const assignBtns = _codexModalEl.querySelectorAll("[data-assign-slot]");
  assignBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const sIdx = Number(btn.getAttribute("data-assign-slot"));
      const wepId = btn.getAttribute("data-assign-wep");
      if (weaponsSys?.assignHotbarSlot && wepId) {
        weaponsSys.assignHotbarSlot(sIdx, wepId);
        env.audio?.weaponSwing?.("slash", false);
        env.ui?.showToast?.(`⚔️ ${WEAPON_LIST.find((w) => w.id === wepId)?.name || wepId} atribuída ao Slot [${sIdx + 1}] em mãos!`);
        _renderCodex(env);
      }
    });
  });

  // Remover da mão
  const unassignBtn = _codexModalEl.querySelector("[data-unassign-wep]");
  unassignBtn?.addEventListener("click", (e) => {
    const wepId = e.currentTarget.getAttribute("data-unassign-wep");
    if (weaponsSys?.hotbarSlots) {
      const idx = weaponsSys.hotbarSlots.indexOf(wepId);
      if (idx >= 0) {
        weaponsSys.unassignHotbarSlot(idx);
        env.ui?.showToast?.(`Arma recolhida para o alforje.`);
        _renderCodex(env);
      }
    }
  });
}

// Expõe globalmente
window.showWeaponsCodex = () => openWeaponsScreen(window.__game || {});
