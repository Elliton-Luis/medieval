import * as THREE from "three";
import { PlayerStats } from "./rpg.js";
import { showVictoryEndingModal } from "./gameEndingScreen.js";

// ============================================================================
// O Final "Ira Dei": O Triunfo Católico e o Julgamento Final (Ultraleve e Cristalino)
// Trombeta do Apocalipse, Descida de São Miguel, Assunção Celestial e Vitória
// ============================================================================

const _holyGold = new THREE.Color(0xffbb33);
const _pureWhite = new THREE.Color(0xffffff);
const _celestialSky = new THREE.Color(0x90caf9);
const _clearFogColor = new THREE.Color(0xe8f0fe);

let _holyCinemaEl = null;

function _ensureHolyCinemaUI() {
  if (_holyCinemaEl) return _holyCinemaEl;
  let el = document.getElementById("holy-cinema-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "holy-cinema-overlay";
    el.innerHTML = `
      <style>
        #holy-cinema-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 99998;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: "Cinzel Decorative", "Almendra", Georgia, "Times New Roman", serif;
          transition: opacity 0.8s ease;
        }
        .holy-bar {
          height: 52px;
          background: rgba(5, 4, 10, 0.82);
          backdrop-filter: blur(4px);
          transition: height 0.6s ease;
        }
        .holy-narrative-container {
          margin: 0 auto 38px;
          max-width: 780px;
          width: 90%;
          text-align: center;
          padding: 16px 28px;
          background: radial-gradient(circle, rgba(16, 14, 28, 0.88) 0%, rgba(6, 5, 12, 0.94) 100%);
          border: 1px solid rgba(255, 215, 0, 0.6);
          border-radius: 8px;
          box-shadow: 0 0 35px rgba(255, 215, 0, 0.35), inset 0 0 20px rgba(0, 0, 0, 0.8);
          animation: holy-sub-appear 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes holy-sub-appear {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .holy-phase-title {
          color: #ffd700;
          font-size: clamp(14px, 1.8vw, 19px);
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-bottom: 6px;
          text-shadow: 0 0 16px rgba(255, 215, 0, 0.7);
        }
        .holy-phase-desc {
          color: #f7eed8;
          font-size: clamp(13px, 1.5vw, 16px);
          line-height: 1.45;
          letter-spacing: 0.04em;
          font-style: italic;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
        }
      </style>
      <div class="holy-bar"></div>
      <div class="holy-narrative-container" id="holy-narrative-box">
        <div class="holy-phase-title" id="holy-sub-title"></div>
        <div class="holy-phase-desc" id="holy-sub-text"></div>
      </div>
      <div class="holy-bar"></div>
    `;
    document.body.appendChild(el);
  }
  _holyCinemaEl = el;
  return el;
}

export function showHolyNarrative(title, text) {
  const el = _ensureHolyCinemaUI();
  if (!el) return;
  const titleEl = document.getElementById("holy-sub-title");
  const textEl = document.getElementById("holy-sub-text");
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
}

export function removeHolyNarrative() {
  if (_holyCinemaEl && _holyCinemaEl.parentNode) {
    _holyCinemaEl.parentNode.removeChild(_holyCinemaEl);
    _holyCinemaEl = null;
  }
}

export const HolyEndingState = {
  active: false,
  timer: 0,
  phase: 0, // 0: Descida com Trombeta, 1: Fala 1 São Miguel, 2: Assunção aos Céus, 3: Fala 2 Triunfo, 4: Tela Final
  swordGroup: null,
  michael: null,
  ascensionPillar: null,
  initialHemiIntensity: 1.0,
  env: null,
  ended: false,
};

/**
 * Descarrega e oculta todas as entidades do mundo durante o Final Sagrado para travar a 60 FPS:
 * Mantém apenas o terreno imediato, o Arcanjo São Miguel, a Coluna de Luz e o céu glorioso.
 */
