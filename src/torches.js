import * as THREE from "three";
import { CRYSTAL_PALETTE } from "./crystals.js";

// Variáveis reutilizáveis no escopo do módulo para eliminar alocação no loop principal (Zero-GC)
const _guardPos = new THREE.Vector3();
const _playerPos = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _driftDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

export const GUARD_SPEED = 4.0;
export const MAX_DRIFT_RAD = Math.PI / 3; // Desvio máximo base de 60 graus
export const FAR_DRIFT_RAD = (Math.PI * 5) / 12; // Desvio de 75 graus quando muito distante da luz da tocha
export const RETARGET_INTERVAL = 0.7; // Intervalo para recalcular imprecisão (segundos)
export const TORCH_VISION_RANGE = 16.0; // Alcance real de visão da tocha do guarda à noite (metros)
export const TORCH_VISION_RANGE_SQ = TORCH_VISION_RANGE * TORCH_VISION_RANGE;
export const GUARD_TORCH_POOL_SIZE = 8;

/**
 * Ajusta neblina densa e renderização de luz à distância.
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 */
export function setupAtmosphere(scene, renderer) {
  const fogColor = 0x060913;

  // Neblina exponencial simples (THREE.FogExp2) na mesma cor do horizonte
  if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
    scene.fog = new THREE.FogExp2(fogColor, 0.025);
  }
  renderer.setClearColor(fogColor);

  // Tone mapping permite que luzes pontuais de alta intensidade atravessem a neblina
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
}

/**
 * Cria ou reconfigura fontes de luz de longo alcance sem sobrecarga.
 * @param {THREE.PointLight} light
 */
export function configureDistantLight(light) {
  light.distance = 55.0; // Visível a longa distância banhando ruas e praças
  light.decay = 1.22;     // Decaimento suave e envolvente
  light.castShadow = false; // Obrigatório: evita cálculo de shadow map em luzes secundárias
}

/**
 * Configura tocha e propriedades de visão do guarda no spawn ou ao anoitecer.
 * Sorteio de 1 a 10: valores de 8 a 10 (30% de chance) ativam a tocha apenas durante a noite.
 * @param {THREE.Object3D} guard
 * @param {boolean} isNight
 * @param {Array<THREE.PointLight>} torchPool
 */
export function setupGuardTorch(guard, isNight, torchPool) {
  releaseGuardTorch(guard);
  guard.userData.hasTorch = false;
  guard.userData.torchLight = null;
  guard.userData.driftAngle = 0;
  guard.userData.driftTimer = Math.random() * RETARGET_INTERVAL;

  if (!isNight) return;

  // Sorteio 1 a 10: 1-7 sem tocha, 8-10 com tocha (30% de probabilidade)
  const roll = Math.floor(Math.random() * 10) + 1;

  if (roll >= 8) {
    guard.userData.hasTorch = true;
    if (guard.userData.torchProp) {
      guard.userData.torchProp.visible = true;
    }
  }
}

/**
 * Libera a tocha do guarda sem mexer em luzes dinâmicas.
 * @param {THREE.Object3D} guard
 */
export function releaseGuardTorch(guard) {
  if (!guard || !guard.userData) return;
  if (guard.userData.torchProp) {
    guard.userData.torchProp.visible = false;
  }
  guard.userData.torchLight = null;
  guard.userData.hasTorch = false;
}

/**
 * Calcula o vetor de perseguição do guarda com perda de precisão (desvio de até ±60°) no escuro.
 * Também suporta atualização direta de um THREE.Object3D conforme a especificação.
 * @param {THREE.Object3D} guard
 * @param {THREE.Vector3} playerPos
 * @param {boolean} isPlayerLit
 * @param {boolean} isNight
 * @param {number} delta
 * @param {boolean} [applyTransform=true]
 */
