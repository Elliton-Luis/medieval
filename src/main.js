import * as THREE from "three";
import { CONFIG } from "./config.js";
import { InputManager } from "./input.js";
import { World, SHADOW_RADIUS } from "./world.js";
import { Player } from "./player.js";
import { ThirdPersonCamera } from "./camera.js";
import { DayNightCycle } from "./daynight.js";
import { GameUI } from "./ui.js";
import { createSettlement } from "./settlement.js";
import { NPCSystem } from "./npc.js";
import { InteractionSystem } from "./interactions.js";
import { SpriteEffects } from "./effects.js";
import { CombatSystem } from "./combat.js";
import { WeaponSystem } from "./weapons.js";
import { AimSystem } from "./aim.js";
import { ExplosionSystem } from "./explosions.js";
import { GameAudio } from "./audio.js";
import { DropSystem } from "./drops.js";
import { Minimap } from "./minimap.js";
import { EnemyDirector } from "./enemies.js";
import { DeathScreen } from "./deathScreen.js";
import { TorchSystem, Candle, setupAtmosphere } from "./torches.js";
import { FireSystem } from "./fire.js";
import { HouseSystem } from "./houses.js";
import { SleepSystem } from "./sleep.js";
import { loadGame } from "./save.js";
import { HorseManager } from "./horses.js";
import { RidingSystem, dismountHorse } from "./riding.js";
import { MusicDirector, TRACK_CATALOG, getMusicCredits } from "./music.js";
import { PauseMenu } from "./pause.js";
import { DamageFx } from "./damagefx.js";
import { setMeleeEnv, clearTokens } from "./melee.js";
import { initDemiurgeDiary, updateDemiurgeDiary } from "./demiurgeBook.js";
import { BeastManager } from "./beasts.js";
import { spawnCrystalNodes, applyTorchColor } from "./crystals.js";
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
  updateFallingTrees,
  getEvilPercent,
  addEvil,
  addGood,
} from "./rpg.js";
import {
  initProceduralEnv,
  createSeededRandom,
  createSharedHouseMaterial,
  generateCity,
  updateWorldChunks,
  assignNpcAnchors,
  updateWildernessSpawns,
  createMonstersPool,
} from "./procedural.js";
import {
  createCultistCluesMeshes,
  spawnCultistClues,
  createCultistsPool,
  updateCultistsLifeCycle,
  CultState,
} from "./cult.js";
import {
  WorldDecay,
  triggerDailyDecayCycle,
  updateEclipseLightning,
  updateMessenger,
  triggerCultistMessenger,
  DemiurgeModalState,
  DemiurgeCataclysm,
  triggerDemiurgeCataclysm,
  updateDemiurgeCataclysm,
} from "./decay.js";
import {
  HolyEndingState,
  triggerDeusVultEnding,
  updateDeusVultEnding,
} from "./holyEnding.js";
import { initCheatMenu } from "./cheats.js";
import {
  initFixedGhostTowns,
  updateGhostTownAtmosphere,
  ActiveGhostTowns,
} from "./ghostTowns.js";
import {
  GameState,
  startIntroSequence,
  updateIntroSequence,
  endIntroSequence,
  createTallFigure,
} from "./intro.js";

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
// PCFSoft com mapa de sombra 512x512 para altíssimo desempenho em GPUs integradas
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = "world-canvas";
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Clique para capturar o mouse e controlar a câmera");
gameRoot.prepend(renderer.domElement);

const hemisphere = new THREE.HemisphereLight("#eaf0dd", "#5a5649", 1.3);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight("#ffe1ae", 1.5);
sun.position.set(35, 65, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512); // Otimizado: 512x512 reduz fillrate em 75%
const SHADOW_BOUNDS = 32; // Frustum culling ortográfico de 32m focado no jogador
sun.shadow.camera.left = -SHADOW_BOUNDS;
sun.shadow.camera.right = SHADOW_BOUNDS;
sun.shadow.camera.top = SHADOW_BOUNDS;
sun.shadow.camera.bottom = -SHADOW_BOUNDS;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(sun);
scene.add(sun.target);

