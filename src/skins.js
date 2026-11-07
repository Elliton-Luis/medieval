import * as THREE from "three";

const cache = new Map();

const TEX = 64; // texturas de personagem simples e leves: a forma (geometria) carrega o visual, não o detalhe da textura

function patternTexture(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = TEX;
  canvas.height = TEX;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, TEX, TEX);
  let state = kind.length * 94831;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  const speck = (n, a, dark, light, wMax = 2) => {
    ctx.globalAlpha = a;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = random() > 0.5 ? dark : light;
      ctx.fillRect(Math.floor(random() * TEX), Math.floor(random() * TEX), 1 + Math.floor(random() * wMax), 1 + Math.floor(random() * wMax));
    }
  };

  if (kind === "fabric") {
    // trama de sarja: fios cruzados com variação de tom e fios soltos
    for (let i = 0; i < TEX; i += 3) {
      ctx.globalAlpha = 0.16 + random() * 0.1;
      ctx.fillStyle = "#6e6e6e";
      ctx.fillRect(i, 0, 1, TEX);
      ctx.globalAlpha = 0.12 + random() * 0.1;
      ctx.fillRect(0, i, TEX, 1);
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#f2f2f2";
    for (let y = 0; y < TEX; y += 3) {
      for (let x = ((y / 3) % 2) * 1.5; x < TEX; x += 3) ctx.fillRect(x, y, 1, 1);
    }
    speck(16, 0.18, "#555555", "#ffffff", 1);
    // remendos / dobras suaves
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#444";
    for (let i = 0; i < 5; i++) ctx.fillRect(random() * TEX, random() * TEX, 14 + random() * 22, 2);
  } else if (kind === "leather") {
    // poros e rugas do couro + costura tracejada
    speck(100, 0.2, "#5a5a5a", "#f0f0f0", 2);
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = random() * TEX, y = random() * TEX;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + random() * 14 - 7, y + random() * 14 - 7, x + random() * 20 - 10, y + random() * 20 - 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = "#4a4a4a";
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(6.5, 6.5, TEX - 13, TEX - 13);
    ctx.setLineDash([]);
  } else if (kind === "metal") {
    // aço escovado: veios horizontais, rebites, riscos e pontos de oxidação
    for (let y = 0; y < TEX; y += 2) {
      ctx.globalAlpha = 0.06 + random() * 0.16;
      ctx.fillStyle = random() > 0.5 ? "#6a6a6a" : "#ffffff";
      ctx.fillRect(0, y, TEX, 1);
    }
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#fafafa";
    for (let y = 12; y < TEX; y += 32) {
      for (let x = 12; x < TEX; x += 32) {
        ctx.fillRect(x, y, 3, 3);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#555";
        ctx.fillRect(x + 2, y + 2, 2, 2);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "#fafafa";
      }
    }
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#444";
    for (let i = 0; i < 3; i++) {
      const x = random() * TEX, y = random() * TEX;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + random() * 30 - 15, y + random() * 10 - 5);
      ctx.stroke();
    }
    speck(10, 0.14, "#7a5a3a", "#9a7a5a", 2);
  } else {
    // pele: poros, manchas suaves e leve vermelhidão
    speck(70, 0.14, "#888888", "#f4f4f4", 1);
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = random() > 0.5 ? "#7a7a7a" : "#ffffff";
      ctx.beginPath();
      ctx.arc(random() * TEX, random() * TEX, 6 + random() * 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 1;
  cache.set(kind, texture);
  return texture;
}

// Personagens SEM textura: a forma (geometria + flatShading) e a cor carregam o visual. A 720p com névoa o grão de
// couro/pano/pele não aparece, e cada textura a menos é uma troca de bind a menos no desenho de cada NPC.
// (patternTexture continua disponível acima caso se queira reativar por seletor de qualidade.)
export function makeSkinnedMaterial(kind, color, metalness = 0, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    flatShading: true,
  });
}
