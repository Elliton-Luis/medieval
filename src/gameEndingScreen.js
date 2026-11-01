import { clearSave } from "./save.js";
import { PlayerStats } from "./rpg.js";

let _endingModalEl = null;

const ENDING_CSS = `
#game-ending-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(14, 8, 20, 0.94) 0%, rgba(3, 1, 6, 0.98) 100%);
  backdrop-filter: blur(10px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: "Cinzel Decorative", "Almendra", Georgia, "Times New Roman", serif;
  color: #f7eed8;
  padding: 24px;
  box-sizing: border-box;
}
#game-ending-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.ending-card {
  max-width: 680px;
  width: 100%;
  border-radius: 8px;
  padding: 38px 42px;
  box-sizing: border-box;
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: ending-pop 0.8s cubic-bezier(0.18, 0.89, 0.32, 1.15);
}
@keyframes ending-pop {
  from { transform: scale(0.92) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
.ending-card.demiurge {
  background: linear-gradient(180deg, rgba(26, 7, 22, 0.96) 0%, rgba(10, 2, 14, 0.98) 100%);
  border: 2px solid #b8143d;
  box-shadow: 0 0 60px rgba(184, 20, 61, 0.45), inset 0 0 35px rgba(0, 0, 0, 0.85);
}
.ending-card.holy {
  background: linear-gradient(180deg, rgba(22, 21, 36, 0.96) 0%, rgba(11, 10, 20, 0.98) 100%);
  border: 2px solid #ffd700;
  box-shadow: 0 0 65px rgba(255, 215, 0, 0.4), inset 0 0 35px rgba(0, 0, 0, 0.85);
}
.ending-badge {
  display: inline-block;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 6px 16px;
  border-radius: 4px;
  margin-bottom: 14px;
}
.ending-card.demiurge .ending-badge {
  background: rgba(184, 20, 61, 0.25);
  border: 1px solid rgba(220, 40, 80, 0.6);
  color: #ff88a3;
}
.ending-card.holy .ending-badge {
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid rgba(255, 215, 0, 0.6);
  color: #ffe688;
}
.ending-title {
  margin: 0 0 10px;
  font-size: clamp(26px, 4.4vw, 42px);
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.15;
}
.ending-card.demiurge .ending-title {
  color: #ff3366;
  text-shadow: 0 0 24px rgba(255, 51, 102, 0.6), 0 3px 8px #000;
}
.ending-card.holy .ending-title {
  color: #ffd700;
  text-shadow: 0 0 24px rgba(255, 215, 0, 0.6), 0 3px 8px #000;
}
.ending-subtitle {
  font-size: clamp(14px, 2vw, 17px);
  font-style: italic;
  letter-spacing: 0.06em;
  margin: 0 0 20px;
  color: #d8c8b0;
  opacity: 0.95;
}
.ending-divider {
  width: 80%;
  height: 2px;
  margin: 18px auto 22px;
}
.ending-card.demiurge .ending-divider {
  background: linear-gradient(90deg, transparent, #b8143d 50%, transparent);
}
.ending-card.holy .ending-divider {
  background: linear-gradient(90deg, transparent, #ffd700 50%, transparent);
}
.ending-quote {
  font-size: clamp(14px, 1.8vw, 16.5px);
  line-height: 1.6;
  color: #e5ded2;
  margin: 0 0 24px;
  padding: 0 16px;
  font-style: italic;
  border-left: 3px solid rgba(255, 255, 255, 0.15);
  border-right: 3px solid rgba(255, 255, 255, 0.15);
}
.ending-stats-box {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 14px 20px;
  margin-bottom: 28px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #d6ccb8;
}
.ending-stat-item strong {
  display: block;
  font-size: 16px;
  color: #ffffff;
  margin-top: 2px;
}
.ending-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}
.ending-btn {
  font-family: "Cinzel Decorative", Georgia, serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 14px 24px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.22s ease;
  display: flex;
  align-items: center;
  gap: 10px;
}
.ending-btn-reset {
  background: rgba(160, 20, 30, 0.25);
  border: 1.5px solid #d43b4e;
  color: #ff99a6;
}
.ending-btn-reset:hover {
  background: #b81428;
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(184, 20, 40, 0.5);
}
.ending-btn-export {
  background: rgba(212, 175, 55, 0.25);
  border: 1.5px solid #ffd700;
  color: #ffe688;
}
.ending-btn-export:hover {
  background: #d4af37;
  color: #0b0710;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 215, 0, 0.5);
}
.ending-btn:active {
  transform: translateY(0);
}
.ending-toast-feedback {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: #ffd700;
  opacity: 0;
  transition: opacity 0.3s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.ending-toast-feedback.show {
  opacity: 1;
}
`;

