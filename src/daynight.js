import * as THREE from "three";
import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";
import { updateAtmosphereDecay } from "./decay.js";

// ============================================================================
// Perfis de Iluminação Pré-Assados (Pre-Baked Lighting Keyframes)
// 9 horários-chave cobrem o ciclo inteiro; entre dois keyframes vizinhos a luz é
// interpolada com smoothstep (sem saltos). Só as tochas continuam dinâmicas.
// `at` = progresso do dia (0 = 00:00, 0.5 = 12:00).
// ============================================================================

const C = (hex) => new THREE.Color(hex);
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

export const BAKED_LIGHTING = {
  // Noite BREU: quase sem luz ambiente. Só tochas, fogueiras, vela e janelas iluminam.
  midnight: {
    key: "midnight", label: "Meia-Noite", at: 0.0, daylight: 0.0,
    sun: { color: C("#2a3a58"), intensity: 0.05, dir: V(-0.22, 0.76, -0.62) },
    hemisphere: { skyColor: C("#07090f"), groundColor: C("#020305"), intensity: 0.1 },
    sky: { color: C("#010203") },
    fog: { color: C("#010203"), density: 0.034 },
    astro: { color: C("#8a9ab8"), haloColor: C("#4a5a78"), haloOpacity: 0.1, scale: 0.85 },
  },
  predawn: {
    key: "predawn", label: "Madrugada Escura", at: 0.17, daylight: 0.04,
    sun: { color: C("#344060"), intensity: 0.1, dir: V(0.3, 0.62, -0.55) },
    hemisphere: { skyColor: C("#0c1019"), groundColor: C("#040508"), intensity: 0.16 },
    sky: { color: C("#04060a") },
    fog: { color: C("#05070b"), density: 0.032 },
    astro: { color: C("#aab8d4"), haloColor: C("#5a6a88"), haloOpacity: 0.14, scale: 0.9 },
  },
  dawn: {
    key: "dawn", label: "Amanhecer Pálido", at: 0.25, daylight: 0.45,
    sun: { color: C("#c89070"), intensity: 0.8, dir: V(0.82, 0.3, 0.25) },
    hemisphere: { skyColor: C("#9a8074"), groundColor: C("#2e2828"), intensity: 0.6 },
    sky: { color: C("#6c6058") },
    fog: { color: C("#756a60"), density: 0.0235 },
    astro: { color: C("#d8a070"), haloColor: C("#b0643a"), haloOpacity: 0.4, scale: 1.15 },
  },
  morning: {
    key: "morning", label: "Manhã Doentia", at: 0.375, daylight: 0.85,
    sun: { color: C("#f0dcb0"), intensity: 1.2, dir: V(0.62, 0.62, 0.3) },
    hemisphere: { skyColor: C("#d0d4ae"), groundColor: C("#4a4634"), intensity: 0.95 },
    sky: { color: C("#868c6e") },
    fog: { color: C("#8a9070"), density: 0.0195 },
    astro: { color: C("#f0e4b0"), haloColor: C("#d8c880"), haloOpacity: 0.3, scale: 1.05 },
  },
  noon: {
    key: "noon", label: "Dia Apodrecido", at: 0.5, daylight: 1.0,
    sun: { color: C("#f4e8c4"), intensity: 1.35, dir: V(0.38, 0.88, 0.28) },
    hemisphere: { skyColor: C("#d6dcb8"), groundColor: C("#4e4a36"), intensity: 1.0 },
    sky: { color: C("#8c9370") },
    fog: { color: C("#8c9370"), density: 0.0185 },
    astro: { color: C("#f0e6b0"), haloColor: C("#d4c47c"), haloOpacity: 0.28, scale: 1.0 },
  },
  afternoon: {
    key: "afternoon", label: "Tarde Pesada", at: 0.625, daylight: 0.82,
    sun: { color: C("#e8c890"), intensity: 1.25, dir: V(-0.45, 0.62, 0.45) },
    hemisphere: { skyColor: C("#d8caa0"), groundColor: C("#4a4030"), intensity: 0.95 },
    sky: { color: C("#8c8566") },
    fog: { color: C("#908868"), density: 0.02 },
    astro: { color: C("#e8c88a"), haloColor: C("#c8a460"), haloOpacity: 0.34, scale: 1.08 },
  },
  sunset: {
    key: "sunset", label: "Pôr do Sol Ferrugem", at: 0.75, daylight: 0.55,
    sun: { color: C("#c8702a"), intensity: 1.15, dir: V(-0.72, 0.36, 0.58) },
    hemisphere: { skyColor: C("#a87850"), groundColor: C("#2e1e14"), intensity: 0.8 },
    sky: { color: C("#7a4a30") },
    fog: { color: C("#6a4430"), density: 0.022 },
    astro: { color: C("#d8662a"), haloColor: C("#a83e12"), haloOpacity: 0.5, scale: 1.2 },
  },
  dusk: {
    key: "dusk", label: "Crepúsculo Sombrio", at: 0.81, daylight: 0.18,
    sun: { color: C("#7a4a78"), intensity: 0.4, dir: V(-0.8, 0.2, 0.4) },
    hemisphere: { skyColor: C("#5a4468"), groundColor: C("#1a1220"), intensity: 0.4 },
    sky: { color: C("#2e2338") },
    fog: { color: C("#30263c"), density: 0.026 },
    astro: { color: C("#c88a6a"), haloColor: C("#802e4a"), haloOpacity: 0.35, scale: 1.1 },
  },
  night: {
    key: "night", label: "Noite Breu", at: 0.9, daylight: 0.01,
    sun: { color: C("#2a3a58"), intensity: 0.05, dir: V(-0.22, 0.76, -0.62) },
    hemisphere: { skyColor: C("#07090f"), groundColor: C("#020305"), intensity: 0.1 },
    sky: { color: C("#010203") },
    fog: { color: C("#010203"), density: 0.034 },
    astro: { color: C("#8a9ab8"), haloColor: C("#4a5a78"), haloOpacity: 0.1, scale: 0.85 },
  },
};

