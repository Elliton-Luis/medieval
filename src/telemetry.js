// ============================================================================
// Profiler & Telemetria em Tempo Real (Zero-GC) para Three.js
// Monitora Frame Time, CPU por Subsistema, Draw Calls, Triângulos e Heap.
// Buffer Circular de 2048 quadros sem alocação de strings no loop principal.
// Pressione F8 para exportar o relatório 'game_telemetry.log' estruturado para IA.
// ============================================================================

const BUFFER_CAPACITY = 2048;

class TelemetryProfiler {
  constructor() {
    this.enabled = true;
    this.bufferSize = BUFFER_CAPACITY;
    this._cursor = 0;
    this._totalSamples = 0;
    this._startTime = performance.now();

    // Buffers Circulares Tipados (Zero-GC: alocados uma única vez na inicialização)
    this._bufTime = new Float32Array(BUFFER_CAPACITY);        // Tempo em seg desde início
    this._bufTotal = new Float32Array(BUFFER_CAPACITY);       // Tempo total do quadro (ms)
    this._bufWorld = new Float32Array(BUFFER_CAPACITY);       // Chunks & Streaming (ms)
    this._bufPhysics = new Float32Array(BUFFER_CAPACITY);     // Movimento & Colisão (ms)
    this._bufAI = new Float32Array(BUFFER_CAPACITY);          // Rotinas de NPCs (ms)
    this._bufCombat = new Float32Array(BUFFER_CAPACITY);      // Combate & Monstros (ms)
    this._bufRender = new Float32Array(BUFFER_CAPACITY);      // Three.js renderer.render (ms)
    this._bufDrawCalls = new Uint16Array(BUFFER_CAPACITY);    // Chamadas de desenho
    this._bufTriangles = new Uint32Array(BUFFER_CAPACITY);    // Triângulos desenhados
    this._bufHeap = new Float32Array(BUFFER_CAPACITY);         // Heap JS em MB (quando disponível)

    // Timers temporários para medição intra-frame
    this._frameStartTime = 0;
    this._lastSubsystemTime = 0;
    this._currWorld = 0;
    this._currPhysics = 0;
    this._currAI = 0;
    this._currCombat = 0;
    this._currRender = 0;

    // Histórico de picos graves (> 33.3ms / queda abaixo de 30 FPS)
    this._severeSpikes = [];
    this._maxSpikesLogged = 100;

    this._bindHotkey();
  }

  _bindHotkey() {
    if (typeof window === "undefined") return;

    window.addEventListener("keydown", (e) => {
      if (e.code === "F8" || (e.ctrlKey && e.code === "F7")) {
        e.preventDefault();
        this.exportReport();
      }
    });

    window.downloadTelemetryLog = () => this.exportReport();
  }

  /**
   * Marca o início do frame.
   */
  beginFrame() {
    if (!this.enabled) return;
    const now = performance.now();
    this._frameStartTime = now;
    this._lastSubsystemTime = now;
    this._currWorld = 0;
    this._currPhysics = 0;
    this._currAI = 0;
    this._currCombat = 0;
    this._currRender = 0;
  }

  /**
   * Acumula o tempo gasto pelo subsistema informado desde a última marcação.
   * @param {'world'|'physics'|'ai'|'combat'|'render'} name
   */
  mark(name) {
    if (!this.enabled) return;
    const now = performance.now();
    const delta = now - this._lastSubsystemTime;
    this._lastSubsystemTime = now;

    switch (name) {
      case "world":   this._currWorld += delta; break;
      case "physics": this._currPhysics += delta; break;
      case "ai":      this._currAI += delta; break;
      case "combat":  this._currCombat += delta; break;
      case "render":  this._currRender += delta; break;
    }
  }

  /**
   * Finaliza o frame, captura métricas do WebGLRenderer e grava no buffer circular.
   * @param {THREE.WebGLRenderer} [renderer]
   */
  endFrame(renderer) {
    if (!this.enabled) return;
    const now = performance.now();
    const totalMs = now - this._frameStartTime;
    const idx = this._cursor;

    this._bufTime[idx] = (now - this._startTime) * 0.001;
    this._bufTotal[idx] = totalMs;
    this._bufWorld[idx] = this._currWorld;
    this._bufPhysics[idx] = this._currPhysics;
    this._bufAI[idx] = this._currAI;
    this._bufCombat[idx] = this._currCombat;
    this._bufRender[idx] = this._currRender;

    if (renderer && renderer.info && renderer.info.render) {
      this._bufDrawCalls[idx] = renderer.info.render.calls || 0;
      this._bufTriangles[idx] = renderer.info.render.triangles || 0;
    } else {
      this._bufDrawCalls[idx] = 0;
      this._bufTriangles[idx] = 0;
    }

    // performance.memory é cara (sincroniza com o heap): lê no máximo 2x por segundo e repete o último valor
    if (typeof performance !== "undefined" && performance.memory) {
      const nowMs = performance.now();
      if (nowMs - (this._lastHeapRead || 0) > 500) {
        this._lastHeapRead = nowMs;
        this._lastHeapMB = performance.memory.usedJSHeapSize / 1048576;
      }
      this._bufHeap[idx] = this._lastHeapMB || 0; // MB
    } else {
      this._bufHeap[idx] = 0;
    }

    // Registra picos severos (> 33.3ms) para auditoria detalhada de IA
    if (totalMs > 33.3 && this._severeSpikes.length < this._maxSpikesLogged) {
      this._severeSpikes.push({
        frame: this._totalSamples,
        timestampSec: Number(this._bufTime[idx].toFixed(2)),
        totalMs: Number(totalMs.toFixed(2)),
        fpsEquivalent: Number((1000 / totalMs).toFixed(1)),
        breakdownMs: {
          worldStreaming: Number(this._currWorld.toFixed(2)),
          physicsMovement: Number(this._currPhysics.toFixed(2)),
          aiRoutines: Number(this._currAI.toFixed(2)),
          combatMonsters: Number(this._currCombat.toFixed(2)),
          gpuRender: Number(this._currRender.toFixed(2)),
          other: Number(Math.max(0, totalMs - (this._currWorld + this._currPhysics + this._currAI + this._currCombat + this._currRender)).toFixed(2)),
        },
        drawCalls: this._bufDrawCalls[idx],
        triangles: this._bufTriangles[idx],
        heapMb: Number(this._bufHeap[idx].toFixed(1)),
      });
    }

    this._cursor = (this._cursor + 1) % BUFFER_CAPACITY;
    this._totalSamples++;
  }