const world = new World(scene);
const settlement = createSettlement(scene, world);
const player = new Player(scene, world);
const audio = new GameAudio();
const effects = new SpriteEffects(scene);
const npcs = new NPCSystem(scene, world, settlement, effects);
npcs.camera = camera;
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
weapons.torches = torches;
weapons.candle = candle;
const horses = new HorseManager({ scene, world, effects, npcs, audio, player });
horses.spawnHerd(30, 22, 3);
horses.spawnOwned(settlement.houses);
const riding = new RidingSystem({ player, world, input, ui, effects, audio, npcs, combat, cameraRig, horses });
weapons.horses = horses;
houses.riding = riding;
interactions.horses = horses;
interactions.hayBales = settlement.hay;
interactions.dayNight = dayNight;
initRPGSystem({ scene, world, npcs, drops, player, ui, effects, audio });
const music = new MusicDirector({ audio, world, player, npcs, dayNight, houses });
const pause = new PauseMenu({ container: gameRoot, canvas: renderer.domElement, audio, input, aim });
pause.onPlayIntro = () => {
  startIntroSequence({ scene, world, player, cameraRig, audio, input, settlement, ui, dayNight, music });
};
const damageFx = new DamageFx({ container: gameRoot, audio, player });
combat.damageFx = damageFx;
const sharedHouseMaterial = createSharedHouseMaterial();
const activeCities = new Map();
if (settlement.cityData) {
  activeCities.set("0_0", settlement.cityData);
}
initProceduralEnv({ scene, world, npcs, activeCities });
initFixedGhostTowns(scene, world);
initRPGSystem({ scene, world, npcs, drops, player, ui, effects, audio, damageFx, weapons, candle, horses, settlement, activeCities });
setMeleeEnv({ npcs, combat, effects });
const director = new EnemyDirector(scene, world, npcs, effects, explosions, audio);
director.combat = combat;
director.cameraRig = cameraRig;
const monstersPool = createMonstersPool(scene, world, npcs, effects, combat, 2);
const { skullsMesh, weaponsMesh } = createCultistCluesMeshes(scene);
if (settlement.cityData) {
  spawnCultistClues(skullsMesh, weaponsMesh, 88231, settlement.cityData.center, scene, world);
}
const cultistsPool = createCultistsPool(scene, world, effects, combat, 16);
for (let i = 0; i < cultistsPool.length; i++) {
  npcs.npcs.push(cultistsPool[i]);
}

// Inicializa Novas Criaturas (Gulurs, Necrons, Hexoculus & Polyphonias)
const beasts = new BeastManager({ scene, world, effects, combat, player, npcs, audio });
if (settlement.well) {
  beasts.spawnInitialBeasts(settlement.well);
}

// Inicializa Nós de Cristais Místicos no Terreno (Verde, Azul, Rosa, Vermelho, Branco, Roxo)
spawnCrystalNodes({ scene, world, cityCenter: settlement.well });
applyTorchColor(PlayerInventory.torchColor || "orange", weapons);
npcs.onWantedChange = (level) => ui.setWanted(level);
npcs.onAlert = (message) => ui.showToast(message);

// Inicializa Sistema de Cheats (window.CheatMenu e tecla POTATO) com todos os subsistemas
initCheatMenu({
  scene,
  world,
  player,
  npcs,
  ui,
  audio,
  effects,
  weapons,
  combat,
  renderer,
  dayNight,
  hemisphere,
  settlement,
  camera,
  cameraRig,
  deathScreen,
  monstersPool,
  cultistsPool,
  firePool: weapons.firePool,
});

dayNight.onNewDay = () => {
  triggerDailyDecayCycle(world, npcs.npcs, horses.horses, ui, scene, effects);
};

