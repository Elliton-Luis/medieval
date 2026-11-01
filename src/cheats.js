import {
  PlayerStats,
  PlayerInventory,
  PlayerEquipment,
  equipArmor,
  syncPlayerStatsToPlayer,
} from "./rpg.js?v=20";

let _cheatModalEl = null;

const CHEAT_MODAL_CSS = `
#cheat-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 6, 14, 0.82);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
#cheat-modal-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.cheat-panel {
  background: linear-gradient(180deg, #1f1828 0%, #120e18 100%);
  border: 2px solid #8e54e9;
  border-radius: 8px;
  box-shadow: 0 0 30px rgba(142, 84, 233, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.8);
  padding: 24px 28px;
  max-width: 520px;
  width: 90%;
  color: #f0e6ff;
  position: relative;
  animation: cheat-pop 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
@keyframes cheat-pop {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1.0); opacity: 1; }
}
.cheat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(142, 84, 233, 0.4);
  padding-bottom: 12px;
  margin-bottom: 18px;
}
.cheat-title {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #c9a9ff;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cheat-close-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ff8888;
  font-size: 18px;
  width: 30px;
  height: 30px;
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
.cheat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}
.cheat-btn {
  background: rgba(142, 84, 233, 0.15);
  border: 1px solid rgba(142, 84, 233, 0.5);
  border-radius: 6px;
  color: #eee0ff;
  padding: 11px 14px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.18s ease;
  text-align: left;
}
.cheat-btn:hover {
  background: rgba(142, 84, 233, 0.45);
  border-color: #bb86fc;
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(142, 84, 233, 0.35);
}
.cheat-btn:active {
  transform: translateY(0);
}
.cheat-tip {
  font-size: 12px;
  color: #9f8fb5;
  text-align: center;
  margin: 0;
}
`;

function _injectCheatStyles() {
  if (document.getElementById("cheat-modal-styles")) return;
  const style = document.createElement("style");
  style.id = "cheat-modal-styles";
  style.textContent = CHEAT_MODAL_CSS;
  document.head.appendChild(style);
}

export function openCheatModal(env) {
  _injectCheatStyles();

  if (!_cheatModalEl) {
    _cheatModalEl = document.createElement("div");
    _cheatModalEl.id = "cheat-modal-overlay";
    document.body.appendChild(_cheatModalEl);
  }

  _cheatModalEl.innerHTML = `
    <div class="cheat-panel" role="dialog" aria-modal="true">
      <div class="cheat-header">
        <h2 class="cheat-title">🥔 CHEAT MENU · PURIS DEBUG</h2>
        <button class="cheat-close-btn" id="cheat-btn-close" aria-label="Fechar">✕</button>
      </div>
      <div class="cheat-grid">
        <button class="cheat-btn" data-cheat="godMode">⚡ Modo Deus (Vida Infinita)</button>
        <button class="cheat-btn" data-cheat="giveAllWeapons">⚔️ Liberar Todo o Arsenal</button>
        <button class="cheat-btn" data-cheat="makeMeRich">💰 +10.000 Ouro</button>
        <button class="cheat-btn" data-cheat="setSpeed">🏃 Super Velocidade (2.5x)</button>
        <button class="cheat-btn" data-cheat="forgiveSins">🕊️ Perdoar Pecados & Voto</button>
        <button class="cheat-btn" data-cheat="killAllEnemies">💀 Exterminar Inimigos Próximos</button>
        <button class="cheat-btn" data-cheat="armor0">🛡️ Armadura 0 (Camponês)</button>
        <button class="cheat-btn" data-cheat="armor1">🛡️ Armadura 1 (Couro)</button>
        <button class="cheat-btn" data-cheat="armor2">🛡️ Armadura 2 (Cota de Malha)</button>
        <button class="cheat-btn" data-cheat="armor3">🛡️ Armadura 3 (Placas / Templário)</button>
      </div>
      <p class="cheat-tip">Você também pode executar <code>window.CheatMenu.godMode()</code> diretamente no console.</p>
    </div>
  `;

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

  const buttons = _cheatModalEl.querySelectorAll(".cheat-btn");
  buttons.forEach((b) => {
    b.addEventListener("click", (e) => {
      const type = e.currentTarget.getAttribute("data-cheat");
      if (type === "godMode") window.CheatMenu.godMode();
      else if (type === "giveAllWeapons") window.CheatMenu.giveAllWeapons();
      else if (type === "makeMeRich") window.CheatMenu.makeMeRich();
      else if (type === "setSpeed") window.CheatMenu.setSpeed(2.5);
      else if (type === "forgiveSins") window.CheatMenu.forgiveSins();
      else if (type === "killAllEnemies") window.CheatMenu.killAllEnemies();
      else if (type === "armor0") window.CheatMenu.equipArmor(0);
      else if (type === "armor1") window.CheatMenu.equipArmor(1);
      else if (type === "armor2") window.CheatMenu.equipArmor(2);
      else if (type === "armor3") window.CheatMenu.equipArmor(3);
    });
  });
}

/**
 * Inicializa o menu de Cheats acessível via Console (window.CheatMenu)
 * e via sequência de teclado ('POTATO' ou 'CHIEFS') durante o jogo.
 */
export function initCheatMenu(env = {}) {
  window.CheatMenu = {
    godMode() {
      if (env.player) {
        env.player.maxHealth = 9999;
        env.player.health = 9999;
      }
      PlayerStats.con = 999;
      PlayerStats.hp = 9999;
      PlayerStats.maxHp = 9999;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.choir?.();
      env.ui?.showToast?.("⚡ CHEAT: Modo Deus ATIVADO (Vitalidade Máxima)!");
      console.log("⚡ CHEAT: Modo Deus ON - Vida infinita");
      return "God Mode ON";
    },

    giveAllWeapons() {
      if (env.weapons) {
        const allWeps = [
          "shortsword",
          "broadsword",
          "claymore",
          "axe",
          "pickaxe",
          "torch",
          "makeshift_spear",
          "makeshift_club",
          "bow",
          "crossbow",
          "bomb",
        ];
        for (const w of allWeps) {
          env.weapons.unlock?.(w, true);
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
      PlayerInventory.hay = 999;
      PlayerInventory.torches = 99;
      syncPlayerStatsToPlayer(env.player, env.ui);
      env.audio?.weaponSwing?.("slash", false);
      env.ui?.showToast?.("⚔️ CHEAT: Todas as armas, munições e recursos liberados!");
      console.log("⚔️ CHEAT: Todo o arsenal desbloqueado!");
      return "Arsenal liberado";
    },

    makeMeRich() {
      const bonus = 10000;
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
      // Ajusta PlayerStats.spd para refletir a velocidade
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
            n.takeHit?.(999, 0, 0, 2);
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
  };

  // Detector de Sequência de Teclado ("POTATO" ou "CHIEFS")
  let keySequence = "";
  let lastKeyTimestamp = 0;

  window.addEventListener("keydown", (e) => {
    // Ignora inputs em caixas de texto
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

  console.log(
    "%c[PURIS CHEATS] Ativado! Digite 'POTATO' durante o jogo ou use o console 'window.CheatMenu'",
    "color: #bb86fc; font-weight: bold; font-size: 13px;"
  );
}
