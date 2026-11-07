// ============================================================================
// Retratos procedurais de rosto humano (canvas 2D, sem assets externos).
// Cada NPC tem um rosto próprio e reconhecível (formato, pele, cabelo, barba, rugas, olhos, chapéu do ofício)
// derivado do nome/aparência. A expressão (neutra, triste, feliz, brava, doente) muda com o humor.
// Cache: um dataURL por "nome|expressão" (desenhado só quando o menu abre / o cartão muda).
// ============================================================================

const SIZE = 144;
const cache = new Map();

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex, f) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f));
  const b = Math.max(0, Math.min(255, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function mix(hexA, hexB, t) {
  const a = parseInt(hexA.replace("#", ""), 16);
  const b = parseInt(hexB.replace("#", ""), 16);
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}

const HAIR_STYLES = ["short", "long", "bald", "bun", "crop"];
const IRIS = ["#3d5a80", "#5a7d3a", "#6b4a2a", "#4a4a4a", "#2f6f6a"];

/** Voz/ofício visual do NPC (guard, smith, merchant, farmer, messenger, commoner, priest, beggar). */
export function visualKey(npc) {
  if (npc.roleKey === "villager") return /mensageiro/i.test(npc.title || "") ? "messenger" : "commoner";
  if (npc.roleKey === "baker") return "merchant"; // voz de comerciante (falas); o retrato tem touca própria (veja draw)
  return npc.roleKey;
}

function draw(npc, expr, age) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const c = canvas.getContext("2d");
  const role = npc.role || {};
  const key = visualKey(npc);
  const baker = npc.roleKey === "baker";
  const r = rng(hash(npc.name || "anon"));
  const skin = role.skin || "#c28e68";
  const hairHex = role.hair || ["#2f2420", "#4a3526", "#7a5a34", "#9a9a96", "#1c1714"][(r() * 5) | 0];
  const cloth = role.cloth || "#555";
  const iris = IRIS[(r() * IRIS.length) | 0];
  const faceW = 38 + r() * 8; // meia-largura do rosto
  const faceH = 48 + r() * 6;
  const hairStyle = key === "priest" ? "crop" : HAIR_STYLES[(r() * HAIR_STYLES.length) | 0];
  const old = age >= 50;
  const sick = expr === "sick";
  const cx = SIZE / 2;
  const cy = 70;

  // fundo: gradiente por ofício, com vinheta
  const bgA = { baker: "#4a3a22", guard: "#26364a", smith: "#40281c", merchant: "#1d3b3a", farmer: "#3a4222", messenger: "#43202a", commoner: "#2c2f33", priest: "#1d1b22", beggar: "#2a2620" }[key] || "#222";
  const g = c.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, shade(bgA, 1.5));
  g.addColorStop(1, shade(bgA, 0.6));
  c.fillStyle = g;
  c.fillRect(0, 0, SIZE, SIZE);

  // ombros / roupa
  c.fillStyle = shade(cloth, 0.9);
  c.beginPath();
  c.moveTo(8, SIZE);
  c.quadraticCurveTo(14, 112, cx - 22, 108);
  c.lineTo(cx + 22, 108);
  c.quadraticCurveTo(SIZE - 14, 112, SIZE - 8, SIZE);
  c.closePath();
  c.fill();
  if (key === "guard") {
    c.fillStyle = "#b7bcb4";
    c.fillRect(cx - 34, 112, 68, 10); // gola de aço
    c.fillStyle = "#e0b84a";
    c.fillRect(cx - 3, 112, 6, 32);
  } else if (key === "priest") {
    c.fillStyle = "#f2efe6";
    c.fillRect(cx - 14, 104, 28, 8); // colarinho
  } else if (key === "smith") {
    c.fillStyle = "#2a201a"; // avental
    c.fillRect(cx - 24, 112, 48, 40);
  } else if (key === "messenger") {
    c.fillStyle = "#f2ead6";
    c.save();
    c.translate(cx, 120);
    c.rotate(-0.7);
    c.fillRect(-4, -30, 8, 60);
    c.restore();
  }

  // pescoço
  c.fillStyle = shade(skin, 0.82);
  c.fillRect(cx - 11, cy + faceH - 14, 22, 28);

  // orelhas
  c.fillStyle = shade(skin, 0.92);
  c.beginPath();
  c.ellipse(cx - faceW + 2, cy + 4, 6, 10, 0, 0, Math.PI * 2);
  c.ellipse(cx + faceW - 2, cy + 4, 6, 10, 0, 0, Math.PI * 2);
  c.fill();

  // cabelo atrás (longo / coque)
  const hairCol = old ? mix(hairHex, "#c9c6bd", 0.55) : hairHex;
  if (hairStyle === "long") {
    c.fillStyle = shade(hairCol, 0.9);
    c.beginPath();
    c.ellipse(cx, cy + 6, faceW + 8, faceH + 8, 0, 0, Math.PI * 2);
    c.fill();
  }

  // rosto
  const sk = sick ? mix(skin, "#8da07a", 0.45) : skin;
  const fg = c.createRadialGradient(cx - 10, cy - 14, 8, cx, cy, faceH + 10);
  fg.addColorStop(0, shade(sk.startsWith("#") ? sk : "#c28e68", 1.1));
  fg.addColorStop(1, shade(sk.startsWith("#") ? sk : "#c28e68", 0.78));
  c.fillStyle = sick ? sk : fg;
  c.beginPath();
  c.ellipse(cx, cy, faceW, faceH, 0, 0, Math.PI * 2);
  c.fill();
  // queixo mais forte
  c.beginPath();
  c.ellipse(cx, cy + faceH * 0.55, faceW * 0.82, faceH * 0.5, 0, 0, Math.PI * 2);
  c.fill();

  // cabelo frontal
  c.fillStyle = hairCol;
  if (hairStyle !== "bald") {
    c.beginPath();
    c.ellipse(cx, cy - faceH + 14, faceW + 4, hairStyle === "crop" ? 15 : 22, 0, Math.PI, Math.PI * 2);
    c.fill();
    if (hairStyle === "bun") {
      c.beginPath();
      c.arc(cx, cy - faceH - 4, 10, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    c.fillStyle = shade(hairCol, 0.8);
    c.fillRect(cx - faceW - 1, cy - 14, 8, 20); // faixa lateral dos calvos
    c.fillRect(cx + faceW - 7, cy - 14, 8, 20);
  }

  // olhos
  const eyeY = cy - 6;
  const eyeDX = faceW * 0.46;
  const lid = sick || expr === "sad" ? 0.35 : expr === "angry" ? 0.25 : old ? 0.2 : 0.05;
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeDX;
    c.fillStyle = "#f1ece0";
    c.beginPath();
    c.ellipse(ex, eyeY, 8.5, 5.6 * (1 - lid), 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = iris;
    c.beginPath();
    c.arc(ex + side * 0.6, eyeY + 0.5, 3.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#0a0a0a";
    c.beginPath();
    c.arc(ex + side * 0.6, eyeY + 0.5, 1.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(ex + side * 0.6 - 2, eyeY - 2, 1.4, 1.4);
    // pálpebra pesada
    c.fillStyle = shade(skin, 0.86);
    c.beginPath();
    c.ellipse(ex, eyeY - 5.4 * (1 - lid), 9.4, 3 + lid * 6, 0, Math.PI, Math.PI * 2);
    c.fill();
    // olheiras / bolsas
    if (sick || old || expr === "sad") {
      c.strokeStyle = sick ? "rgba(60,50,80,0.55)" : "rgba(80,50,50,0.35)";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(ex, eyeY + 7, 7, 0.2, Math.PI - 0.2);
      c.stroke();
    }
    // sobrancelhas
    const tilt = expr === "angry" ? 0.5 : expr === "sad" ? -0.45 : 0;
    c.strokeStyle = old ? "#bdb9ae" : shade(hairHex, 0.85);
    c.lineWidth = 3.4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(ex - 8, eyeY - 12 + side * -tilt * 4);
    c.lineTo(ex + 8, eyeY - 12 + side * tilt * 4);
    c.stroke();
  }

  // nariz
  c.strokeStyle = shade(skin, 0.62);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx - 1, cy - 4);
  c.lineTo(cx - 4, cy + 12);
  c.lineTo(cx + 3, cy + 13);
  c.stroke();

  // boca por expressão
  const my = cy + 26;
  c.strokeStyle = "#5a2a28";
  c.lineWidth = 2.6;
  c.beginPath();
  if (expr === "happy") {
    c.moveTo(cx - 10, my - 1);
    c.quadraticCurveTo(cx, my + 8, cx + 10, my - 1);
  } else if (expr === "sad" || sick) {
    c.moveTo(cx - 9, my + 3);
    c.quadraticCurveTo(cx, my - 4, cx + 9, my + 3);
  } else if (expr === "angry") {
    c.moveTo(cx - 9, my + 1);
    c.lineTo(cx + 9, my - 1);
  } else {
    c.moveTo(cx - 8, my);
    c.quadraticCurveTo(cx, my + 2, cx + 8, my);
  }
  c.stroke();

  // rugas
  if (old || age >= 38) {
    c.strokeStyle = "rgba(60,30,20,0.22)";
    c.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(cx - 14, cy - faceH + 22 + i * 4);
      c.lineTo(cx + 14, cy - faceH + 22 + i * 4);
      c.stroke();
    }
    if (old) {
      c.beginPath();
      c.moveTo(cx - 20, my - 4);
      c.quadraticCurveTo(cx - 24, my + 2, cx - 19, my + 8);
      c.moveTo(cx + 20, my - 4);
      c.quadraticCurveTo(cx + 24, my + 2, cx + 19, my + 8);
      c.stroke();
    }
  }
  // cicatriz do guarda / fuligem do ferreiro / sujeira do pedinte
  if (key === "guard" && r() > 0.4) {
    c.strokeStyle = "rgba(150,70,60,0.7)";
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(cx + 14, cy - 18);
    c.lineTo(cx + 24, cy + 6);
    c.stroke();
  }
  if (key === "smith" || key === "beggar") {
    c.fillStyle = "rgba(20,14,10,0.25)";
    for (let i = 0; i < 9; i++) c.fillRect(cx - faceW + r() * faceW * 2, cy - faceH * 0.2 + r() * faceH, 4, 3);
  }

  // barba / bigode
  const beard = role.beard;
  if (beard) {
    c.fillStyle = old ? "#cfccc2" : shade(hairHex, 0.95);
    if (beard === "full" || beard === "long" || beard === "short") {
      c.beginPath();
      c.moveTo(cx - faceW + 4, cy + 6);
      c.quadraticCurveTo(cx - faceW + 2, cy + faceH + 8 + (beard === "long" ? 26 : beard === "full" ? 10 : 0), cx, cy + faceH + 10 + (beard === "long" ? 30 : beard === "full" ? 12 : 2));
      c.quadraticCurveTo(cx + faceW - 2, cy + faceH + 8 + (beard === "long" ? 26 : beard === "full" ? 10 : 0), cx + faceW - 4, cy + 6);
      c.quadraticCurveTo(cx + 18, cy + 22, cx, cy + 20);
      c.quadraticCurveTo(cx - 18, cy + 22, cx - faceW + 4, cy + 6);
      c.fill();
    }
    // bigode (todos)
    c.beginPath();
    c.ellipse(cx - 8, cy + 19, 9, 4, 0.2, 0, Math.PI * 2);
    c.ellipse(cx + 8, cy + 19, 9, 4, -0.2, 0, Math.PI * 2);
    c.fill();
    // boca visível sob o bigode
    c.strokeStyle = "#3a1a18";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - 6, my + 1);
    c.lineTo(cx + 6, my + 1);
    c.stroke();
  }

  // chapéu / adereço do ofício
  if (key === "guard") {
    c.fillStyle = "#b7bcb4";
    c.beginPath();
    c.ellipse(cx, cy - faceH + 12, faceW + 5, 24, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.fillStyle = "#8d928a";
    c.fillRect(cx - faceW - 5, cy - faceH + 10, (faceW + 5) * 2, 6);
    c.fillStyle = "#c0262f";
    c.beginPath();
    c.moveTo(cx - 4, cy - faceH - 6);
    c.quadraticCurveTo(cx + 8, cy - faceH - 36, cx + 22, cy - faceH - 10);
    c.lineTo(cx + 2, cy - faceH - 2);
    c.fill();
  } else if (key === "smith") {
    c.fillStyle = "#e8b04a";
    c.fillRect(cx - faceW - 2, cy - faceH + 14, (faceW + 2) * 2, 7);
  } else if (baker) {
    // touca de padeira: faixa e cúpula branca fofa
    c.fillStyle = "#f6f1e6";
    c.beginPath();
    c.ellipse(cx, cy - faceH - 8, faceW + 4, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e3dccb";
    c.fillRect(cx - faceW - 2, cy - faceH + 8, (faceW + 2) * 2, 8);
  } else if (key === "merchant") {
    c.fillStyle = "#1f7f72";
    c.beginPath();
    c.moveTo(cx - faceW + 2, cy - faceH + 14);
    c.lineTo(cx, cy - faceH - 34);
    c.lineTo(cx + faceW - 2, cy - faceH + 14);
    c.closePath();
    c.fill();
    c.fillStyle = "#f0c84a";
    c.fillRect(cx - faceW - 6, cy - faceH + 12, (faceW + 6) * 2, 5);
    c.strokeStyle = "#f0c84a";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx + 10, cy - faceH - 6);
    c.quadraticCurveTo(cx + 30, cy - faceH - 26, cx + 38, cy - faceH - 6);
    c.stroke();
  } else if (key === "farmer") {
    c.fillStyle = "#e6cb6a";
    c.beginPath();
    c.ellipse(cx, cy - faceH + 14, faceW + 22, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#d6b858";
    c.beginPath();
    c.ellipse(cx, cy - faceH + 8, faceW - 2, 18, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.fillStyle = "#a83a2a";
    c.fillRect(cx - faceW + 2, cy - faceH + 10, (faceW - 2) * 2, 4);
  } else if (key === "messenger") {
    c.fillStyle = "#b42e3a";
    c.beginPath();
    c.ellipse(cx, cy - faceH + 14, faceW + 3, 20, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.fillRect(cx - faceW - 8, cy - faceH + 12, faceW + 14, 6); // aba
  } else if (key === "priest") {
    c.fillStyle = "#1d1b1e";
    c.beginPath();
    c.ellipse(cx, cy - faceH + 10, faceW - 6, 14, 0, Math.PI, Math.PI * 2);
    c.fill();
  } else if (key === "beggar") {
    c.fillStyle = "#6f685c";
    c.beginPath();
    c.ellipse(cx, cy - 2, faceW + 12, faceH + 12, 0, Math.PI * 1.05, Math.PI * 1.95);
    c.lineTo(cx + faceW + 12, cy + 24);
    c.lineTo(cx + faceW - 4, cy + 22);
    c.quadraticCurveTo(cx + faceW + 2, cy - faceH + 8, cx, cy - faceH + 4);
    c.quadraticCurveTo(cx - faceW - 2, cy - faceH + 8, cx - faceW + 4, cy + 22);
    c.lineTo(cx - faceW - 12, cy + 24);
    c.closePath();
    c.fill();
  }

  // moldura interna
  c.strokeStyle = "rgba(210,169,105,0.55)";
  c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, SIZE - 3, SIZE - 3);
  return canvas;
}

/** dataURL do retrato (cacheado por nome|expressão). expr: neutral | happy | sad | angry | sick. */
export function portraitFor(npc, expr = "neutral", age = 35) {
  const k = `${npc.name}|${expr}`;
  let url = cache.get(k);
  if (!url) {
    try {
      url = draw(npc, expr, age).toDataURL("image/png");
    } catch (_) {
      url = "";
    }
    cache.set(k, url);
  }
  return url;
}