  /**
   * Consolida a telemetria gravada e dispara o download do log para auditoria de IA.
   */
  exportReport() {
    const samplesCount = Math.min(this._totalSamples, BUFFER_CAPACITY);
    if (samplesCount === 0) {
      console.warn("[Telemetry] Nenhum dado coletado para exportar.");
      return;
    }

    const totals = [];
    let sumTotal = 0;
    let sumDrawCalls = 0;
    let sumTriangles = 0;
    let maxTotal = 0;
    let spikes16 = 0; // Quadros > 16.6ms (< 60 FPS)
    let spikes33 = 0; // Quadros > 33.3ms (< 30 FPS)
    let spikes66 = 0; // Quadros > 66.6ms (< 15 FPS)

    for (let i = 0; i < samplesCount; i++) {
      const ms = this._bufTotal[i];
      totals.push(ms);
      sumTotal += ms;
      sumDrawCalls += this._bufDrawCalls[i];
      sumTriangles += this._bufTriangles[i];
      if (ms > maxTotal) maxTotal = ms;
      if (ms > 16.66) spikes16++;
      if (ms > 33.33) spikes33++;
      if (ms > 66.66) spikes66++;
    }

    totals.sort((a, b) => a - b);
    const avgMs = sumTotal / samplesCount;
    const avgFps = 1000 / Math.max(0.1, avgMs);
    const p50 = totals[Math.floor(samplesCount * 0.50)];
    const p95 = totals[Math.floor(samplesCount * 0.95)];
    const p99 = totals[Math.floor(samplesCount * 0.99)];

    // Coleta as 150 amostras mais recentes em ordem cronológica
    const recentWindow = Math.min(samplesCount, 150);
    const recentTimeline = [];
    const startIdx = (this._cursor - recentWindow + BUFFER_CAPACITY) % BUFFER_CAPACITY;

    for (let i = 0; i < recentWindow; i++) {
      const idx = (startIdx + i) % BUFFER_CAPACITY;
      recentTimeline.push({
        tSec: Number(this._bufTime[idx].toFixed(2)),
        totalMs: Number(this._bufTotal[idx].toFixed(2)),
        world: Number(this._bufWorld[idx].toFixed(2)),
        physics: Number(this._bufPhysics[idx].toFixed(2)),
        ai: Number(this._bufAI[idx].toFixed(2)),
        combat: Number(this._bufCombat[idx].toFixed(2)),
        render: Number(this._bufRender[idx].toFixed(2)),
        dc: this._bufDrawCalls[idx],
        tris: this._bufTriangles[idx],
        heapMb: Number(this._bufHeap[idx].toFixed(1)),
      });
    }

    const report = {
      meta: {
        title: "rex-mundi (Caldera) — Telemetria de Performance para IA",
        generatedAt: new Date().toISOString(),
        totalRecordedFrames: this._totalSamples,
        bufferSamplesAnalyzed: samplesCount,
        sessionDurationSeconds: Number(((performance.now() - this._startTime) / 1000).toFixed(1)),
        hardware: {
          userAgent: navigator.userAgent,
          pixelRatio: window.devicePixelRatio || 1,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          hardwareConcurrency: navigator.hardwareConcurrency || "N/A",
        },
      },
      summary: {
        avgFps: Number(avgFps.toFixed(1)),
        avgFrameMs: Number(avgMs.toFixed(2)),
        p50FrameMs: Number(p50.toFixed(2)),
        p95FrameMs: Number(p95.toFixed(2)),
        p99FrameMs: Number(p99.toFixed(2)),
        maxFrameMs: Number(maxTotal.toFixed(2)),
        stutters: {
          over16msRatio: `${((spikes16 / samplesCount) * 100).toFixed(1)}% (${spikes16} frames)`,
          over33msRatio: `${((spikes33 / samplesCount) * 100).toFixed(1)}% (${spikes33} frames)`,
          over66msRatio: `${((spikes66 / samplesCount) * 100).toFixed(1)}% (${spikes66} frames)`,
        },
        gpuMetrics: {
          avgDrawCalls: Math.round(sumDrawCalls / samplesCount),
          avgTriangles: Math.round(sumTriangles / samplesCount),
        },
        memoryHeapMb: {
          current: Number(this._bufHeap[(this._cursor - 1 + BUFFER_CAPACITY) % BUFFER_CAPACITY].toFixed(1)),
        },
      },
      topSevereSpikes: this._severeSpikes.slice(-20),
      recentChronologicalSamples: recentTimeline,
    };

    const jsonText = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `game_telemetry_${Date.now()}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(
      `%c[Telemetry] Relatório exportado com sucesso! Média: ${avgFps.toFixed(1)} FPS | P99: ${p99.toFixed(1)}ms | Picos > 33ms: ${spikes33}`,
      "color: #10b981; font-weight: bold; font-size: 13px;"
    );
  }
}

export const telemetry = new TelemetryProfiler();
