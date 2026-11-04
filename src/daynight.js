import * as THREE from "three";
import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";
import { updateAtmosphereDecay } from "./decay.js";

// ============================================================================
// Perfis de Iluminação Pré-Assados (Pre-Baked Lighting Profiles)
// Horários Chave do Mundo: DIA, TARDE (Entardecer / Golden Hour) e NOITE
// Todas as luzes ambientais operam sobre estes perfis com overlap suave.
// Apenas as tochas permanecem dinâmicas com PointLights e flicker físico.
// ============================================================================

export const BAKED_LIGHTING = {
  day: {
    key: "day",
    label: "Pleno Dia",
    sun: {
      color: new THREE.Color("#fff4db"),
      intensity: 1.65,
      dir: new THREE.Vector3(0.38, 0.88, 0.28).normalize(),
    },
    hemisphere: {
      skyColor: new THREE.Color("#e8f2df"),
      groundColor: new THREE.Color("#5e5847"),
      intensity: 1.25,
    },
    sky: {
      color: new THREE.Color("#8fa596"),
    },
    fog: {
      color: new THREE.Color("#8fa596"),
      density: 0.0165,
    },
    astro: {
      color: new THREE.Color("#fff2c4"),
      haloColor: new THREE.Color("#ffe088"),
      haloOpacity: 0.35,
      scale: 1.0,
    },
    daylight: 1.0,
  },

  afternoon: {
    key: "afternoon",
    label: "Tarde / Pôr do Sol",
    sun: {
      color: new THREE.Color("#ff9e3b"),
      intensity: 1.45,
      dir: new THREE.Vector3(-0.72, 0.36, 0.58).normalize(),
    },
    hemisphere: {
      skyColor: new THREE.Color("#ffb47c"),
      groundColor: new THREE.Color("#4a2e1d"),
      intensity: 1.05,
    },
    sky: {
      color: new THREE.Color("#b56c42"),
    },
    fog: {
      color: new THREE.Color("#9c5c36"),
      density: 0.0195,
    },
    astro: {
      color: new THREE.Color("#ff8833"),
      haloColor: new THREE.Color("#ff6611"),
      haloOpacity: 0.55,
      scale: 1.22,
    },
    daylight: 0.72,
  },

  night: {
    key: "night",
    label: "Noite dos Ermos",
    sun: {
      color: new THREE.Color("#688fbe"),
      intensity: 0.22,
      dir: new THREE.Vector3(-0.22, 0.76, -0.62).normalize(),
    },
    hemisphere: {
      skyColor: new THREE.Color("#111827"),
      groundColor: new THREE.Color("#070a10"),
      intensity: 0.35,
    },
    sky: {
      color: new THREE.Color("#080b12"),
    },
    fog: {
      color: new THREE.Color("#080b12"),
      density: 0.0265,
    },
    astro: {
      color: new THREE.Color("#dbe8ff"),
      haloColor: new THREE.Color("#7f9ec4"),
      haloOpacity: 0.28,
      scale: 0.90,
    },
    daylight: 0.05,
  },
};

// Função Hermite cúbica para transições ultra-suaves (Zero descontinuidades)
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Calcula os pesos de overlap contínuos entre Dia, Tarde e Noite
export function computeLightingWeights(prog) {
  let wDay = 0;
  let wAfternoon = 0;
  let wNight = 0;

  if (prog < 0.20) {
    // 00h00 às 04h48: Plena Noite
    wNight = 1.0;
  } else if (prog < 0.32) {
    // 04h48 às 07h40: Amanhecer (Overlap suave Noite -> Dia)
    const t = smoothstep(0.20, 0.32, prog);
    wNight = 1.0 - t;
    wDay = t;
  } else if (prog < 0.64) {
    // 07h40 às 15h20: Pleno Dia Solar
    wDay = 1.0;
  } else if (prog < 0.76) {
    // 15h20 às 18h15: Transição da Tarde (Overlap suave Dia -> Tarde)
    const t = smoothstep(0.64, 0.76, prog);
    wDay = 1.0 - t;
    wAfternoon = t;
  } else if (prog < 0.82) {
    // 18h15 às 19h40: Plena Tarde / Pôr do Sol Dourado (Golden Hour)
    wAfternoon = 1.0;
  } else if (prog < 0.92) {
    // 19h40 às 22h05: Anoitecer / Crepúsculo (Overlap suave Tarde -> Noite)
    const t = smoothstep(0.82, 0.92, prog);
    wAfternoon = 1.0 - t;
    wNight = t;
  } else {
    // 22h05 às 24h00: Plena Noite
    wNight = 1.0;
  }

  return { wDay, wAfternoon, wNight };
}

