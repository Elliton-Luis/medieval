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
  phase: 0, // 0: Flash/Smite/Descida, 1: Fala 1 de Miguel, 2: Cura e Purificação, 3: Fala 2 Triunfo
  swordGroup: null,
  michael: null,
  initialHemiIntensity: 1.0,
  env: null,
};

/**
 * Constrói o modelo majestoso e detalhado de São Miguel Arcanjo.
 * Armadura dourada celestial, asas radiantes de penas brancas e douradas, auréola e espada de luz.
 */
export function buildArchangelMichaelMesh() {
  const root = new THREE.Group();
  root.name = "ArchangelMichaelRoot";

  const goldArmorMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.82,
    roughness: 0.28,
    emissive: 0xaa7700,
    emissiveIntensity: 0.8,
  });
  const whiteClothMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
  });
  const crimsonCloakMat = new THREE.MeshStandardMaterial({
    color: 0xaa1122,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const holyWingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffe688,
    emissiveIntensity: 0.9,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

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

  // 3. Braços e Espada Flamejante de São Miguel
  // Braço Esquerdo repousando
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.95, 6), goldArmorMat);
  armL.position.set(-0.48, 1.6, 0.05);
  armL.rotation.z = 0.22;
  model.add(armL);

  // Braço Direito erguendo a Espada da Justiça
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

  // 4. Asas Majestosas de São Miguel (Envergadura 6.2 metros)
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

  // Luz Sagrada própria emitida por São Miguel (dobrada)
  const holyLight = new THREE.PointLight(0xffea88, 6.5, 45, 1.6);
  holyLight.position.set(0, 2.2, 0.5);
  model.add(holyLight);

  return { root, model, wingGroupL, wingGroupR, swordGroup, holyLight, cloak };
}

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
    effects,
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
    // Posiciona na frente do jogador a 6 metros e 40 metros no ar
    const mx = px + Math.sin(yaw) * 6.0;
    const mz = pz + Math.cos(yaw) * 6.0;
    michaelData.root.position.set(mx, py + 42, mz);
    michaelData.targetY = py + 2.0;
    michaelData.root.lookAt(px, py + 1.6, pz);

    if (scene) scene.add(michaelData.root);
    HolyEndingState.michael = michaelData;
  }

  ui?.showToast?.("✝️ «NON NOBIS DOMINE, NON NOBIS... SED NOMINI TUO DA GLORIAM!»");
}

/**
 * Atualização do ciclo de julgamento divino frame a frame.
 */
export function updateDeusVultEnding(dt, env = HolyEndingState.env) {
  if (!HolyEndingState.active || !env) return;

  HolyEndingState.timer += dt;
  const t = HolyEndingState.timer;
  const { hemisphere, scene, renderer, dayNight, ui, audio, cameraRig, player, effects } = env;
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
    m.root.position.y = THREE.MathUtils.lerp(m.root.position.y, (m.targetY || py + 2.0) + Math.sin(t * 2.2) * 0.14, dt * 1.6);
    m.root.lookAt(px, py + 1.6, pz);

    if (Math.random() < 0.25 && effects) {
      effects.play("star", m.root.position.x + (Math.random() - 0.5) * 2.5, m.root.position.y + 1.8, m.root.position.z + (Math.random() - 0.5) * 2.5, "#ffd700", 1.5);
    }
  }

  // Decaimento suave da luz de 5.0 para 1.5 estável ao longo de 4 segundos
  if (hemisphere && t <= 4.2) {
    const p = Math.min(1.0, t / 4.0);
    hemisphere.intensity = THREE.MathUtils.lerp(5.0, 1.45, p);
  }

  // Transição da névoa de branco puro para o amanhecer celestial dourado
  if (scene && scene.fog && t <= 6.0) {
    const p = Math.min(1.0, t / 5.0);
    scene.fog.color.lerp(_sunColor, p * 0.1);
    scene.fog.density = THREE.MathUtils.lerp(0.048, 0.0165, p);
    if (renderer) renderer.setClearColor(scene.fog.color);
  }

  // Fase 1 (t = 2.4s): São Miguel proclama o fim do mal por Jesus Cristo
  if (t >= 2.4 && HolyEndingState.phase === 0) {
    HolyEndingState.phase = 1;
    ui?.showToast?.("⚔️ SÃO MIGUEL ARCANJO: «Não temam, povos da terra o mal foi derrotado, por Nosso Senhor Jesus Cristo!»");
    audio?.churchBell?.();
    if (cameraRig) cameraRig.addShake(0.22);
  }

  // Fase 2 (t = 5.8s): Cura divina cósmica e purificação completa de todo problema
  if (t >= 5.8 && HolyEndingState.phase === 1) {
    HolyEndingState.phase = 2;

    // São Miguel ergue a espada flamejante aos céus
    if (HolyEndingState.michael?.swordGroup) {
      HolyEndingState.michael.swordGroup.rotation.x = -1.6;
    }

    // Cura completa do jogador (vitalidade máxima, remove nocaute, perdoa voto)
    if (player) {
      player.health = player.maxHealth;
      player.knockedOut = false;
      player.dead = false;
      player.invuln = 10;
    }
    PlayerStats.hp = PlayerStats.getMaxHp();
    PlayerStats.hasBrokenVow = false;
    PlayerStats.morality = 100;

    // Purifica o reino, cessa o eclipse e restaura manhã ensolarada
    import("./decay.js").then(({ WorldDecay }) => {
      WorldDecay.isEclipse = false;
    }).catch(() => {});

    if (dayNight) {
      dayNight.isNight = false;
      dayNight.progress = 0.33; // Manhã ensolarada radiante
    }

    if (effects) {
      for (let s = 0; s < 12; s++) {
        const ang = (s / 12) * Math.PI * 2;
        effects.play("star", px + Math.cos(ang) * 4, py + 1.5, pz + Math.sin(ang) * 4, "#ffd700", 2.5);
      }
    }

    ui?.showToast?.("✨ GRAÇA SAGRADA: O reino foi curado, os votos renovados e todas as enfermidades sanadas!");
  }

  // Fase 3 (t = 8.8s): Proclamação da Vitória Definitiva
  if (t >= 8.8 && HolyEndingState.phase === 2) {
    HolyEndingState.phase = 3;
    ui?.showToast?.("☀️ SÃO MIGUEL ARCANJO: «O mal perdeu, o mal foi derrotado!»");
    audio?.playEpicChoir?.();
    audio?.churchBell?.();
    if (cameraRig) cameraRig.addShake(0.15);
  }
}
