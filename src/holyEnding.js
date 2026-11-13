import * as THREE from "three";
import { PlayerStats } from "./rpg.js";
import { showVictoryEndingModal } from "./gameEndingScreen.js";

// ============================================================================
// O Final "Ira Dei": O Triunfo Católico e o Julgamento Final (Otimizado)
// Trombeta do Apocalipse, Fogo Sagrado nos Hereges, Assunção Celestial e Vitória
// ============================================================================

const _holyGold = new THREE.Color(0xffaa00);
const _pureWhite = new THREE.Color(0xffffff);
const _sunColor = new THREE.Color(0xfff5e6);

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
 * Constrói o modelo majestoso e detalhado de São Miguel Arcanjo.
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

  // Brilho divino emitido pela boca da trombeta ao soar o Apocalipse
  const trumpetLight = new THREE.PointLight(0xfff099, 6.0, 30, 2.0);
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

  // Luz Sagrada própria emitida por São Miguel
  const holyLight = new THREE.PointLight(0xffea88, 5.0, 40, 1.6);
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
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  // Coluna externa dourada translúcida e núcleo branco ofuscante
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
  } = env;

  HolyEndingState.active = true;
  HolyEndingState.timer = 0;
  HolyEndingState.phase = 0;
  HolyEndingState.env = env;
  HolyEndingState.ended = false;
  HolyEndingState.initialHemiIntensity = hemisphere ? hemisphere.intensity : 1.0;

  // 1. Toca a Trombeta do Apocalipse, o sino e o coro majestoso
  audio?.playTrumpetFanfare?.();
  audio?.churchBell?.();
  audio?.playEpicChoir?.();

  // 2. Estouro Branco do Céu (Abertura dos Céus) - Mais suave e leve
  if (scene && scene.fog) {
    scene.fog.color.copy(_pureWhite);
    scene.fog.density = 0.016;
  }
  if (renderer) {
    renderer.setClearColor(_pureWhite);
  }
  if (hemisphere) {
    hemisphere.color.copy(_holyGold);
    hemisphere.intensity = 5.0; // Flash sagrado
  }

  // 3. Incendeia os hereges e feras com o Fogo Sagrado
  smiteHeretics(monstersPool, cultistsPool, firePool, performance.now(), player, effects);

  // 4. Crava a colossal Cruz e Espada de Luz no presbitério da Igreja
  const church = settlement?.churches?.[0] || settlement?.houses?.find((h) => h.type === "church");
  const churchPos = church
    ? { x: church.x, y: church.floorY || 0, z: church.z }
    : { x: 0, y: 0, z: -40 };

  if (!HolyEndingState.swordGroup) {
    HolyEndingState.swordGroup = spawnHolySword(churchPos, scene);
  }

  // 5. Spawna São Miguel Arcanjo descendo dos céus diretamente diante do jogador
  const px = player ? (player.x ?? player.position?.x ?? 0) : 0;
  const pz = player ? (player.z ?? player.position?.z ?? 0) : 0;
  const py = player ? (player.root?.position?.y ?? 0) : 0;
  const yaw = player?.model?.rotation?.y ?? 0;

  if (!HolyEndingState.michael) {
    const michaelData = buildArchangelMichaelMesh();
    // Posiciona na frente do jogador a 6.5 metros e 42 metros no ar
    const mx = px + Math.sin(yaw) * 6.5;
    const mz = pz + Math.cos(yaw) * 6.5;
    michaelData.root.position.set(mx, py + 42, mz);
    michaelData.targetY = py + 2.2;
    michaelData.root.lookAt(px, py + 1.6, pz);

    if (scene) scene.add(michaelData.root);
    HolyEndingState.michael = michaelData;
  }

  ui?.showToast?.("🎺 «A TROMBETA DO APOCALIPSE RESSÔA DOS CÉUS!»");
}

/**
 * Atualização do ciclo divino frame a frame (Trombeta, Assunção e Vitória).
 */
