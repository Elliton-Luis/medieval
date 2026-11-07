import * as THREE from "three";
import { BloodFx, isBloodColor } from "./damagefx.js";

const EFFECTS = {
  slash: { file: "slash_01.png", duration: 0.24, size: 1.7, rise: 0.15, spin: 1.2, add: true },
  star: { file: "star_01.png", duration: 0.42, size: 0.95, rise: 0.72, spin: 2.5, add: true },
  smoke: { file: "smoke_01.png", duration: 0.82, size: 1.3, rise: 0.55, spin: 0.45, grow: 0.9 },
  flame: { file: "flame_01.png", duration: 0.34, size: 0.78, rise: 0.35, spin: 0.7, add: true },
  dust: { file: "smoke_01.png", duration: 0.55, size: 0.55, rise: 0.22, spin: 0.9, grow: 1.5, fade: 0.55 },
  glint: { canvas: "glint", duration: 0.5, size: 0.5, rise: 0.35, spin: 2.2, add: true },
  heart: { canvas: "heart", duration: 1.25, size: 0.9, rise: 0.85, spin: 0, grow: 0.2, pop: true },
  alert: { canvas: "alert", duration: 1.15, size: 0.8, rise: 0.5, spin: 0, grow: 0.15, pop: true },
  caution: { canvas: "caution", duration: 1.15, size: 0.8, rise: 0.5, spin: 0, grow: 0.15, pop: true },
};

export function makeIconTexture(kind) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (kind === "heart") {
    // Coração radiante de caridade / bênção
    ctx.fillStyle = "#ff2a55";
    ctx.strokeStyle = "#ffe288";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(32, 20);
    ctx.bezierCurveTo(32, 12, 20, 6, 12, 14);
    ctx.bezierCurveTo(4, 22, 6, 36, 32, 56);
    ctx.bezierCurveTo(58, 36, 60, 22, 52, 14);
    ctx.bezierCurveTo(44, 6, 32, 12, 32, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === "glint") {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(255,255,255,0.85)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(32, 2); ctx.lineTo(36, 28); ctx.lineTo(62, 32); ctx.lineTo(36, 36);
    ctx.lineTo(32, 62); ctx.lineTo(28, 36); ctx.lineTo(2, 32); ctx.lineTo(28, 28);
    ctx.closePath();
    ctx.fill();
  } else {
    // balão com "!" (alerta) ou "?" (cautela)
    ctx.fillStyle = kind === "alert" ? "#c8402f" : "#d6a33a";
    ctx.strokeStyle = "#2a1a14";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 28, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(24, 46); ctx.lineTo(32, 60); ctx.lineTo(40, 46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff6dc";
    ctx.font = "bold 34px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(kind === "alert" ? "!" : "?", 32, 30);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class SpriteEffects {
  constructor(scene, capacity = 56) {
    this.scene = scene;
    this.textures = Object.create(null);
    this.pool = [];
    this.cursor = 0;
    this.spinSign = 1;
    this.blood = new BloodFx(scene);
    this._loader = new THREE.TextureLoader();
    for (const [kind, definition] of Object.entries(EFFECTS)) {
      if (definition.canvas) {
        this.textures[kind] = makeIconTexture(definition.canvas);
        continue;
      }
      const texture = this._loader.load(`./assets/sprites/kenney-particles/${definition.file}`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      this.textures[kind] = texture;
    }
    for (let i = 0; i < capacity; i++) {
      const material = new THREE.SpriteMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, alphaTest: 0.01 });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 3;
      scene.add(sprite);
      this.pool.push({ sprite, material, active: false, life: 0, duration: 1, rise: 0, spin: 0, baseSize: 1, startY: 0, grow: 0.65, fade: 1, pop: false });
    }
  }

  play(kind, x, y, z, color = "#ffffff", size = 0) {
    // acerto vermelho (feras/monstros): além da faísca, sangue que cai e mancha o chão
    if (kind === "star" && isBloodColor(color)) this.blood.splash(x, y, z, 0, 0, Math.min(2, 0.6 + (size || 1) * 0.4));
    const definition = EFFECTS[kind] || EFFECTS.star;
    let effect = null;
    for (let attempt = 0; attempt < this.pool.length; attempt++) {
      const index = (this.cursor + attempt) % this.pool.length;
      if (!this.pool[index].active) {
        effect = this.pool[index];
        this.cursor = (index + 1) % this.pool.length;
        break;
      }
    }
    if (!effect) {
      effect = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
    }
    effect.active = true;
    effect.life = definition.duration;
    effect.duration = definition.duration;
    effect.rise = definition.rise;
    effect.spin = definition.spin * this.spinSign;
    this.spinSign *= -1;
    effect.baseSize = size || definition.size;
    effect.grow = definition.grow ?? 0.65;
    effect.fade = definition.fade ?? 1;
    effect.pop = Boolean(definition.pop);
    const blending = definition.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    if (effect.material.blending !== blending) {
      effect.material.blending = blending;
      effect.material.needsUpdate = true;
    }
    effect.startY = y;
    effect.sprite.position.set(x, y, z);
    effect.sprite.scale.set(effect.baseSize, effect.baseSize, 1);
    effect.material.map = this.textures[kind] || this.textures.star;
    effect.material.color.set(color);
    effect.material.opacity = 1;
    effect.material.rotation = definition.spin ? Math.random() * 6.28 : 0;
    effect.sprite.visible = true;
    return effect;
  }

  update(dt) {
    this.blood.update(dt);
    for (let i = 0; i < this.pool.length; i++) {
      const effect = this.pool[i];
      if (!effect.active) continue;
      effect.life -= dt;
      if (effect.life <= 0) {
        effect.active = false;
        effect.sprite.visible = false;
        continue;
      }
      const progress = 1 - effect.life / effect.duration;
      const fade = 1 - progress;
      effect.sprite.position.y = effect.startY + progress * effect.rise;
      effect.material.opacity = effect.pop ? Math.min(1, fade * 3) : fade * fade * effect.fade;
      effect.material.rotation += dt * effect.spin;
      // ícones dão um pulinho ao surgir
      const pop = effect.pop ? 1 + Math.max(0, 0.3 - progress) * 2.4 : 1;
      const scale = effect.baseSize * (0.72 + progress * effect.grow) * pop;
      effect.sprite.scale.set(scale, scale, 1);
    }
  }
}