export function updateGuardTracking(guard, playerPos, isPlayerLit, isNight, delta, applyTransform = true) {
  const dt = Math.min(delta, 0.05);
  guard.getWorldPosition(_guardPos);
  _playerPos.copy(playerPos);

  _targetDir.subVectors(_playerPos, _guardPos);
  _targetDir.y = 0;
  const distSq = _targetDir.lengthSq();

  if (distSq < 0.001) return _driftDir.set(0, 0, 0);
  _targetDir.normalize();

  if (guard.userData.driftTimer === undefined) {
    guard.userData.driftAngle = 0;
    guard.userData.driftTimer = Math.random() * RETARGET_INTERVAL;
  }

  // Visão direta mantida se for dia, se o player estiver iluminado no ambiente/vela,
  // por proximidade imediata (< 3 metros), ou se o guarda tiver tocha E o player estiver dentro do alcance da luz da tocha (< 16m).
  // Se o jogador se afastar além do alcance da tocha no escuro, mesmo o guarda com tocha o perde de vista!
  const torchReachesPlayer = Boolean(guard.userData.hasTorch) && distSq < TORCH_VISION_RANGE_SQ;
  const hasDirectVision = !isNight || torchReachesPlayer || Boolean(isPlayerLit) || distSq < 9.0;

  if (hasDirectVision) {
    _driftDir.copy(_targetDir);
    guard.userData.driftAngle = 0;
  } else {
    guard.userData.driftTimer -= dt;
    if (guard.userData.driftTimer <= 0) {
      guard.userData.driftTimer = RETARGET_INTERVAL + (Math.random() * 0.3 - 0.15);
      // Se o jogador estiver bem longe (> 24m), o desvio angular aumenta ainda mais pois o guarda perdeu o rastro
      const maxDrift = distSq > 24 * 24 ? FAR_DRIFT_RAD : MAX_DRIFT_RAD;
      guard.userData.driftAngle = (Math.random() * 2 - 1) * maxDrift;
    }

    _driftDir.copy(_targetDir).applyAxisAngle(_upAxis, guard.userData.driftAngle);
  }

  if (applyTransform) {
    const targetYaw = Math.atan2(_driftDir.x, _driftDir.z);
    const diff = Math.atan2(Math.sin(targetYaw - guard.rotation.y), Math.cos(targetYaw - guard.rotation.y));
    guard.rotation.y = THREE.MathUtils.lerp(guard.rotation.y, guard.rotation.y + diff, dt * 4.5);
    guard.translateZ(GUARD_SPEED * dt);
  }

  return _driftDir;
}