window.__game = { beasts, ActiveGhostTowns, getEvilPercent, addEvil, addGood, HolyEndingState, triggerDeusVultEnding, triggerCultistMessenger, TRACK_CATALOG, getMusicCredits, CultState, GameState, startIntroSequence, endIntroSequence, createTallFigure, WorldDecay, triggerDailyDecayCycle, triggerDemiurgeCataclysm, MissionState, ActiveMissions, spawnWaypointMarker, removeWaypointMarker, updateWaypointBillboard, generateDeliveryMission, generateDebtMission, generateHorseTheftMission, generateBountyMission, startMission, failActiveMission, notifyMissionFistHit, payDebtorMission, updateMissionProgress, activeCities, dismountHorse, updateWorldChunks, PlayerInventory, BUILD_COSTS, gatherResource, buildStructure, sellResourcesToNPC, createPlayerBuildingsPool, monstersPool, cultistsPool, createSeededRandom, createSharedHouseMaterial, generateCity, assignNpcAnchors, updateWildernessSpawns, PlayerStats, PlayerEquipment, NPC_TYPES, NPC_STATES, checkWitnesses, updateNPCRoutine, handleNPCDeath, interactWithChest, dropHayBait, handleWeaponAction, updateMusketReload, igniteTarget, takeDamage, buyUpgrade, interactWithPriest, interactWithBeggar, damageFx, music, pause, renderer, ui, minimap, interactions, horses, riding, dayNight, hemisphere, houses, sleep, torches, candle, fire, deathScreen, audio, director, drops, THREE, scene, camera, world, player, npcs, input, cameraRig, aim, combat, weapons, explosions, effects, settlement };
window.triggerCultistMessenger = () => triggerCultistMessenger(player, scene, world, true);

