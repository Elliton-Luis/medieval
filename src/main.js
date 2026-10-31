import * as THREE from "three";
import { CONFIG } from "./config.js";
import { InputManager } from "./input.js?v=14";
import { World, SHADOW_RADIUS } from "./world.js?v=14";
import { Player } from "./player.js?v=14";
import { ThirdPersonCamera } from "./camera.js?v=14";
import { DayNightCycle } from "./daynight.js?v=14";
import { GameUI } from "./ui.js?v=14";
import { createSettlement } from "./settlement.js?v=14";
import { NPCSystem } from "./npc.js?v=14";
import { InteractionSystem } from "./interactions.js?v=14";
import { SpriteEffects } from "./effects.js";
import { CombatSystem } from "./combat.js?v=14";
import { WeaponSystem } from "./weapons.js?v=14";
import { AimSystem } from "./aim.js?v=14";
import { ExplosionSystem } from "./explosions.js";
import { GameAudio } from "./audio.js?v=14";
import { DropSystem } from "./drops.js";
import { Minimap } from "./minimap.js?v=14";
import { EnemyDirector } from "./enemies.js?v=14";
import { DeathScreen } from "./deathScreen.js";
import { TorchSystem, Candle, setupAtmosphere } from "./torches.js?v=14";
import { FireSystem } from "./fire.js";
import { HouseSystem } from "./houses.js?v=14";
import { SleepSystem } from "./sleep.js?v=14";
import { loadGame } from "./save.js";
import { HorseManager } from "./horses.js?v=14";
import { RidingSystem, dismountHorse } from "./riding.js?v=14";
import { MusicDirector } from "./music.js";
import { PauseMenu } from "./pause.js?v=14";
import { DamageFx } from "./damagefx.js";
import { setMeleeEnv, clearTokens } from "./melee.js";
import {
  PlayerStats,
  PlayerEquipment,
  PlayerInventory,
  BUILD_COSTS,
  MissionState,
  ActiveMissions,
  NPC_TYPES,
  NPC_STATES,
  initRPGSystem,
  syncPlayerStatsToPlayer,
  checkWitnesses,
  updateNPCRoutine,
  handleNPCDeath,
  interactWithChest,
  dropHayBait,
  handleWeaponAction,
  updateMusketReload,
  igniteTarget,
  takeDamage,
  buyUpgrade,
  interactWithPriest,
  interactWithBeggar,
  gatherResource,
  buildStructure,
  sellResourcesToNPC,
  createPlayerBuildingsPool,
  spawnWaypointMarker,
  removeWaypointMarker,
  updateWaypointBillboard,
  generateDeliveryMission,
  generateDebtMission,
  generateHorseTheftMission,
  generateBountyMission,
  startMission,
  failActiveMission,
  notifyMissionFistHit,
  payDebtorMission,
  updateMissionProgress,
} from "./rpg.js?v=14";
import {
  initProceduralEnv,
  createSeededRandom,
  createSharedHouseMaterial,
  generateCity,
  updateWorldChunks,
  assignNpcAnchors,
  updateWildernessSpawns,
  createMonstersPool,
} from "./procedural.js?v=14";

const gameRoot = document.getElementById("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#aebfae");
scene.fog = new THREE.FogExp2("#aebfae", CONFIG.fogDensity);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 240);
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
  stencil: false,
  depth: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
setupAtmosphere(scene, renderer);
renderer.shadowMap.enabled = true;
// PCF com raio de desfoque: sombras suaves (o PCFSoft ignora shadow.radius)
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.id = "world-canvas";
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Clique para capturar o mouse e controlar a câmera");
gameRoot.prepend(renderer.domElement);

