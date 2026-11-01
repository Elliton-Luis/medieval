import { WEAPON_LIST, AMMO_LABELS } from "./weapondata.js";
import { PlayerEquipment, PlayerStats } from "./rpg.js";

let _codexModalEl = null;
let _activeCategory = "all";

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
  max-width: 960px;
  width: 96%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  animation: codex-pop 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.2);
}
@keyframes codex-pop {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1.0); opacity: 1; }
}
.codex-header {
  padding: 18px 24px 14px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
}
.codex-title-wrap h2 {
  margin: 0;
  font-family: "Cinzel Decorative", "Almendra", Georgia, serif;
  font-size: clamp(18px, 2.5vw, 24px);
  font-weight: 900;
  color: #ffd700;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
}
.codex-title-wrap p {
  margin: 4px 0 0;
  font-size: 12px;
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
.codex-summary-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 24px;
  font-size: 12px;
}
.codex-stat-chip {
  display: flex;
  flex-direction: column;
}
.codex-stat-chip span {
  font-size: 11px;
  color: #a49780;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.codex-stat-chip strong {
  font-size: 14px;
  color: #ffd700;
  margin-top: 1px;
}
.codex-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 24px;
  background: rgba(10, 8, 14, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: auto;
}
.codex-tab-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #d6ccb8;
  padding: 6px 12px;
  font-size: 12px;
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
  padding: 16px 24px 24px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.weapon-card {
  background: rgba(22, 17, 30, 0.75);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 6px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.2s ease;
}
.weapon-card:hover {
  border-color: #ffd700;
  background: rgba(30, 24, 42, 0.9);
  transform: translateY(-2px);
  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.5);
}
.weapon-card.equipped {
  border: 1.5px solid #ffd700;
  box-shadow: 0 0 14px rgba(255, 215, 0, 0.35);
  background: linear-gradient(180deg, rgba(38, 30, 52, 0.9) 0%, rgba(20, 15, 28, 0.9) 100%);
}
.weapon-card.owned:not(.equipped) {
  border-color: rgba(90, 180, 110, 0.6);
}
.weapon-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.weapon-card-name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 6px;
}
.weapon-slot-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  color: #d6ccb8;
}
.weapon-status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.weapon-status-badge.eq {
  background: #ffd700;
  color: #0b0710;
}
.weapon-status-badge.inv {
  background: rgba(90, 180, 110, 0.25);
  border: 1px solid #5ab46e;
  color: #88ffaa;
}
.weapon-status-badge.lock {
  background: rgba(255, 255, 255, 0.06);
  color: #887e6d;
}
.weapon-stats-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
  font-size: 12.5px;
}
.weapon-stat-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.07);
  padding-bottom: 3px;
}
.weapon-stat-label {
  color: #a49780;
}
.weapon-stat-val {
  font-weight: 600;
  color: #ffffff;
}
.weapon-stat-val.highlight {
  color: #ffd700;
  font-weight: 700;
}
.weapon-traits-tag {
  font-size: 11px;
  color: #c9a9ff;
  background: rgba(142, 84, 233, 0.15);
  border: 1px solid rgba(142, 84, 233, 0.3);
  padding: 3px 6px;
  border-radius: 3px;
  margin-bottom: 12px;
  line-height: 1.35;
}
.weapon-action-btn {
  width: 100%;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  transition: all 0.18s;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.weapon-action-btn.btn-equip {
  background: rgba(212, 175, 55, 0.25);
  border: 1px solid #ffd700;
  color: #ffe688;
}
.weapon-action-btn.btn-equip:hover {
  background: #d4af37;
  color: #0b0710;
}
.weapon-action-btn.btn-equipped {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  color: #ffd700;
  cursor: default;
}
.weapon-action-btn.btn-locked {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #8c8270;
  cursor: default;
}
.codex-hotbar-container {
  background: rgba(8, 6, 12, 0.75);
  border-bottom: 1px solid rgba(212, 175, 55, 0.25);
  padding: 10px 24px;
}
.codex-hotbar-title {
  font-size: 11px;
  font-weight: 700;
  color: #ffd700;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  letter-spacing: 0.06em;
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
  padding: 6px 4px;
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
.hotbar-assign-wrap {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
}
.hotbar-assign-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.hotbar-assign-label {
  font-size: 10.5px;
  color: #bfa888;
  font-weight: 600;
}
.hotbar-slot-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffe688;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.hotbar-slot-btn:hover {
  background: #ffd700;
  color: #110d18;
  border-color: #ffffff;
}
.hotbar-slot-btn.active-slot {
  background: #ffd700;
  color: #110d18;
  border-color: #ffd700;
}
.btn-unassign {
  background: rgba(220, 50, 50, 0.2);
  border: 1px solid rgba(220, 50, 50, 0.5);
  color: #ff9999;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
}
.btn-unassign:hover {
  background: #dc3232;
  color: #ffffff;
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
 * Abre o compêndio completo de armas e estatísticas de dano.
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

  _renderCodex(env);
  _codexModalEl.classList.add("active");

  const close = () => {
    if (!_codexModalEl.classList.contains("active")) return;
    _codexModalEl.classList.remove("active");
    window.removeEventListener("keydown", onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape" || e.code === "Escape" || e.code === "KeyK") {
      e.preventDefault();
      close();
    }
  };

  window.addEventListener("keydown", onKeyDown);

  const btnClose = _codexModalEl.querySelector("#codex-btn-close");
  btnClose?.addEventListener("click", () => close());
  _codexModalEl.addEventListener("click", (e) => {
    if (e.target === _codexModalEl) close();
  });
}

export function closeWeaponsScreen() {
  if (_codexModalEl) {
    _codexModalEl.classList.remove("active");
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
          <h2>⚔️ COMPÊNDIO DE ARMAS & ARSENAL</h2>
          <p>Estatísticas completas de dano, velocidade, forja e balística do inventário</p>
        </div>
        <button class="codex-close-btn" id="codex-btn-close" aria-label="Fechar">✕</button>
      </div>

      <div class="codex-summary-bar">
        <div class="codex-stat-chip">
          <span>Afiação do Ferreiro</span>
          <strong>Nível ${wepLevel} (+${Math.round((wepMult - 1) * 100)}% Dano)</strong>
        </div>
        <div class="codex-stat-chip">
          <span>Força do Personagem (STR)</span>
          <strong>${PlayerStats.str ?? 10} (+${Math.round((PlayerStats.str - 10) * 5)}% Físico)</strong>
        </div>
        <div class="codex-stat-chip">
          <span>Multiplicador Total</span>
          <strong>×${totalMeleeMult.toFixed(2)} Dano Final</strong>
        </div>
        <div class="codex-stat-chip">
          <span>Arma em Mãos</span>
          <strong>${weaponsSys?.currentWeapon?.name || "Mãos"}</strong>
        </div>
      </div>

      <div class="codex-hotbar-container">
        <div class="codex-hotbar-title">
          <span>⚔️ ARSENAL EM MÃOS (HOTBAR 1-9 · MÁXIMO 9 ARMAS NO CICLO)</span>
          <span style="color: #bfa888; font-size: 10px; font-weight: normal;">Clique no slot para empunhar ou escolha o slot abaixo de cada arma</span>
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

          // Cálculo do dano efetivo
          let effectiveDmg = Math.round(w.damage * totalMeleeMult * 10) / 10;
          if (w.type === "musket") effectiveDmg = Math.round(w.damage * wepMult * 10) / 10;
          else if (w.type === "bow" || w.type === "crossbow") effectiveDmg = Math.round(w.damage * wepMult * 10) / 10;
          else if (w.type === "throw") effectiveDmg = w.damage;

          // Cadência e velocidade
          const attackSpeed = (1 / Math.max(0.1, w.cooldown)).toFixed(1);

          // Munição
          let ammoDisplay = "Infinita (Corpo a Corpo)";
          if (w.ammo) {
            const count = ammoMap[w.ammo] ?? 0;
            const label = AMMO_LABELS[w.ammo] || w.ammo.toUpperCase();
            ammoDisplay = `${count} ${label}`;
          }

          // Durabilidade
          let durDisplay = "Infinita (Aço Forjado)";
          if (w.isImprovised) {
            const cur = durMap[w.id] !== undefined ? durMap[w.id] : (w.durability || 10);
            durDisplay = `${cur}/${w.maxDurability || 10} Usos (Rústica)`;
          }

          // Propriedades especiais
          const traits = [];
          if (w.id === "spear" || w.id === "makeshift_spear") traits.push("Investida com Lança: Dano aumenta com a velocidade (até 3.5x)");
          if (w.combo) traits.push("Combo de 3 Golpes");
          if (w.charge) traits.push("Ataque Carregado Pesado");
          if (w.hands === 1) traits.push("1 Mão · Permite Escudo (Q)");
          else traits.push("2 Mãos · Golpe Largo e Lento");
          if (w.toolType === "AXE") traits.push("Corta Árvores em Madeira");
          if (w.toolType === "PICKAXE") traits.push("Minera Rochas e Barro");
          if (w.type === "musket") traits.push("Pólvora Fulminante (120 m/s) · Perfura Armaduras");
          if (w.type === "bow" || w.type === "crossbow") traits.push("Tiro de Longa Distância · Tiro na Cabeça Dobrado");
          if (w.radius) traits.push(`Explosão em Raio (${w.radius}m)`);

          return `
            <div class="weapon-card ${isEquipped ? "equipped" : isOwned ? "owned" : ""}">
              <div>
                <div class="weapon-card-header">
                  <h3 class="weapon-card-name">
                    ${w.name}
                    ${inHotbar ? `<span class="weapon-slot-badge" style="background:#ffd700;color:#0b0710;">Slot ${hotbarIdx + 1} em Mãos</span>` : `<span class="weapon-slot-badge">Cat. ${w.slot}</span>`}
                  </h3>
                  <span class="weapon-status-badge ${isEquipped ? "eq" : isOwned ? "inv" : "lock"}">
                    ${isEquipped ? "EM MÃOS" : inHotbar ? `HOTBAR (${hotbarIdx + 1})` : isOwned ? "NO ALFORJE" : "BLOQUEADA"}
                  </span>
                </div>

                <div class="weapon-stats-list">
                  <div class="weapon-stat-row">
                    <span class="weapon-stat-label">Dano Base / Efetivo:</span>
                    <span class="weapon-stat-val highlight">${w.damage} ➔ ${effectiveDmg} pts</span>
                  </div>
                  <div class="weapon-stat-row">
                    <span class="weapon-stat-label">Velocidade de Ataque:</span>
                    <span class="weapon-stat-val">${attackSpeed} golpes/s (${w.cooldown}s)</span>
                  </div>
                  <div class="weapon-stat-row">
                    <span class="weapon-stat-label">Alcance da Arma:</span>
                    <span class="weapon-stat-val">${w.reach ? `${w.reach}m` : "Disparo"}</span>
                  </div>
                  <div class="weapon-stat-row">
                    <span class="weapon-stat-label">Força de Impacto:</span>
                    <span class="weapon-stat-val">${w.knock} pts (Empurrão)</span>
                  </div>
                  <div class="weapon-stat-row">
                    <span class="weapon-stat-label">Mobilidade (Peso):</span>
                    <span class="weapon-stat-val">${Math.round(w.weight * 100)}% Velocidade</span>
                  </div>
                  <div class="weapon-stat-row">
                    <span class="weapon-stat-label">Munição:</span>
                    <span class="weapon-stat-val">${ammoDisplay}</span>
                  </div>
                  <div class="weapon-stat-row">
                    <span class="weapon-stat-label">Durabilidade:</span>
                    <span class="weapon-stat-val">${durDisplay}</span>
                  </div>
                </div>

                <div class="weapon-traits-tag">
                  ✦ ${traits.join(" · ")}
                </div>

                ${
                  isOwned
                    ? `
                    <div class="hotbar-assign-wrap">
                      <div class="hotbar-assign-row">
                        <span class="hotbar-assign-label">Equipar no Slot:</span>
                        ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((sIdx) => {
                          const isCurrentSlot = hotbar[sIdx] === w.id;
                          return `<button class="hotbar-slot-btn ${isCurrentSlot ? "active-slot" : ""}" data-assign-slot="${sIdx}" data-assign-wep="${w.id}" title="Equipar ${w.name} no Slot ${sIdx + 1}">${sIdx + 1}</button>`;
                        }).join("")}
                        ${inHotbar && w.id !== "fists" ? `<button class="btn-unassign" data-unassign-wep="${w.id}">Remover da Mão</button>` : ""}
                      </div>
                    </div>
                  `
                    : ""
                }
              </div>

              <div style="margin-top: 8px;">
                ${
                  isEquipped
                    ? `<button class="weapon-action-btn btn-equipped" disabled>✓ Empunhada Agora</button>`
                    : isOwned
                    ? `<button class="weapon-action-btn btn-equip" data-equip-id="${w.id}">Empunhar Agora</button>`
                    : `<button class="weapon-action-btn btn-locked" disabled>Bloqueada · ${w.price > 0 ? `Compre no Armeiro por ${w.price} 🪙` : "Crie na Bancada"}</button>`
                }
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  // Listener para abas
  const tabBtns = _codexModalEl.querySelectorAll(".codex-tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      _activeCategory = e.currentTarget.getAttribute("data-cat");
      _renderCodex(env);
    });
  });

  // Listener para seleção de slots rápidos na Hotbar superior
  const hotbarSlotEls = _codexModalEl.querySelectorAll("[data-hotbar-select]");
  hotbarSlotEls.forEach((el) => {
    el.addEventListener("click", (e) => {
      // Ignora clique se for no botão de limpar slot
      if (e.target.closest(".codex-hotbar-slot-clear")) return;
      const num = Number(el.getAttribute("data-hotbar-select"));
      if (num && weaponsSys?.selectSlot) {
        weaponsSys.selectSlot(num);
        _renderCodex(env);
      }
    });
  });

  // Listener para desequipar slot específico da Hotbar
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

  // Listener para atribuir arma ao slot 1..9
  const assignSlotBtns = _codexModalEl.querySelectorAll("[data-assign-slot]");
  assignSlotBtns.forEach((btn) => {
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

  // Listener para remover arma da hotbar
  const unassignWepBtns = _codexModalEl.querySelectorAll("[data-unassign-wep]");
  unassignWepBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const wepId = btn.getAttribute("data-unassign-wep");
      if (weaponsSys?.hotbarSlots) {
        const idx = weaponsSys.hotbarSlots.indexOf(wepId);
        if (idx >= 0) {
          weaponsSys.unassignHotbarSlot(idx);
          env.ui?.showToast?.(`Arma recolhida para o alforje.`);
          _renderCodex(env);
        }
      }
    });
  });

  // Listener para botões de equipar diretamente
  const equipBtns = _codexModalEl.querySelectorAll("[data-equip-id]");
  equipBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-equip-id");
      if (id && weaponsSys?.equip) {
        // Se a arma não estiver em nenhum slot da hotbar, atribui a um slot livre ou ao primeiro que puder
        if (weaponsSys.hotbarSlots && !weaponsSys.hotbarSlots.includes(id)) {
          let freeIdx = weaponsSys.hotbarSlots.indexOf(null);
          if (freeIdx === -1) freeIdx = 3; // Substitui o slot 4 se todos cheios
          weaponsSys.assignHotbarSlot(freeIdx, id);
        }
        weaponsSys.equip(id, false);
        weaponsSys._refreshWeaponHud?.();
        env.audio?.weaponSwing?.("slash", false);
        env.ui?.showToast?.(`⚔️ Empunhaste: ${WEAPON_LIST.find((w) => w.id === id)?.name || id}`);
        _renderCodex(env);
      }
    });
  });
}

// Expõe globalmente
window.showWeaponsCodex = () => openWeaponsScreen(window.__game || {});
