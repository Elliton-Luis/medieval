import * as THREE from "three";
import { PlayerStats, syncPlayerStatsToPlayer } from "./rpg.js";

// ============================================================================
// Diário dos Demiurgos (Livro Oculto em Posição Aleatória por Save)
// ============================================================================

export const DEMIURGE_BOOK_SPOTS = [
  {
    id: 0,
    name: "Cemitério da Igreja",
    x: -16.8,
    z: -12.5,
    hint: "Vi sombras encapuzadas sussurrando entre as lápides frias do cemitério atrás da igreja de Caldera.",
  },
  {
    id: 1,
    name: "Beco da Taverna",
    x: 10.5,
    z: -17.5,
    hint: "Dizem que algo herético foi jogado atrás dos barris de vinho no beco da taverna da praça.",
  },
  {
    id: 2,
    name: "Alcova do Velho Poço",
    x: 2.2,
    z: -8.8,
    hint: "Na calada da noite vi um brilho carmesim pulsando na base de pedra do poço central da vila.",
  },
  {
    id: 3,
    name: "Entulho do Ferreiro",
    x: -21.0,
    z: 14.5,
    hint: "O ferreiro jurou que deixaram um livro negro sob os restos de escória atrás de sua forja.",
  },
  {
    id: 4,
    name: "Bancas do Mercado Antigo",
    x: -8.0,
    z: -23.5,
    hint: "Um viajante de capa escura esqueceu um tomo oculto sob os caixotes de especiarias do mercado velho.",
  },
  {
    id: 5,
    name: "Portão da Muralha Sul",
    x: 5.5,
    z: -38.0,
    hint: "Guardas encontraram marcas de cinzas e um códice sinistro nos esteios de madeira perto do grande portão da muralha.",
  },
];

let _currentSpotIndex = 0;
let _demiurgeBookGroup = null;
let _bookLight = null;
let _cachedScene = null;
let _cachedWorld = null;

export function getDemiurgeDiarySpotIndex() {
  return _currentSpotIndex;
}

export function getDemiurgeDiaryHint() {
  const spot = DEMIURGE_BOOK_SPOTS[_currentSpotIndex] || DEMIURGE_BOOK_SPOTS[0];
  return spot.hint;
}

export function initDemiurgeDiary({ scene, world, savedSpotIndex = null }) {
  _cachedScene = scene;
  _cachedWorld = world;

  if (savedSpotIndex !== null && savedSpotIndex !== undefined && typeof savedSpotIndex === "number" && savedSpotIndex >= 0 && savedSpotIndex < DEMIURGE_BOOK_SPOTS.length) {
    _currentSpotIndex = savedSpotIndex;
  } else {
    _currentSpotIndex = Math.floor(Math.random() * DEMIURGE_BOOK_SPOTS.length);
  }

  const spot = DEMIURGE_BOOK_SPOTS[_currentSpotIndex];

  if (_demiurgeBookGroup && _demiurgeBookGroup.parent) {
    _demiurgeBookGroup.parent.remove(_demiurgeBookGroup);
  }

  _demiurgeBookGroup = new THREE.Group();
  _demiurgeBookGroup.name = "DiarioDosDemiurgos";

  // Materiais do tomo profano
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x140e0c, roughness: 0.88, flatShading: true });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xb58b38, metalness: 0.75, roughness: 0.35, flatShading: true });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xd6c498, roughness: 0.95, flatShading: true });
  const eyeSealMat = new THREE.MeshBasicMaterial({ color: 0xff1500 });

  // Capa inferior e capa superior
  const coverBottom = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.48), leatherMat);
  coverBottom.position.set(0, 0.015, 0);
  coverBottom.castShadow = true;
  _demiurgeBookGroup.add(coverBottom);

  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.07, 0.45), paperMat);
  pages.position.set(0.01, 0.06, 0);
  _demiurgeBookGroup.add(pages);

  const coverTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.48), leatherMat);
  coverTop.position.set(0, 0.105, 0);
  coverTop.castShadow = true;
  _demiurgeBookGroup.add(coverTop);

  // Lombada reforçada de couro trabalhado
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.115, 0.48), leatherMat);
  spine.position.set(-0.175, 0.06, 0);
  _demiurgeBookGroup.add(spine);

  // Cantoneiras de bronze entalhado
  for (const cx of [-0.155, 0.155]) {
    for (const cz of [-0.215, 0.215]) {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.05), goldTrimMat);
      corner.position.set(cx, 0.106, cz);
      _demiurgeBookGroup.add(corner);
    }
  }

  // Olho Oculto do Demiurgo na capa frontal
  const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeSealMat);
  eyeGlow.position.set(0.02, 0.122, 0);
  eyeGlow.scale.set(1.2, 0.35, 0.85);
  _demiurgeBookGroup.add(eyeGlow);

  const eyePupil = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.028, 0.055), goldTrimMat);
  eyePupil.position.set(0.02, 0.126, 0);
  _demiurgeBookGroup.add(eyePupil);

  // Luz carmesim oculta que pulsa sobre o livro
  _bookLight = new THREE.PointLight(0xee2200, 1.4, 3.8, 2.0);
  _bookLight.position.set(0, 0.35, 0);
  _demiurgeBookGroup.add(_bookLight);

  // Posição no mundo
  const gy = world ? world.heightAt(spot.x, spot.z) : 0;
  _demiurgeBookGroup.position.set(spot.x, gy + 0.12, spot.z);
  _demiurgeBookGroup.rotation.y = 0.42;

  scene.add(_demiurgeBookGroup);
  return _demiurgeBookGroup;
}

