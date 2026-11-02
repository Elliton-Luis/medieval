// ============================================================================
// loadingScreen.js — Sistema de Telas de Carregamento Assíncrono Fora da Tela
// Elimina micro-travamentos (stutters) ao trocar de áreas, pular cutscenes
// ou gerar chunks pesados, utilizando pré-aquecimento de shaders na GPU
// (renderer.compile) e streaming de terreno fora da visão do jogador.
// ============================================================================

const LORE_TIPS = [
  "Tochas fixadas em postes e paredes iluminam o caminho e protegem contra o pavor da escuridão.",
  "Pressione [F3] a qualquer momento para abrir o painel completo de telemetria, chunks e entidades.",
  "Conserte e badale o Sino de Bronze da Igreja de Caldera para conter a corrupção do mundo.",
  "Durante o Eclipse Solar, o spawn de feras e criaturas dos ermos é estritamente dobrado.",
  "Ao cair da noite, lobos e criaturas sombrias rondam a névoa além dos limites seguros dos muros.",
  "Aperte [I] para consultar seu alforje, forjar ferramentas ou preparar provisões de cura.",
  "Mantenha distância de altares profanos ou destrua-os para purificar a terra da influência do Demiurgo.",
  "Use a Foice de Colheita (3) para ceifar feno nas plantações e recuar a degradação do reino.",
  "Casas com forjas externas abrigam ferreiros experientes capazes de forjar lâminas superiores.",
];

export class LoadingScreen {
  constructor(container = document.body) {
    this.container = container;
    this.el = null;
    this.titleEl = null;
    this.statusEl = null;
    this.barFillEl = null;
    this.percentEl = null;
    this.tipEl = null;
    this.active = false;
    this._initDOM();
  }

  _initDOM() {
    let el = document.getElementById("puris-loading-screen");
    if (!el) {
      el = document.createElement("div");
      el.id = "puris-loading-screen";
      el.className = "loading-screen hidden";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = `
        <div class="loading-content">
          <div class="loading-emblem">✦</div>
          <h2 class="loading-title" id="loading-title">PURIS · REINO DE CALDERA</h2>
          <p class="loading-status" id="loading-status">Sincronizando as terras...</p>
          <div class="loading-bar-wrap">
            <div class="loading-bar-fill" id="loading-bar-fill"></div>
          </div>
          <span class="loading-percent" id="loading-percent">0%</span>
          <div class="loading-tip" id="loading-tip"></div>
        </div>
      `;
      this.container.appendChild(el);
    }

    this.el = el;
    this.titleEl = el.querySelector("#loading-title");
    this.statusEl = el.querySelector("#loading-status");
    this.barFillEl = el.querySelector("#loading-bar-fill");
    this.percentEl = el.querySelector("#loading-percent");
    this.tipEl = el.querySelector("#loading-tip");
  }

  _randomTip() {
    const idx = Math.floor(Math.random() * LORE_TIPS.length);
    return `💡 Dica: ${LORE_TIPS[idx]}`;
  }

  /**
   * Exibe a tela de carregamento imediatamente com opacidade total.
   */
  show(title = "PURIS · REINO DE CALDERA", message = "Preparando as terras...") {
    if (this.titleEl) this.titleEl.textContent = title;
    if (this.statusEl) this.statusEl.textContent = message;
    if (this.tipEl) this.tipEl.textContent = this._randomTip();
    this.setProgress(0);

    this.el.classList.remove("hidden");
    this.el.setAttribute("aria-hidden", "false");
    this.active = true;
  }

  /**
   * Atualiza a barra de progresso visual (0 a 100).
   */
  setProgress(percent, message = null) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    if (this.barFillEl) {
      this.barFillEl.style.width = `${clamped}%`;
    }
    if (this.percentEl) {
      this.percentEl.textContent = `${clamped}%`;
    }
    if (message && this.statusEl) {
      this.statusEl.textContent = message;
    }
  }

  /**
   * Oculta a tela de loading com transição suave fade-out.
   */
  hide(callback = null) {
    this.setProgress(100);
    window.setTimeout(() => {
      if (this.el) {
        this.el.classList.add("hidden");
        this.el.setAttribute("aria-hidden", "true");
      }
      this.active = false;
      if (callback) callback();
    }, 280);
  }

  /**
   * Executa transição assíncrona fora da tela dividida em frames, eliminando engasgos visíveis:
   * 1. Exibe a tela de loading instantaneamente.
   * 2. Roda a ação principal (reposicionamento de entidades/câmera).
   * 3. Atualiza os chunks do mundo e malhas de colisão.
   * 4. Executa pré-aquecimento de shaders no renderer Three.js (renderer.compile).
   * 5. Faz fade-out suave ao concluir.
   */
  transition({
    title = "PURIS · REINO DE CALDERA",
    message = "Carregando área...",
    action = null,
    world = null,
    scene = null,
    camera = null,
    renderer = null,
    player = null,
    minDuration = 650,
    onComplete = null,
  }) {
    this.show(title, message);
    const startTime = performance.now();

    // Passo 1 (15%): Entrada e início
    requestAnimationFrame(() => {
      this.setProgress(15, "Posicionando entidades e cenário...");

      // Passo 2 (40%): Executa as ações de mundo e entidades
      setTimeout(() => {
        try {
          if (action) action();
        } catch (err) {
          console.warn("[LoadingScreen] Erro na ação da transição:", err);
        }
        this.setProgress(45, "Sincronizando chunks de terreno e muralhas...");

        // Passo 3 (70%): Atualiza chunks e visibilidade no ponto de destino
        setTimeout(() => {
          if (world && player) {
            try {
              if (world.updateChunks) world.updateChunks(player.x, player.z);
              if (world.updateVisibility && camera) world.updateVisibility(camera, player.x, player.z);
            } catch (err) {
              console.warn("[LoadingScreen] Erro no streaming de chunks:", err);
            }
          }
          this.setProgress(75, "Compilando iluminação e sombras na GPU...");

          // Passo 4 (95%): Pré-aquecimento da GPU (Zero-Stutter shader compile)
          setTimeout(() => {
            if (renderer && scene && camera) {
              try {
                renderer.compile(scene, camera);
              } catch (err) {
                console.warn("[LoadingScreen] Erro no compile de shaders:", err);
              }
            }
            this.setProgress(100, "Concluído!");

            // Passo 5: Aguarda tempo mínimo estético para evitar cortes abruptos
            const elapsed = performance.now() - startTime;
            const remaining = Math.max(80, minDuration - elapsed);

            setTimeout(() => {
              this.hide(onComplete);
            }, remaining);
          }, 60);
        }, 50);
      }, 50);
    });
  }
}