export function isolateHolyEndingScene(env) {
  if (!env) return;
  const { world, player, npcs, houses, settlement, beasts, clutter, farmAnimals, farming, torches, villageGenerator, horses, weapons } = env;

  if (world) {
    world.cataclysmIsolated = true; // Mantém somente o chunk sob o jogador e São Miguel
    const px = player?.x ?? 0;
    const pz = player?.z ?? 0;
    world.updateVisibility(env.camera || world.camera, px, pz, false);
  }

  if (npcs?.group) npcs.group.visible = false;
  if (houses?.group) houses.group.visible = false;
  if (settlement?.group) settlement.group.visible = false;
  if (beasts?.group) beasts.group.visible = false;
  if (clutter?.group) clutter.group.visible = false;
  if (farmAnimals?.group) farmAnimals.group.visible = false;
  if (farming?.group) farming.group.visible = false;
  if (villageGenerator?.group) villageGenerator.group.visible = false;
  if (horses?.group) horses.group.visible = false;
  if (torches?.group) torches.group.visible = false;
  if (torches?.impostorMesh) torches.impostorMesh.visible = false;
  if (torches?.lights) {
    for (let i = 0; i < torches.lights.length; i++) torches.lights[i].intensity = 0;
  }
  if (weapons?.playerBuildingsPool) {
    for (let b of weapons.playerBuildingsPool) {
      if (b) b.visible = false;
    }
  }

  // Remove qualquer classe de dano/wasted
  const gameRoot = document.getElementById("game");
  if (gameRoot) {
    gameRoot.classList.remove("wasted");
  }
}

/**
 * Constrói o modelo majestoso e ultra otimizado de São Miguel Arcanjo.
 * Armadura dourada celestial, asas radiantes, auréola, espada de fogo e a Trombeta do Apocalipse.
 */