export function updateDemiurgeDiary(dt, now = performance.now()) {
  if (!_bookLight) return;
  _bookLight.intensity = 1.2 + Math.sin(now * 0.0035) * 0.45;
}

export function checkDemiurgeDiaryNearby(playerPos) {
  if (!_demiurgeBookGroup) return false;
  const dx = (playerPos.x ?? 0) - _demiurgeBookGroup.position.x;
  const dz = (playerPos.z ?? 0) - _demiurgeBookGroup.position.z;
  return dx * dx + dz * dz < 2.3 * 2.3;
}

export function interactWithDemiurgeDiary(playerPos, ui, audio, input) {
  if (!checkDemiurgeDiaryNearby(playerPos)) return false;

  import("./decay.js").then(({ showDemiurgeModal, addEvil, triggerCultistMessenger }) => {
    showDemiurgeModal(
      `<p style="margin-bottom:12px;font-size:1.02em;line-height:1.6">«O mundo que tocais não é a obra do Pai Celestial, mas a forja imperfeita do Demiurgo cego. Cada rocha talhada, cada carne mortal que adoece e apodrece foi concebida para aprisionar a centelha do fogo eterno em grilhões de barro e dor.»</p>
      <p style="margin-bottom:12px;font-size:1.02em;line-height:1.6">«Quando a lua for tragada pelo sangue do Eclipse, os servos das sombras descerão dos ermos. Nenhuma muralha de pedra deterá a ruína daqueles que recusam a verdade: a matéria há de retornar ao pó, e o espírito acordará para o abismo primordial.»</p>
      <p style="color:#e88a38;font-size:0.92em;margin-top:14px;border-top:1px dashed #662211;padding-top:10px">✦ Ao folhear as páginas manchadas de cinzas, sentes a corrupção afagar tua alma. (+10% Maldade · +1 Carisma Oculto)</p>`,
      2,
      () => {
        // Ao fechar a leitura do diário, o Mensageiro do Demiurgo é invocado nas sombras
        triggerCultistMessenger();
      },
      input,
      "DIÁRIO DOS DEMIURGOS",
      "Códice Proibido dos Arcontes · Tomo Cátaro das Trevas"
    );
    addEvil(10, "Leu as escrituras blasfemas do Diário dos Demiurgos");
    PlayerStats.cha += 1;
    syncPlayerStatsToPlayer();
  });

  ui?.showToast?.("✦ Abriste o Diário dos Demiurgos! (+10% Maldade · +1 Carisma)");
  audio?.weaponSwing?.("chop", false);
  return true;
}
