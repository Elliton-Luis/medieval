// ============================================================================
// Tela de Debug F3 (Estilo Minecraft com Estatísticas Completas de Engine)
// Monitora FPS, Memória, Polígonos (Triângulos), Draw Calls, Coordenadas,
// Entidades, Chunks, Cidades, Construções e Física do Mundo.
// Zero-GC: reutiliza nós DOM pré-alocados e atualiza a cada 80ms (~12 Hz).
// ============================================================================

export class DebugScreen {
  constructor(gameCtx) {
    this.ctx = gameCtx;
    this.active = false;
    this._el = null;
    this._colLeft = null;
    this._colRight = null;
    this._leftLines = [];
    this._rightLines = [];
    this._updateTimer = 0;

    // Histórico de FPS para cálculo de média, mín e máx
    this._fpsHistory = [];
    this._fpsCapacity = 30;
    this._avgFps = 60;
    this._minFps = 60;
    this._maxFps = 60;
    this._avgMs = 16.6;

    this._createDOM();
    this._bindEvents();
  }

  _createDOM() {
    let container = document.getElementById("debug-screen");
    if (!container) {
      container = document.createElement("div");
      container.id = "debug-screen";
      container.className = "debug-screen";
      container.hidden = true;
      document.body.appendChild(container);
    }
    this._el = container;
    this._el.innerHTML = "";

    const colL = document.createElement("div");
    colL.className = "debug-col debug-col-left";
    const colR = document.createElement("div");
    colR.className = "debug-col debug-col-right";

    this._el.appendChild(colL);
    this._el.appendChild(colR);

    this._colLeft = colL;
    this._colRight = colR;

    // Pré-aloca linhas DOM reutilizáveis para evitar criação de elementos no loop
    this._leftLines = [];
    this._rightLines = [];
    for (let i = 0; i < 14; i++) {
      const line = document.createElement("div");
      line.className = "debug-line";
      colL.appendChild(line);
      this._leftLines.push(line);
    }
    for (let i = 0; i < 14; i++) {
      const line = document.createElement("div");
      line.className = "debug-line";
      colR.appendChild(line);
      this._rightLines.push(line);
    }
  }

