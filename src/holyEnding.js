import * as THREE from "three";
import { PlayerStats } from "./rpg.js";

// ============================================================================
// O Final "Ira Dei": O Triunfo Católico e o Julgamento Final (Otimizado)
// A Cruzada Divina, Fogo Sagrado nos Hereges e a Espada de Luz no Altar
// ============================================================================

const _holyGold = new THREE.Color(0xffaa00);
const _pureWhite = new THREE.Color(0xffffff);
const _sunColor = new THREE.Color(0xfff5e6);

export const HolyEndingState = {
  active: false,
  timer: 0,
  phase: 0, // 0: Flash/Smite, 1: Message 1, 2: Message 2, 3: Restored Kingdom
  swordGroup: null,
  initialHemiIntensity: 1.0,
  env: null,
};

/**
 * Cria a manifestação física do poder divino cravada na Igreja (Cruz Flamejante / Espada de Luz).
 * Geometria aditiva estática otimizada sem sobrecarga de shaders.
 */
export function spawnHolySword(churchAnchorPos, scene) {
  const group = new THREE.Group();
  group.name = "HolySwordOfGod";
  group.position.set(churchAnchorPos.x, churchAnchorPos.y, churchAnchorPos.z);

  const mat = new THREE.MeshBasicMaterial({
    color: 0xffdd44,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // 1. Lâmina / Feixe Vertical Colossal atravessando os céus até o altar
  const bladeGeo = new THREE.BoxGeometry(2.2, 120, 2.2);
  bladeGeo.translate(0, 60, 0);
  const blade = new THREE.Mesh(bladeGeo, mat);
  const coreBlade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 120, 0.8), coreMat);
  coreBlade.position.y = 60;
  blade.add(coreBlade);

  // 2. Guarda / Feixe Horizontal formando a Sagrada Cruz
  const crossGeo = new THREE.BoxGeometry(16, 2.2, 2.2);
  crossGeo.translate(0, 24, 0);
  const crossbar = new THREE.Mesh(crossGeo, mat);

  group.add(blade);
  group.add(crossbar);

  // Anéis de glória celestial orbitais
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5 + r * 2.2, 0.22, 6, 24), mat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 12 + r * 14;
    group.add(ring);
  }

  if (scene) scene.add(group);
  return group;
}

/**
 * Incendeia todos os hereges e bestas no mapa simultaneamente com fogo sagrado.
 * Otimizado: Aplica chamas reais aos alvos em raio de 40m; alvos distantes sofrem morte instantânea.
 */
export function smiteHeretics(monstersPool, cultistsPool, firePool, time, playerPos, effects) {
  const px = playerPos ? (playerPos.x ?? playerPos.position?.x ?? 0) : 0;
  const pz = playerPos ? (playerPos.z ?? playerPos.position?.z ?? 0) : 0;

  const smite = (entity) => {
    if (!entity || !entity.root?.visible && !entity.visible) return;
    if (entity.userData?.isDead) return;

    // Trava o inimigo no lugar (paralisia divina absoluta)
    entity.userData = entity.userData || {};
    entity.userData.state = "STUNNED";
    entity.userData.isDead = true;
    entity.alive = false;

    const ex = entity.x ?? entity.root?.position?.x ?? entity.position?.x ?? 0;
    const ez = entity.z ?? entity.root?.position?.z ?? entity.position?.z ?? 0;
    const ey = entity.root?.position?.y ?? entity.position?.y ?? 0;
    const dSq = (ex - px) ** 2 + (ez - pz) ** 2;

    if (dSq <= 40 * 40 && Array.isArray(firePool)) {
      // Aplica até 2 chamas do pool sagrado cobrindo o herege
      for (let i = 0; i < 2; i++) {
        const holyFire = firePool.find((f) => !f.visible);
        if (holyFire) {
          holyFire.visible = true;
          holyFire.position.set(ex, ey + i * 0.6, ez);
          holyFire.userData = holyFire.userData || {};
          holyFire.userData.extinguishTime = time + 4000;
          if (holyFire.material) {
            holyFire.material.color.setHex(0xffffff);
          }
        }
      }
      if (effects) {
        effects.play("star", ex, ey + 1.2, ez, "#ffd700", 2.2);
        effects.play("flame", ex, ey + 0.6, ez, "#ffffff", 1.8);
      }
    } else {
      // Inimigos distantes sofrem aniquilação instantânea sem sobrecarregar a GPU
      if (entity.root) entity.root.visible = false;
      else entity.visible = false;
    }

    // Despawn final após o julgamento
    setTimeout(() => {
      if (entity.vanish) entity.vanish(false);
      else {
        if (entity.root) entity.root.visible = false;
        entity.visible = false;
      }
    }, 3500);
  };

  if (Array.isArray(monstersPool)) monstersPool.forEach(smite);
  if (Array.isArray(cultistsPool)) cultistsPool.forEach(smite);
}

