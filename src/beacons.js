import * as THREE from "three";

/**
 * Cria textura radial suave para os beacons aditivos de cidades e vilas.
 * Sem quinas ou artefatos de corte.
 */
function makeBeaconTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0.0, "rgba(255, 230, 180, 0.65)");
  gradient.addColorStop(0.25, "rgba(220, 140, 50, 0.32)");
  gradient.addColorStop(0.55, "rgba(160, 80, 20, 0.08)");
  gradient.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let _beaconTexture = null;
function getBeaconTexture() {
  if (!_beaconTexture) {
    _beaconTexture = makeBeaconTexture();
  }
  return _beaconTexture;
}

// Lista global de beacons ativos
const _activeBeacons = [];

/**
 * Adiciona um Beacon visível de longe para sinalizar uma cidade, vila ou ruína no breu da noite.
 * Suavizado para não ofuscar nem parecer queimada.
 * @param {THREE.Scene} scene
 * @param {number} x
 * @param {number} z
 * @param {number|string} [color=0xffaa40]
 * @param {number} [baseSize=36]
 * @param {object} [world=null]
 * @returns {THREE.Sprite}
 */
export function addCityBeacon(scene, x, z, color = 0xffaa40, baseSize = 36, world = null) {
  if (!scene) return null;

  // Evita duplicatas se já houver um beacon na mesma posição exata
  for (let i = 0; i < _activeBeacons.length; i++) {
    const b = _activeBeacons[i];
    const dx = b.x - x;
    const dz = b.z - z;
    if (dx * dx + dz * dz < 16) {
      return b.sprite;
    }
  }

  const texture = getBeaconTexture();
  const mat = new THREE.SpriteMaterial({
    map: texture,
    color: color,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const sprite = new THREE.Sprite(mat);
  const groundY = world && typeof world.heightAt === "function" ? world.heightAt(x, z) : 0;
  const posY = groundY + 26; // Posiciona suavemente sobre a cidade

  sprite.position.set(x, posY, z);
  sprite.scale.set(baseSize, baseSize * 0.9, 1);
  scene.add(sprite);

  const beaconData = {
    sprite,
    x,
    z,
    baseY: posY,
    baseSize,
    baseOpacity: 0.28,
  };

  _activeBeacons.push(beaconData);
  return sprite;
}

/**
 * Atualiza a escala e intensidade dos beacons de cidades de acordo com o ciclo dia/noite.
 * À noite, o halo expande e ganha força para guiar o viajante no breu.
 * @param {number} daylight - Valor de 0 (noite escura) a 1 (pleno dia)
 */
export function updateCityBeacons(daylight = 0.5) {
  const nightFactor = Math.max(0, Math.min(1, 1 - daylight));
  // À noite escala 100%, de dia reduz para 60%
  const scaleMultiplier = 0.6 + 0.4 * nightFactor;
  // À noite opacidade cheia (0.52), de dia opacidade sutil (0.15)
  const opacityMultiplier = 0.28 + 0.72 * nightFactor;

  for (let i = 0; i < _activeBeacons.length; i++) {
    const b = _activeBeacons[i];
    const s = b.baseSize * scaleMultiplier;
    b.sprite.scale.set(s, s * 0.9, 1);
    b.sprite.material.opacity = b.baseOpacity * opacityMultiplier;
  }
}

/**
 * Limpa todos os beacons cadastrados (útil em resets ou reloads).
 */
export function clearCityBeacons() {
  for (let i = 0; i < _activeBeacons.length; i++) {
    const b = _activeBeacons[i];
    if (b.sprite && b.sprite.parent) {
      b.sprite.parent.remove(b.sprite);
    }
  }
  _activeBeacons.length = 0;
}