const hemisphere = new THREE.HemisphereLight("#eaf0dd", "#5a5649", 1.3);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight("#ffe1ae", 1.5);
sun.position.set(35, 65, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -SHADOW_RADIUS;
sun.shadow.camera.right = SHADOW_RADIUS;
sun.shadow.camera.top = SHADOW_RADIUS;
sun.shadow.camera.bottom = -SHADOW_RADIUS;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 160;
sun.shadow.radius = 3.5;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.05;
scene.add(sun);
scene.add(sun.target);

const world = new World(scene);
const settlement = createSettlement(scene, world);
const player = new Player(scene, world);
const audio = new GameAudio();
const effects = new SpriteEffects(scene);
const npcs = new NPCSystem(scene, world, settlement, effects);
const input = new InputManager(renderer.domElement);
const cameraRig = new ThirdPersonCamera(camera, world);
const dayNight = new DayNightCycle(scene, sun, hemisphere);
const ui = new GameUI(renderer);
const explosions = new ExplosionSystem(scene, world, (x, z, power) => cameraRig.shakeAt(x, z, power, player.x, player.z));
const aim = new AimSystem(camera, world, npcs, input, ui);
const combat = new CombatSystem(player, npcs, input, effects, ui, settlement, audio, cameraRig);
combat.aim = aim;
const weapons = new WeaponSystem(scene, player, input, combat, effects, ui, world, npcs, aim, cameraRig, explosions, audio);
const interactions = new InteractionSystem(player, npcs, input, ui, weapons);
const minimap = new Minimap(document.getElementById("minimap"));
const drops = new DropSystem(scene, world, player, ui, audio, effects);
drops.weapons = weapons;
combat.drops = drops;
interactions.drops = drops;
player.effects = effects;
player.audio = audio;
const deathScreen = new DeathScreen({
  container: gameRoot,
  canvas: renderer.domElement,
  audio,
  cameraRig,
  input,
  onRespawn: () => combat.respawnAtChurch(),
});
combat.deathScreen = deathScreen;
const torches = new TorchSystem(scene, world, dayNight);
npcs.torches = torches;
for (const t of settlement.torchSpots) torches.addTorch(t.x, t.y, t.z, t.nx, t.nz, t.post);
for (const house of settlement.houses) torches.addFireSource(house.hearth.x, house.hearth.y, house.hearth.z, house);
const candle = new Candle(scene, player, torches, input, ui, audio);
for (const stand of settlement.stands) candle.addStand(stand.x, stand.z, 4);
const sleep = new SleepSystem({ container: gameRoot, input, player, npcs, dayNight, ui, audio, weapons, candle });
const houses = new HouseSystem({
  houses: settlement.houses,
  wells: settlement.wells,
  townBenches: settlement.townBenches,
  player,
  ui,
  effects,
  audio,
  npcs,
  drops,
  sleep,
  candle,
  input,
});
houses.assignOwners();
const fire = new FireSystem({ scene, world, candle, player, combat, npcs, effects, ui });
fire.register(settlement.hay, settlement.houses);
weapons.fire = fire;
interactions.candle = candle;
interactions.houses = houses;
combat.houses = houses;
weapons.houses = houses;
const horses = new HorseManager({ scene, world, effects, npcs, audio, player });
horses.spawnHerd(30, 22, 3);
horses.spawnOwned(settlement.houses);
const riding = new RidingSystem({ player, world, input, ui, effects, audio, npcs, combat, cameraRig, horses });
weapons.horses = horses;
houses.riding = riding;
interactions.horses = horses;
interactions.hayBales = settlement.hay;
initRPGSystem({ scene, world, npcs, drops, player, ui, effects, audio });
const music = new MusicDirector({ audio, world, player, npcs });
const pause = new PauseMenu({ container: gameRoot, canvas: renderer.domElement, audio, input, aim });
const damageFx = new DamageFx({ container: gameRoot, audio, player });
combat.damageFx = damageFx;
const sharedHouseMaterial = createSharedHouseMaterial();
const activeCities = new Map();
if (settlement.cityData) {
  activeCities.set("0_0", settlement.cityData);
}
initProceduralEnv({ scene, world, npcs, activeCities });
initRPGSystem({ scene, world, npcs, drops, player, ui, effects, audio, damageFx, weapons, candle, horses, settlement, activeCities });
setMeleeEnv({ npcs, combat, effects });
const director = new EnemyDirector(scene, world, npcs, effects, explosions, audio);
director.combat = combat;
director.cameraRig = cameraRig;
const monstersPool = createMonstersPool(scene, world, npcs, effects, combat, 2);
npcs.onWantedChange = (level) => ui.setWanted(level);
npcs.onAlert = (message) => ui.showToast(message);

if (new URLSearchParams(location.search).has("debug")) {
  window.__game = { MissionState, ActiveMissions, spawnWaypointMarker, removeWaypointMarker, updateWaypointBillboard, generateDeliveryMission, generateDebtMission, generateHorseTheftMission, generateBountyMission, startMission, failActiveMission, notifyMissionFistHit, payDebtorMission, updateMissionProgress, activeCities, dismountHorse, updateWorldChunks, PlayerInventory, BUILD_COSTS, gatherResource, buildStructure, sellResourcesToNPC, createPlayerBuildingsPool, monstersPool, createSeededRandom, createSharedHouseMaterial, generateCity, assignNpcAnchors, updateWildernessSpawns, PlayerStats, PlayerEquipment, NPC_TYPES, NPC_STATES, checkWitnesses, updateNPCRoutine, handleNPCDeath, interactWithChest, dropHayBait, handleWeaponAction, updateMusketReload, igniteTarget, takeDamage, buyUpgrade, interactWithPriest, interactWithBeggar, damageFx, music, pause, renderer, ui, minimap, interactions, horses, riding, dayNight, houses, sleep, torches, candle, fire, deathScreen, audio, director, drops, THREE, scene, camera, world, player, npcs, input, cameraRig, aim, combat, weapons, explosions, effects, settlement };
}

const saved = loadGame();
if (saved) {
  if (saved.stats) {
    PlayerStats.str = saved.stats.str ?? PlayerStats.str;
    PlayerStats.con = saved.stats.con ?? PlayerStats.con;
    PlayerStats.cha = saved.stats.cha ?? PlayerStats.cha;
    PlayerStats.spd = saved.stats.spd ?? PlayerStats.spd;
    PlayerStats.hay = saved.stats.hay ?? PlayerStats.hay;
    PlayerInventory.hay = PlayerStats.hay;
    PlayerInventory.wood = saved.stats.wood ?? PlayerInventory.wood;
    PlayerInventory.stone = saved.stats.stone ?? PlayerInventory.stone;
    PlayerInventory.torches = saved.stats.torches ?? PlayerInventory.torches;
    PlayerInventory.hasSword = saved.stats.hasSword ?? PlayerInventory.hasSword;
  }
  player.coins = saved.coins ?? player.coins;
  PlayerStats.gold = player.coins;
  PlayerInventory.gold = player.coins;
  syncPlayerStatsToPlayer(player, ui);
  player.health = Math.max(1, Math.min(player.maxHealth, saved.health ?? player.maxHealth));
  player.potions = saved.potions ?? player.potions;
  weapons.restore(saved.weapons || { ammo: saved.ammo });
  candle.count = saved.candles ?? candle.count;
  if (typeof saved.progress === "number") dayNight.progress = saved.progress;
  if (typeof saved.x === "number" && !world.isBlockedAt(saved.x, saved.z, player.radius)) {
    player.x = saved.x;
    player.z = saved.z;
    player.root.position.set(player.x, world.heightAt(player.x, player.z), player.z);
  }
  candle._sync();
  weapons._refreshWeaponHud();
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(width, height, false);
}

window.addEventListener("resize", resize, { passive: true });
window.addEventListener("contextmenu", (event) => event.preventDefault());

let lastTime = performance.now();
let hasRendered = false;

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - lastTime) / 1000, 0.25);
  lastTime = now;
  // a tela de morte usa o tempo real; o jogo usa passos curtos e a câmera lenta
  deathScreen.update(elapsed);
  const dt = pause.open ? 0 : Math.min(elapsed, CONFIG.maxDelta) * deathScreen.timeScale;

  if (input.consumeAimAssistPressed()) {
    const on = aim.toggleAssist();
    ui.showToast(on ? "Assist. Mira: ATIVADO (ser mais próximo)" : "Assist. Mira: DESATIVADO");
  }
  world.updateAround(player.x, player.z);
  world.respawnResources(now);
  updateWorldChunks(player.root.position, activeCities, sharedHouseMaterial);
  riding.update(dt, cameraRig.yaw);
  player.update(dt, input, world, cameraRig.yaw, aim);
  ui.setStealth(player.crouching);
  const isPlayerLit = torches.isPlayerLit(player, candle, fire);
  const timeOfDay = (dayNight.progress * 24) % 24;
  if (settlement.cityData) {
    updateWildernessSpawns(player.root.position, settlement.cityData, dayNight.isNight, monstersPool, dt);
  }
  npcs.update(dt, player.x, player.z, dayNight.isNight, isPlayerLit, timeOfDay);
  interactions.update(dt);
  combat.update(dt);
  updateMissionProgress(player.root, dt);
  updateWaypointBillboard(player.root.position, now);
  const canAim = !input.modalOpen && !player.knockedOut && !player.blocking;
  aim.prepare(player, weapons.currentWeapon, canAim);
  cameraRig.update(dt, player, input, aim.active, aim);
  aim.update(dt, player, weapons.currentWeapon, canAim);
  weapons.update(dt, cameraRig.yaw);
  director.update(dt, player);
  torches.update(dt, player);
  candle.update(dt, player.mounted ? player.mounted.speed : 0);
  houses.update(dt);
  fire.update(dt);
  horses.update(dt);
  music.update(elapsed);
  damageFx.update(dt);
  world.updateWind(dt);
  sleep.update(elapsed);
  drops.update(dt);
  minimap.churches = settlement.churches;
  minimap.update(dt, player, cameraRig.yaw, npcs, npcs.wanted);
  explosions.update(dt);
  effects.update(dt);
  world.updateVisibility(camera, player.x, player.z);
  const clock = dayNight.update(dt, player.x, player.z);
  renderer.render(scene, camera);
  ui.update(dt, clock, world.activeChunks.length, npcs.nearest, player.x, player.z);

  if (!hasRendered) {
    hasRendered = true;
    window.setTimeout(() => ui.hideLoading(), 160);
  }
}

requestAnimationFrame(frame);
