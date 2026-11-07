import * as THREE from "three";

// Texturas de ruído geradas em canvas (pedra, madeira, reboco, palha, telha).
// Tons claros: a cor final vem das cores de vértice, que também carregam o AO leve.
const cache = new Map();

function rng(seed) {
  let state = seed | 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

function make(name, size, draw) {
  if (cache.has(name)) return cache.get(name);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size, rng(name.length * 7919 + size));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  cache.set(name, texture);
  return texture;
}

const grey = (v) => `rgb(${v | 0},${v | 0},${(v * 0.96) | 0})`;

export function stoneTexture() {
  return make("stone", 128, (ctx, size, random) => {
    ctx.fillStyle = grey(190);
    ctx.fillRect(0, 0, size, size);
    let y = 0;
    while (y < size) {
      const h = 16 + random() * 8;
      let x = -random() * 20;
      while (x < size) {
        const w = 20 + random() * 18;
        ctx.fillStyle = grey(165 + random() * 70);
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.strokeStyle = "rgba(70,66,60,0.55)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        x += w;
      }
      y += h;
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(60,56,50,${random() * 0.12})`;
      ctx.fillRect(random() * size, random() * size, 2, 2);
    }
  });
}

export function woodTexture() {
  return make("wood", 128, (ctx, size, random) => {
    ctx.fillStyle = grey(205);
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = grey(180 + random() * 55);
      ctx.fillRect(x, 0, 15, size);
      ctx.fillStyle = "rgba(40,28,16,0.5)";
      ctx.fillRect(x + 15, 0, 1, size);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = `rgba(60,40,24,${0.05 + random() * 0.12})`;
        ctx.fillRect(x + random() * 14, random() * size, 1, 10 + random() * 40);
      }
    }
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "rgba(45,30,18,0.5)";
      ctx.beginPath();
      ctx.ellipse(random() * size, random() * size, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function plasterTexture() {
  return make("plaster", 128, (ctx, size, random) => {
    ctx.fillStyle = grey(225);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 700; i++) {
      const v = random() > 0.5 ? 255 : 150;
      ctx.fillStyle = `rgba(${v},${v},${v},${random() * 0.14})`;
      ctx.fillRect(random() * size, random() * size, 2 + random() * 4, 2 + random() * 3);
    }
    ctx.strokeStyle = "rgba(90,80,66,0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      let x = random() * size;
      let y = random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (random() - 0.5) * 16;
        y += random() * 12;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

export function thatchTexture() {
  return make("thatch", 128, (ctx, size, random) => {
    ctx.fillStyle = grey(200);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const v = 150 + random() * 105;
      ctx.strokeStyle = `rgba(${v},${v * 0.92},${v * 0.6},0.65)`;
      ctx.lineWidth = 1 + random() * 1.4;
      const x = random() * size;
      const y = random() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 4, y + 10 + random() * 16);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(60,48,24,0.25)";
    for (let y = 0; y < size; y += 22) ctx.fillRect(0, y, size, 2);
  });
}

export function tileTexture() {
  return make("tile", 128, (ctx, size, random) => {
    ctx.fillStyle = grey(190);
    ctx.fillRect(0, 0, size, size);
    const rows = 8;
    const h = size / rows;
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 ? 8 : 0;
      for (let x = -16; x < size; x += 16) {
        ctx.fillStyle = grey(165 + random() * 80);
        ctx.fillRect(x + offset + 1, r * h + 1, 14, h - 1);
        ctx.fillStyle = "rgba(30,20,14,0.35)";
        ctx.fillRect(x + offset, r * h + h - 3, 16, 3);
      }
    }
  });
}

// Pedra de muralha envelhecida: blocos irregulares, argamassa escura, rachaduras, musgo na base,
// manchas de umidade e sujeira. Tons claros (a cor final vem do material/vértice).
export function weatheredStoneTexture() {
  return make("wallStone", 128, (ctx, size, random) => {
    ctx.fillStyle = grey(176);
    ctx.fillRect(0, 0, size, size);
    let y = 0;
    const rows = [];
    while (y < size) {
      const h = 18 + random() * 10;
      let x = -random() * 24;
      while (x < size) {
        const w = 22 + random() * 24;
        const tone = 150 + random() * 80;
        ctx.fillStyle = grey(tone);
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        // luz no topo e sombra embaixo de cada bloco
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x + 1, y + 1, w - 2, 2);
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.fillRect(x + 1, y + h - 3, w - 2, 2);
        ctx.strokeStyle = "rgba(48,44,40,0.7)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        rows.push([x, y, w, h]);
        x += w;
      }
      y += h;
    }
    // rachaduras
    ctx.strokeStyle = "rgba(34,30,26,0.55)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      let cx = random() * size;
      let cy = random() * size;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let k = 0; k < 5; k++) {
        cx += (random() - 0.5) * 14;
        cy += 4 + random() * 9;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    // manchas de umidade escorrendo
    for (let i = 0; i < 9; i++) {
      const sx = random() * size;
      const g = ctx.createLinearGradient(0, 0, 0, size * 0.6);
      g.addColorStop(0, "rgba(40,36,32,0.22)");
      g.addColorStop(1, "rgba(40,36,32,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx, 0, 3 + random() * 6, size * 0.6);
    }
    // musgo esverdeado acumulando na base (parte de baixo da textura = pé da parede)
    for (let i = 0; i < 160; i++) {
      const px = random() * size;
      const py = size - Math.pow(random(), 2.2) * size * 0.45;
      ctx.fillStyle = `rgba(${70 + random() * 30},${96 + random() * 40},${48 + random() * 20},${0.18 + random() * 0.25})`;
      ctx.fillRect(px, py, 2 + random() * 4, 2 + random() * 3);
    }
    // sujeira fina
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(50,44,38,${random() * 0.16})`;
      ctx.fillRect(random() * size, random() * size, 2, 2);
    }
  });
}

// Reboco/barro de parede de casa: emboço irregular, tábuas desbotadas, manchas e fissuras finas.
export function weatheredWallTexture() {
  return make("wallHouse", 128, (ctx, size, random) => {
    ctx.fillStyle = grey(196);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 38; i++) {
      ctx.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "70,60,50"},${0.04 + random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(random() * size, random() * size, 6 + random() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
    // tábuas verticais desbotadas (parte inferior de madeira)
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = `rgba(40,30,22,${0.1 + random() * 0.1})`;
      ctx.fillRect(x, size * 0.55, 1.5, size * 0.45);
      ctx.fillStyle = `rgba(0,0,0,${0.04 + random() * 0.08})`;
      ctx.fillRect(x + 2, size * 0.55, 13, size * 0.45);
    }
    ctx.strokeStyle = "rgba(40,32,26,0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      let cx = random() * size;
      let cy = random() * size * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) {
        cx += (random() - 0.5) * 10;
        cy += 3 + random() * 8;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    // lama/respingos no pé da parede
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(52,42,32,${0.08 + random() * 0.2})`;
      ctx.fillRect(random() * size, size - Math.pow(random(), 2) * size * 0.3, 2 + random() * 4, 2 + random() * 2);
    }
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(50,44,38,${random() * 0.12})`;
      ctx.fillRect(random() * size, random() * size, 2, 2);
    }
  });
}
