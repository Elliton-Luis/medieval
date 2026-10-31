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
};

export const DEBUG = {
  updateInterval: 0.25,
};
