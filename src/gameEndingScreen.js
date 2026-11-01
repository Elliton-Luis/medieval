import { clearSave } from "./save.js";
import { PlayerStats, PlayerEquipment } from "./rpg.js";

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
  overflow-y: auto;
}
#game-ending-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.ending-card {
  max-width: 740px;
  width: 100%;
  border-radius: 8px;
  padding: 34px 40px;
  box-sizing: border-box;
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: ending-pop 0.8s cubic-bezier(0.18, 0.89, 0.32, 1.15);
  max-height: 92vh;
  overflow-y: auto;
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
  margin-bottom: 12px;
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
  margin: 0 0 8px;
  font-size: clamp(26px, 4.4vw, 40px);
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
  font-size: clamp(13px, 1.8vw, 16px);
  font-style: italic;
  letter-spacing: 0.06em;
  margin: 0 0 16px;
  color: #d8c8b0;
  opacity: 0.95;
}
.ending-divider {
  width: 80%;
  height: 2px;
  margin: 14px auto 18px;
}
.ending-card.demiurge .ending-divider {
  background: linear-gradient(90deg, transparent, #b8143d 50%, transparent);
}
.ending-card.holy .ending-divider {
  background: linear-gradient(90deg, transparent, #ffd700 50%, transparent);
}
.ending-quote {
  font-size: clamp(13.5px, 1.7vw, 16px);
  line-height: 1.6;
  color: #e5ded2;
  margin: 0 0 20px;
  padding: 0 16px;
  font-style: italic;
  border-left: 3px solid rgba(255, 255, 255, 0.15);
  border-right: 3px solid rgba(255, 255, 255, 0.15);
}
.ending-stats-box {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 12px 18px;
  margin-bottom: 22px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #d6ccb8;
}
.ending-stat-item strong {
  display: block;
  font-size: 15px;
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
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 13px 22px;
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
.ending-preview-wrap {
  margin: 18px auto 8px;
  max-width: 520px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.7);
  display: none;
}
.ending-preview-wrap.show {
  display: block;
}
.ending-preview-img {
  width: 100%;
  display: block;
  border-radius: 6px;
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
  white-space: nowrap;
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
 * Desenha o certificado gráfico padrão de conquista em alta resolução (1200x800).
 * Apresenta a ilustração do personagem (corrompido/podre com olhos reptilianos ou nobre cavaleiro em armadura),
 * as desgraças trazidas pelo Mal ou virtudes e frases sagradas do Bem, além de estatísticas completas.
 */
export function renderConquestCertificateCanvas({
  type = "DEMIURGE",
  title = "",
  subtitle = "",
  quote = "",
  evil = 50,
  morality = 0,
  coins = 0,
  hash = "",
  timestamp = "",
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  const isDemiurge = type === "DEMIURGE";

  // 1. Fundo Texturizado (Void Gnóstico x Pergaminho Sagrado)
  if (isDemiurge) {
    const bgGrad = ctx.createRadialGradient(600, 400, 80, 600, 400, 750);
    bgGrad.addColorStop(0, "#220520");
    bgGrad.addColorStop(0.55, "#100314");
    bgGrad.addColorStop(1, "#030006");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 800);

    // Vignette escurecida de cinzas
    const darkVignette = ctx.createLinearGradient(0, 0, 1200, 800);
    darkVignette.addColorStop(0, "rgba(45, 4, 16, 0.45)");
    darkVignette.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    darkVignette.addColorStop(1, "rgba(20, 2, 28, 0.65)");
    ctx.fillStyle = darkVignette;
    ctx.fillRect(0, 0, 1200, 800);
  } else {
    const bgGrad = ctx.createRadialGradient(600, 400, 100, 600, 400, 750);
    bgGrad.addColorStop(0, "#262240");
    bgGrad.addColorStop(0.6, "#131024");
    bgGrad.addColorStop(1, "#090812");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 800);

    // Raios de glória celestial tênues
    ctx.save();
    ctx.translate(600, 0);
    ctx.fillStyle = "rgba(255, 215, 0, 0.04)";
    for (let r = -8; r <= 8; r++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 90 - 30, 800);
      ctx.lineTo(r * 90 + 30, 800);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 2. Borda Medieval Ornamentada com Nós Góticos
  const primaryColor = isDemiurge ? "#b8143d" : "#ffd700";
  const secondaryColor = isDemiurge ? "#ff3366" : "#d4af37";

  // Moldura Externa Dupla
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, 1144, 744);

  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(38, 38, 1124, 724);

  // Cantos ornamentais em cruz medieval
  const drawCornerFlourish = (x, y, flipX, flipY) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX, flipY);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 35);
    ctx.lineTo(35, 35);
    ctx.lineTo(35, 0);
    ctx.stroke();

    ctx.fillStyle = secondaryColor;
    ctx.fillRect(32, 32, 6, 6);
    ctx.restore();
  };
  drawCornerFlourish(38, 38, 1, 1);
  drawCornerFlourish(1162, 38, -1, 1);
  drawCornerFlourish(38, 762, 1, -1);
  drawCornerFlourish(1162, 762, -1, -1);

  // 3. Faixa de Cabeçalho Superior e Lema em Latim
  ctx.textAlign = "center";
  ctx.fillStyle = isDemiurge ? "#ff88a3" : "#ffe688";
  ctx.font = "bold 13px Georgia, serif";
  ctx.letterSpacing = "4px";
  const motto = isDemiurge
    ? "« RUINA CARNIS · DISSOLUTIO MUNDI · VACUUM AETERNUM »"
    : "« NON NOBIS DOMINE · SOLI DEO GLORIA · JUSTITIA AETERNA »";
  ctx.fillText(motto, 600, 72);

  // Título da Vitória
  ctx.fillStyle = primaryColor;
  ctx.font = "900 36px 'Cinzel Decorative', Georgia, serif";
  ctx.shadowColor = isDemiurge ? "rgba(255, 20, 60, 0.7)" : "rgba(255, 215, 0, 0.7)";
  ctx.shadowBlur = 18;
  const mainTitle = isDemiurge ? "O DESPERTAR DO DEMIURGO" : "A ASSUNÇÃO CELESTIAL";
  ctx.fillText(mainTitle, 600, 116);
  ctx.shadowBlur = 0;

  // Subtítulo
  ctx.fillStyle = "#d8c8b0";
  ctx.font = "italic 16px Georgia, serif";
  ctx.fillText(subtitle || (isDemiurge ? "A DISSOLUÇÃO DA MATÉRIA E O FIM DO CÁRCERE DA CARNE" : "O TRIUNFO DOS JUSTOS E A ENTRADA NO REINO DOS CÉUS"), 600, 144);

  // Linha divisória dourada / rubi
  const lineGrad = ctx.createLinearGradient(250, 0, 950, 0);
  lineGrad.addColorStop(0, "transparent");
  lineGrad.addColorStop(0.5, primaryColor);
  lineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(250, 156);
  ctx.lineTo(950, 156);
  ctx.stroke();

  // =========================================================================
  // 4. QUADRO DA ESQUERDA: ILUSTRAÇÃO DO PERSONAGEM (Corrompido x Cavaleiro Santo)
  // =========================================================================
  const portX = 72;
  const portY = 178;
  const portW = 340;
  const portH = 490;

  // Moldura do Retrato
  ctx.fillStyle = isDemiurge ? "rgba(14, 3, 18, 0.85)" : "rgba(18, 15, 30, 0.85)";
  ctx.fillRect(portX, portY, portW, portH);
  ctx.strokeStyle = isDemiurge ? "rgba(184, 20, 61, 0.6)" : "rgba(255, 215, 0, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(portX, portY, portW, portH);

  // Desenho Ilustrado do Personagem
  ctx.save();
  ctx.beginPath();
  ctx.rect(portX + 2, portY + 2, portW - 4, portH - 4);
  ctx.clip();

  const centerX = portX + portW / 2;
  const centerY = portY + 220;

  if (isDemiurge) {
    // --- ILUSTRAÇÃO: PERSONAGEM CORROMPIDO, PODRE E VESTIDO DO DEMIURGO ---
    // Miasma escuro de fundo
    const miasmaGrad = ctx.createRadialGradient(centerX, centerY - 20, 30, centerX, centerY, 190);
    miasmaGrad.addColorStop(0, "rgba(80, 10, 70, 0.6)");
    miasmaGrad.addColorStop(0.7, "rgba(20, 2, 25, 0.9)");
    miasmaGrad.addColorStop(1, "rgba(8, 1, 10, 0.95)");
    ctx.fillStyle = miasmaGrad;
    ctx.fillRect(portX, portY, portW, portH);

    // Coroa de Espinhos de Obsidiana
    ctx.strokeStyle = "#5a0815";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 100, 65, 0, Math.PI * 2);
    ctx.stroke();
    for (let s = 0; s < 12; s++) {
      const a = (s / 12) * Math.PI * 2;
      ctx.fillStyle = "#ff1133";
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(a) * 65, centerY - 100 + Math.sin(a) * 65);
      ctx.lineTo(centerX + Math.cos(a) * 82, centerY - 100 + Math.sin(a) * 82);
      ctx.stroke();
    }

    // Ombros e Capa Cerimonial Roxa Rasgada do Demiurgo
    ctx.fillStyle = "#180624";
    ctx.beginPath();
    ctx.moveTo(centerX - 130, centerY + 240);
    ctx.lineTo(centerX - 85, centerY + 20);
    ctx.lineTo(centerX, centerY - 30);
    ctx.lineTo(centerX + 85, centerY + 20);
    ctx.lineTo(centerX + 130, centerY + 240);
    ctx.closePath();
    ctx.fill();

    // Estola Carmesim de Seda
    ctx.fillStyle = "#6b0c1e";
    ctx.beginPath();
    ctx.moveTo(centerX - 35, centerY + 15);
    ctx.lineTo(centerX - 45, centerY + 240);
    ctx.lineTo(centerX + 45, centerY + 240);
    ctx.lineTo(centerX + 35, centerY + 15);
    ctx.closePath();
    ctx.fill();

    // Emblema Dourado do Ouroboros / Olho Cósmico no peito
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY + 95, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ff2244";
    ctx.beginPath();
    ctx.arc(centerX, centerY + 95, 7, 0, Math.PI * 2);
    ctx.fill();

    // Pescoço e Cabeça com Pele Esverdeada Pálida Cadavérica (Podre)
    ctx.fillStyle = "#5c6b5e";
    ctx.fillRect(centerX - 24, centerY - 35, 48, 55);

    // Veias necróticas escuras se espalhando
    ctx.strokeStyle = "#1a0422";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - 15, centerY + 10);
    ctx.lineTo(centerX - 5, centerY - 15);
    ctx.lineTo(centerX - 18, centerY - 30);
    ctx.moveTo(centerX + 14, centerY + 10);
    ctx.lineTo(centerX + 6, centerY - 12);
    ctx.lineTo(centerX + 16, centerY - 28);
    ctx.stroke();

    // Capuz Sombrio cobrindo a testa
    ctx.fillStyle = "#11041a";
    ctx.beginPath();
    ctx.moveTo(centerX - 52, centerY + 20);
    ctx.lineTo(centerX - 50, centerY - 65);
    ctx.lineTo(centerX, centerY - 95);
    ctx.lineTo(centerX + 50, centerY - 65);
    ctx.lineTo(centerX + 52, centerY + 20);
    ctx.closePath();
    ctx.fill();

    // Máscara Dourada e Olhar Reptiliano Assustador
    ctx.fillStyle = "#16051f";
    ctx.beginPath();
    ctx.arc(centerX, centerY - 40, 36, 0, Math.PI * 2);
    ctx.fill();

    // Olhos Reptilianos Brilhantes com Fendas Verticais
    for (const sx of [-16, 16]) {
      // Íris rubi pulsante
      ctx.shadowColor = "#ff0033";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ff1133";
      ctx.beginPath();
      ctx.ellipse(centerX + sx, centerY - 42, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupila Reptiliana Vertical Pontiaguda
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.ellipse(centerX + sx, centerY - 42, 2.2, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // --- ILUSTRAÇÃO: PERSONAGEM LIMPO, NOBRE CAVALEIRO DE CRISTO EM ARMADURA ---
    // Resplendor Celestial Dourado
    const haloSun = ctx.createRadialGradient(centerX, centerY - 50, 20, centerX, centerY - 50, 160);
    haloSun.addColorStop(0, "rgba(255, 235, 140, 0.6)");
    haloSun.addColorStop(0.4, "rgba(212, 175, 55, 0.35)");
    haloSun.addColorStop(1, "rgba(18, 14, 32, 0.1)");
    ctx.fillStyle = haloSun;
    ctx.fillRect(portX, portY, portW, portH);

    // Auréola Divina Dourada Perfeita
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 85, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3 Estrelas de Graça sobre a cabeça
    ctx.fillStyle = "#ffffff";
    for (let st = -1; st <= 1; st++) {
      ctx.beginPath();
      ctx.arc(centerX + st * 28, centerY - 150, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ombros e Peitoral de Armadura de Aço Polido & Ouro
    ctx.fillStyle = "#b8bcc8";
    ctx.beginPath();
    ctx.moveTo(centerX - 125, centerY + 240);
    ctx.lineTo(centerX - 80, centerY + 25);
    ctx.lineTo(centerX, centerY - 25);
    ctx.lineTo(centerX + 80, centerY + 25);
    ctx.lineTo(centerX + 125, centerY + 240);
    ctx.closePath();
    ctx.fill();

    // Bordas de ouro nos ombros
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Túnica Branca Imaculada dos Templários
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(centerX - 42, centerY + 20);
    ctx.lineTo(centerX - 50, centerY + 240);
    ctx.lineTo(centerX + 50, centerY + 240);
    ctx.lineTo(centerX + 42, centerY + 20);
    ctx.closePath();
    ctx.fill();

    // Cruz Vermelha Sagrada no Peito
    ctx.fillStyle = "#aa1122";
    ctx.fillRect(centerX - 9, centerY + 45, 18, 90);
    ctx.fillRect(centerX - 35, centerY + 65, 70, 18);

    // Elmo Templário com Visor em Cruz
    ctx.fillStyle = "#d0d4de";
    ctx.beginPath();
    ctx.moveTo(centerX - 32, centerY + 10);
    ctx.lineTo(centerX - 35, centerY - 60);
    ctx.lineTo(centerX, centerY - 80);
    ctx.lineTo(centerX + 35, centerY - 60);
    ctx.lineTo(centerX + 32, centerY + 10);
    ctx.closePath();
    ctx.fill();

    // Faixas de bronze no Elmo
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(centerX - 4, centerY - 75, 8, 70);
    ctx.fillRect(centerX - 28, centerY - 45, 56, 8);

    // Fendas oculares no elmo
    ctx.fillStyle = "#121018";
    ctx.fillRect(centerX - 24, centerY - 43, 18, 4);
    ctx.fillRect(centerX + 6, centerY - 43, 18, 4);

    // Escudo Sagrado empunhado ao lado esquerdo
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(portX + 22, centerY + 80);
    ctx.lineTo(portX + 75, centerY + 80);
    ctx.lineTo(portX + 70, centerY + 175);
    ctx.lineTo(portX + 48, centerY + 215);
    ctx.lineTo(portX + 22, centerY + 175);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cruz no Escudo
    ctx.fillStyle = "#aa1122";
    ctx.fillRect(portX + 43, centerY + 95, 10, 85);
    ctx.fillRect(portX + 28, centerY + 115, 40, 10);
  }
  ctx.restore();

  // Tarja inferior de identificação do personagem
  ctx.fillStyle = isDemiurge ? "rgba(184, 20, 61, 0.4)" : "rgba(212, 175, 55, 0.4)";
  ctx.fillRect(portX, portY + portH - 34, portW, 34);
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(portX, portY + portH - 34, portW, 34);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Georgia, serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "2px";
  ctx.fillText(
    isDemiurge ? "O VASO DO CAOS · CORROMPIDO" : "O DEFENSOR DA FÉ · ASSUNTO AOS CÉUS",
    centerX,
    portY + portH - 12
  );

  // =========================================================================
  // 5. PAINEL DA DIREITA: NARRATIVA HISTÓRICA, DESGRAÇAS/VIRTUDES E ESTATÍSTICAS
  // =========================================================================
  const textX = 445;
  const textY = 180;
  const textW = 680;

  ctx.textAlign = "left";
  ctx.letterSpacing = "1.5px";

  // Cabeçalho da Seção Narrativa
  ctx.fillStyle = isDemiurge ? "#ff88a3" : "#ffe688";
  ctx.font = "bold 14px 'Cinzel Decorative', Georgia, serif";
  ctx.fillText(
    isDemiurge ? "✦ TESTEMUNHO DA PERDIÇÃO & RUÍNA ✦" : "✦ TESTEMUNHO DA GRAÇA & SANTIDADE ✦",
    textX,
    textY + 16
  );

  // Texto descritivo adaptado ao final
  ctx.fillStyle = "#f0e6d6";
  ctx.font = "14px Georgia, serif";
  ctx.letterSpacing = "0.5px";

  const wrapText = (str, x, y, maxW, lineH) => {
    const words = str.split(" ");
    let line = "";
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxW && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + " ";
        curY += lineH;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
    return curY + lineH;
  };

  const evilStory =
    "Pela tua lâmina sem piedade, as muralhas da cidade ruíram e a terra foi manchada com o sangue dos inocentes. Trouxeste a peste, o fogo e o colapso do reino de Caldera. Nenhuma oração foi ouvida: a ilusão da matéria sucumbiu e o mundo foi devolvido ao abismo primordial do Demiurgo.";

  const holyStory =
    "Pela tua virtude inabalável e coragem serena, os fracos foram defendidos, as bestas do eclipse aniquiladas e o reino de Caldera purificado. Ao som estrondoso da trombeta do Apocalipse, tua fidelidade a Cristo foi recompensada com a assunção em glória aos Céus Eternos.";

  let nextY = wrapText(isDemiurge ? evilStory : holyStory, textX, textY + 44, textW - 20, 22);

  // Citação de Destaque
  ctx.fillStyle = isDemiurge ? "#ff99aa" : "#ffd700";
  ctx.font = "italic bold 15px Georgia, serif";
  const quoteText = isDemiurge
    ? "«A carne é o cárcere; tu foste a chave que abriu o eterno nada.»"
    : "«Combati o bom combate, acabei a carreira, guardei a fé.»";
  nextY = wrapText(quoteText, textX, nextY + 10, textW - 20, 24);

  // Linha sutil separando para estatísticas
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textX, nextY + 6);
  ctx.lineTo(textX + textW - 20, nextY + 6);
  ctx.stroke();

  // Título do Box de Estatísticas
  ctx.fillStyle = isDemiurge ? "#ff6688" : "#ffe688";
  ctx.font = "bold 13px 'Cinzel Decorative', Georgia, serif";
  ctx.fillText("ESTATÍSTICAS DA JORNADA", textX, nextY + 30);

  // 4 Caixas de Estatísticas em Grid 2x2
  const statBoxY = nextY + 44;
  const boxW = (textW - 35) / 2;
  const boxH = 58;

  const statsList = isDemiurge
    ? [
        { label: "Nível de Maldade", val: `${evil}% · Corrupção Suprema` },
        { label: "Moralidade da Alma", val: `${morality}/100 · Abismo` },
        { label: "Ouro Pilhado", val: `${coins} Moedas de Ouro 🪙` },
        { label: "Voto de Honra", val: "Quebrado no Sangue" },
      ]
    : [
        { label: "Santidade da Alma", val: "100% · Graça Divina" },
        { label: "Moralidade Pura", val: "+100/100 · Sem Mácula" },
        { label: "Ouro Acumulado", val: `${coins} Moedas de Ouro 🪙` },
        { label: "Voto Templário", val: "Honrado e Sagrado" },
      ];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = textX + col * (boxW + 15);
    const by = statBoxY + row * (boxH + 10);

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = isDemiurge ? "rgba(184, 20, 61, 0.4)" : "rgba(212, 175, 55, 0.4)";
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = "#b5a48e";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillText(statsList[i].label, bx + 12, by + 20);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Georgia, serif";
    ctx.fillText(statsList[i].val, bx + 12, by + 44);
  }

  // =========================================================================
  // 6. SELO DE CERA INFERIOR & CÓDIGO DE AUTENTICIDADE
  // =========================================================================
  const sealX = textX + textW - 75;
  const sealY = 620;

  // Carimbo de cera
  ctx.save();
  ctx.shadowColor = isDemiurge ? "rgba(255, 0, 40, 0.5)" : "rgba(255, 215, 0, 0.5)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = isDemiurge ? "#8a0c20" : "#d4af37";
  ctx.beginPath();
  ctx.arc(sealX, sealY, 36, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isDemiurge ? "#ff3355" : "#ffe688";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sealX, sealY, 31, 0, Math.PI * 2);
  ctx.stroke();

  // Símbolo do Selo (Olho ou Cruz)
  ctx.fillStyle = isDemiurge ? "#ff3355" : "#ffffff";
  ctx.textAlign = "center";
  ctx.font = isDemiurge ? "24px Georgia" : "bold 28px Georgia";
  ctx.fillText(isDemiurge ? "👁" : "✝", sealX, sealY + (isDemiurge ? 8 : 10));
  ctx.restore();

  // Texto de autenticação e data
  ctx.textAlign = "left";
  ctx.fillStyle = "#a89a85";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.letterSpacing = "1px";
  ctx.fillText(`CÓDIGO DE CONQUISTA: PURIS-CONQUEST-${isDemiurge ? "DEMIURGE" : "HOLY"}-${hash}`, textX, 615);
  ctx.fillText(`DATA DA CONCLUSÃO: ${timestamp || new Date().toLocaleString("pt-BR")}`, textX, 633);
  ctx.fillText("ESTE CERTIFICADO VALIDA A CONCLUSÃO DEFINITIVA DO JOGO NESTA ROTA.", textX, 651);

  return canvas;
}

/**
 * Cria ou reusa a tela de encerramento definitivo do jogo.
 */
export function showVictoryEndingModal({
  type = "DEMIURGE",
  title = "FIM DA JORNADA",
  subtitle = "O DESTINO FOI CUMPRIDO",
  quote = "",
  summary = "",
}) {
  injectEndingStyles();

  if (document.pointerLockElement) {
    try {
      document.exitPointerLock?.();
    } catch {}
  }

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
    : "«Combati o bom combate, acabei a carreira, guardei a fé. Ao soar da trombeta do Apocalipse, a alma do justo é elevada em triunfo aos Céus Eternos.»";

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
      <div class="ending-preview-wrap" id="ending-preview-wrap">
        <img class="ending-preview-img" id="ending-preview-img" alt="Certificado da Vitória" />
      </div>
      <div class="ending-actions">
        <button class="ending-btn ending-btn-reset" id="btn-ending-reset">
          ↺ Resetar o Save
        </button>
        <button class="ending-btn ending-btn-export" id="btn-ending-export">
          📜 Exportar Conquista (Imagem & Texto)
        </button>
      </div>
      <div class="ending-toast-feedback" id="ending-feedback"></div>
    </div>
  `;

  requestAnimationFrame(() => {
    _endingModalEl.classList.add("active");
  });

  const feedbackEl = _endingModalEl.querySelector("#ending-feedback");
  const showFeedback = (msg) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.classList.add("show");
    setTimeout(() => feedbackEl.classList.remove("show"), 4000);
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

  // Botão 2: Exportar Conquista (Gera Imagem PNG Ilustrada + Arquivo TXT + Copia Texto)
  const btnExport = _endingModalEl.querySelector("#btn-ending-export");
  btnExport?.addEventListener("click", () => {
    const timestamp = new Date().toLocaleString("pt-BR");
    const routeName = isDemiurge ? "O DESPERTAR DO DEMIURGO (MAL FINAL)" : "A ASSUNÇÃO CELESTIAL (BEM FINAL)";
    const hash = Math.random().toString(36).substring(2, 10).toUpperCase();

    // 1. Gera o Canvas Ilustrado Oficial
    const certCanvas = renderConquestCertificateCanvas({
      type,
      title,
      subtitle,
      quote: finalQuote,
      evil,
      morality,
      coins,
      hash,
      timestamp,
    });

    // Atualiza preview no modal
    const previewWrap = _endingModalEl.querySelector("#ending-preview-wrap");
    const previewImg = _endingModalEl.querySelector("#ending-preview-img");
    const dataUrl = certCanvas.toDataURL("image/png");
    if (previewImg && previewWrap) {
      previewImg.src = dataUrl;
      previewWrap.classList.add("show");
    }

    // 2. Dispara Download da Imagem PNG do Certificado
    try {
      certCanvas.toBlob((blob) => {
        if (!blob) return;
        const imgUrl = URL.createObjectURL(blob);
        const aImg = document.createElement("a");
        aImg.href = imgUrl;
        aImg.download = `puris_conquista_${isDemiurge ? "demiurgo" : "assuncao"}.png`;
        document.body.appendChild(aImg);
        aImg.click();
        document.body.removeChild(aImg);
        URL.revokeObjectURL(imgUrl);
      }, "image/png");
    } catch (err) {
      console.warn("Falha ao exportar imagem do certificado:", err);
    }

    // 3. Monta o Certificado em Texto
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
      `- Forja do Ferreiro: Nível ${PlayerEquipment.weaponLevel ?? 1}`,
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

    // Dispara download do arquivo .txt
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
      console.warn("Falha ao disparar download do certificado TXT:", err);
    }

    btnExport.innerHTML = "✓ Conquista & Imagem Exportadas!";
    showFeedback("✓ Certificado PNG Ilustrado baixado e texto copiado!");
  });
}
