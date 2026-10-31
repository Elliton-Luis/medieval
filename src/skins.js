import * as THREE from "three";

const cache = new Map();

function patternTexture(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, 64, 64);
  let state = kind.length * 94831;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };

  if (kind === "fabric") {
    ctx.strokeStyle = "#777777";
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 1;
    for (let i = 2; i < 64; i += 4) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke();
    }
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#eeeeee";
    for (let y = 0; y < 64; y += 4) {
      for (let x = (y / 4) % 2 ? 0 : 2; x < 64; x += 4) ctx.fillRect(x, y, 1, 1);
    }
  } else if (kind === "leather") {
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = random() > 0.5 ? "#666666" : "#eeeeee";
      ctx.fillRect(Math.floor(random() * 64), Math.floor(random() * 64), 1 + Math.floor(random() * 2), 1);
    }
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "#555555";
    ctx.setLineDash([2, 3]);
    ctx.strokeRect(3.5, 3.5, 57, 57);
    ctx.setLineDash([]);
  } else if (kind === "metal") {
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "#777777";
    ctx.lineWidth = 1;
    for (let y = 2; y < 64; y += 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = "#f4f4f4";
    for (let y = 8; y < 64; y += 16) {
      for (let x = 8; x < 64; x += 16) ctx.fillRect(x, y, 2, 2);
    }
  } else {
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = random() > 0.55 ? "#888888" : "#eeeeee";
      ctx.fillRect(Math.floor(random() * 64), Math.floor(random() * 64), 1, 1);
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
  cache.set(kind, texture);
  return texture;
}

export function makeSkinnedMaterial(kind, color, metalness = 0, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({
    color,
    map: patternTexture(kind),
    metalness,
    roughness,
    flatShading: true,
  });
}