  _bindEvents() {
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "F3" || (e.shiftKey && e.code === "F3")) {
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
        }
      },
      true,
    );

    window.toggleDebugScreen = () => this.toggle();
    window.isDebugScreenActive = () => this.active;
    window.setDebugScreen = (val) => {
      this.active = Boolean(val);
      if (this._el) this._el.hidden = !this.active;
    };
  }

  toggle() {
    this.active = !this.active;
    if (this._el) this._el.hidden = !this.active;
    if (this.ctx.ui?.showToast) {
      this.ctx.ui.showToast(this.active ? "✦ Tela de Debug F3 ATIVADA" : "✦ Tela de Debug F3 DESATIVADA");
    }
    return this.active;
  }

  update(dt) {
    if (!this.active) return;

    // Calcula FPS suavizado
    const instantFps = dt > 0.0001 ? 1 / dt : 60;
    this._fpsHistory.push(instantFps);
    if (this._fpsHistory.length > this._fpsCapacity) {
      this._fpsHistory.shift();
    }

    this._updateTimer += dt;
    // Throttling da renderização de texto (80ms ~12 vezes por segundo) para Zero-GC e zero impacto no frame rate
    if (this._updateTimer < 0.08) return;
    this._updateTimer = 0;

    let sum = 0;
    let min = 9999;
    let max = 0;
    for (let i = 0; i < this._fpsHistory.length; i++) {
      const f = this._fpsHistory[i];
      sum += f;
      if (f < min) min = f;
      if (f > max) max = f;
    }
    this._avgFps = this._fpsHistory.length > 0 ? sum / this._fpsHistory.length : 60;
    this._minFps = min !== 9999 ? min : 60;
    this._maxFps = max;
    this._avgMs = this._avgFps > 0 ? 1000 / this._avgFps : 16.6;

    this._renderStats();
  }

  _renderStats() {
    const {
      renderer,
      player,
      cameraRig,
      world,
      npcs,
      settlement,
      activeCities,
      dayNight,
      torches,
      candle,
      horses,
      monstersPool,
      cultistsPool,
      weapons,
      WorldDecay,
    } = this.ctx;

    if (!player) return;

    // 1. Memória JS Heap
    let memHtml = "Mem: <span class=\"debug-cyan\">N/A</span>";
    if (performance && performance.memory) {
      const used = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(0);
      const total = (performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(0);
      const limit = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(0);
      const pct = Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100);
      const colorClass = pct > 80 ? "debug-alert" : pct > 60 ? "debug-warn" : "debug-good";
      memHtml = `Mem: <span class="${colorClass}">${used}MB</span> / ${total}MB (${pct}% de ${limit}MB)`;
    }

    // 2. Coordenadas e Chunks
    const px = player.x || 0;
    const py = player.root?.position?.y ?? 0;
    const pz = player.z || 0;
    const chunkSize = world?.chunkSize || 64;
    const chunkX = Math.floor(px / chunkSize);
    const chunkZ = Math.floor(pz / chunkSize);
    const activeChunksCount = world?.activeChunks?.length || 0;

    // 3. Direção da Câmera / Jogador
    const yaw = cameraRig?.yaw ?? 0;
    const pitch = cameraRig?.pitch ?? 0;
    const facing = this._getFacing(yaw);

    // 4. Altura do Terreno
    const groundY = world?.heightAt ? world.heightAt(px, pz) : py;
    const procY = world?._proceduralHeightAt ? world._proceduralHeightAt(px, pz) : groundY;
    const hasFloor = Math.abs(groundY - procY) > 0.05;

    // 5. Horário / Iluminação
    const progress = dayNight?.progress ?? 0.25;
    const hours = Math.floor((progress * 24 + 6) % 24);
    const mins = Math.floor((((progress * 24 + 6) % 24) % 1) * 60);
    const timeStr = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    const dayNightState = dayNight?.isNight ? "Noite" : "Dia";
    const daylightPct = Math.round((dayNight?.daylight ?? 1) * 100);
    const isPlayerLit = torches?.isPlayerLit ? torches.isPlayerLit(player, candle) : false;

    // 6. Status do Jogador
    const hp = Math.round(player.health ?? 100);
    const maxHp = Math.round(player.maxHealth ?? 100);
    const stamina = Math.round(player.stamina ?? 100);
    const gold = player.coins ?? 0;
    const wantedLvl = npcs?.wanted?.level ?? 0;

    // 7. FPS Classe de Cor
    const fpsClass = this._avgFps >= 55 ? "debug-good" : this._avgFps >= 30 ? "debug-warn" : "debug-alert";

    // Preenchimento da Coluna Esquerda
    this._leftLines[0].innerHTML = `Puris 3D RPG <span class="debug-highlight">v1.0.4</span> · Three.js r128 (WebGL2)`;
    this._leftLines[1].innerHTML = `FPS: <span class="${fpsClass}">${this._avgFps.toFixed(1)} fps</span> (${this._avgMs.toFixed(1)}ms) · min: ${this._minFps.toFixed(0)} / max: ${this._maxFps.toFixed(0)}`;
    this._leftLines[2].innerHTML = memHtml;
    this._leftLines[3].innerHTML = `XYZ: <span class="debug-cyan">${px.toFixed(3)}</span> / <span class="debug-cyan">${py.toFixed(3)}</span> / <span class="debug-cyan">${pz.toFixed(3)}</span>`;
    this._leftLines[4].innerHTML = `Chunk: [<span class="debug-highlight">${chunkX}, ${chunkZ}</span>] · ${activeChunksCount} chunks ativos (raio 2)`;
    this._leftLines[5].innerHTML = `Direção: <span class="debug-highlight">${facing.cardinal}</span> (Yaw: ${facing.deg}° / Pitch: ${(pitch * 180 / Math.PI).toFixed(1)}°)`;
    this._leftLines[6].innerHTML = `Chão Y: ${groundY.toFixed(2)}m (${hasFloor ? '<span class="debug-good">Piso OBB Construído</span>' : 'Terreno Natural'})`;
    this._leftLines[7].innerHTML = `Tempo: <span class="debug-highlight">${timeStr}</span> (${dayNightState} · Ciclo: ${(progress * 100).toFixed(1)}%)`;
    this._leftLines[8].innerHTML = `Luz Solar: ${daylightPct}% · Jogador Iluminado: ${isPlayerLit ? '<span class="debug-good">Sim</span>' : '<span class="debug-warn">Escuro</span>'}`;
    this._leftLines[9].innerHTML = `Bioma: <span class="debug-cyan">Reino de Caldera</span> · Decaimento: ${(WorldDecay?.evilLevel ?? 0).toFixed(1)}%`;
    this._leftLines[10].innerHTML = `Jogador: HP <span class="debug-good">${hp}/${maxHp}</span> · Stamina: <span class="debug-cyan">${stamina}/100</span> · Ouro: <span class="debug-highlight">${gold}</span>`;
    this._leftLines[11].innerHTML = `Alerta / Procurado: ${wantedLvl > 0 ? `<span class="debug-alert">Nível ${wantedLvl}</span>` : '<span class="debug-good">Tranquilo (0)</span>'}`;
    this._leftLines[12].innerHTML = `Postura: ${player.mounted ? '<span class="debug-highlight">Montado a Cavalo</span>' : player.crouching ? '<span class="debug-purple">Furtivo (Agachado)</span>' : 'A Pé'}`;
    this._leftLines[13].innerHTML = `<small style="color:#aaa;">[F3] Alternar Debug · [F8] Exportar Log de Telemetria</small>`;

    // 8. Estatísticas de Renderização da GPU
    const info = renderer?.info;
    const calls = info?.render?.calls ?? 0;
    const triangles = info?.render?.triangles ?? 0;
    const geometries = info?.memory?.geometries ?? 0;
    const textures = info?.memory?.textures ?? 0;
    const canvasW = renderer?.domElement?.width ?? window.innerWidth;
    const canvasH = renderer?.domElement?.height ?? window.innerHeight;

    // 9. Contagem de Entidades
    let aliveNpcs = 0;
    let citizens = 0;
    let guards = 0;
    let beggars = 0;
    let otherNpc = 0;
    if (npcs?.npcs) {
      for (let i = 0; i < npcs.npcs.length; i++) {
        const n = npcs.npcs[i];
        if (n && n.alive) {
          aliveNpcs++;
          if (n.type === "guard" || n.roleKey === "footman" || n.roleKey === "knight") guards++;
          else if (n.type === "beggar" || n.roleKey === "beggar") beggars++;
          else if (n.type === "villager" || n.roleKey === "farmer" || n.roleKey === "blacksmith") citizens++;
          else otherNpc++;
        }
      }
    }

    let activeMonsters = 0;
    if (monstersPool) {
      for (let i = 0; i < monstersPool.length; i++) {
        const m = monstersPool[i];
        if (m && m.alive && m.root?.visible) activeMonsters++;
      }
    }

    let activeCultists = 0;
    if (cultistsPool) {
      for (let i = 0; i < cultistsPool.length; i++) {
        const c = cultistsPool[i];
        if (c && c.alive && c.root?.visible) activeCultists++;
      }
    }

    const totalHorses = horses?.horses?.length ?? 0;
    let mountedHorses = 0;
    if (horses?.horses) {
      for (let i = 0; i < horses.horses.length; i++) {
        if (horses.horses[i]?.rider) mountedHorses++;
      }
    }
    const totalSimulatedEntities = aliveNpcs + activeMonsters + activeCultists + totalHorses + 1;

    // 10. Cidades e Casas
    let totalCities = 0;
    let totalHouses = 0;
    let nearestCityDist = Infinity;
    let nearestCityName = "Ermos";
    if (activeCities) {
      for (const city of activeCities.values()) {
        if (!city) continue;
        totalCities++;
        if (city.houses) totalHouses += city.houses.length;
        if (city.center) {
          const d = Math.hypot(city.center.x - px, city.center.z - pz);
          if (d < nearestCityDist) {
            nearestCityDist = d;
            nearestCityName = city.name || "Vila Próxima";
          }
        }
      }
    }

    // 11. Obras e Colisores
    let playerBuildingsCount = 0;
    if (weapons?.playerBuildingsPool) {
      for (let i = 0; i < weapons.playerBuildingsPool.length; i++) {
        if (weapons.playerBuildingsPool[i]?.visible) playerBuildingsCount++;
      }
    }
    const placedItemsCount = weapons?.placedItems?.length ?? 0;
    const boxCollidersCount = world?.boxColliders?.length ?? 0;
    const floorsCount = world?.floors?.length ?? 0;
    const activeTorchesCount = torches?.torches?.length ?? 0;
    const curWeaponName = weapons?.currentWeapon?.name ?? "Desarmado";

    const farDist = camera?.far ? camera.far.toFixed(0) : "105";
    // Preenchimento da Coluna Direita
    this._rightLines[0].innerHTML = `Tela: <span class="debug-highlight">${canvasW}x${canvasH}</span> (WebGL2 · Far: <span class="debug-cyan">${farDist}m</span> · Culling Neblina)`;
    this._rightLines[1].innerHTML = `Draw Calls: <span class="debug-good">${calls}</span> · Polígonos: <span class="debug-cyan">${triangles.toLocaleString()}</span>`;
    this._rightLines[2].innerHTML = `Geometrias GPU: <span class="debug-highlight">${geometries}</span> · Texturas: <span class="debug-highlight">${textures}</span>`;
    this._rightLines[3].innerHTML = `Entidades no Mundo: <span class="debug-cyan">${totalSimulatedEntities}</span> simuladas`;
    this._rightLines[4].innerHTML = `NPCs Vivos: <span class="debug-good">${aliveNpcs}</span> (Aldeões: ${citizens}, Guardas: ${guards}, Mendigos: ${beggars})`;
    this._rightLines[5].innerHTML = `Inimigos / Ermos: <span class="debug-alert">${activeMonsters + activeCultists}</span> (Seita: ${activeCultists}, Bestas: ${activeMonsters})`;
    this._rightLines[6].innerHTML = `Cavalos: <span class="debug-highlight">${totalHorses}</span> (${mountedHorses} com cavaleiro)`;
    this._rightLines[7].innerHTML = `Casas no Mundo: <span class="debug-cyan">${totalHouses}</span> em <span class="debug-highlight">${totalCities}</span> vilas/cidades`;
    this._rightLines[8].innerHTML = `Cidade Mais Próxima: <span class="debug-highlight">${nearestCityName}</span> (${nearestCityDist < 1000 ? Math.round(nearestCityDist) + "m" : "distante"})`;
    this._rightLines[9].innerHTML = `Construções Jogador: <span class="debug-good">${playerBuildingsCount}</span> erguidas (+ ${placedItemsCount} itens fixados)`;
    this._rightLines[10].innerHTML = `Física & Colisão: <span class="debug-highlight">${boxCollidersCount}</span> OBBs · <span class="debug-highlight">${floorsCount}</span> pisos`;
    this._rightLines[11].innerHTML = `Tochas no Cenário: <span class="debug-highlight">${activeTorchesCount}</span> tochas dinâmicas`;
    this._rightLines[12].innerHTML = `Arma Ativa: <span class="debug-good">${curWeaponName}</span>`;
    this._rightLines[13].innerHTML = `<small style="color:#aaa;">Pressione [F3] para fechar</small>`;
  }

  _getFacing(yaw) {
    let deg = ((yaw * 180) / Math.PI) % 360;
    if (deg < -180) deg += 360;
    if (deg > 180) deg -= 360;

    let cardinal = "Norte (-Z)";
    if (deg >= -45 && deg <= 45) {
      cardinal = "Norte (-Z)";
    } else if (deg > 45 && deg < 135) {
      cardinal = "Oeste (-X)";
    } else if (deg < -45 && deg > -135) {
      cardinal = "Leste (+X)";
    } else {
      cardinal = "Sul (+Z)";
    }
    return { deg: deg.toFixed(1), cardinal };
  }
}
