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
