import * as THREE from "three";
import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";
import { updateAtmosphereDecay } from "./decay.js?v=19";

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
    this.dayColor = new THREE.Color("#aebfae");
    this.nightColor = new THREE.Color(0x060913);
    this.dawnColor = new THREE.Color("#be9273");
    this.currentColor = new THREE.Color();
    this.solarAngle = 0;
    this.daylight = 1;
    this.isNight = false;
    this._lastClock = "";
    this._lastMinute = -1;
    this._prevProgress = 0.36;
    this.onNewDay = null;
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
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.currentColor);
      // Neblina mais densa à noite (até 0.025) para atmosfera noturna e corte de geometria distante
      this.scene.fog.density = CONFIG.fogDensity + (0.025 - CONFIG.fogDensity) * (night * night);
    }

    // Luz ambiente e sol/lua única com transição suave sem alocação GC
    this.sun.intensity = 0.08 + this.daylight * 1.44;
    this.sun.color.copy(_sunDay).lerp(_sunMoon, night * 0.88);
    this.hemisphere.intensity = 0.16 + this.daylight * 1.18;
    this.hemisphere.color.copy(_hemiSkyDay).lerp(_hemiSkyNight, night * 0.9);
    this.hemisphere.groundColor.copy(_hemiGroundDay).lerp(_hemiGroundNight, night * 0.9);

    // Ajuste de atmosfera sombria, neblina corrompida e Eclipse Vermelho
    updateAtmosphereDecay(this, this.scene, renderer);

    // Otimização de Sombras Dinâmicas: desliga a sombra à noite profunda para economizar GPU
    this.sun.castShadow = this.daylight > 0.12;

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
