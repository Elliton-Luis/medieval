export const WORLD = {
  skyColor: 0x9ec8d8,
  groundColor: 0xcfe3c2,
  fogNear: 18,
  fogFar: 60,
  groundSize: 200,
};

export const CAMERA = {
  fov: 35,
  targetHeight: 0.7,
  followSpeed: 6,
  near: 0.1,
  far: 220,
  initialYaw: Math.PI / 4,
  initialPitch: 0.815,
  initialDistance: 20.6,
  minPitch: 0.3,
  maxPitch: 1.35,
  minDistance: 8,
  maxDistance: 32,
  dragSensitivity: 0.005,
  zoomSensitivity: 0.001,
};

export const COLORS = {
  box: 0xd29b6f,
  column: 0xb7c9a8,
  ground: WORLD.groundColor,
  sun: 0xfff2d8,
  skyLight: 0xd8eef5,
  bounceLight: 0x7d9470,
  playerBody: 0x3f8f8a,
  playerNose: 0xffe3b3,
  shadow: 0x263b33,
  fireCore: 0xffd27a,
  fireEmissive: 0xff5a12,
  fireHalo: 0xffa64d,
  fireParticle: 0xffb25e,
  targetBody: 0xe0c49b,
  targetBase: 0x7a6650,
  targetFlash: 0xff7a1a,
};

export const PLAYER = {
  radius: 0.45,
  moveSpeed: 6,
  acceleration: 16,
  deceleration: 22,
  turnSpeed: 14,
  jumpSpeed: 7.2,
  gravity: 22,
  airControl: 0.45,
  bodyRadius: 0.4,
  bodyLength: 0.8,
  shadowRadius: 0.55,
  shadowOpacity: 0.3,
};

export const FIREBALL = {
  poolSize: 16,
  speed: 14,
  lifetime: 1.2,
  cooldown: 0.35,
  radius: 0.16,
  coreRadius: 0.16,
  haloScale: 0.9,
  spawnOffset: 0.7,
  spawnHeight: 1,
  trailInterval: 0.02,
  trailLife: 0.35,
  burstCount: 10,
  burstLife: 0.32,
  burstSpeed: 3.2,
  particlePoolSize: 96,
  particleSize: 0.45,
};

export const DEBUG = {
  updateInterval: 0.25,
};