export function buildArchangelMichaelMesh() {
  const root = new THREE.Group();
  root.name = "ArchangelMichaelRoot";

  const goldArmorMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.85,
    roughness: 0.25,
    emissive: 0xaa7700,
    emissiveIntensity: 0.8,
    fog: false,
  });
  const whiteClothMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    fog: false,
  });
  const crimsonCloakMat = new THREE.MeshStandardMaterial({
    color: 0xaa1122,
    roughness: 0.6,
    side: THREE.DoubleSide,
    fog: false,
  });
  const holyWingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffe688,
    emissiveIntensity: 0.9,
    roughness: 0.45,
    side: THREE.DoubleSide,
    fog: false,
  });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffea00, fog: false });
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });

  const model = new THREE.Group();
  root.add(model);

  // 1. Corpo, Peitoral com a Cruz Sagrada e Túnica
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.1, 0.44), goldArmorMat);
  torso.position.y = 1.65;
  model.add(torso);

  // Cruz Vermelha no Peito
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.04), crimsonCloakMat);
  crossV.position.set(0, 1.68, 0.23);
  model.add(crossV);

  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.04), crimsonCloakMat);
  crossH.position.set(0, 1.78, 0.23);
  model.add(crossH);

  // Túnica e saia de placas de ouro
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.68, 8), whiteClothMat);
  skirt.position.y = 1.05;
  model.add(skirt);

  // Pernas de armadura dourada
  for (const side of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 1.05, 7), goldArmorMat);
    leg.position.set(side, 0.55, 0);
    model.add(leg);

    const sabaton = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), goldArmorMat);
    sabaton.position.set(side, 0.08, 0.06);
    model.add(sabaton);
  }

  // 2. Cabeça, Elmo Dourado e Auréola Sagrada Flutuante
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), goldArmorMat);
  head.position.y = 2.42;
  model.add(head);

  // Auréola flutuante de ouro reluzente
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.038, 8, 24), haloMat);
  halo.rotation.x = Math.PI * 0.45;
  halo.position.set(0, 2.75, 0.04);
  model.add(halo);

  // Manto Carmesim esvoaçante nas costas
  const cloak = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.9), crimsonCloakMat);
  cloak.position.set(0, 1.45, -0.26);
  cloak.rotation.x = 0.15;
  model.add(cloak);

  // 3. Braços e Armamentos (Espada Flamejante e Trombeta do Apocalipse)
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.95, 6), goldArmorMat);
  armL.position.set(-0.48, 1.6, 0.05);
  armL.rotation.z = 0.22;
  model.add(armL);

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.95, 6), goldArmorMat);
  armR.position.set(0.48, 1.7, 0.12);
  armR.rotation.z = -0.35;
  armR.rotation.x = -0.65;
  model.add(armR);

  // Espada Sagrada (Lâmina reluzente de fogo divino)
  const swordGroup = new THREE.Group();
  swordGroup.position.set(0.68, 2.1, 0.62);
  swordGroup.rotation.x = -0.45;

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 6), goldArmorMat);
  swordGroup.add(hilt);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.08), goldArmorMat);
  guard.position.y = 0.16;
  swordGroup.add(guard);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.65, 0.03), bladeMat);
  blade.position.y = 1.0;
  swordGroup.add(blade);

  model.add(swordGroup);

  // 4. A Trombeta do Apocalipse de São Miguel Arcanjo (Flâmula com Cruz Vermelha)
  const trumpetGroup = new THREE.Group();
  trumpetGroup.name = "ApocalypseTrumpet";

  // Tubo dourado longo e reto
  const trumpetTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.048, 1.55, 8), goldArmorMat);
  trumpetTube.position.y = 0.78;
  trumpetGroup.add(trumpetTube);

  // Campânula alargada da trombeta
  const trumpetBell = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.048, 0.38, 12), goldArmorMat);
  trumpetBell.position.y = 1.65;
  trumpetGroup.add(trumpetBell);

  // Anel dourado na borda da campânula
  const bellLip = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 20), goldArmorMat);
  bellLip.rotation.x = Math.PI * 0.5;
  bellLip.position.y = 1.84;
  trumpetGroup.add(bellLip);

  // Flâmula de seda com a Cruz Vermelha pendurada na trombeta
  const trumpetBanner = new THREE.Group();
  trumpetBanner.position.set(0, 0.92, -0.16);

  const bannerCloth = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.75), whiteClothMat);
  bannerCloth.position.y = -0.38;
  trumpetBanner.add(bannerCloth);

  const tCrossV = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.58), crimsonCloakMat);
  tCrossV.position.set(0, -0.38, 0.005);
  trumpetBanner.add(tCrossV);

  const tCrossH = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.1), crimsonCloakMat);
  tCrossH.position.set(0, -0.28, 0.005);
  trumpetBanner.add(tCrossH);

  trumpetGroup.add(trumpetBanner);

  // Luz suave e leve sem sobrecarregar shaders
  const trumpetLight = new THREE.PointLight(0xfff099, 1.8, 12, 2.0);
  trumpetLight.castShadow = false;
  trumpetLight.position.set(0, 1.95, 0);
  trumpetGroup.add(trumpetLight);

  // Posiciona a trombeta erguida à boca de São Miguel
  trumpetGroup.position.set(0.18, 2.3, 0.38);
  trumpetGroup.rotation.x = -1.35;
  trumpetGroup.rotation.z = -0.15;
  model.add(trumpetGroup);

  // 5. Asas Majestosas de São Miguel (Envergadura 6.2 metros)
  const wingGroupL = new THREE.Group();
  wingGroupL.position.set(-0.25, 1.9, -0.2);
  for (let f = 0; f < 6; f++) {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.18 - f * 0.02, 1.6 + f * 0.28, 4), holyWingMat);
    feather.rotation.z = 0.55 + f * 0.22;
    feather.rotation.x = -0.15;
    feather.position.set(-0.35 - f * 0.26, 0.45 + f * 0.22, 0);
    wingGroupL.add(feather);
  }
  model.add(wingGroupL);

  const wingGroupR = new THREE.Group();
  wingGroupR.position.set(0.25, 1.9, -0.2);
  for (let f = 0; f < 6; f++) {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.18 - f * 0.02, 1.6 + f * 0.28, 4), holyWingMat);
    feather.rotation.z = -0.55 - f * 0.22;
    feather.rotation.x = -0.15;
    feather.position.set(0.35 + f * 0.26, 0.45 + f * 0.22, 0);
    wingGroupR.add(feather);
  }
  model.add(wingGroupR);

  // Ponto de luz sutil para contorno suave
  const holyLight = new THREE.PointLight(0xffea88, 1.5, 14, 1.8);
  holyLight.castShadow = false;
  holyLight.position.set(0, 2.2, 0.5);
  model.add(holyLight);

  return { root, model, wingGroupL, wingGroupR, swordGroup, trumpetGroup, trumpetLight, holyLight, cloak, armR };
}