export function makeGlowTexture(inner = "255,225,160") {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${inner},1)`);
  g.addColorStop(0.2, "rgba(255,185,85,0.85)");
  g.addColorStop(0.5, "rgba(255,120,40,0.42)");
  g.addColorStop(0.8, "rgba(255,75,15,0.14)");
  g.addColorStop(1, "rgba(255,50,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const MAX_LIGHTS = 6;
const EMBERS = 90;
const _sortByDist = (a, b) => a.d - b.d;

// Tochas fixas, lareiras e iluminação noturna:
// Pool estrito e imutável de 6 PointLights ativas mantidas permanentemente na cena (visible=true),
// eliminando 100% das recompilações de shaders que causavam micro-travamentos violentos.
export class TorchSystem {
  constructor(scene, world, dayNight) {
    this.scene = scene;
    this.world = world;
    this.dayNight = dayNight;
    this.sources = [];
    this.time = 0;
    this.lit = false;
    this.rain = 0;
    this.glow = makeGlowTexture();
    this.lights = [];
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const light = new THREE.PointLight("#ffaa50", 0, 28.0, 1.4);
      configureDistantLight(light);
      light.visible = true; // CRÍTICO: NUNCA alternar visible em runtime para evitar recompilação de shader
      light.position.set(0, -9999, 0);
      light.userData.source = null;
      scene.add(light);
      this.lights.push(light);
    }

    // Pool de guardas esvaziado: guardas utilizam halos aditivos e materiais emissivos (Zero PointLights reais)
    this.guardTorchPool = [];

    this.pending = [];
    this._lastSortX = -9999;
    this._lastSortZ = -9999;
    this._sortTimer = 0;
    this.stickGeometry = new THREE.CylinderGeometry(0.035, 0.05, 0.62, 6);
    this.headGeometry = new THREE.CylinderGeometry(0.075, 0.05, 0.2, 6);
    this.stickMaterial = new THREE.MeshStandardMaterial({ color: "#4a3626", roughness: 1, flatShading: true });
    this.headMaterial = new THREE.MeshStandardMaterial({ color: "#2c2218", emissive: "#ff7a22", emissiveIntensity: 0, roughness: 1, flatShading: true });
    this.guardHeadMaterial = new THREE.MeshStandardMaterial({ color: "#2c2218", emissive: "#ff8833", emissiveIntensity: 4.5, roughness: 1, flatShading: true });
    this.poleMaterial = new THREE.MeshStandardMaterial({ color: "#503b2a", roughness: 1, flatShading: true });
    this.group = new THREE.Group();
    scene.add(this.group);

    // =========================================================================
    // Light Impostors: InstancedMesh de Halos de Luz (Glows que perfuram o breu)
    // =========================================================================
    const impostorPlaneGeo = new THREE.PlaneGeometry(1, 1);
    this.impostorMaterial = new THREE.MeshBasicMaterial({
      map: this.glow,
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false, // CRÍTICO: ignora a neblina preta noturna para perfurar o breu
    });

    // Injeta rotação para a câmera (Billboard) diretamente no vertex shader da GPU
    this.impostorMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `
        vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        vec2 scale = vec2(
          length( vec3( modelMatrix[0].x, modelMatrix[0].y, modelMatrix[0].z ) ),
          length( vec3( modelMatrix[1].x, modelMatrix[1].y, modelMatrix[1].z ) )
        );
        mvPosition.xy += position.xy * scale;
        gl_Position = projectionMatrix * mvPosition;
        `
      );
    };

    this.maxImpostors = 512;
    this.impostorMesh = new THREE.InstancedMesh(impostorPlaneGeo, this.impostorMaterial, this.maxImpostors);
    this.impostorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.impostorMesh.frustumCulled = false;
    scene.add(this.impostorMesh);

    // Vetores e matrizes auxiliares Zero-GC
    this._impostorMatrix = new THREE.Matrix4();
    this._impostorPos = new THREE.Vector3();
    this._impostorScale = new THREE.Vector3();
    this._impostorQuat = new THREE.Quaternion();
    this._impostorColor = new THREE.Color();
    this._prevActiveImpostors = 0;

    for (let i = 0; i < this.maxImpostors; i++) {
      this._impostorPos.set(0, -9999, 0);
      this._impostorScale.set(0, 0, 0);
      this._impostorMatrix.compose(this._impostorPos, this._impostorQuat, this._impostorScale);
      this.impostorMesh.setMatrixAt(i, this._impostorMatrix);
    }
    this.impostorMesh.instanceMatrix.needsUpdate = true;

    // fagulhas
    this.emberPositions = new Float32Array(EMBERS * 3);
    this.emberVelocity = new Float32Array(EMBERS * 3);
    this.emberLife = new Float32Array(EMBERS);
    this.emberCursor = 0;
    this.emberTimer = 0;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.emberPositions, 3));
    this.embers = new THREE.Points(geometry, new THREE.PointsMaterial({ map: this.glow, color: "#ffb15a", size: 0.18, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.embers.frustumCulled = false;
    scene.add(this.embers);
    for (let i = 0; i < EMBERS; i++) this.emberPositions[i * 3 + 1] = -500;
  }

  // Cria o modelo visual de tocha na mão do guarda (visível apenas quando hasTorch = true).
  attachGuardTorchProp(guardRoot, handParent) {
    if (guardRoot.userData.torchProp) return guardRoot.userData.torchProp;
    const prop = new THREE.Group();
    prop.position.set(0.06, -0.22, 0.14);
    prop.rotation.x = Math.PI * 0.32;
    const stick = new THREE.Mesh(this.stickGeometry, this.stickMaterial);
    stick.scale.setScalar(0.75);
    const head = new THREE.Mesh(this.headGeometry, this.guardHeadMaterial);
    head.scale.setScalar(0.8);
    head.position.y = 0.26;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow,
      color: "#ff9933",
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }));
    flame.scale.set(0.48, 0.62, 1);
    flame.position.y = 0.38;
    prop.add(stick, head, flame);
    prop.visible = false;
    (handParent || guardRoot).add(prop);
    guardRoot.userData.torchProp = prop;
    return prop;
  }

  // Verifica se o jogador está iluminado (vela acesa, tocha mágica equipada, perto de tocha/lareira acesa ou fogo).
  isPlayerLit(player, candle = null, fire = null) {
    if (!this.dayNight.isNight) return true;
    if (player.weaponId === "torch") return true;
    if (candle && candle.lit) return true;
    const px = player.x;
    const py = player.root.position.y + 1.0;
    const pz = player.z;
    if (this.nearestFire(px, py, pz, 11.5) !== null) return true;
    if (fire && Array.isArray(fire.patches)) {
      for (let i = 0; i < fire.patches.length; i++) {
        const p = fire.patches[i];
        if (!p.active) continue;
        const dx = p.x - px;
        const dz = p.z - pz;
        if (dx * dx + dz * dz < 9.5 * 9.5) return true;
      }
    }
    return false;
  }

  // Tocha presa à parede (nx, nz: direção para fora) ou no alto de um poste.
  addTorch(x, y, z, nx = 0, nz = 0, post = false, colorKey = "orange", alwaysOn = false, isPlayerPlaced = false) {
    const pal = CRYSTAL_PALETTE[colorKey] || CRYSTAL_PALETTE.orange || { flameHex: 0xffa040, coreHex: 0xffffff };
    const group = new THREE.Group();
    group.position.set(x + nx * 0.18, y, z + nz * 0.18);
    const stick = new THREE.Mesh(this.stickGeometry, this.stickMaterial);
    stick.rotation.set(nz * 0.3, 0, -nx * 0.3);
    group.add(stick);

    const isAlwaysLit = Boolean(alwaysOn || isPlayerPlaced);
    const customHeadMaterial = new THREE.MeshStandardMaterial({
      color: "#2c2218",
      emissive: pal.flameHex,
      emissiveIntensity: isAlwaysLit ? 5.8 : (this.lit ? 4.8 : 0.05),
      roughness: 1,
      flatShading: true,
    });
    const head = new THREE.Mesh(this.headGeometry, customHeadMaterial);
    head.position.set(nx * 0.09, 0.34, nz * 0.09);
    group.add(head);

    if (!post) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.22), this.poleMaterial);
      bracket.position.set(-nx * 0.1, -0.15, -nz * 0.1);
      bracket.rotation.y = Math.atan2(nx, nz);
      group.add(bracket);
    } else {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, y - this.world.heightAt(x, z) - 0.1, 6), this.poleMaterial);
      pole.position.set(0, -(y - this.world.heightAt(x, z)) / 2 + 0.05, 0);
      group.add(pole);
      group.position.set(x, y, z);
    }
    this.group.add(group);
    const spriteScale = isPlayerPlaced ? 2.4 : (post ? 2.2 : 1.9);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow,
      color: pal.flameHex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false, // Perfora a neblina noturna
    }));
    sprite.scale.set(spriteScale, spriteScale * 1.35, 1);
    sprite.position.set(x + nx * 0.27, y + 0.52, z + nz * 0.27);
    sprite.visible = isAlwaysLit;
    this.scene.add(sprite);

    const source = {
      x: x + nx * 0.27,
      y: y + 0.5,
      z: z + nz * 0.27,
      sprite,
      phase: Math.random() * 6.28,
      kind: "torch",
      alwaysOn: isAlwaysLit,
      light: true,
      group,
      lightColor: pal.flameHex,
      colorKey,
      headMaterial: customHeadMaterial,
      pointLight: null,
      isPlayerPlaced: Boolean(isPlayerPlaced),
      isPost: Boolean(post),
    };
    this.sources.push(source);
    return source;
  }

  removeTorch(source) {
    if (!source) return;
    const idx = this.sources.indexOf(source);
    if (idx !== -1) this.sources.splice(idx, 1);
    if (source.group) {
      if (source.group.parent) source.group.parent.remove(source.group);
      source.group.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
      });
    }
    if (source.sprite) {
      if (source.sprite.parent) source.sprite.parent.remove(source.sprite);
    }
    if (source.pointLight) {
      if (source.pointLight.parent) source.pointLight.parent.remove(source.pointLight);
    }
    for (let i = 0; i < this.lights.length; i++) {
      if (this.lights[i].userData.source === source) {
        this.lights[i].userData.source = null;
        this.lights[i].intensity = 0;
      }
    }
  }

  addFireSource(x, y, z, house = null) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: "#ffb060", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sprite.scale.set(1.0, 1.2, 1);
    sprite.position.set(x, y + 0.3, z);
    this.scene.add(sprite);
    const source = { x, y: y + 0.3, z, sprite, phase: Math.random() * 6.28, kind: "hearth", alwaysOn: true, light: true, house };
    this.sources.push(source);
    return source;
  }

  // Fonte de fogo acesa mais próxima de um ponto (para acender a vela).
  nearestFire(x, y, z, radius) {
    let best = null;
    let bestDistance = radius * radius;
    for (const source of this.sources) {
      if (!this._isOn(source)) continue;
      const d = (source.x - x) ** 2 + (source.z - z) ** 2 + (source.y - y) ** 2 * 0.4;
      if (d < bestDistance) {
        bestDistance = d;
        best = source;
      }
    }
    return best;
  }

  _isOn(source) {
    return source.alwaysOn || (this.lit && this.rain < 0.7);
  }

  update(dt, player) {
    this.time += dt;
    // acendem ao anoitecer e apagam ao amanhecer (com histerese)
    const daylight = this.dayNight.daylight;
    if (!this.lit && daylight < 0.42) this.lit = true;
    else if (this.lit && daylight > 0.55) this.lit = false;
    this.headMaterial.emissiveIntensity = this.lit ? 4.8 : 0.05;
    for (let s = 0; s < this.sources.length; s++) {
      const src = this.sources[s];
      if (src.headMaterial) {
        src.headMaterial.emissiveIntensity = (src.alwaysOn || this.lit) ? 5.8 : 0.05;
      }
    }

    const px = player.x;
    const pz = player.z;
    const candidates = this.pending;
    candidates.length = 0;

    // Regra: PointLights reais iluminam em um raio curto de até 25m do jogador.
    // Acima disso, halos e billboards aditivos perfuram o breu sem custo de sombreamento ou recompilação.
    const POINTLIGHT_ACTIVATION_DIST = 25.0;
    const POINTLIGHT_ACTIVATION_DIST_SQ = POINTLIGHT_ACTIVATION_DIST * POINTLIGHT_ACTIVATION_DIST; // 625 m²

    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      const dx = source.x - px;
      const dz = source.z - pz;
      const d = dx * dx + dz * dz;
      const on = this._isOn(source);
      const nearPointLight = on && d <= POINTLIGHT_ACTIVATION_DIST_SQ;
      const flicker = 0.88 + 0.12 * Math.sin(this.time * 11 + source.phase) + 0.06 * Math.sin(this.time * 23 + source.phase * 2);

      // 1. Halo / Chama do Sprite: compensa a distância e perfura a neblina escura (fog=false)
      if (source.sprite) {
        source.sprite.visible = on;
        if (on) {
          const baseScale = source.kind === "hearth" ? 3.4 : (source.isPost ? 2.4 : 1.9);
          const dist = Math.sqrt(d);
          // Escala cresce com a distância para manter legibilidade visual clara de 100m a 200m
          const distScaleBoost = Math.min(8.0, Math.max(1.0, 1.0 + dist * 0.035));
          const s = baseScale * flicker * distScaleBoost;
          source.sprite.scale.set(s, s * 1.35, 1);
        }
      }

      // 2. Seleção de fontes para o pool de PointLights reais de curta distância:
      if (!nearPointLight || !source.light) continue;
      // Lareiras de dia só iluminam quem está dentro da casa
      if (source.kind === "hearth" && this.dayNight.daylight > 0.6 && !(source.house && source.house.inside)) continue;
      source.d = d;
      candidates.push(source);
    }

    // Ordenação sob demanda: evita sort() a cada quadro se o jogador estiver parado ou houver poucas fontes
    if (candidates.length > MAX_LIGHTS) {
      const movedDx = px - this._lastSortX;
      const movedDz = pz - this._lastSortZ;
      this._sortTimer -= dt;
      if (movedDx * movedDx + movedDz * movedDz > 0.64 || this._sortTimer <= 0) {
        this._lastSortX = px;
        this._lastSortZ = pz;
        this._sortTimer = 0.2;
        candidates.sort(_sortByDist);
      }
    }
    const chosenCount = Math.min(candidates.length, MAX_LIGHTS);

    // Mantém as PointLights presas às mesmas fontes para evitar oscilação visual
    // CRÍTICO: NUNCA alterar light.visible (manter sempre true para zero recompilação de shader)
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const light = this.lights[i];
      const src = light.userData.source;
      if (!src) continue;
      let stillChosen = false;
      for (let j = 0; j < chosenCount; j++) {
        if (candidates[j] === src) { stillChosen = true; break; }
      }
      if (!stillChosen) {
        light.userData.source = null;
        light.intensity = 0;
        light.position.set(0, -9999, 0);
      }
    }
    for (let j = 0; j < chosenCount; j++) {
      const source = candidates[j];
      let alreadyBound = false;
      for (let i = 0; i < MAX_LIGHTS; i++) {
        if (this.lights[i].userData.source === source) { alreadyBound = true; break; }
      }
      if (alreadyBound) continue;
      let free = null;
      for (let i = 0; i < MAX_LIGHTS; i++) {
        if (!this.lights[i].userData.source) { free = this.lights[i]; break; }
      }
      if (!free) {
        for (let i = 0; i < MAX_LIGHTS; i++) {
          if (this.lights[i].intensity < 1) { free = this.lights[i]; break; }
        }
      }
      if (free) {
        free.userData.source = source;
      }
    }
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const light = this.lights[i];
      const source = light.userData.source;
      if (!source) {
        light.intensity = 0;
        light.position.set(0, -9999, 0);
        continue;
      }
      const flicker = 0.88 + 0.12 * Math.sin(this.time * 13 + source.phase);
      const target = (source.kind === "hearth" ? 28 : 38) * flicker;
      light.distance = 28.0;
      light.decay = 1.4;
      light.intensity += (target - light.intensity) * (1 - Math.exp(-8 * dt));
      light.position.set(source.x, source.y + 0.25, source.z);
      if (source.lightColor !== undefined) {
        light.color.setHex(source.lightColor);
      } else {
        light.color.setHex(0xffaa50);
      }
    }

    // fagulhas subindo das fontes mais próximas
    this.emberTimer -= dt;
    if (this.emberTimer <= 0 && chosenCount > 0) {
      this.emberTimer = 0.07;
      const source = candidates[Math.floor(Math.random() * chosenCount)];
      const k = this.emberCursor;
      this.emberCursor = (this.emberCursor + 1) % EMBERS;
      this.emberPositions[k * 3] = source.x + (Math.random() - 0.5) * 0.15;
      this.emberPositions[k * 3 + 1] = source.y + 0.1;
      this.emberPositions[k * 3 + 2] = source.z + (Math.random() - 0.5) * 0.15;
      this.emberVelocity[k * 3] = (Math.random() - 0.5) * 0.4;
      this.emberVelocity[k * 3 + 1] = 0.6 + Math.random() * 0.8;
      this.emberVelocity[k * 3 + 2] = (Math.random() - 0.5) * 0.4;
      this.emberLife[k] = 0.9 + Math.random() * 0.9;
    }
    let anyEmberActive = false;
    for (let i = 0; i < EMBERS; i++) {
      if (this.emberLife[i] <= 0) continue;
      anyEmberActive = true;
      this.emberLife[i] -= dt;
      if (this.emberLife[i] <= 0) {
        this.emberPositions[i * 3 + 1] = -500;
        continue;
      }
      this.emberPositions[i * 3] += this.emberVelocity[i * 3] * dt + Math.sin(this.time * 5 + i) * 0.003;
      this.emberPositions[i * 3 + 1] += this.emberVelocity[i * 3 + 1] * dt;
      this.emberPositions[i * 3 + 2] += this.emberVelocity[i * 3 + 2] * dt;
    }
    if (anyEmberActive || chosenCount > 0) {
      this.embers.geometry.attributes.position.needsUpdate = true;
    }
  }
}

// Vela: V equipa/guarda, E perto do fogo acende; a única luz que segue o jogador.
export class Candle {
  constructor(scene, player, torches, input, ui, audio) {
    this.player = player;
    this.torches = torches;
    this.input = input;
    this.ui = ui;
    this.audio = audio;
    this.count = 1;
    this.equipped = false;
    this.lit = false;
    this.burn = 0;
    this.maxBurn = 240;
    this.stands = [];
    this.promptText = null;
    this.hand = new THREE.Vector3();
    this.time = 0;

    this.light = new THREE.PointLight("#ffb866", 0, 22, 2);
    scene.add(this.light);
    this.mesh = new THREE.Group();
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 7), new THREE.MeshStandardMaterial({ color: "#efe4c8", roughness: 1 }));
    wax.position.y = 0.1;
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 4), new THREE.MeshStandardMaterial({ color: "#222" }));
    wick.position.y = 0.22;
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: torches.glow, color: "#ffd08a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flame.scale.set(0.35, 0.48, 1);
    this.flame.position.y = 0.3;
    this.mesh.add(wax, wick, this.flame);
    this.mesh.position.set(0, -0.3, 0.1);
    this.mesh.visible = false;
    player.leftForearm.add(this.mesh);
    this._sync();
  }

  addStand(x, z, price = 4) {
    this.stands.push({ x, z, price });
  }

  _sync() {
    this.ui.setCandle(this.equipped ? (this.lit ? `acesa ${this._left()}` : "apagada") : this.count > 0 ? "guardada" : "—", this.count, this.lit);
  }

  _left() {
    const left = Math.max(0, this.maxBurn - this.burn);
    return `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
  }

  buy(price) {
    if (this.player.coins < price) {
      this.ui.showToast(`A vela custa ${price} moedas`);
      return false;
    }
    this.player.coins -= price;
    this.count++;
    this.ui.showToast("Vela comprada");
    this.ui.setVitals(this.player.health, this.player.maxHealth, this.player.coins, this.player.potions);
    this._sync();
    return true;
  }

  extinguish(message) {
    if (!this.lit) return;
    this.lit = false;
    if (message) this.ui.showToast(message);
    this._sync();
  }

  // E: acende a vela junto a uma tocha ou lareira, ou compra no estande da igreja.
  interact() {
    if (this.equipped && !this.lit && this._fireNear()) {
      this.lit = true;
      this.ui.showToast("Vela acesa");
      this.audio.coin();
      this._sync();
      return true;
    }
    const stand = this._standNear();
    if (stand) return this.buy(stand.price) || true;
    return false;
  }

  _fireNear() {
    this.player.leftForearm.getWorldPosition(this.hand);
    return this.torches.nearestFire(this.hand.x, this.hand.y, this.hand.z, 2.6);
  }

  _standNear() {
    for (const stand of this.stands) {
      if ((stand.x - this.player.x) ** 2 + (stand.z - this.player.z) ** 2 < 2.2 * 2.2) return stand;
    }
    return null;
  }

  update(dt, mountedSpeed = 0) {
    this.time += dt;
    const player = this.player;
    if (this.input.consumeCandlePressed() && !player.knockedOut && !player.dead) {
      if (this.count > 0) {
        this.equipped = !this.equipped;
        if (!this.equipped) this.lit = false;
        this.ui.showToast(this.equipped ? "Vela equipada" : "Vela guardada");
      } else {
        this.ui.showToast("Não tens velas");
      }
      this._sync();
    }
    this.mesh.visible = this.equipped;
    this.flame.visible = this.lit;

    if (this.lit) {
      // apaga correndo muito, galopando ou rolando
      const fast = player.mounted ? mountedSpeed > 9 : player.speedRatio > 0.88;
      if (fast || player.rolling) this.extinguish("O vento apagou a vela");
      this.burn += dt;
      if (this.burn >= this.maxBurn) {
        this.count = Math.max(0, this.count - 1);
        this.burn = 0;
        this.lit = false;
        this.equipped = this.count > 0 ? this.equipped : false;
        this.ui.showToast("A vela derreteu até o fim");
        this._sync();
      }
    }
    if (this.lit) {
      this.player.leftForearm.getWorldPosition(this.hand);
      const flicker = 0.82 + 0.18 * Math.sin(this.time * 14) + 0.08 * Math.sin(this.time * 31);
      this.light.position.set(this.hand.x, this.hand.y + 0.45, this.hand.z);
      this.light.intensity += (14 * flicker - this.light.intensity) * (1 - Math.exp(-12 * dt));
      this.flame.scale.set(0.35 * flicker, 0.48 * flicker, 1);
      if (Math.floor(this.time * 2) !== this._lastTick) {
        this._lastTick = Math.floor(this.time * 2);
        this._sync();
      }
    } else {
      this.light.intensity += (0 - this.light.intensity) * (1 - Math.exp(-12 * dt));
    }

    // aviso: acender ou comprar
    let text = null;
    if (this.equipped && !this.lit && this._fireNear()) text = "E · acender vela";
    else if (this._standNear()) text = `E · comprar vela (${this._standNear().price} moedas)`;
    this.promptText = text;
  }
}