// Ordem cronológica dos keyframes (o último volta ao primeiro, em at = 1.0)
const KEYFRAMES = Object.values(BAKED_LIGHTING).sort((a, b) => a.at - b.at);

// Função Hermite cúbica para transições ultra-suaves (Zero descontinuidades)
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// ---------------------------------------------------------------------------
// Níveis de neblina: multiplicam a densidade do keyframe e empurram a cor da neblina (e do horizonte)
// para um cinza-esverdeado frio. Mesmo de dia o mundo fica com ar de suspense.
// ---------------------------------------------------------------------------
export const FOG_LEVELS = [
  { name: "Limpo", mul: 0.6, tint: 0.0 },
  { name: "Bruma leve", mul: 1.0, tint: 0.12 },
  { name: "Névoa", mul: 1.55, tint: 0.28 },
  { name: "Neblina densa", mul: 2.25, tint: 0.45 },
  { name: "Cerração", mul: 3.3, tint: 0.6 },
  { name: "Breu branco", mul: 4.8, tint: 0.75 },
];
const FOG_TINT = new THREE.Color("#a3a888");
const _fogMixed = new THREE.Color();
// pesos do sorteio automático (favorece névoa média; extremos são raros)
const FOG_AUTO_WEIGHTS = [0.03, 0.14, 0.3, 0.3, 0.16, 0.07];

const _blend = { a: KEYFRAMES[0], b: KEYFRAMES[0], t: 0 };

/** Descobre os dois keyframes vizinhos e o fator de mistura (sem alocação). */
function findKeyframes(prog, out = _blend) {
  const n = KEYFRAMES.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) {
    if (KEYFRAMES[k].at > prog) break;
    i = k;
  }
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[(i + 1) % n];
  const aAt = a.at;
  let bAt = b.at;
  if (bAt <= aAt) bAt += 1.0;
  const p = prog < aAt ? prog + 1.0 : prog;
  out.a = a;
  out.b = b;
  out.t = smoothstep(aAt, bAt, p);
  return out;
}

// Compatibilidade: pesos agregados Dia / Tarde / Noite (HUD de cheats)
const _legacyBlend = { a: KEYFRAMES[0], b: KEYFRAMES[0], t: 0 };
const _legacyWeights = { wDay: 0, wAfternoon: 0, wNight: 0 };
export function computeLightingWeights(prog) {
  const { a, b, t } = findKeyframes(prog, _legacyBlend);
  const w = _legacyWeights;
  w.wDay = 0;
  w.wAfternoon = 0;
  w.wNight = 0;
  const add = (frame, amount) => {
    switch (frame.key) {
      case "morning": case "noon": w.wDay += amount; break;
      case "dawn": case "afternoon": case "sunset": w.wAfternoon += amount; break;
      default: w.wNight += amount;
    }
  };
  add(a, 1 - t);
  add(b, t);
  return w;
}

