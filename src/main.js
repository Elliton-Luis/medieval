import * as THREE from 'three';
import { createScene } from './scene.js';
import { createDebugPanel } from './debug.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const { scene, camera, updateCamera } = createScene();
const debug = import.meta.env.DEV ? createDebugPanel() : null;

const clock = new THREE.Clock();

function animate() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);

  updateCamera(0, 0, dt);
  renderer.render(scene, camera);
  if (debug) debug.update(rawDt, renderer.info.render.calls);

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
