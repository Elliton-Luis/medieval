import * as THREE from 'three';
import { createScene } from './scene.js';
import { createDebugPanel } from './debug.js';
import { input } from './input.js';
import { createPlayer } from './player.js';
import { createZombies } from './zombies.js';
import { createBullets } from './bullet.js';
import { createHud } from './hud.js';
import { GAME } from './config.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const { scene, camera, colliders, updateCamera } = createScene();
const player = createPlayer(scene);
const zombies = createZombies(scene, colliders);
const bullets = createBullets(scene);
const hud = createHud();
const debug = import.meta.env.DEV ? createDebugPanel() : null;

const game = {
  time: 0,
  kills: 0,
  health: GAME.maxHealth,
  over: false,
  damageCooldown: 0,
};

function resetGame() {
  game.time = 0;
  game.kills = 0;
  game.health = GAME.maxHealth;
  game.over = false;
  game.damageCooldown = 0;
  player.reset();
  zombies.reset();
  bullets.reset();
  hud.hideGameOver();
  hud.update(game);
}

const timer = new THREE.Timer();
timer.connect(document);

function animate(timestamp) {
  timer.update(timestamp);
  const rawDt = timer.getDelta();
  const dt = Math.min(rawDt, 0.05);

  if (!game.over) {
    game.time += dt;
    player.update(dt, input, camera, colliders);
    zombies.update(dt, player, game);
    bullets.update(dt, input, player, colliders, zombies, game);

    if (game.health <= 0) {
      game.over = true;
      hud.showGameOver(game);
    }
  } else if (input.wasPressed('KeyR')) {
    resetGame();
  }

  updateCamera(player.group.position.x, player.group.position.z, dt, input);
  hud.update(game);
  renderer.render(scene, camera);
  if (debug) debug.update(rawDt, renderer.info.render.calls);
  input.endFrame();

  requestAnimationFrame(animate);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);

requestAnimationFrame(animate);
