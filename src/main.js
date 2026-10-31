import * as THREE from 'three';
import { createScene } from './scene.js';
import { createDebugPanel } from './debug.js';
import { input } from './input.js';
import { createPlayer } from './player.js';
import { createFireballs } from './fireball.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const { scene, camera, colliders, target, updateCamera } = createScene();
const player = createPlayer(scene);
const fireballs = createFireballs(scene);
const debug = import.meta.env.DEV ? createDebugPanel() : null;

const timer = new THREE.Timer();
timer.connect(document);

function animate(timestamp) {
  timer.update(timestamp);
  const rawDt = timer.getDelta();
  const dt = Math.min(rawDt, 0.05);

  player.update(dt, input, camera, colliders);
  fireballs.update(dt, input, player, colliders, target);
  target.update(dt);
  updateCamera(player.group.position.x, player.group.position.z, dt, input);
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
