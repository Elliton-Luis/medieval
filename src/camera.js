import * as THREE from "three";
import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

const NORMAL_SHOULDER = 0.45;
const AIM_SHOULDER = 0.92;
const AIM_DISTANCE = 5.2;
const AIM_FOV = 46;

// Vetores auxiliares pré-alocados no escopo do módulo (Zero-GC no loop de câmera)
const _v1 = new THREE.Vector3();
const _desiredPivot = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

export class ThirdPersonCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.baseFov = camera.fov;
    this.yaw = 0;
    this.pitch = CONFIG.camera.pitch;
    this.distance = CONFIG.camera.distance;
    this.aimBlend = 0;
    this.recoil = 0;
    this.shake = 0;
    this.time = 0;
    this.ride = 0;
    this.rideTarget = 0;
    this.ridePhase = 0;
    this.deathBlend = 0;
    this.frozen = false;
    this._lookDelta = { x: 0, y: 0 };
    this._smoothLookX = 0;
    this._smoothLookY = 0;
    this._pivot = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._initialized = false;
    this._wasAiming = false;
    this._assistSnapTimer = 0;
  }

  // Coice vertical da arma: o cano sobe e a câmera volta sozinha.
  kick(amount) {
    this.recoil = Math.min(0.18, this.recoil + amount * 0.75);
  }

  // Encaixa e redefine imediatamente a câmera atrás do jogador (ex: ao terminar cutscene ou renascer)
  snap(player) {
    if (!player) return;
    this.frozen = false;
    this._initialized = true;
    this._pivot.set(player.x, player.root.position.y + 1.45, player.z);
    this._smoothLookX = 0;
    this._smoothLookY = 0;
    this.yaw = 0;
    this.pitch = CONFIG.camera.pitch;
    this.distance = CONFIG.camera.distance;
    this.shake = 0;
    this.recoil = 0;
  }

  // Galope: só a intensidade vem de fora; o balanço usa uma fase própria, lenta e contínua.
  setRide(strength) {
    this.rideTarget = strength;
  }

  addShake(amount) {
    this.shake = Math.min(1.1, this.shake + amount);
  }

  shakeAt(x, z, power, playerX, playerZ) {
    const distance = Math.hypot(x - playerX, z - playerZ);
    this.addShake(power * clamp(1 - distance / 70, 0, 1));
  }

  // Impede que a câmera atravesse paredes: encurta a distância até o pivô do ombro.
  _constrain(position) {
    const t = this._target;
    _v1.subVectors(position, t);
    const length = _v1.length();
    if (length < 0.01) return;
    const invLen = 1 / length;
    const dx = _v1.x * invLen;
    const dy = _v1.y * invLen;
    const dz = _v1.z * invLen;
    const hit = this.world.cameraRay(t.x, t.y, t.z, dx, dy, dz, length + 0.2);
    if (hit < length + 0.15) {
      const safe = Math.max(0.65, hit - 0.22);
      position.set(t.x + dx * safe, t.y + dy * safe, t.z + dz * safe);
    }
  }

  update(dt, player, input, aimActive = false, aim = null) {
    input.consumeLook(this._lookDelta);

    const blendRate = 1 - Math.exp(-14 * dt);
    this.aimBlend += ((aimActive ? 1 : 0) - this.aimBlend) * blendRate;

    if (aimActive && !this._wasAiming) {
      this._assistSnapTimer = 0.28;
    } else if (!aimActive) {
      this._assistSnapTimer = 0;
    }
    this._wasAiming = aimActive;
    if (this._assistSnapTimer > 0) this._assistSnapTimer = Math.max(0, this._assistSnapTimer - dt);

    // Filtro exponencial de alta resposta para deixar o movimento do mouse extremamente suave
    const lookSmooth = 1 - Math.exp(-42 * Math.max(dt, 0.001));
    this._smoothLookX += (this._lookDelta.x - this._smoothLookX) * lookSmooth;
    this._smoothLookY += (this._lookDelta.y - this._smoothLookY) * lookSmooth;

    const sensitivity = CONFIG.camera.sensitivity * (1 - 0.28 * this.aimBlend);
    if (!this.frozen) {
      this.yaw -= this._smoothLookX * sensitivity;
      this.pitch = clamp(this.pitch + this._smoothLookY * sensitivity, -0.42, 1.05);
    }

    const blend = this.aimBlend;
    const death = this.deathBlend;
    const shoulder = NORMAL_SHOULDER + (AIM_SHOULDER - NORMAL_SHOULDER) * blend;

    // Assistência de Mira (Aim Assist): quando ativa e mirando, alinha suavemente no ser mais próximo
    if (!this.frozen && aimActive && aim && aim.assistEnabled && aim.assistTarget && death < 0.01) {
      const targetPt = aim.assistPoint;
      const rightX0 = Math.cos(this.yaw);
      const rightZ0 = -Math.sin(this.yaw);
      const pivotX = player.x + rightX0 * shoulder;
      const pivotY = player.root.position.y + 1.45;
      const pivotZ = player.z + rightZ0 * shoulder;

      const toX = targetPt.x - pivotX;
      const toY = targetPt.y - pivotY;
      const toZ = targetPt.z - pivotZ;
      const flatDist = Math.hypot(toX, toZ);
      if (flatDist > 0.35) {
        const wantedYaw = Math.atan2(-toX, -toZ);
        // Como na mira aimPitch = this.pitch - 0.16 * blend, compensamos para o raio central cravar no alvo
        const wantedAimPitch = -Math.atan2(toY, flatDist);
        const wantedPitch = clamp(wantedAimPitch + 0.16 * blend, -0.42, 1.05);

        const mouseInputMag = Math.hypot(this._lookDelta.x, this._lookDelta.y);
        const userOverride = clamp(1 - mouseInputMag * 0.045, 0.2, 1);
        const pullSpeed = (this._assistSnapTimer > 0 ? 18 : 11.5) * userOverride;
        const pull = 1 - Math.exp(-pullSpeed * dt);

        this.yaw += shortestAngle(this.yaw, wantedYaw) * pull;
        this.pitch = clamp(this.pitch + (wantedPitch - this.pitch) * pull, -0.42, 1.05);
      }
    }

    this.distance = clamp(this.distance + input.consumeZoom() * 0.008, CONFIG.camera.minDistance, CONFIG.camera.maxDistance);
    this.recoil *= Math.exp(-9 * dt);
    this.shake *= Math.exp(-5 * dt);
    this.time += dt;
    this.ride += (this.rideTarget - this.ride) * (1 - Math.exp(-4 * dt));
    this.ridePhase += dt * (3.2 + 3.6 * this.ride);

    const baseDistance = this.distance + (16 - this.distance) * death;
    const distance = baseDistance + (AIM_DISTANCE - baseDistance) * blend * (1 - death) + (player.mounted ? 2.8 * (1 - blend) : 0);

    const aimPitch = this.pitch - 0.16 * blend;
    const base = aimPitch + (0.95 - aimPitch) * death;
    const pitch = base - this.recoil;
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    // Suaviza o pivô do jogador (e não o ângulo da câmera!) para que andar de lado nunca entorte a mira
    _desiredPivot.set(player.x, player.root.position.y + 1.45, player.z);
    if (!this._initialized) {
      this._pivot.copy(_desiredPivot);
      this._initialized = true;
    } else {
      const pivotFollow = 1 - Math.exp(-(15 + 14 * blend) * dt);
      this._pivot.lerp(_desiredPivot, pivotFollow);
    }

    this._target.set(
      this._pivot.x + rightX * shoulder,
      this._pivot.y,
      this._pivot.z + rightZ * shoulder,
    );

    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    // Vetor para trás da câmera (do pivô até a lente)
    const backX = sinYaw * cosPitch;
    const backY = sinPitch;
    const backZ = cosYaw * cosPitch;

    this._desired.set(
      this._target.x + backX * distance,
      this._target.y + backY * distance,
      this._target.z + backZ * distance,
    );
    const terrain = this.world.raycastGround(this._desired.x, this._desired.y, this._desired.z) + 0.62;
    if (this._desired.y < terrain) this._desired.y = terrain;
    this._constrain(this._desired);

    this.camera.position.copy(this._desired);

    if (this.shake > 0.002) {
      const t = this.time;
      const k = this.shake * 0.32;
      this.camera.position.x += (Math.sin(t * 31) + Math.sin(t * 17.3 + 1)) * 0.5 * k;
      this.camera.position.y += (Math.sin(t * 27 + 2) + Math.sin(t * 13.1)) * 0.5 * k;
      this.camera.position.z += (Math.sin(t * 23 + 4) + Math.sin(t * 19.7 + 3)) * 0.5 * k;
    }
    if (this.ride > 0.01) {
      this.camera.position.y += (Math.sin(this.ridePhase) * 0.05 + Math.sin(this.ridePhase * 2.1) * 0.014) * this.ride;
      this.camera.position.x += Math.cos(this.ridePhase * 0.5) * 0.025 * this.ride;
    }
    const camFloor = this.world.raycastGround(this.camera.position.x, this.camera.position.y, this.camera.position.z) + 0.55;
    if (this.camera.position.y < camFloor) this.camera.position.y = camFloor;

    // A câmera olha exatamente na direção (yaw, pitch) a partir da sua posição, mantendo a mira 100% estável
    if (death > 0.01) {
      this.camera.lookAt(this._target);
    } else {
      _lookTarget.set(
        this.camera.position.x - backX * 60,
        this.camera.position.y - backY * 60,
        this.camera.position.z - backZ * 60,
      );
      this.camera.lookAt(_lookTarget);
    }

    const rush = Math.max(0, player.speedRatio - 0.75) * 4;
    const fov = this.baseFov + (AIM_FOV - this.baseFov) * blend + rush * 3.5 * (1 - blend);
    if (Math.abs(this.camera.fov - fov) > 0.02) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