export function updateDeusVultEnding(dt, env = HolyEndingState.env) {
  if (!HolyEndingState.active || !env) return;

  HolyEndingState.timer += dt;
  const t = HolyEndingState.timer;
  const { hemisphere, scene, renderer, dayNight, ui, audio, cameraRig, player, effects, camera } = env;
  const px = player ? (player.x ?? player.position?.x ?? 0) : 0;
  const pz = player ? (player.z ?? player.position?.z ?? 0) : 0;
  const py = player ? (player.root?.position?.y ?? 0) : 0;

  // Rotação majestosa da Espada de Luz na Igreja
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
      dt * 1.6
    );
    m.root.lookAt(px, py + 1.6, pz);

    // Na descida inicial, São Miguel sopra a Trombeta com brilho radiante
    if (t < 3.5) {
      if (m.trumpetLight) m.trumpetLight.intensity = 8.0 + Math.sin(t * 12) * 2.0;
      if (effects && Math.random() < 0.4) {
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

  // Transição da iluminação e névoa celestial
  if (hemisphere && t <= 4.2) {
    const p = Math.min(1.0, t / 4.0);
    hemisphere.intensity = THREE.MathUtils.lerp(5.0, 1.5, p);
  }
  if (scene && scene.fog && t <= 6.0) {
    const p = Math.min(1.0, t / 5.0);
    scene.fog.color.lerp(_sunColor, p * 0.1);
    scene.fog.density = THREE.MathUtils.lerp(0.016, 0.005, p);
    if (renderer) renderer.setClearColor(scene.fog.color);
  }

  // Fase 1 (t = 3.2s): São Miguel proclama o fim do mal por Jesus Cristo
  if (t >= 3.2 && HolyEndingState.phase === 0) {
    HolyEndingState.phase = 1;
    ui?.showToast?.("⚔️ SÃO MIGUEL ARCANJO: «Não temam, povos da terra! O mal foi derrotado por Nosso Senhor Jesus Cristo!»");
    audio?.churchBell?.();
    if (cameraRig) cameraRig.addShake(0.22);
  }

  // Fase 2 (t = 6.0s): Corta para a Cutscene da Assunção aos Céus
  if (t >= 6.0 && HolyEndingState.phase === 1) {
    HolyEndingState.phase = 2;

    // Purifica o jogador e renova os votos
    if (player) {
      player.health = player.maxHealth;
      player.knockedOut = true; // Trava controle para a cutscene
      player.dead = false;
      player.invuln = 999;
    }
    PlayerStats.hp = PlayerStats.getMaxHp();
    PlayerStats.hasBrokenVow = false;
    PlayerStats.morality = 100;

    // Remove o eclipse e restaura céu glorioso de manhã
    import("./decay.js").then(({ WorldDecay }) => {
      WorldDecay.isEclipse = false;
    }).catch(() => {});

    if (dayNight) {
      dayNight.isNight = false;
      dayNight.progress = 0.33;
    }

    // Spawna a colossal Coluna de Luz da Assunção sobre o jogador
    if (!HolyEndingState.ascensionPillar && scene) {
      HolyEndingState.ascensionPillar = spawnAscensionPillar({ x: px, y: py, z: pz }, scene);
    }

    ui?.showToast?.("✨ «A ASSUNÇÃO CELESTIAL: Teu fôlego mortal se desfaz e és assunto aos Céus Eternos!»");
    audio?.playEpicChoir?.();
  }

  // Execução da Cutscene de Assunção (t >= 6.0s)
  if (HolyEndingState.phase >= 2) {
    // 1. Elevação corporal do jogador em direção aos céus
    if (player && player.root) {
      player.root.position.y += dt * 3.4;

      // Braços estendidos em beatífica contemplação celestial
      if (player.leftArm) player.leftArm.rotation.set(-1.15, 0, -0.42);
      if (player.rightArm) player.rightArm.rotation.set(-1.15, 0, 0.42);
      if (player.leftForearm) player.leftForearm.rotation.set(-0.25, 0, 0);
      if (player.rightForearm) player.rightForearm.rotation.set(-0.25, 0, 0);

      // Partículas sagradas girando ao redor do jogador
      if (effects && Math.random() < 0.6) {
        const ang = Math.random() * Math.PI * 2;
        const rad = 0.6 + Math.random() * 1.8;
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

    // 3. Câmera cinematográfica orbital focando o personagem subindo aos céus
    if (camera) {
      if (cameraRig) cameraRig.frozen = true;
      const camOrbit = t * 0.38;
      const camDist = 9.2;
      const camY = Math.max(py + 1.8, (player?.root?.position?.y || py) - 2.0);
      camera.position.set(px + Math.sin(camOrbit) * camDist, camY, pz + Math.cos(camOrbit) * camDist);
      camera.lookAt(px, (player?.root?.position?.y || py) + 1.0, pz);
    }
  }

  // Fase 3 (t = 10.0s): Segunda proclamação de São Miguel saudando a alma assumida
  if (t >= 10.0 && HolyEndingState.phase === 2) {
    HolyEndingState.phase = 3;
    ui?.showToast?.("☀️ SÃO MIGUEL ARCANJO: «Vinde, bendito de meu Pai, entrar no Reino que vos está preparado!»");
    audio?.churchBell?.();
    audio?.playEpicChoir?.();
  }

  // Fase 4 (t = 14.2s): O jogo acaba de vez! Exibe a tela de vitória sagrada com reset e exportar
  if (t >= 14.2 && !HolyEndingState.ended) {
    HolyEndingState.ended = true;
    HolyEndingState.phase = 4;

    showVictoryEndingModal({
      type: "HOLY",
      title: "A ASSUNÇÃO CELESTIAL",
      subtitle: "O TRIUNFO DOS JUSTOS E A ENTRADA NO REINO DOS CÉUS",
      quote: "«Combati o bom combate, acabei a carreira, guardei a fé. Ao soar da trombeta do Apocalipse, a alma e o corpo do servo fiel foram assumidos em triunfo aos Céus Eternos na glória de Nosso Senhor Jesus Cristo.»",
    });
  }
}
