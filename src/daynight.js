import * as THREE from "three";
import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";
import { updateAtmosphereDecay } from "./decay.js";

const _hemiSkyDay = new THREE.Color("#eaf0dd");
const _hemiSkyNight = new THREE.Color("#141e30");
const _hemiGroundDay = new THREE.Color("#5a5649");
const _hemiGroundNight = new THREE.Color("#080b12");
const _sunDay = new THREE.Color("#ffe1ae");
const _sunMoon = new THREE.Color("#7f9ec4");

export class DayNightCycle {
  constructor(scene, sun, hemisphere) {
    this.scene = scene;
    this.sun = sun;
    this.hemisphere = hemisphere;
    this.progress = 0.36;
    this.dayColor = new THREE.Color("#8fa093");
    this.nightColor = new THREE.Color(0x0a0f16);
    this.dawnColor = new THREE.Color("#9e7c65");
    this.currentColor = new THREE.Color();
    this.solarAngle = 0;
    this.daylight = 1;
    this.isNight = false;
    this._lastClock = "";
    this._lastMinute = -1;
    this._prevProgress = 0.36;
    this.onNewDay = null;

    // Astro Celeste Fixo no Firmamento (Sol/Lua Primordial sempre visível no mesmo ângulo e direção)
    this.fixedAstroGroup = new THREE.Group();
    this.fixedAstroGroup.name = "FixedCelestialAstro";

    // Disco do Astro Celestial com brilho místico
    const astroGeo = new THREE.SphereGeometry(17, 24, 18);
    const astroMat = new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      fog: false,
    });
    const astroMesh = new THREE.Mesh(astroGeo, astroMat);
    this.fixedAstroGroup.add(astroMesh);

    // Halo / Corona Etérea luminosa ao redor do astro
    const haloGeo = new THREE.RingGeometry(18.5, 32.0, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffe299,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      fog: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.fixedAstroGroup.add(haloMesh);

    // Detalhes de crateras e sombras místicas na face da lua/sol
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
  }

  update(dt, playerX, playerZ, renderer = null) {
    const prevProg = this._prevProgress;
    this.progress = (this.progress + dt / CONFIG.dayLengthSeconds) % 1;
    if (this.progress < prevProg && prevProg > 0.85) {
      // Virada da meia-noite in-game executada exatamente 1 vez por dia
      this.onNewDay?.();
    }
    this._prevProgress = this.progress;

    this.solarAngle = (this.progress - 0.25) * Math.PI * 2;
    const elevation = Math.sin(this.solarAngle);
    this.daylight = clamp((elevation + 0.16) / 0.82, 0.025, 1);

    if (!this.isNight && this.daylight < 0.42) this.isNight = true;
    else if (this.isNight && this.daylight > 0.52) this.isNight = false;

    const night = 1 - this.daylight;
    this.currentColor.copy(this.dayColor).lerp(this.nightColor, night * 0.96);
    const horizon = Math.max(0, 1 - Math.abs(elevation) * 3.4);
    this.currentColor.lerp(this.dawnColor, horizon * 0.24);
    this.scene.background.copy(this.currentColor);
    if (renderer) renderer.setClearColor(this.currentColor);
    if (this.scene.fog) {
      if (night > 0.55) {
        // Noite escura absoluta: neblina preta pura (0x000000) bloqueando a visão das malhas normais aos 40m
        const nightT = (night - 0.55) / 0.45;
        this.currentColor.lerp(new THREE.Color(0x000000), nightT * 0.98);
        this.scene.background.copy(this.currentColor);
        if (renderer) renderer.setClearColor(this.currentColor);
        this.scene.fog.color.copy(this.currentColor);
        this.scene.fog.density = THREE.MathUtils.lerp(0.032, 0.052, nightT);
      } else {
        this.scene.fog.color.copy(this.currentColor);
        this.scene.fog.density = 0.0315 + 0.0055 * (night * night);
      }
    }

    // Luz ambiente e sol/lua única com transição suave sem alocação GC
    this.sun.intensity = 0.08 + this.daylight * 1.44;
    this.sun.color.copy(_sunDay).lerp(_sunMoon, night * 0.88);
    this.hemisphere.intensity = 0.16 + this.daylight * 1.18;
    this.hemisphere.color.copy(_hemiSkyDay).lerp(_hemiSkyNight, night * 0.9);
    this.hemisphere.groundColor.copy(_hemiGroundDay).lerp(_hemiGroundNight, night * 0.9);

    // Ajuste de atmosfera sombria, neblina corrompida e Eclipse Vermelho
    updateAtmosphereDecay(this, this.scene, renderer);

    // Mantém castShadow sempre ativo para evitar recompilação de shaders no WebGL ao anoitecer/amanhecer
    this.sun.castShadow = true;

    // Degraus esparsos de 3m: atualiza a posição da luz ortográfica sem tremores e sem recalculadas milimétricas
    const sx = Math.round(playerX / 3) * 3;
    const sz = Math.round(playerZ / 3) * 3;
    if (this._lastShadowSX !== sx || this._lastShadowSZ !== sz || Math.abs(this.progress - (this._lastShadowProg || 0)) > 0.004) {
      this._lastShadowSX = sx;
      this._lastShadowSZ = sz;
      this._lastShadowProg = this.progress;
      this.sun.position.set(
        sx + Math.cos(this.solarAngle) * 48,
        Math.max(0.18, Math.abs(elevation)) * 58 + 14,
        sz + Math.sin(this.solarAngle) * 48,
      );
      this.sun.target.position.set(sx, 0, sz);
      this.sun.target.updateMatrixWorld();
    }

    // Atualiza o Astro Celeste Fixo para permanecer sempre no mesmo ângulo e direção relativa ao jogador
    if (this.fixedAstroGroup) {
      // Ângulo fixo: Azimute 215° (Sul-Sudoeste), Elevação 32°
      const fixedX = (playerX ?? 0) - 150.5;
      const fixedY = 164.0;
      const fixedZ = (playerZ ?? 0) - 215.3;
      this.fixedAstroGroup.position.set(fixedX, fixedY, fixedZ);
      this.fixedAstroGroup.lookAt(playerX ?? 0, 15, playerZ ?? 0);
    }

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