// Variáveis temporárias estáticas pré-alocadas para interpolação Zero-GC
const _tempSunDir = new THREE.Vector3();

export class DayNightCycle {
  constructor(scene, sun, hemisphere) {
    this.scene = scene;
    this.sun = sun;
    this.hemisphere = hemisphere;
    this.progress = 0.45; // Inicia em pleno dia (~10h48)
    this.currentColor = new THREE.Color("#8fa596");
    this.solarAngle = 0;
    this.daylight = 1.0;
    this.isNight = false;
    this._lastClock = "";
    this._lastMinute = -1;
    this._prevProgress = 0.45;
    this.onNewDay = null;

    // Neblina: nível alvo (0..5), nível suavizado (float) e modo automático
    this.fogLevel = 3;
    this._fogLevelF = 3;
    this.fogAuto = true;
    this._fogAutoTimer = 40;
    // alívio local (0..1): ex.: perto do Diário de Demiurgo a névoa de DIA diminui ~30% (suavizado aqui)
    this.fogRelief = 0;
    this._fogReliefS = 0;
    // distância (m) além da qual tudo é só a cor da névoa; o jogo usa isso para nem desenhar o que está lá
    this.visibleDistance = 200;

    // Estado da Iluminação Pré-Assada
    this.weights = { day: 1.0, afternoon: 0.0, night: 0.0 };
    this.currentProfile = "Pleno Dia";
    this.currentProfileKey = "noon";
    this._kfA = KEYFRAMES[0];
    this._kfB = KEYFRAMES[0];
    this._kfT = 0;

    // Astro Celeste Fixo no Firmamento (Sol/Lua Primordial com overlap de horário)
    this.fixedAstroGroup = new THREE.Group();
    this.fixedAstroGroup.name = "FixedCelestialAstro";

    // Disco do Astro Celestial
    const astroGeo = new THREE.SphereGeometry(17, 24, 18);
    const astroMat = new THREE.MeshBasicMaterial({
      color: 0xfff2c4,
      fog: false,
    });
    this.astroMesh = new THREE.Mesh(astroGeo, astroMat);
    this.fixedAstroGroup.add(this.astroMesh);

    // Halo / Corona Etérea luminosa ao redor do astro
    const haloGeo = new THREE.RingGeometry(18.5, 32.0, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffe088,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.astroHaloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.fixedAstroGroup.add(this.astroHaloMesh);

    // Detalhes de crateras e relevo na face da lua/sol
    const darkSpotMat = new THREE.MeshBasicMaterial({ color: 0xd4ba8a, fog: false });
    const spots = [
      { x: -4, y: 5, z: 15.5, r: 3.5 },
      { x: 5, y: -2, z: 15.8, r: 4.8 },
      { x: -3, y: -6, z: 15.2, r: 3.2 },
      { x: 6, y: 6, z: 15.0, r: 2.8 },
    ];
    for (const sp of spots) {
      const spotMesh = new THREE.Mesh(new THREE.CircleGeometry(sp.r, 12), darkSpotMat);
      spotMesh.position.set(sp.x, sp.y, sp.z);
      this.fixedAstroGroup.add(spotMesh);
    }

    if (this.scene) {
      this.scene.add(this.fixedAstroGroup);
    }

    // Aplica imediatamente iluminação estável para evitar piscar de luzes na inicialização
    this.setTime(0.40, true);
  }

  getLightingWeights() {
    return { ...this.weights };
  }

  getLightingProfileName() {
    return this.currentProfile;
  }

  /**
   * Define o horário do dia e recalcula a iluminação pré-assada sem atrasos ou glitches.
   */
  setTime(prog, immediate = true, playerX = 0, playerZ = 0, renderer = null) {
    this.progress = ((prog % 1) + 1) % 1;
    this._prevProgress = this.progress;

    this._updateState();

    if (immediate) {
      this.applyLighting(playerX, playerZ, renderer);
    }
  }

  /** Define o nível de neblina (0 = limpo ... 5 = breu branco). auto=true devolve o controle ao clima. */
  setFogLevel(level, immediate = false) {
    this.fogLevel = clamp(Math.round(level), 0, FOG_LEVELS.length - 1);
    this.fogAuto = false;
    if (immediate) this._fogLevelF = this.fogLevel;
    return FOG_LEVELS[this.fogLevel].name;
  }

  setFogAuto(on = true) {
    this.fogAuto = on;
    this._fogAutoTimer = 20;
  }

  getFogName() {
    return FOG_LEVELS[this.fogLevel].name + (this.fogAuto ? " (auto)" : "");
  }

  _updateFog(dt) {
    if (this.fogAuto) {
      this._fogAutoTimer -= dt;
      if (this._fogAutoTimer <= 0) {
        this._fogAutoTimer = 70 + Math.random() * 110; // segundos reais até o próximo sorteio
        let r = Math.random();
        let pick = 0;
        for (let i = 0; i < FOG_AUTO_WEIGHTS.length; i++) {
          r -= FOG_AUTO_WEIGHTS[i];
          if (r <= 0) { pick = i; break; }
        }
        // anda no máximo 2 níveis por vez: o clima muda devagar
        this.fogLevel = clamp(pick, this.fogLevel - 2, this.fogLevel + 2);
      }
    }
    // aproximação lenta (~4s) do nível atual para o alvo
    this._fogLevelF += (this.fogLevel - this._fogLevelF) * (1 - Math.exp(-dt * 0.5));
    this._fogReliefS += (this.fogRelief - this._fogReliefS) * (1 - Math.exp(-dt * 1.2));
  }

  /** Recalcula pesos, perfil dominante, daylight e isNight a partir do progresso. */
  _updateState() {
    const { a, b, t } = findKeyframes(this.progress);
    this._kfA = a;
    this._kfB = b;
    this._kfT = t;
    const legacy = computeLightingWeights(this.progress);
    this.weights.day = legacy.wDay;
    this.weights.afternoon = legacy.wAfternoon;
    this.weights.night = legacy.wNight;
    const dominant = t < 0.5 ? a : b;
    this.currentProfile = dominant.label;
    this.currentProfileKey = dominant.key;
    this.daylight = a.daylight + (b.daylight - a.daylight) * t;
    this.isNight = this.daylight < 0.45;
    this.solarAngle = (this.progress - 0.25) * Math.PI * 2;
  }

  /**
   * Interpolação e envio para materiais e Three.js das luzes pré-assadas (Zero-GC).
   */
  applyLighting(playerX = 0, playerZ = 0, renderer = null) {
    const A = this._kfA;
    const B = this._kfB;
    const t = this._kfT;
    const lerp = (x, y) => x + (y - x) * t;
    const mix = (out, ca, cb) => out.copy(ca).lerp(cb, t);

    // A) Sol / Luz Direcional
    if (this.sun) {
      mix(this.sun.color, A.sun.color, B.sun.color);
      this.sun.intensity = lerp(A.sun.intensity, B.sun.intensity);
    }
    _tempSunDir.copy(A.sun.dir).lerp(B.sun.dir, t).normalize();

    // B) Luz Hemisférica (Céu e Solo)
    if (this.hemisphere) {
      mix(this.hemisphere.color, A.hemisphere.skyColor, B.hemisphere.skyColor);
      mix(this.hemisphere.groundColor, A.hemisphere.groundColor, B.hemisphere.groundColor);
      this.hemisphere.intensity = lerp(A.hemisphere.intensity, B.hemisphere.intensity);
    }

    // C) Céu / Fundo / Limpeza do Canvas
    mix(this.currentColor, A.sky.color, B.sky.color);
    if (this.scene && this.scene.background) this.scene.background.copy(this.currentColor);
    if (renderer) renderer.setClearColor(this.currentColor);

    // D) Neblina
    // nível de neblina interpolado entre as duas entradas vizinhas da tabela
    const fi = clamp(this._fogLevelF, 0, FOG_LEVELS.length - 1);
    const f0 = Math.floor(fi);
    const f1 = Math.min(FOG_LEVELS.length - 1, f0 + 1);
    const ft = fi - f0;
    const fogMul = FOG_LEVELS[f0].mul + (FOG_LEVELS[f1].mul - FOG_LEVELS[f0].mul) * ft;
    const fogTint = FOG_LEVELS[f0].tint + (FOG_LEVELS[f1].tint - FOG_LEVELS[f0].tint) * ft;
    if (this.scene && this.scene.fog) {
      mix(this.scene.fog.color, A.fog.color, B.fog.color);
      // a neblina de dia fica pálida e fria; à noite escurece junto com a luz
      _fogMixed.copy(FOG_TINT).multiplyScalar(0.015 + 0.985 * this.daylight * this.daylight); // à noite a neblina é preta
      this.scene.fog.color.lerp(_fogMixed, fogTint);
      // perto do diário a neblina de DIA cede um pouco (até -30%); à noite não muda
      const relief = 1 - 0.3 * this._fogReliefS * this.daylight;
      this.scene.fog.density = lerp(A.fog.density, B.fog.density) * fogMul * relief;
      // o horizonte acompanha a neblina, sem "faixa" de céu limpo atrás dela
      this.currentColor.lerp(this.scene.fog.color, Math.min(1, fogTint * 1.25));
      if (this.scene.background) this.scene.background.copy(this.currentColor);
      if (renderer) renderer.setClearColor(this.currentColor);
    }

    // E) Astro Celeste Fixo (Sol poente, Sol diurno e Lua mística)
    if (this.astroMesh && this.astroHaloMesh) {
      mix(this.astroMesh.material.color, A.astro.color, B.astro.color);
      mix(this.astroHaloMesh.material.color, A.astro.haloColor, B.astro.haloColor);
      this.astroHaloMesh.material.opacity = lerp(A.astro.haloOpacity, B.astro.haloOpacity);
      const astroScale = lerp(A.astro.scale, B.astro.scale);
      this.fixedAstroGroup.scale.set(astroScale, astroScale, astroScale);
    }

    // (calculado depois dos efeitos de decadência/eclipse, que também mexem na densidade; ver abaixo)

    // Efeitos Atmosféricos de Decadência / Eclipse do Demiurgo (se ativos)
    updateAtmosphereDecay(this, this.scene, renderer);

    // Distância de visibilidade real: onde a transmitância da FogExp2 cai a ~0,01% (exp(-(d*dens)^2) -> d = 3/dens).
    // Tudo além disso é pura cor de névoa, então chunks/casas/campos nem precisam ser desenhados lá.
    if (this.scene && this.scene.fog) {
      const target = clamp(3.0 / Math.max(0.004, this.scene.fog.density), 70, 260);
      this.visibleDistance += (target - this.visibleDistance) * 0.2;
    }

    // Posicionamento Estável da Luz Direcional (Sem trepidação de sombras)
    if (this.sun) {
      this.sun.castShadow = true;
      const sx = Math.round((playerX ?? 0) / 4) * 4;
      const sz = Math.round((playerZ ?? 0) / 4) * 4;
      const sunDist = 56.0;
      this.sun.position.set(
        sx + _tempSunDir.x * sunDist,
        Math.max(12.0, _tempSunDir.y * 64.0),
        sz + _tempSunDir.z * sunDist
      );
      this.sun.target.position.set(sx, 0, sz);
      this.sun.target.updateMatrixWorld();
    }

    // Astro Celeste Fixo no Firmamento (Azimute 215°, Elevação 32°)
    if (this.fixedAstroGroup) {
      const fixedX = (playerX ?? 0) - 150.5;
      const fixedY = 164.0;
      const fixedZ = (playerZ ?? 0) - 215.3;
      this.fixedAstroGroup.position.set(fixedX, fixedY, fixedZ);
      this.fixedAstroGroup.lookAt(playerX ?? 0, 15, playerZ ?? 0);
    }
  }

  update(dt, playerX = 0, playerZ = 0, renderer = null) {
    const prevProg = this._prevProgress;
    this.progress = (this.progress + dt / CONFIG.dayLengthSeconds) % 1;
    if (this.progress < prevProg && prevProg > 0.85) {
      // Virada da meia-noite in-game executada exatamente 1 vez por dia
      this.onNewDay?.();
    }
    this._prevProgress = this.progress;

    // 1. Estado de iluminação (keyframes, daylight, isNight) e neblina
    this._updateFog(dt);
    this._updateState();

    // 2. Aplica interpolação das luzes pré-assadas
    this.applyLighting(playerX, playerZ, renderer);

    // 6. Relógio HUD
    const totalMinutes = Math.floor(this.progress * 24 * 60);
    if (totalMinutes !== this._lastMinute) {
      const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
      const minutes = (totalMinutes % 60).toString().padStart(2, "0");
      this._lastClock = `${hours}:${minutes}`;
      this._lastMinute = totalMinutes;
    }
    return this._lastClock;
  }
}