// Variáveis temporárias estáticas pré-alocadas para interpolação Zero-GC
const _tempSunColor = new THREE.Color();
const _tempSunDir = new THREE.Vector3();
const _tempHemiSky = new THREE.Color();
const _tempHemiGround = new THREE.Color();
const _tempSkyColor = new THREE.Color();
const _tempFogColor = new THREE.Color();
const _tempAstroColor = new THREE.Color();
const _tempAstroHaloColor = new THREE.Color();

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

    // Estado da Iluminação Pré-Assada
    this.weights = { day: 1.0, afternoon: 0.0, night: 0.0 };
    this.currentProfile = "dia";

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

    const { wDay, wAfternoon, wNight } = computeLightingWeights(this.progress);
    this.weights.day = wDay;
    this.weights.afternoon = wAfternoon;
    this.weights.night = wNight;

    if (wAfternoon > wDay && wAfternoon > wNight) {
      this.currentProfile = "tarde";
    } else if (wNight > wDay) {
      this.currentProfile = "noite";
    } else {
      this.currentProfile = "dia";
    }

    this.daylight = wDay * 1.0 + wAfternoon * 0.72 + wNight * 0.05;
    this.isNight = wNight > 0.55;
    this.solarAngle = (this.progress - 0.25) * Math.PI * 2;

    if (immediate) {
      this.applyLighting(playerX, playerZ, renderer);
    }
  }

  /**
   * Interpolação e envio para materiais e Three.js das luzes pré-assadas (Zero-GC).
   */
  applyLighting(playerX = 0, playerZ = 0, renderer = null) {
    const { day: wDay, afternoon: wAfternoon, night: wNight } = this.weights;
    const P_D = BAKED_LIGHTING.day;
    const P_A = BAKED_LIGHTING.afternoon;
    const P_N = BAKED_LIGHTING.night;

    // A) Sol / Luz Direcional Pré-Assada
    _tempSunColor.setRGB(
      P_D.sun.color.r * wDay + P_A.sun.color.r * wAfternoon + P_N.sun.color.r * wNight,
      P_D.sun.color.g * wDay + P_A.sun.color.g * wAfternoon + P_N.sun.color.g * wNight,
      P_D.sun.color.b * wDay + P_A.sun.color.b * wAfternoon + P_N.sun.color.b * wNight
    );
    if (this.sun) {
      this.sun.color.copy(_tempSunColor);
      this.sun.intensity = P_D.sun.intensity * wDay + P_A.sun.intensity * wAfternoon + P_N.sun.intensity * wNight;
    }

    // Vetor Direcional do Sol/Luar interpolado suavemente
    _tempSunDir.set(
      P_D.sun.dir.x * wDay + P_A.sun.dir.x * wAfternoon + P_N.sun.dir.x * wNight,
      P_D.sun.dir.y * wDay + P_A.sun.dir.y * wAfternoon + P_N.sun.dir.y * wNight,
      P_D.sun.dir.z * wDay + P_A.sun.dir.z * wAfternoon + P_N.sun.dir.z * wNight
    ).normalize();

    // B) Luz Hemisférica Pré-Assada (Céu e Solo)
    _tempHemiSky.setRGB(
      P_D.hemisphere.skyColor.r * wDay + P_A.hemisphere.skyColor.r * wAfternoon + P_N.hemisphere.skyColor.r * wNight,
      P_D.hemisphere.skyColor.g * wDay + P_A.hemisphere.skyColor.g * wAfternoon + P_N.hemisphere.skyColor.g * wNight,
      P_D.hemisphere.skyColor.b * wDay + P_A.hemisphere.skyColor.b * wAfternoon + P_N.hemisphere.skyColor.b * wNight
    );
    _tempHemiGround.setRGB(
      P_D.hemisphere.groundColor.r * wDay + P_A.hemisphere.groundColor.r * wAfternoon + P_N.hemisphere.groundColor.r * wNight,
      P_D.hemisphere.groundColor.g * wDay + P_A.hemisphere.groundColor.g * wAfternoon + P_N.hemisphere.groundColor.g * wNight,
      P_D.hemisphere.groundColor.b * wDay + P_A.hemisphere.groundColor.b * wAfternoon + P_N.hemisphere.groundColor.b * wNight
    );
    if (this.hemisphere) {
      this.hemisphere.color.copy(_tempHemiSky);
      this.hemisphere.groundColor.copy(_tempHemiGround);
      this.hemisphere.intensity = P_D.hemisphere.intensity * wDay + P_A.hemisphere.intensity * wAfternoon + P_N.hemisphere.intensity * wNight;
    }

    // C) Céu / Fundo / Limpeza do Canvas
    _tempSkyColor.setRGB(
      P_D.sky.color.r * wDay + P_A.sky.color.r * wAfternoon + P_N.sky.color.r * wNight,
      P_D.sky.color.g * wDay + P_A.sky.color.g * wAfternoon + P_N.sky.color.g * wNight,
      P_D.sky.color.b * wDay + P_A.sky.color.b * wAfternoon + P_N.sky.color.b * wNight
    );
    this.currentColor.copy(_tempSkyColor);
    if (this.scene && this.scene.background) {
      this.scene.background.copy(_tempSkyColor);
    }
    if (renderer) renderer.setClearColor(_tempSkyColor);

    // D) Neblina Pré-Assada (Fog)
    if (this.scene && this.scene.fog) {
      _tempFogColor.setRGB(
        P_D.fog.color.r * wDay + P_A.fog.color.r * wAfternoon + P_N.fog.color.r * wNight,
        P_D.fog.color.g * wDay + P_A.fog.color.g * wAfternoon + P_N.fog.color.g * wNight,
        P_D.fog.color.b * wDay + P_A.fog.color.b * wAfternoon + P_N.fog.color.b * wNight
      );
      this.scene.fog.color.copy(_tempFogColor);
      this.scene.fog.density = P_D.fog.density * wDay + P_A.fog.density * wAfternoon + P_N.fog.density * wNight;
    }

    // E) Astro Celeste Fixo (Sol poente, Sol diurno e Lua mística)
    if (this.astroMesh && this.astroHaloMesh) {
      _tempAstroColor.setRGB(
        P_D.astro.color.r * wDay + P_A.astro.color.r * wAfternoon + P_N.astro.color.r * wNight,
        P_D.astro.color.g * wDay + P_A.astro.color.r * wAfternoon + P_N.astro.color.r * wNight,
        P_D.astro.color.b * wDay + P_A.astro.color.r * wAfternoon + P_N.astro.color.r * wNight
      );
      _tempAstroHaloColor.setRGB(
        P_D.astro.haloColor.r * wDay + P_A.astro.haloColor.r * wAfternoon + P_N.astro.haloColor.r * wNight,
        P_D.astro.haloColor.g * wDay + P_A.astro.haloColor.r * wAfternoon + P_N.astro.haloColor.r * wNight,
        P_D.astro.haloColor.b * wDay + P_A.astro.haloColor.r * wAfternoon + P_N.astro.haloColor.r * wNight
      );
      this.astroMesh.material.color.copy(_tempAstroColor);
      this.astroHaloMesh.material.color.copy(_tempAstroHaloColor);
      this.astroHaloMesh.material.opacity = P_D.astro.haloOpacity * wDay + P_A.astro.haloOpacity * wAfternoon + P_N.astro.haloOpacity * wNight;
      const astroScale = P_D.astro.scale * wDay + P_A.astro.scale * wAfternoon + P_N.astro.scale * wNight;
      this.fixedAstroGroup.scale.set(astroScale, astroScale, astroScale);
    }

    // Efeitos Atmosféricos de Decadência / Eclipse do Demiurgo (se ativos)
    updateAtmosphereDecay(this, this.scene, renderer);

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

    // 1. Pesos de Overlap Pré-Assados (Dia, Tarde, Noite)
    const { wDay, wAfternoon, wNight } = computeLightingWeights(this.progress);
    this.weights.day = wDay;
    this.weights.afternoon = wAfternoon;
    this.weights.night = wNight;

    if (wAfternoon > wDay && wAfternoon > wNight) {
      this.currentProfile = "tarde";
    } else if (wNight > wDay) {
      this.currentProfile = "noite";
    } else {
      this.currentProfile = "dia";
    }

    // Daylight e Noite computados a partir dos perfis assados
    this.daylight = wDay * 1.0 + wAfternoon * 0.72 + wNight * 0.05;
    this.isNight = wNight > 0.55;

    // Ângulo solar mantido para compatibilidade
    this.solarAngle = (this.progress - 0.25) * Math.PI * 2;

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
