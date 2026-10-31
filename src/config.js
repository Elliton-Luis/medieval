export const WORLD = {
  skyColor: 0x9ec8d8,
  groundColor: 0xcfe3c2,
  fogNear: 18,
  fogFar: 60,
  groundSize: 200,
};

export const CAMERA = {
  fov: 35,
  offsetX: 10,
  offsetY: 15,
  offsetZ: 10,
  targetHeight: 0.7,
  followSpeed: 6,
  near: 0.1,
  far: 220,
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

export const DEBUG = {
  updateInterval: 0.25,
};