const saved = loadGame();
if (saved) {
  if (saved.stats) {
    PlayerStats.str = saved.stats.str ?? PlayerStats.str;
    PlayerStats.con = saved.stats.con ?? PlayerStats.con;
    PlayerStats.cha = saved.stats.cha ?? PlayerStats.cha;
    PlayerStats.spd = saved.stats.spd ?? PlayerStats.spd;
    PlayerStats.morality = saved.stats.morality ?? PlayerStats.morality;
    PlayerStats.lastMessengerTier = saved.stats.lastMessengerTier ?? 0;
    if (typeof saved.stats.sacrifices === "number") {
      CultState.syncLevel(saved.stats.sacrifices);
    }
    PlayerStats.hay = saved.stats.hay ?? PlayerStats.hay;
    PlayerInventory.hay = PlayerStats.hay;
    PlayerInventory.wood = saved.stats.wood ?? PlayerInventory.wood;
    PlayerInventory.stone = saved.stats.stone ?? PlayerInventory.stone;
    PlayerInventory.clay = saved.stats.clay ?? PlayerInventory.clay;
    PlayerInventory.torches = saved.stats.torches ?? PlayerInventory.torches;
    PlayerInventory.hasSword = saved.stats.hasSword ?? PlayerInventory.hasSword;
    PlayerInventory.hasDemiurgeDiary = Boolean(saved.stats.hasDemiurgeDiary || saved.hasDemiurgeDiary);
    PlayerInventory.discoveredBookPages = Array.isArray(saved.stats.discoveredBookPages) ? saved.stats.discoveredBookPages : [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 20];
    PlayerInventory.torchColor = saved.stats.torchColor || "orange";
    PlayerInventory.crystals = saved.stats.crystals || { green: 0, blue: 0, pink: 0, red: 0, white: 0, purple: 0 };
    applyTorchColor(PlayerInventory.torchColor, weapons);
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

// Inicializa o Diário dos Demiurgos em posição aleatória persistida no save
initDemiurgeDiary({
  scene,
  world,
  savedSpotIndex: saved?.demiurgeBookSpotIndex,
  isCollected: PlayerInventory.hasDemiurgeDiary,
});

const shouldPlayIntro = !saved || new URLSearchParams(location.search).has("intro");
if (shouldPlayIntro) {
  startIntroSequence({ scene, world, player, cameraRig, audio, input, settlement, ui, dayNight, music });
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
  const isReading = Boolean(ui.dialoguePanel && !ui.dialoguePanel.hidden);
  const isBuildMenu = Boolean(weapons.buildHubOpen || (ui.buildPanel && !ui.buildPanel.hidden));
  const isDemiurge = Boolean(DemiurgeModalState.isOpen);
  const isPaused = pause.open || isDemiurge || isReading || isBuildMenu;
  const dt = isPaused ? 0 : Math.min(elapsed, CONFIG.maxDelta) * deathScreen.timeScale;

  const isCutscene = Boolean(GameState.isIntroPlaying || DemiurgeCataclysm.active || HolyEndingState.active);

  if (GameState.isIntroPlaying) {
    updateIntroSequence(dt, player, camera, world, audio, effects, ui);
    world.updateAround(player.x, player.z);
    effects.update(dt);
    world.updateVisibility(camera, player.x, player.z, true);
    dayNight.update(dt, player.x, player.z);
    renderer.render(scene, camera);
    if (!hasRendered) {
      hasRendered = true;
      window.setTimeout(() => ui.hideLoading(), 160);
    }
    return;
  }

  if (input.consumeAimAssistPressed()) {
    const on = aim.toggleAssist();
    ui.showToast(on ? "Assist. Mira: ATIVADO (ser mais próximo)" : "Assist. Mira: DESATIVADO");
  }
  world.updateAround(player.x, player.z);
  world.respawnResources(now);
  updateWorldChunks(player.root.position, activeCities, sharedHouseMaterial);
  updateGhostTownAtmosphere(player.root.position, ui, dt);
  riding.update(dt, cameraRig.yaw);
  player.update(dt, input, world, cameraRig.yaw, aim);
  ui.setStealth(player.crouching);
  const isPlayerLit = torches.isPlayerLit(player, candle, fire);
  const timeOfDay = (dayNight.progress * 24) % 24;
  if (settlement.cityData) {
    updateWildernessSpawns(player.root.position, settlement.cityData, dayNight.isNight, monstersPool, dt);
    updateCultistsLifeCycle(cultistsPool, player, npcs.npcs, weapons.firePool, dt, dayNight.isNight, settlement.cityData);
  }
  updateEclipseLightning(player.root.position, dt, effects, audio, damageFx, combat, npcs, player);
  updateDemiurgeCataclysm(dt, { scene, camera, player, effects, audio, ui, world, npcs, dayNight, deathScreen, cameraRig });
  updateDeusVultEnding(dt, { scene, renderer, hemisphere, dayNight, ui, audio, cameraRig, player, effects, camera });
  updateMessenger(dt, player, effects, ui, audio, world, input);
  npcs.update(dt, player.x, player.z, dayNight.isNight, isPlayerLit, timeOfDay, isCutscene);
  interactions.update(dt);
  combat.update(dt);
  updateMissionProgress(player.root, dt);
  updateWaypointBillboard(player.root.position, now);
  updateFallingTrees(dt);
  ui.updateMissionHud(player.root.position);
  const clock = dayNight.update(dt, player.x, player.z);
  const canAim = !input.modalOpen && !player.knockedOut && !player.blocking;
  aim.prepare(player, weapons.currentWeapon, canAim);
  cameraRig.update(dt, player, input, aim.active, aim);
  aim.update(dt, player, weapons.currentWeapon, canAim);
  weapons.update(dt, cameraRig.yaw);
  director.update(dt, player);
  torches.update(dt, player);
  candle.update(dt, player.mounted ? player.mounted.speed : 0);
  houses.update(dt, camera, isCutscene);
  fire.update(dt);
  horses.update(dt);
  const isNightStrict = Boolean(dayNight.isNight && dayNight.daylight < 0.45);
  beasts.update(dt, isNightStrict);
  music.update(elapsed);
  damageFx.update(dt);
  world.updateWind(dt);
  sleep.update(elapsed);
  drops.update(dt);
  updateDemiurgeDiary(dt, now);
  minimap.churches = settlement.churches;
  minimap.update(dt, player, cameraRig.yaw, npcs, npcs.wanted);
  explosions.update(dt);
  effects.update(dt);
  world.updateVisibility(camera, player.x, player.z, isCutscene);
  renderer.render(scene, camera);
  ui.update(dt, clock, world.activeChunks.length, npcs.nearest, player.x, player.z);

  if (!hasRendered) {
    hasRendered = true;
    window.setTimeout(() => ui.hideLoading(), 160);
  }
}

requestAnimationFrame(frame);