/**
 * Dispara o clímax Católico (A Ira de Deus).
 */
export function triggerDeusVultEnding(env = {}) {
  const {
    scene,
    renderer,
    hemisphere,
    audio,
    ui,
    dayNight,
    monstersPool,
    cultistsPool,
    firePool,
    settlement,
    player,
    cameraRig,
  } = env;

  HolyEndingState.active = true;
  HolyEndingState.timer = 0;
  HolyEndingState.phase = 0;
  HolyEndingState.env = env;
  HolyEndingState.initialHemiIntensity = hemisphere ? hemisphere.intensity : 1.0;

  // 1. Toca canto gregoriano épico solene (Dies Irae) em volume triunfante
  audio?.playEpicChoir?.();
  audio?.churchBell?.();

  // 2. Estouro Branco do Céu (A Abertura dos Céus)
  if (scene && scene.fog) {
    scene.fog.color.copy(_pureWhite);
    scene.fog.density = 0.048;
  }
  if (renderer) {
    renderer.setClearColor(_pureWhite);
  }
  if (hemisphere) {
    hemisphere.color.copy(_holyGold);
    hemisphere.intensity = 5.0; // Flash sagrado intencional
  }

  // 3. Incendeia os hereges e feras com o Fogo Sagrado
  smiteHeretics(monstersPool, cultistsPool, firePool, performance.now(), player, env.effects);

  // 4. Crava a colossal Cruz e Espada de Luz no presbitério da Igreja
  const church = settlement?.churches?.[0] || settlement?.houses?.find((h) => h.type === "church");
  const churchPos = church
    ? { x: church.x, y: church.floorY || 0, z: church.z }
    : { x: 0, y: 0, z: -40 };

  if (!HolyEndingState.swordGroup) {
    HolyEndingState.swordGroup = spawnHolySword(churchPos, scene);
  }

  // 5. Exibe a invocação dos Templários em Dourado Sagrado
  ui?.showToast?.("✦ «NON NOBIS DOMINE, NON NOBIS...»");
}

/**
 * Atualização do ciclo de julgamento divino frame a frame.
 */
export function updateDeusVultEnding(dt, env = HolyEndingState.env) {
  if (!HolyEndingState.active || !env) return;

  HolyEndingState.timer += dt;
  const t = HolyEndingState.timer;
  const { hemisphere, scene, renderer, dayNight, ui, audio, cameraRig } = env;

  // Rotação majestosa da Espada de Luz na Igreja
  if (HolyEndingState.swordGroup) {
    HolyEndingState.swordGroup.rotation.y += dt * 0.18;
  }

  // Decaimento suave da luz de 5.0 para 1.5 estável ao longo de 4 segundos
  if (hemisphere && t <= 4.2) {
    const p = Math.min(1.0, t / 4.0);
    hemisphere.intensity = THREE.MathUtils.lerp(5.0, 1.45, p);
  }

  // Transição da névoa de branco puro para o amanhecer celestial dourado
  if (scene && scene.fog && t <= 5.0) {
    const p = Math.min(1.0, t / 4.5);
    scene.fog.color.lerp(_sunColor, p * 0.1);
    scene.fog.density = THREE.MathUtils.lerp(0.048, 0.0165, p);
    if (renderer) renderer.setClearColor(scene.fog.color);
  }

  // Fase 1 (em 3.0s): Segunda estrofe do lema dos Templários
  if (t >= 3.0 && HolyEndingState.phase === 0) {
    HolyEndingState.phase = 1;
    ui?.showToast?.("✦ «...SED NOMINI TUO DA GLORIAM!»");
    audio?.churchBell?.();
    if (cameraRig) cameraRig.addShake(0.18);
  }

  // Fase 2 (em 6.0s): O Triunfo Completo e Restauração dos Controles em Dia Ensolarado Perpétuo
  if (t >= 6.0 && HolyEndingState.phase === 1) {
    HolyEndingState.phase = 2;
    if (dayNight) {
      dayNight.isNight = false;
      dayNight.progress = 0.32; // Manhã ensolarada radiante
    }
    ui?.showToast?.("☀️ IRA DEI: O MAL FOI PURIFICADO! O Reino dos Céus triunfou sobre a heresia.");
  }
}