/**
 * Cria a manifestação física do poder divino cravada na Igreja (Cruz Flamejante / Espada de Luz).
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
    fog: false,
  });

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
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
 * Cria o colossal pilar de luz celestial da Assunção aos Céus que envolve o jogador.
 */
export function spawnAscensionPillar(playerPos, scene) {
  const group = new THREE.Group();
  group.name = "AscensionLightPillar";
  group.position.set(playerPos.x, playerPos.y, playerPos.z);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe688,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  // Coluna externa dourada translúcida e núcleo branco
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 160, 16, 1, true), beamMat);
  outer.position.y = 80;
  group.add(outer);

  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 160, 12, 1, true), coreMat);
  inner.position.y = 80;
  group.add(inner);

  // Anéis de glória flutuantes que sobem em direção aos céus
  const rings = [];
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffea00,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });

  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5 - i * 0.35, 0.12, 6, 20), ringMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 1.0 + i * 4.5;
    group.add(ring);
    rings.push(ring);
  }

  if (scene) scene.add(group);
  return { group, rings };
}

/**
 * Incendeia todos os hereges e bestas no mapa simultaneamente com fogo sagrado.
 */
export function smiteHeretics(monstersPool, cultistsPool, firePool, time, playerPos, effects) {
  const px = playerPos ? (playerPos.x ?? playerPos.position?.x ?? 0) : 0;
  const pz = playerPos ? (playerPos.z ?? playerPos.position?.z ?? 0) : 0;

  const smite = (entity) => {
    if (!entity || (!entity.root?.visible && !entity.visible)) return;
    if (entity.userData?.isDead) return;

    entity.userData = entity.userData || {};
    entity.userData.state = "STUNNED";
    entity.userData.isDead = true;
    entity.alive = false;

    const ex = entity.x ?? entity.root?.position?.x ?? entity.position?.x ?? 0;
    const ez = entity.z ?? entity.root?.position?.z ?? entity.position?.z ?? 0;
    const ey = entity.root?.position?.y ?? entity.position?.y ?? 0;
    const dSq = (ex - px) ** 2 + (ez - pz) ** 2;

    if (dSq <= 40 * 40 && Array.isArray(firePool)) {
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
      if (entity.root) entity.root.visible = false;
      else entity.visible = false;
    }

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
 * Dispara o clímax Católico (A Trombeta do Apocalipse e a Assunção Celestial).
 */
export function triggerDeusVultEnding(env = {}) {
  const {
    scene,
    renderer,
    hemisphere,
    audio,
    ui,
    monstersPool,
    cultistsPool,
    firePool,
    settlement,
    player,
    effects,
    dayNight,
  } = env;

  HolyEndingState.active = true;
  HolyEndingState.timer = 0;
  HolyEndingState.phase = 0;
  HolyEndingState.env = env;
  HolyEndingState.ended = false;
  HolyEndingState.initialHemiIntensity = hemisphere ? hemisphere.intensity : 1.0;

  // 1. Descarrega e isola o mundo imediatamente para garantir 60 FPS lisos
  isolateHolyEndingScene(env);

  // 2. Trava o jogador em postura de contemplação divina
  if (player) {
    player.health = player.maxHealth || 100;
    player.knockedOut = true;
    player.dead = false;
    player.invuln = 999;
  }
  PlayerStats.hp = PlayerStats.getMaxHp();
  PlayerStats.hasBrokenVow = false;
  PlayerStats.morality = 100;

  // 3. Remove todo eclipse e restaura céu diurno celestial límpido
  import("./decay.js").then(({ WorldDecay }) => {
    WorldDecay.isEclipse = false;
  }).catch(() => {});

  if (dayNight) {
    dayNight.isNight = false;
    dayNight.progress = 0.35; // Céu claro e sol no alto
    if (dayNight.sun) {
      dayNight.sun.color.setHex(0xfff2d4);
      dayNight.sun.intensity = 1.35;
    }
  }

  // 4. Clareia a atmosfera sem névoa cega (tudo nítido e visível a longa distância)
  if (scene && scene.fog) {
    scene.fog.color.copy(_clearFogColor);
    scene.fog.density = 0.0012; // Quase sem névoa: céu e anjo 100% visíveis!
  }
  if (renderer) {
    renderer.setClearColor(_celestialSky);
  }
  if (hemisphere) {
    hemisphere.color.copy(_holyGold);
    hemisphere.groundColor.setHex(0x554422);
    hemisphere.intensity = 2.4;
  }

  // 5. Sons do triunfo celeste
  audio?.playTrumpetFanfare?.();
  audio?.churchBell?.();
  audio?.playEpicChoir?.();

  // 6. Purifica todos os hereges e bestas restantes
  smiteHeretics(monstersPool, cultistsPool, firePool, performance.now(), player, effects);

  // 7. Crava a colossal Cruz e Espada de Luz no presbitério da Igreja
  const church = settlement?.churches?.[0] || settlement?.houses?.find((h) => h.type === "church");
  const churchPos = church
    ? { x: church.x, y: church.floorY || 0, z: church.z }
    : { x: 0, y: 0, z: -40 };

  if (!HolyEndingState.swordGroup) {
    HolyEndingState.swordGroup = spawnHolySword(churchPos, scene);
  }

  // 8. Spawna São Miguel Arcanjo descendo dos céus diretamente diante do jogador
  const px = player ? (player.x ?? player.position?.x ?? 0) : 0;
  const pz = player ? (player.z ?? player.position?.z ?? 0) : 0;
  const py = player ? (player.root?.position?.y ?? 0) : 0;
  const yaw = player?.model?.rotation?.y ?? 0;

  if (!HolyEndingState.michael) {
    const michaelData = buildArchangelMichaelMesh();
    // Posiciona na frente do jogador a 5.5 metros e 22 metros no ar (visível logo no início)
    const mx = px + Math.sin(yaw) * 5.5;
    const mz = pz + Math.cos(yaw) * 5.5;
    michaelData.root.position.set(mx, py + 22, mz);
    michaelData.targetY = py + 2.2;
    michaelData.root.lookAt(px, py + 1.6, pz);

    if (scene) scene.add(michaelData.root);
    HolyEndingState.michael = michaelData;
  }

  // 9. Legenda cinematográfica límpida e clara no centro da tela
  showHolyNarrative(
    "✦ O TRIUNFO DOS JUSTOS: A CHEGADA DO ARCANJO ✦",
    "Ao ressoar da Trombeta do Apocalipse, São Miguel Arcanjo desce dos Céus trazendo a Glória Eterna!"
  );
  ui?.showToast?.("🎺 «A TROMBETA DO APOCALIPSE RESSÔA DOS CÉUS!»");
}

/**
 * Atualização do ciclo divino frame a frame (Trombeta, Assunção e Vitória).
 */
export function updateDeusVultEnding(dt, env = HolyEndingState.env) {
  if (!HolyEndingState.active || !env) return;

  // Garante isolamento contínuo de entidades para manter 60 FPS
  isolateHolyEndingScene(env);

  HolyEndingState.timer += dt;
  const t = HolyEndingState.timer;
  const { hemisphere, scene, renderer, dayNight, ui, audio, cameraRig, player, effects, camera } = env;
  const px = player ? (player.x ?? player.position?.x ?? 0) : 0;
  const pz = player ? (player.z ?? player.position?.z ?? 0) : 0;
  const py = player ? (player.root?.position?.y ?? 0) : 0;

  // Rotação suave da Espada de Luz na Igreja
  if (HolyEndingState.swordGroup) {
    HolyEndingState.swordGroup.rotation.y += dt * 0.18;
  }

  // Animação e Descida Gloriosa de São Miguel Arcanjo
  if (HolyEndingState.michael) {
    const m = HolyEndingState.michael;
    const flap = Math.sin(t * 3.6) * 0.28;
    m.wingGroupL.rotation.z = 0.55 + flap;
    m.wingGroupR.rotation.z = -0.55 - flap;

    // Desce suavemente até pairar majestosamente diante do jogador
    m.root.position.y = THREE.MathUtils.lerp(
      m.root.position.y,
      (m.targetY || py + 2.2) + Math.sin(t * 2.2) * 0.14,
      dt * 1.8
    );
    m.root.lookAt(px, py + 1.6, pz);

    // Na descida inicial, São Miguel sopra a Trombeta com brilho radiante
    if (t < 3.5) {
      if (m.trumpetLight) m.trumpetLight.intensity = 2.0 + Math.sin(t * 12) * 0.6;
      if (effects && Math.random() < 0.25) {
        effects.play("star", m.root.position.x, m.root.position.y + 2.4, m.root.position.z, "#ffd700", 2.0);
      }
    } else {
      // Abaixa a trombeta e ergue a Espada da Justiça
      if (m.trumpetGroup) {
        m.trumpetGroup.position.y = THREE.MathUtils.lerp(m.trumpetGroup.position.y, 1.45, dt * 2.5);
        m.trumpetGroup.rotation.x = THREE.MathUtils.lerp(m.trumpetGroup.rotation.x, 0.2, dt * 2.5);
      }
      if (m.trumpetLight) m.trumpetLight.intensity = THREE.MathUtils.lerp(m.trumpetLight.intensity, 0, dt * 3.0);
      if (m.swordGroup) {
        m.swordGroup.rotation.x = THREE.MathUtils.lerp(m.swordGroup.rotation.x, -1.6, dt * 2.5);
      }
    }
  }

  // Fase 0 (t < 3.5s): Câmera foca no Arcanjo descendo e no jogador
  if (t < 3.5 && camera) {
    if (cameraRig) cameraRig.frozen = true;
    const camDist = 6.8;
    camera.position.set(px, py + 2.0, pz + camDist);
    camera.lookAt(px, py + 2.2, pz - 2.0);
  }

  // Fase 1 (t = 3.5s): São Miguel proclama a derrota total do mal
  if (t >= 3.5 && HolyEndingState.phase === 0) {
    HolyEndingState.phase = 1;
    showHolyNarrative(
      "⚔️ A PROCLAMAÇÃO DE SÃO MIGUEL ARCANJO ⚔️",
      "«Não temais! O Maligno e suas hostes foram expulsos para sempre desta terra por Cristo Jesus!»"
    );
    ui?.showToast?.("⚔️ SÃO MIGUEL ARCANJO: «Não temam! O mal foi derrotado por Nosso Senhor Jesus Cristo!»");
    audio?.churchBell?.();
    if (cameraRig) cameraRig.addShake(0.18);
  }

  // Fase 2 (t = 6.5s): A Coluna de Luz Sagrada envolve o protagonista na Assunção
  if (t >= 6.5 && HolyEndingState.phase === 1) {
    HolyEndingState.phase = 2;

    // Purifica completamente o jogador
    if (player) {
      player.health = player.maxHealth || 100;
      player.knockedOut = true;
      player.dead = false;
      player.invuln = 999;
    }

    // Spawna a colossal Coluna de Luz da Assunção sobre o jogador
    if (!HolyEndingState.ascensionPillar && scene) {
      HolyEndingState.ascensionPillar = spawnAscensionPillar({ x: px, y: py, z: pz }, scene);
    }

    showHolyNarrative(
      "✨ A ASSUNÇÃO CELESTIAL ✨",
      "«Pela tua fé e sacrifício, és purificado: tua alma e teu corpo sobem aos Céus Eternos!»"
    );
    ui?.showToast?.("✨ «A ASSUNÇÃO CELESTIAL: Teu fôlego mortal se desfaz e és assunto aos Céus Eternos!»");
    audio?.playEpicChoir?.();
  }

  // Execução da Cutscene de Assunção (t >= 6.5s)
  if (HolyEndingState.phase >= 2) {
    // 1. Elevação corporal suave do jogador em direção aos céus
    if (player && player.root) {
      player.root.position.y += dt * 3.2;

      // Braços estendidos em beatífica contemplação celestial
      if (player.leftArm) player.leftArm.rotation.set(-1.15, 0, -0.42);
      if (player.rightArm) player.rightArm.rotation.set(-1.15, 0, 0.42);
      if (player.leftForearm) player.leftForearm.rotation.set(-0.25, 0, 0);
      if (player.rightForearm) player.rightForearm.rotation.set(-0.25, 0, 0);

      // Partículas sagradas girando ao redor do jogador
      if (effects && Math.random() < 0.4) {
        const ang = Math.random() * Math.PI * 2;
        const rad = 0.6 + Math.random() * 1.5;
        effects.play(
          "star",
          px + Math.cos(ang) * rad,
          player.root.position.y + 1.2,
          pz + Math.sin(ang) * rad,
          "#ffd700",
          1.8
        );
      }
    }

    // 2. Anéis flutuantes da coluna de luz subindo
    if (HolyEndingState.ascensionPillar?.rings) {
      for (const ring of HolyEndingState.ascensionPillar.rings) {
        ring.position.y += dt * 8.5;
        if (ring.position.y > 45) {
          ring.position.y = 1.0;
        }
      }
    }

    // 3. São Miguel também se eleva ao lado do jogador após a fase 2
    if (HolyEndingState.michael && t >= 8.5) {
      HolyEndingState.michael.root.position.y += dt * 3.0;
    }

    // 4. Câmera cinematográfica orbital suave focando o personagem subindo aos céus
    if (camera) {
      if (cameraRig) cameraRig.frozen = true;
      const camOrbit = (t - 6.5) * 0.42;
      const camDist = 8.5;
      const camY = Math.max(py + 1.8, (player?.root?.position?.y || py) - 1.5);
      camera.position.set(px + Math.sin(camOrbit) * camDist, camY, pz + Math.cos(camOrbit) * camDist);
      camera.lookAt(px, (player?.root?.position?.y || py) + 1.2, pz);
    }
  }

  // Fase 3 (t = 11.5s): Acolhimento nos Portões do Céu
  if (t >= 11.5 && HolyEndingState.phase === 2) {
    HolyEndingState.phase = 3;
    showHolyNarrative(
      "👑 OS PORTÕES DO REINO DOS CÉUS 👑",
      "«ARCANJO SÃO MIGUEL: Vinde, servo bom e fiel! Entrai no Reino que vos foi preparado por toda a eternidade!»"
    );
    ui?.showToast?.("☀️ SÃO MIGUEL ARCANJO: «Vinde, bendito de meu Pai, entrar no Reino que vos está preparado!»");
    audio?.churchBell?.();
    audio?.playEpicChoir?.();
  }

  // Fase 4 (t = 15.0s): Fim do jogo com a tela de vitória sagrada
  if (t >= 15.0 && !HolyEndingState.ended) {
    HolyEndingState.ended = true;
    HolyEndingState.phase = 4;
    removeHolyNarrative();

    showVictoryEndingModal({
      type: "HOLY",
      title: "A ASSUNÇÃO CELESTIAL",
      subtitle: "O TRIUNFO DOS JUSTOS E A ENTRADA NO REINO DOS CÉUS",
      quote: "«Combati o bom combate, acabei a carreira, guardei a fé. Ao soar da trombeta do Apocalipse, o mal foi desterrado e a alma e o corpo do servo fiel foram assumidos em glória aos Céus Eternos na presença de Deus.»",
    });
  }
}