function injectEndingStyles() {
  if (document.getElementById("game-ending-styles")) return;
  const style = document.createElement("style");
  style.id = "game-ending-styles";
  style.textContent = ENDING_CSS;
  document.head.appendChild(style);
}

/**
 * Cria ou reusa a tela de encerramento definitivo do jogo.
 * @param {Object} options
 * @param {"DEMIURGE" | "HOLY"} options.type
 * @param {string} options.title
 * @param {string} options.subtitle
 * @param {string} options.quote
 * @param {string} options.summary
 */
export function showVictoryEndingModal({
  type = "DEMIURGE",
  title = "FIM DA JORNADA",
  subtitle = "O DESTINO FOI CUMPRIDO",
  quote = "",
  summary = "",
}) {
  injectEndingStyles();

  // Libera ponteiro do mouse para permitir interação
  if (document.pointerLockElement) {
    try {
      document.exitPointerLock?.();
    } catch {}
  }

  // Trava o loop do jogador
  if (window.__game?.player) {
    window.__game.player.knockedOut = true;
    window.__game.player.dead = false;
  }
  window.__gameEnded = true;

  if (!_endingModalEl) {
    _endingModalEl = document.createElement("div");
    _endingModalEl.id = "game-ending-overlay";
    document.body.appendChild(_endingModalEl);
  }

  const isDemiurge = type === "DEMIURGE";
  const badgeText = isDemiurge
    ? "👁️ O MAL FINAL · O DESPERTAR DO DEMIURGO"
    : "✝️ O BEM FINAL · A ASSUNÇÃO CELESTIAL";

  const defaultQuote = isDemiurge
    ? "«A matéria sucumbiu e o cárcere da carne ruiu. Não há mais terra, não há mais corpos; a criação material foi inteiramente dissolvida no eterno vazio.»"
    : "«Combati o bom combate, acabei a carreira, guardei a fé. Ao soar da trombeta do Apocalipse, a alma justa é elevada em triunfo aos Céus Eternos.»";

  const finalQuote = quote || defaultQuote;
  const coins = window.__game?.player?.coins ?? PlayerStats.gold ?? 0;
  const morality = Math.round(PlayerStats.morality ?? 50);
  const evil = window.__game?.getEvilPercent ? window.__game.getEvilPercent() : (100 - morality);

  _endingModalEl.innerHTML = `
    <div class="ending-card ${isDemiurge ? "demiurge" : "holy"}" role="dialog" aria-modal="true">
      <div class="ending-badge">${badgeText}</div>
      <h1 class="ending-title">${title}</h1>
      <p class="ending-subtitle">${subtitle}</p>
      <div class="ending-divider"></div>
      <blockquote class="ending-quote">${finalQuote}</blockquote>
      <div class="ending-stats-box">
        <div class="ending-stat-item">
          <span>Rota Concluída</span>
          <strong>${isDemiurge ? "Demiurgo (Vazio)" : "Sagrada (Céus)"}</strong>
        </div>
        <div class="ending-stat-item">
          <span>Nível de Maldade</span>
          <strong>${evil}%</strong>
        </div>
        <div class="ending-stat-item">
          <span>Moralidade</span>
          <strong>${morality}/100</strong>
        </div>
        <div class="ending-stat-item">
          <span>Ouro Acumulado</span>
          <strong>${coins} 🪙</strong>
        </div>
      </div>
      <div class="ending-actions">
        <button class="ending-btn ending-btn-reset" id="btn-ending-reset">
          ↺ Resetar o Save
        </button>
        <button class="ending-btn ending-btn-export" id="btn-ending-export">
          📜 Exportar Conquista
        </button>
      </div>
      <div class="ending-toast-feedback" id="ending-feedback"></div>
    </div>
  `;

  // Animação de entrada
  requestAnimationFrame(() => {
    _endingModalEl.classList.add("active");
  });

  const feedbackEl = _endingModalEl.querySelector("#ending-feedback");
  const showFeedback = (msg) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.classList.add("show");
    setTimeout(() => feedbackEl.classList.remove("show"), 3500);
  };

  // Botão 1: Resetar o Save
  const btnReset = _endingModalEl.querySelector("#btn-ending-reset");
  btnReset?.addEventListener("click", () => {
    if (confirm("Tens certeza de que desejas apagar teu save e recomeçar a jornada do zero?")) {
      clearSave();
      try {
        localStorage.clear();
      } catch {}
      window.location.reload();
    }
  });

  // Botão 2: Exportar Conquista
  const btnExport = _endingModalEl.querySelector("#btn-ending-export");
  btnExport?.addEventListener("click", () => {
    const timestamp = new Date().toLocaleString("pt-BR");
    const routeName = isDemiurge ? "O DESPERTAR DO DEMIURGO (MAL FINAL)" : "A ASSUNÇÃO CELESTIAL (BEM FINAL)";
    const hash = Math.random().toString(36).substring(2, 10).toUpperCase();

    const certText = [
      "╔══════════════════════════════════════════════════════════════════════╗",
      "║                CERTIFICADO DE VITÓRIA · PURIS MEDIEVAL               ║",
      "║                     AS CRÔNICAS DA TERRA DE PURIS                    ║",
      "╚══════════════════════════════════════════════════════════════════════╝",
      "",
      `DATA DA CONQUISTA: ${timestamp}`,
      `DESTINO FINAL:     ${routeName}`,
      `TÍTULO DA VITÓRIA: ${title}`,
      `PROCLAMAÇÃO:       ${subtitle}`,
      "",
      "----------------------------------------------------------------------",
      "REGISTRO DA CONCLUSÃO:",
      finalQuote,
      "",
      "ESTATÍSTICAS DA JORNADA:",
      `- Nível de Maldade: ${evil}%`,
      `- Moralidade Final: ${morality}/100`,
      `- Moedas de Ouro:   ${coins}`,
      `- Força (STR):      ${PlayerStats.str ?? 10}`,
      `- Vitalidade (CON): ${PlayerStats.con ?? 10}`,
      `- Carisma (CHA):    ${PlayerStats.cha ?? 10}`,
      `- Agilidade (SPD):  ${PlayerStats.spd ?? 10}`,
      "",
      "----------------------------------------------------------------------",
      `CÓDIGO DE AUTENTICIDADE: PURIS-CONQUEST-${isDemiurge ? "DEMIURGE" : "HOLY"}-${hash}`,
      "O JOGO FOI DEFINITIVAMENTE ZERADO NESTA ROTA.",
      "======================================================================",
    ].join("\n");

    // Copia para área de transferência
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(certText).catch(() => {});
    }

    // Faz download do arquivo .txt
    try {
      const blob = new Blob([certText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `puris_conquista_${isDemiurge ? "demiurgo" : "assuncao"}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Falha ao disparar download do certificado:", err);
    }

    btnExport.innerHTML = "✓ Conquista Exportada!";
    showFeedback("✓ Certificado salvo em arquivo e copiado para a área de transferência!");
  });
}
